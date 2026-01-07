/**
 * DocCov Sandbox API - Vercel Functions requiring @vercel/sandbox
 *
 * Endpoints:
 * - POST /plan - Generate AI build plan
 * - POST /execute - Execute build plan
 * - POST /execute-stream - Execute with SSE streaming
 * - POST /diff - Compare specs from GitHub refs
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import type {
  BuildPlan,
  BuildPlanEnvironment,
  BuildPlanExecutionResult,
  BuildPlanStep,
  BuildPlanStepResult,
  BuildPlanTarget,
  GitHubProjectContext,
} from '@doccov/sdk';
import {
  buildDocCovSpec,
  fetchGitHubContext,
  getExportDrift,
  parseScanGitHubUrl,
} from '@doccov/sdk';
import type { DocCovSpec } from '@doccov/spec';
import type { OpenPkg } from '@openpkg-ts/spec';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Sandbox } from '@vercel/sandbox';
import { generateObject } from 'ai';
import ms from 'ms';
import { z } from 'zod';

export const config = {
  runtime: 'nodejs',
  maxDuration: 300,
};

// =============================================================================
// Types & Helpers
// =============================================================================

function cors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Internal-Token');
}

function json(res: VercelResponse, data: unknown, status = 200): void {
  res.status(status).json(data);
}

function getSandboxRuntime(_runtime: string): 'node22' {
  return 'node22';
}

const LOCAL_BINARIES = new Set([
  'turbo',
  'tsc',
  'tsup',
  'esbuild',
  'vite',
  'rollup',
  'webpack',
  'parcel',
  'swc',
  'bunchee',
  'unbuild',
  'microbundle',
  'preconstruct',
  'changesets',
  'eslint',
  'prettier',
  'vitest',
  'jest',
  'mocha',
  'ava',
  'c8',
  'nyc',
  'size-limit',
  'publint',
  'attw',
  'are-the-types-wrong',
  'lerna',
  'nx',
]);

function wrapLocalBinary(
  cmd: string,
  args: string[],
  packageManager: string,
): { cmd: string; args: string[] } {
  if (LOCAL_BINARIES.has(cmd)) {
    switch (packageManager) {
      case 'pnpm':
        return { cmd: 'pnpm', args: ['exec', cmd, ...args] };
      case 'yarn':
        return { cmd: 'yarn', args: [cmd, ...args] };
      case 'bun':
        return { cmd: 'bunx', args: [cmd, ...args] };
      default:
        return { cmd: 'npx', args: [cmd, ...args] };
    }
  }
  return { cmd, args };
}

function normalizeCwd(cwd: string | undefined): string | undefined {
  if (!cwd || cwd === '.' || cwd === './') return undefined;
  if (cwd.startsWith('/')) return cwd;
  return `/vercel/sandbox/${cwd}`;
}

interface SpecSummary {
  name: string;
  version: string;
  coverage: number;
  exports: number;
  types: number;
  documented: number;
  undocumented: number;
  driftCount: number;
  topUndocumented: string[];
  topDrift: Array<{ name: string; issue: string }>;
}

function createSpecSummary(spec: OpenPkg, doccov: DocCovSpec): SpecSummary {
  const totalExports = spec.exports?.length ?? 0;
  const types = spec.types?.length ?? 0;
  const coverageScore = doccov.summary.score;
  const documented = doccov.summary.documentedExports;
  const undocumented = totalExports - documented;

  const driftItems: Array<{ name: string; issue: string }> = [];
  const undocumentedNames: string[] = [];

  for (const exp of spec.exports ?? []) {
    if (!exp.description || exp.description.trim().length === 0) {
      undocumentedNames.push(exp.name);
    }
    for (const drift of getExportDrift(exp, doccov)) {
      driftItems.push({
        name: exp.name,
        issue: drift.issue ?? 'Documentation drift detected',
      });
    }
  }

  return {
    name: spec.meta?.name ?? 'unknown',
    version: spec.meta?.version ?? '0.0.0',
    coverage: coverageScore,
    exports: totalExports,
    types,
    documented,
    undocumented,
    driftCount: driftItems.length,
    topUndocumented: undocumentedNames.slice(0, 5),
    topDrift: driftItems.slice(0, 5),
  };
}

// =============================================================================
// Plan Agent (AI-powered build plan generation)
// =============================================================================

const BuildPlanStepSchema = z.object({
  id: z.string().describe('Unique identifier'),
  name: z.string().describe('Human-readable step name'),
  command: z.string().describe('Command to execute'),
  args: z.array(z.string()).describe('Command arguments'),
  cwd: z.string().optional().describe('Working directory'),
  timeout: z.number().optional().describe('Timeout in ms'),
  optional: z.boolean().optional().describe('If true, failure does not stop execution'),
});

const BuildPlanEnvironmentSchema = z.object({
  runtime: z.literal('node22').describe('Runtime (always node22)'),
  packageManager: z.enum(['npm', 'yarn', 'pnpm', 'bun']).describe('Package manager'),
  requiredTools: z.array(z.string()).optional().describe('Additional tools'),
});

const BuildPlanReasoningSchema = z.object({
  summary: z.string().describe('Brief summary'),
  rationale: z.string().describe('Why this approach'),
  concerns: z.array(z.string()).describe('Potential issues'),
});

const AIBuildPlanSchema = z.object({
  environment: BuildPlanEnvironmentSchema,
  steps: z.array(BuildPlanStepSchema).describe('Steps to execute'),
  entryPoints: z.array(z.string()).describe('Entry point files'),
  reasoning: BuildPlanReasoningSchema,
  confidence: z.enum(['high', 'medium', 'low']).describe('Confidence level'),
});

type AIBuildPlanOutput = z.infer<typeof AIBuildPlanSchema>;

interface GenerateBuildPlanOptions {
  targetPackage?: string;
}

function formatContext(context: GitHubProjectContext): string {
  const sections: string[] = [];

  sections.push(`=== Repository ===
Owner: ${context.metadata.owner}
Repo: ${context.metadata.repo}
Language: ${context.metadata.language ?? 'unknown'}
Topics: ${context.metadata.topics.join(', ') || 'none'}
Description: ${context.metadata.description ?? 'none'}`);

  sections.push(`=== Environment ===
Package Manager: ${context.packageManager}
Is Monorepo: ${context.workspace.isMonorepo}
Workspace Tool: ${context.workspace.tool ?? 'none'}
Workspace Packages: ${context.workspace.packages?.join(', ') ?? 'none'}`);

  sections.push(`=== Build Hints ===
Has TypeScript: ${context.buildHints.hasTypeScript}
Has WASM: ${context.buildHints.hasWasm}
Has Native Modules: ${context.buildHints.hasNativeModules}
Has Build Script: ${context.buildHints.hasBuildScript}
Build Script: ${context.buildHints.buildScript ?? 'none'}
Frameworks: ${context.buildHints.frameworks.join(', ') || 'none'}`);

  if (context.files.packageJson) {
    const truncated =
      context.files.packageJson.length > 3000
        ? `${context.files.packageJson.slice(0, 3000)}\n... (truncated)`
        : context.files.packageJson;
    sections.push(`=== package.json ===\n${truncated}`);
  }

  if (context.files.tsconfigJson) {
    sections.push(`=== tsconfig.json ===\n${context.files.tsconfigJson}`);
  }

  if (context.files.lockfile) {
    const preview = context.files.lockfile.content.slice(0, 500);
    sections.push(`=== ${context.files.lockfile.name} (preview) ===\n${preview}\n...`);
  }

  return sections.join('\n\n');
}

const PLAN_SYSTEM_PROMPT = `You are a build system expert. Your task is to analyze a GitHub repository and generate a build plan to analyze its TypeScript/JavaScript API.

The goal is to:
1. Install dependencies
2. Build the project (if needed) to generate TypeScript declarations
3. Identify entry points for API documentation analysis

Package Manager Selection:
- If a lockfile is detected, use that package manager
- If Package Manager is "unknown", default to npm with "npm install"
- "npm ci" and "--frozen-lockfile" flags ONLY work when a lockfile exists

Monorepo Build Strategy:
When a target package is specified in a monorepo, ONLY build that package and its dependencies.

General Guidelines:
- For TypeScript projects, look for "types" or "exports" fields in package.json
- Common entry points: src/index.ts, dist/index.d.ts, lib/index.ts
- Be conservative with timeouts (default 60000ms, increase for builds)`;

function generatePlanPrompt(
  context: GitHubProjectContext,
  options: GenerateBuildPlanOptions,
): string {
  let prompt = `Analyze this repository and generate a build plan:\n\n${formatContext(context)}`;

  if (options.targetPackage) {
    prompt += `\n\nTarget Package: ${options.targetPackage}
Focus the plan on building and analyzing only this package within the monorepo.`;
  }

  prompt += `\n\nGenerate a build plan with:
- environment: Runtime and package manager configuration
- steps: Ordered build steps (install, build, etc.)
- entryPoints: TypeScript entry files to analyze (relative paths)
- reasoning: Explain your approach
- confidence: How confident you are in this plan`;

  return prompt;
}

function transformToBuildPlan(
  output: AIBuildPlanOutput,
  context: GitHubProjectContext,
  options: GenerateBuildPlanOptions,
): BuildPlan {
  let rootPath: string | undefined;
  if (options.targetPackage && output.entryPoints.length > 0) {
    const firstEntry = output.entryPoints[0];
    const match = firstEntry.match(/^(packages\/[^/]+)\//);
    if (match) {
      rootPath = match[1];
    }
  }

  const target: BuildPlanTarget = {
    type: 'github',
    repoUrl: `https://github.com/${context.metadata.owner}/${context.metadata.repo}`,
    ref: context.ref,
    rootPath,
    entryPoints: output.entryPoints,
  };

  const environment: BuildPlanEnvironment = {
    runtime: output.environment.runtime,
    packageManager: output.environment.packageManager,
    requiredTools: output.environment.requiredTools,
  };

  const steps: BuildPlanStep[] = output.steps.map((step) => ({
    id: step.id,
    name: step.name,
    command: step.command,
    args: step.args,
    cwd: step.cwd,
    timeout: step.timeout,
    optional: step.optional,
  }));

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    target,
    environment,
    steps,
    reasoning: {
      summary: output.reasoning.summary,
      rationale: output.reasoning.rationale,
      concerns: output.reasoning.concerns,
    },
    confidence: output.confidence,
  };
}

async function generateBuildPlan(
  context: GitHubProjectContext,
  options: GenerateBuildPlanOptions = {},
): Promise<BuildPlan> {
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = anthropic('claude-sonnet-4-20250514');
  const prompt = generatePlanPrompt(context, options);

  const { object } = await generateObject({
    model,
    schema: AIBuildPlanSchema,
    system: PLAN_SYSTEM_PROMPT,
    prompt,
  });

  return transformToBuildPlan(object, context, options);
}

// =============================================================================
// Route Handlers
// =============================================================================

async function handleRoot(_req: VercelRequest, res: VercelResponse): Promise<void> {
  json(res, {
    name: 'DocCov Sandbox API',
    version: '0.5.0',
    status: 'ok',
    timestamp: new Date().toISOString(),
    endpoints: [
      { method: 'GET', path: '/', description: 'API info' },
      { method: 'POST', path: '/plan', description: 'Generate AI build plan' },
      { method: 'POST', path: '/execute', description: 'Execute build plan' },
      { method: 'POST', path: '/execute-stream', description: 'Execute with SSE' },
      { method: 'POST', path: '/diff', description: 'Compare specs from GitHub refs' },
    ],
  });
}

async function handlePlan(req: VercelRequest, res: VercelResponse): Promise<void> {
  const body = req.body as { url?: string; ref?: string; package?: string };

  if (!body.url) {
    json(res, { error: 'url is required' }, 400);
    return;
  }

  let repoUrl: string;
  try {
    const parsed = parseScanGitHubUrl(body.url);
    if (!parsed) {
      json(res, { error: 'Invalid GitHub URL' }, 400);
      return;
    }
    repoUrl = `https://github.com/${parsed.owner}/${parsed.repo}`;
  } catch {
    json(res, { error: 'Invalid GitHub URL' }, 400);
    return;
  }

  try {
    const context = await fetchGitHubContext(repoUrl, body.ref);

    if (context.metadata.isPrivate) {
      json(
        res,
        { error: 'Private repositories are not supported', hint: 'Use doccov locally' },
        403,
      );
      return;
    }

    const plan = await generateBuildPlan(context, { targetPackage: body.package });

    json(res, {
      plan,
      context: {
        owner: context.metadata.owner,
        repo: context.metadata.repo,
        ref: context.ref,
        packageManager: context.packageManager,
        isMonorepo: context.workspace.isMonorepo,
      },
    });
  } catch (error) {
    console.error('Plan generation error:', error);

    if (error instanceof Error) {
      if (error.message.includes('404') || error.message.includes('not found')) {
        json(res, { error: 'Repository not found' }, 404);
        return;
      }
      if (error.message.includes('rate limit')) {
        json(res, { error: 'GitHub API rate limit exceeded' }, 429);
        return;
      }
    }

    json(
      res,
      {
        error: 'Failed to generate build plan',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
}

async function handleExecute(req: VercelRequest, res: VercelResponse): Promise<void> {
  const includeSpec = req.query.includeSpec === 'true';
  const body = req.body as { plan?: BuildPlan };

  if (!body.plan) {
    json(res, { error: 'plan is required' }, 400);
    return;
  }

  const { plan } = body;

  if (!plan.target?.repoUrl || !plan.steps) {
    json(res, { error: 'Invalid plan structure' }, 400);
    return;
  }

  const startTime = Date.now();
  const stepResults: BuildPlanStepResult[] = [];
  let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | null = null;

  try {
    sandbox = await Sandbox.create({
      source: { url: plan.target.repoUrl, type: 'git' as const },
      resources: { vcpus: 4 },
      timeout: ms('5m'),
      runtime: getSandboxRuntime(plan.environment.runtime),
    });

    for (const step of plan.steps) {
      const stepStart = Date.now();

      try {
        const normalizedCwd = normalizeCwd(step.cwd);
        const { cmd, args } = wrapLocalBinary(
          step.command,
          step.args,
          plan.environment.packageManager,
        );
        const result = await sandbox.runCommand({
          cmd,
          args,
          ...(normalizedCwd ? { cwd: normalizedCwd } : {}),
        });

        const stdout = result.stdout ? await result.stdout() : '';
        const stderr = result.stderr ? await result.stderr() : '';

        stepResults.push({
          stepId: step.id,
          success: result.exitCode === 0,
          duration: Date.now() - stepStart,
          output: stdout.slice(0, 5000),
          error: result.exitCode !== 0 ? stderr.slice(0, 2000) : undefined,
        });

        if (result.exitCode !== 0 && !step.optional) {
          throw new Error(`Step '${step.name}' failed: ${stderr}`);
        }
      } catch (stepError) {
        stepResults.push({
          stepId: step.id,
          success: false,
          duration: Date.now() - stepStart,
          error: stepError instanceof Error ? stepError.message : 'Unknown error',
        });

        if (!step.optional) {
          throw stepError;
        }
      }
    }

    // Run doccov spec
    const specStart = Date.now();
    let entryPoint = plan.target.entryPoints[0] ?? 'src/index.ts';
    const analyzeCwd = normalizeCwd(plan.target.rootPath);

    if (plan.target.rootPath && entryPoint.startsWith(`${plan.target.rootPath}/`)) {
      entryPoint = entryPoint.slice(plan.target.rootPath.length + 1);
    }

    await sandbox.runCommand({ cmd: 'npm', args: ['install', '-g', '@doccov/cli@latest'] });

    const specResult = await sandbox.runCommand({
      cmd: 'doccov',
      args: ['spec', entryPoint, '--output', 'openpkg.json'],
      ...(analyzeCwd ? { cwd: analyzeCwd } : {}),
    });

    const specStdout = specResult.stdout ? await specResult.stdout() : '';
    const specStderr = specResult.stderr ? await specResult.stderr() : '';

    stepResults.push({
      stepId: 'analyze',
      success: specResult.exitCode === 0,
      duration: Date.now() - specStart,
      output: specStdout.slice(0, 2000),
      error: specResult.exitCode !== 0 ? specStderr.slice(0, 2000) : undefined,
    });

    if (specResult.exitCode !== 0) {
      throw new Error(`Spec generation failed: ${specStderr}`);
    }

    const specFilePath = plan.target.rootPath
      ? `${plan.target.rootPath}/openpkg.json`
      : 'openpkg.json';

    let spec: OpenPkg;
    try {
      const specStream = await sandbox.readFile({ path: specFilePath });
      const chunks: Buffer[] = [];
      for await (const chunk of specStream as AsyncIterable<Buffer>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const specContent = Buffer.concat(chunks).toString('utf-8');
      spec = JSON.parse(specContent) as OpenPkg;
    } catch (readError) {
      throw new Error(
        `Failed to read spec file (${specFilePath}): ${readError instanceof Error ? readError.message : 'Unknown error'}`,
      );
    }
    const doccov = await buildDocCovSpec({ openpkg: spec, openpkgPath: specFilePath });
    const summary = createSpecSummary(spec, doccov);

    const result = {
      success: true,
      summary,
      stepResults,
      totalDuration: Date.now() - startTime,
      ...(includeSpec ? { spec } : {}),
    };

    json(res, result);
  } catch (error) {
    console.error('Execution error:', error);

    const result: BuildPlanExecutionResult = {
      success: false,
      stepResults,
      totalDuration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    json(res, result);
  } finally {
    if (sandbox) {
      try {
        await sandbox.stop();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

async function handleExecuteStream(req: VercelRequest, res: VercelResponse): Promise<void> {
  const includeSpec = req.query.includeSpec === 'true';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const body = req.body as { plan?: BuildPlan };

  if (!body.plan) {
    send('error', { error: 'plan is required' });
    res.end();
    return;
  }

  const { plan } = body;

  if (!plan.target?.repoUrl || !plan.steps) {
    send('error', { error: 'Invalid plan structure' });
    res.end();
    return;
  }

  const startTime = Date.now();
  const stepResults: BuildPlanStepResult[] = [];
  let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | null = null;

  try {
    send('progress', { stage: 'init', message: 'Creating sandbox...', progress: 5 });

    sandbox = await Sandbox.create({
      source: { url: plan.target.repoUrl, type: 'git' as const },
      resources: { vcpus: 4 },
      timeout: ms('5m'),
      runtime: getSandboxRuntime(plan.environment.runtime),
    });

    send('progress', { stage: 'cloned', message: 'Repository cloned', progress: 15 });

    const totalSteps = plan.steps.length + 1;
    let completedSteps = 0;

    for (const step of plan.steps) {
      const stepStart = Date.now();
      const progressBase = 15 + (completedSteps / totalSteps) * 70;

      send('step:start', { stepId: step.id, name: step.name, progress: Math.round(progressBase) });

      try {
        const normalizedCwd = normalizeCwd(step.cwd);
        const { cmd, args } = wrapLocalBinary(
          step.command,
          step.args,
          plan.environment.packageManager,
        );
        const result = await sandbox.runCommand({
          cmd,
          args,
          ...(normalizedCwd ? { cwd: normalizedCwd } : {}),
        });

        const stdout = result.stdout ? await result.stdout() : '';
        const stderr = result.stderr ? await result.stderr() : '';

        const stepResult: BuildPlanStepResult = {
          stepId: step.id,
          success: result.exitCode === 0,
          duration: Date.now() - stepStart,
          output: stdout.slice(0, 5000),
          error: result.exitCode !== 0 ? stderr.slice(0, 2000) : undefined,
        };

        stepResults.push(stepResult);
        completedSteps++;

        send('step:complete', {
          ...stepResult,
          progress: Math.round(15 + (completedSteps / totalSteps) * 70),
        });

        if (result.exitCode !== 0 && !step.optional) {
          throw new Error(`Step '${step.name}' failed: ${stderr}`);
        }
      } catch (stepError) {
        const stepResult: BuildPlanStepResult = {
          stepId: step.id,
          success: false,
          duration: Date.now() - stepStart,
          error: stepError instanceof Error ? stepError.message : 'Unknown error',
        };

        stepResults.push(stepResult);
        send('step:error', stepResult);

        if (!step.optional) {
          throw stepError;
        }
      }
    }

    send('step:start', { stepId: 'analyze', name: 'Analyzing API', progress: 85 });
    const specStart = Date.now();
    let entryPoint = plan.target.entryPoints[0] ?? 'src/index.ts';
    const analyzeCwd = normalizeCwd(plan.target.rootPath);

    if (plan.target.rootPath && entryPoint.startsWith(`${plan.target.rootPath}/`)) {
      entryPoint = entryPoint.slice(plan.target.rootPath.length + 1);
    }

    await sandbox.runCommand({ cmd: 'npm', args: ['install', '-g', '@doccov/cli@latest'] });

    const specResult = await sandbox.runCommand({
      cmd: 'doccov',
      args: ['spec', entryPoint, '--output', 'openpkg.json'],
      ...(analyzeCwd ? { cwd: analyzeCwd } : {}),
    });

    const specStdout = specResult.stdout ? await specResult.stdout() : '';
    const specStderr = specResult.stderr ? await specResult.stderr() : '';

    stepResults.push({
      stepId: 'analyze',
      success: specResult.exitCode === 0,
      duration: Date.now() - specStart,
      output: specStdout.slice(0, 2000),
      error: specResult.exitCode !== 0 ? specStderr.slice(0, 2000) : undefined,
    });

    if (specResult.exitCode !== 0) {
      throw new Error(`Spec generation failed: ${specStderr}`);
    }

    send('step:complete', { stepId: 'analyze', success: true, progress: 95 });

    const specFilePath = plan.target.rootPath
      ? `${plan.target.rootPath}/openpkg.json`
      : 'openpkg.json';

    let spec: OpenPkg;
    try {
      const specStream = await sandbox.readFile({ path: specFilePath });
      const chunks: Buffer[] = [];
      for await (const chunk of specStream as AsyncIterable<Buffer>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const specContent = Buffer.concat(chunks).toString('utf-8');
      spec = JSON.parse(specContent) as OpenPkg;
    } catch (readError) {
      throw new Error(
        `Failed to read spec file (${specFilePath}): ${readError instanceof Error ? readError.message : 'Unknown error'}`,
      );
    }
    const doccov = await buildDocCovSpec({ openpkg: spec, openpkgPath: specFilePath });
    const summary = createSpecSummary(spec, doccov);

    const result = {
      success: true,
      summary,
      stepResults,
      totalDuration: Date.now() - startTime,
      ...(includeSpec ? { spec } : {}),
    };

    send('complete', result);
  } catch (error) {
    console.error('Execution error:', error);

    const result: BuildPlanExecutionResult = {
      success: false,
      stepResults,
      totalDuration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    send('error', result);
  } finally {
    if (sandbox) {
      try {
        await sandbox.stop();
      } catch {
        // Ignore cleanup errors
      }
    }
    res.end();
  }
}

// =============================================================================
// Spec Diff Handler
// =============================================================================

const SANDBOX_SECRET = process.env.SANDBOX_SECRET;

function verifyInternalToken(req: VercelRequest): boolean {
  if (!SANDBOX_SECRET) return true; // No secret configured = allow all (dev mode)
  const token = req.headers['x-internal-token'];
  return token === SANDBOX_SECRET;
}

interface GitHubDiffRequest {
  mode: 'github';
  owner: string;
  repo: string;
  base: string;
  head: string;
  accessToken: string; // GitHub access token passed from apps/web
  includeDocsImpact?: boolean;
}

interface SpecsDiffRequest {
  mode: 'specs';
  baseSpec: OpenPkg;
  headSpec: OpenPkg;
  markdownFiles?: Array<{ path: string; content: string }>;
}

type DiffRequest = GitHubDiffRequest | SpecsDiffRequest;

async function fetchSpecFromGitHub(
  owner: string,
  repo: string,
  ref: string,
  accessToken: string,
): Promise<OpenPkg | null> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/openpkg.json`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'DocCov-Sandbox',
      },
    });

    if (res.ok) {
      return (await res.json()) as OpenPkg;
    }
  } catch {
    // Not found
  }

  return null;
}

async function resolveRefToSha(
  owner: string,
  repo: string,
  ref: string,
  accessToken: string,
): Promise<string> {
  if (/^[a-f0-9]{40}$/i.test(ref)) {
    return ref;
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${ref}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'DocCov-Sandbox',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to resolve ref ${ref}: ${res.status}`);
  }

  const data = (await res.json()) as { sha: string };
  return data.sha;
}

async function handleDiff(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Verify internal token
  if (!verifyInternalToken(req)) {
    json(res, { error: 'Unauthorized' }, 401);
    return;
  }

  const body = req.body as DiffRequest;

  if (!body || !body.mode) {
    json(res, { error: 'Invalid request: mode required' }, 400);
    return;
  }

  try {
    if (body.mode === 'specs') {
      // Direct comparison mode
      const { baseSpec, headSpec, markdownFiles } = body;

      if (!baseSpec || !headSpec) {
        json(res, { error: 'baseSpec and headSpec required for specs mode' }, 400);
        return;
      }

      const { diffSpecWithDocs, parseMarkdownFiles } = await import('@doccov/sdk');
      const parsedMarkdown = markdownFiles ? parseMarkdownFiles(markdownFiles) : undefined;

      const diff = diffSpecWithDocs(baseSpec, headSpec, {
        markdownFiles: parsedMarkdown,
      });

      json(res, {
        breaking: diff.breaking,
        nonBreaking: diff.nonBreaking,
        docsOnly: diff.docsOnly,
        memberChanges: diff.memberChanges,
        categorizedBreaking: diff.categorizedBreaking,
        docsImpact: diff.docsImpact,
        generatedAt: new Date().toISOString(),
        cached: false,
      });
      return;
    }

    if (body.mode === 'github') {
      const { owner, repo, base, head, accessToken } = body;

      if (!owner || !repo || !base || !head || !accessToken) {
        json(
          res,
          { error: 'owner, repo, base, head, and accessToken required for github mode' },
          400,
        );
        return;
      }

      // Resolve refs to SHAs
      const [baseSha, headSha] = await Promise.all([
        resolveRefToSha(owner, repo, base, accessToken),
        resolveRefToSha(owner, repo, head, accessToken),
      ]);

      // Fetch specs
      const [baseSpec, headSpec] = await Promise.all([
        fetchSpecFromGitHub(owner, repo, baseSha, accessToken),
        fetchSpecFromGitHub(owner, repo, headSha, accessToken),
      ]);

      if (!baseSpec) {
        json(res, { error: `No openpkg.json found at ${base}` }, 404);
        return;
      }

      if (!headSpec) {
        json(res, { error: `No openpkg.json found at ${head}` }, 404);
        return;
      }

      const { diffSpecWithDocs } = await import('@doccov/sdk');

      const diff = diffSpecWithDocs(baseSpec, headSpec, {});

      json(res, {
        breaking: diff.breaking,
        nonBreaking: diff.nonBreaking,
        docsOnly: diff.docsOnly,
        memberChanges: diff.memberChanges,
        categorizedBreaking: diff.categorizedBreaking,
        docsImpact: diff.docsImpact,
        base: { ref: base, sha: baseSha },
        head: { ref: head, sha: headSha },
        generatedAt: new Date().toISOString(),
        cached: false,
      });
      return;
    }

    json(res, { error: 'Invalid mode' }, 400);
  } catch (error) {
    console.error('Diff error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('not found') || message.includes('404')) {
      json(res, { error: 'Repository or ref not found' }, 404);
      return;
    }

    json(res, { error: 'Failed to compute diff' }, 500);
  }
}

// =============================================================================
// Main Router
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    if (path === '/' && req.method === 'GET') {
      return handleRoot(req, res);
    }

    if (path === '/plan' && req.method === 'POST') {
      return handlePlan(req, res);
    }

    if (path === '/execute' && req.method === 'POST') {
      return handleExecute(req, res);
    }

    if (path === '/execute-stream' && req.method === 'POST') {
      return handleExecuteStream(req, res);
    }

    if (path === '/diff' && req.method === 'POST') {
      return handleDiff(req, res);
    }

    json(res, { error: 'Not found' }, 404);
  } catch (error) {
    console.error('Handler error:', error);
    json(res, { error: 'Internal server error' }, 500);
  }
}

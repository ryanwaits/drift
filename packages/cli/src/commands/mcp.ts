/**
 * `drift mcp` — stdio MCP server exposing drift's truth primitives to any agent.
 *
 * No logic of its own: every tool shells out to this same CLI with --json and
 * returns the {ok, data, meta} envelope. Deterministic edges, LLM in the middle.
 */
import { spawn } from 'node:child_process';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Command } from 'commander';
import { z } from 'zod';
import { getVersion } from '../utils/version';

const truthShape = {
  cwd: z
    .string()
    .optional()
    .describe('Directory to run in (project root; where package.json/config live)'),
  entry: z
    .string()
    .optional()
    .describe('Entry file: TypeScript entry or Clarity .clar source. Omit for OpenAPI specs.'),
  lang: z
    .enum(['typescript', 'clarity', 'openapi'])
    .optional()
    .describe('Source language override; inferred from spec/abi/.clar extension otherwise'),
  spec: z
    .string()
    .optional()
    .describe('OpenAPI 3.x JSON document — local path or https URL. Implies lang=openapi.'),
  abi: z.string().optional().describe('Clarity ABI JSON path (required for Clarity sources)'),
};

interface TruthArgs {
  cwd?: string;
  entry?: string;
  lang?: string;
  spec?: string;
  abi?: string;
}

function truthFlags(args: TruthArgs): string[] {
  const out: string[] = [];
  if (args.lang) out.push('--lang', args.lang);
  if (args.spec) out.push('--spec', args.spec);
  if (args.abi) out.push('--abi', args.abi);
  return out;
}

function runDrift(cliArgs: string[], cwd?: string): Promise<{ text: string; ok: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [process.argv[1], ...cliArgs, '--json'], {
      cwd: cwd ?? process.cwd(),
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('close', (code) => {
      const text = stdout.trim() || stderr.trim() || `drift exited with code ${code}`;
      let ok = code === 0;
      try {
        ok = JSON.parse(stdout).ok === true;
      } catch {
        // non-JSON output; fall back to exit code
      }
      resolve({ text, ok });
    });
    child.on('error', (err) => resolve({ text: `Failed to run drift: ${err.message}`, ok: false }));
  });
}

function toResult({ text, ok }: { text: string; ok: boolean }) {
  return { content: [{ type: 'text' as const, text }], isError: !ok };
}

export function registerMcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Run an MCP stdio server exposing drift tools to agents')
    .action(async () => {
      const server = new McpServer({ name: 'drift', version: getVersion() });

      server.registerTool(
        'drift_extract',
        {
          title: 'Extract API spec',
          description:
            'Extract the full machine-readable API spec from a source of truth: a TypeScript package (entry auto-detected from cwd), an OpenAPI 3.x document (spec path/URL), or a Clarity contract (entry .clar + abi). Returns every export with signatures, types, and docs. This is ground truth — use it instead of assuming what an API looks like.',
          inputSchema: truthShape,
        },
        async (args) =>
          toResult(
            await runDrift(
              ['extract', ...(args.entry ? [args.entry] : []), ...truthFlags(args)],
              args.cwd,
            ),
          ),
      );

      server.registerTool(
        'drift_list',
        {
          title: 'List exports/operations',
          description:
            'List every export (TypeScript), operation (OpenAPI), or function (Clarity) in an API surface: name, kind, one-line description, deprecated flag. Cheap way to check what exists before drilling in with drift_get. Supports filtering to undocumented or drifted items.',
          inputSchema: {
            ...truthShape,
            search: z.string().optional().describe('Fuzzy search term'),
            kind: z.string().optional().describe('Filter by kind (comma-separated)'),
            undocumented: z.boolean().optional().describe('Only items missing docs'),
            drifted: z.boolean().optional().describe('Only items whose docs drifted'),
          },
        },
        async (args) => {
          const cli = ['list'];
          if (args.entry) cli.push(args.entry);
          else if (args.search) cli.push(args.search);
          if (args.kind) cli.push('--kind', args.kind);
          if (args.undocumented) cli.push('--undocumented');
          if (args.drifted) cli.push('--drifted');
          cli.push('--full');
          return toResult(await runDrift([...cli, ...truthFlags(args)], args.cwd));
        },
      );

      server.registerTool(
        'drift_get',
        {
          title: 'Get one export/operation',
          description:
            'Get the authoritative definition of a single export, endpoint operation, or contract function by name: parameters with types/required/descriptions, return shape, deprecation, referenced types. Use this to verify every claim a docs page makes — one drift_get per claim, never from memory. Unknown names return fuzzy suggestions.',
          inputSchema: {
            ...truthShape,
            name: z
              .string()
              .describe('Export/operation name (e.g. candidateInfo, transfer, createClient)'),
          },
        },
        async (args) => {
          const cli = ['get'];
          if (args.entry) cli.push(args.entry, args.name);
          else cli.push(args.name);
          return toResult(await runDrift([...cli, ...truthFlags(args)], args.cwd));
        },
      );

      server.registerTool(
        'drift_scan',
        {
          title: 'Scan docs health',
          description:
            'Full docs-drift scan of an API surface: coverage score, drift issues with file/line locations, health score. The one-shot summary — use drift_list/drift_get for targeted follow-up.',
          inputSchema: {
            ...truthShape,
            min: z
              .number()
              .optional()
              .describe('Minimum health threshold (result.pass=false below it)'),
          },
        },
        async (args) => {
          const cli = ['scan'];
          if (args.entry) cli.push(args.entry);
          if (args.min !== undefined) cli.push('--min', String(args.min));
          return toResult(await runDrift([...cli, ...truthFlags(args)], args.cwd));
        },
      );

      server.registerTool(
        'drift_diff',
        {
          title: 'Diff two API specs',
          description:
            'Diff two extracted API specs (TypeScript only today): spec files or git refs. Reports added/removed/changed exports. Useful for changelog and release-note verification.',
          inputSchema: {
            cwd: truthShape.cwd,
            old: z.string().optional().describe('Old spec file path'),
            new: z.string().optional().describe('New spec file path'),
            base: z.string().optional().describe('Git ref for old spec (alternative to files)'),
            head: z.string().optional().describe('Git ref for new spec (default: working tree)'),
            entry: z.string().optional().describe('Entry file for git ref extraction'),
          },
        },
        async (args) => toResult(await runDrift(diffArgs('diff', args), args.cwd)),
      );

      server.registerTool(
        'drift_breaking',
        {
          title: 'Detect breaking changes',
          description:
            'Detect breaking API changes between two specs or git refs (TypeScript only today). Use to check whether docs claiming compatibility are still true.',
          inputSchema: {
            cwd: truthShape.cwd,
            old: z.string().optional().describe('Old spec file path'),
            new: z.string().optional().describe('New spec file path'),
            base: z.string().optional().describe('Git ref for old spec (alternative to files)'),
            head: z.string().optional().describe('Git ref for new spec (default: working tree)'),
            entry: z.string().optional().describe('Entry file for git ref extraction'),
          },
        },
        async (args) => toResult(await runDrift(diffArgs('breaking', args), args.cwd)),
      );

      await server.connect(new StdioServerTransport());
    });
}

function diffArgs(
  command: string,
  args: { old?: string; new?: string; base?: string; head?: string; entry?: string },
): string[] {
  const cli = [command];
  if (args.old) cli.push(args.old);
  if (args.new) cli.push(args.new);
  if (args.base) cli.push('--base', args.base);
  if (args.head) cli.push('--head', args.head);
  if (args.entry) cli.push('--entry', args.entry);
  return cli;
}

/**
 * Run example code in Vercel Sandbox
 * POST /examples/run
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Sandbox } from '@vercel/sandbox';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

interface RunExampleRequest {
  packageName: string;
  packageVersion?: string;
  code: string;
}

interface RunExampleResponse {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

function isVercelEnvironment(): boolean {
  return process.env.VERCEL === '1';
}

async function runExampleLocal(
  code: string,
  packageName: string,
  packageVersion?: string,
): Promise<RunExampleResponse> {
  const tmpDir = os.tmpdir();
  const workDir = path.join(
    tmpDir,
    `doccov-example-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const codeFile = path.join(workDir, 'example.ts');

  try {
    fs.mkdirSync(workDir, { recursive: true });

    const pkgJson = {
      name: 'example-runner',
      type: 'module',
      dependencies: {
        [packageName]: packageVersion || 'latest',
      },
    };
    fs.writeFileSync(path.join(workDir, 'package.json'), JSON.stringify(pkgJson, null, 2));
    fs.writeFileSync(codeFile, code);

    const startTime = Date.now();

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('npm', ['install', '--silent'], { cwd: workDir, timeout: 15000 });
      proc.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error('npm install failed')),
      );
      proc.on('error', reject);
    });

    return await new Promise<RunExampleResponse>((resolve) => {
      let stdout = '';
      let stderr = '';

      const proc = spawn('node', ['--experimental-strip-types', codeFile], {
        cwd: workDir,
        timeout: 5000,
      });

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (exitCode) => {
        resolve({
          success: exitCode === 0,
          stdout,
          stderr,
          exitCode: exitCode ?? 1,
          duration: Date.now() - startTime,
        });
      });

      proc.on('error', (error) => {
        resolve({
          success: false,
          stdout,
          stderr: error.message,
          exitCode: 1,
          duration: Date.now() - startTime,
        });
      });
    });
  } finally {
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function runExampleInSandbox(
  code: string,
  packageName: string,
  packageVersion?: string,
): Promise<RunExampleResponse> {
  const startTime = Date.now();
  const versionSpec = packageVersion ? `${packageName}@${packageVersion}` : packageName;

  const sandbox = await Sandbox.create({
    resources: { vcpus: 2 },
    timeout: 30 * 1000,
    runtime: 'node22',
  });

  try {
    const workDir = '/tmp/doccov-run';
    await sandbox.runCommand({ cmd: 'mkdir', args: ['-p', workDir] });

    await sandbox.runCommand({
      cmd: 'sh',
      args: ['-c', `echo '{"type":"module"}' > ${workDir}/package.json`],
    });

    const installResult = await sandbox.runCommand({
      cmd: 'npm',
      args: ['install', versionSpec, '--ignore-scripts', '--legacy-peer-deps'],
      cwd: workDir,
    });

    if (installResult.exitCode !== 0) {
      const installErr = (await installResult.stderr?.()) ?? 'Unknown install error';
      return {
        success: false,
        stdout: '',
        stderr: `Failed to install ${versionSpec}: ${installErr.slice(-200)}`,
        exitCode: installResult.exitCode ?? 1,
        duration: Date.now() - startTime,
      };
    }

    const exampleFile = `${workDir}/example.ts`;
    await sandbox.runCommand({
      cmd: 'sh',
      args: ['-c', `cat > ${exampleFile} << 'DOCCOV_EOF'\n${code}\nDOCCOV_EOF`],
    });

    const runResult = await sandbox.runCommand({
      cmd: 'node',
      args: ['--experimental-strip-types', exampleFile],
      cwd: workDir,
    });

    const stdout = (await runResult.stdout?.()) ?? '';
    const stderr = (await runResult.stderr?.()) ?? '';

    return {
      success: runResult.exitCode === 0,
      stdout,
      stderr,
      exitCode: runResult.exitCode ?? 1,
      duration: Date.now() - startTime,
    };
  } finally {
    await sandbox.stop();
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body as RunExampleRequest;

  if (!body.packageName) {
    return res.status(400).json({ error: 'packageName is required' });
  }

  if (!body.code) {
    return res.status(400).json({ error: 'code is required' });
  }

  const cleanCode = body.code
    .replace(/^```(?:ts|typescript|js|javascript)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();

  try {
    let result: RunExampleResponse;

    if (isVercelEnvironment()) {
      result = await runExampleInSandbox(cleanCode, body.packageName, body.packageVersion);
    } else {
      result = await runExampleLocal(cleanCode, body.packageName, body.packageVersion);
    }

    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      success: false,
      stdout: '',
      stderr: message,
      exitCode: 1,
      duration: 0,
    });
  }
}

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface ExampleRunResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface RunExampleOptions {
  /** Timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** Working directory for execution */
  cwd?: string;
}

export interface RunExamplesWithPackageOptions extends RunExampleOptions {
  /** Path to the local package to install */
  packagePath: string;
  /** Package manager to use (auto-detected if not specified) */
  packageManager?: 'npm' | 'pnpm' | 'bun';
  /** Timeout for package installation in ms (default: 60000) */
  installTimeout?: number;
}

export interface RunExamplesWithPackageResult {
  /** Results for each example by index */
  results: Map<number, ExampleRunResult>;
  /** Whether package installation succeeded */
  installSuccess: boolean;
  /** Error message if installation failed */
  installError?: string;
  /** Total duration including install */
  totalDuration: number;
}

/**
 * Strip markdown code block markers from example code
 */
function stripCodeBlockMarkers(code: string): string {
  return code
    .replace(/^```(?:ts|typescript|js|javascript)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
}

/**
 * Run an example code snippet in an isolated Node process.
 * Uses Node 22+ --experimental-strip-types for direct TS execution.
 */
export async function runExample(
  code: string,
  options: RunExampleOptions = {},
): Promise<ExampleRunResult> {
  const { timeout = 5000, cwd = process.cwd() } = options;
  const cleanCode = stripCodeBlockMarkers(code);

  // Create temp file in cwd so Node can find node_modules
  // When running with package install, cwd is the temp working directory
  const tmpFile = path.join(
    cwd,
    `drift-example-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`,
  );

  try {
    fs.writeFileSync(tmpFile, cleanCode, 'utf-8');

    const startTime = Date.now();

    return await new Promise<ExampleRunResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let killed = false;

      const proc = spawn('node', ['--experimental-strip-types', tmpFile], {
        cwd,
        timeout,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        killed = true;
        proc.kill('SIGKILL');
      }, timeout);

      proc.on('close', (exitCode) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        if (killed) {
          resolve({
            success: false,
            stdout,
            stderr: stderr || `Example timed out after ${timeout}ms`,
            exitCode: exitCode ?? 1,
            duration,
          });
        } else {
          resolve({
            success: exitCode === 0,
            stdout,
            stderr,
            exitCode: exitCode ?? 1,
            duration,
          });
        }
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
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
    // Cleanup temp file
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Run multiple examples and collect results
 */
export async function runExamples(
  examples: string[],
  options: RunExampleOptions = {},
): Promise<Map<number, ExampleRunResult>> {
  const results = new Map<number, ExampleRunResult>();

  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];
    if (typeof example === 'string' && example.trim()) {
      results.set(i, await runExample(example, options));
    }
  }

  return results;
}

/**
 * Detect package manager from lockfiles in the given directory.
 */
function detectPackageManager(cwd: string): 'npm' | 'pnpm' | 'bun' | 'yarn' {
  if (fs.existsSync(path.join(cwd, 'bun.lockb'))) return 'bun';
  if (fs.existsSync(path.join(cwd, 'bun.lock'))) return 'bun';
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(cwd, 'package-lock.json'))) return 'npm';
  return 'npm';
}

/**
 * Get the install command and args for a package manager.
 */
function getInstallCommand(
  pm: 'npm' | 'pnpm' | 'bun' | 'yarn',
  packagePath: string,
): { cmd: string; args: string[] } {
  switch (pm) {
    case 'bun':
      return { cmd: 'bun', args: ['add', packagePath] };
    case 'pnpm':
      return { cmd: 'pnpm', args: ['add', packagePath] };
    case 'yarn':
      return { cmd: 'yarn', args: ['add', packagePath] };
    default:
      return { cmd: 'npm', args: ['install', packagePath, '--legacy-peer-deps'] };
  }
}

/**
 * Run a command and capture output.
 */
async function runCommand(
  cmd: string,
  args: string[],
  options: { cwd: string; timeout: number },
): Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;

    const proc = spawn(cmd, args, {
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timeoutId = setTimeout(() => {
      killed = true;
      proc.kill('SIGKILL');
    }, options.timeout);

    proc.on('close', (exitCode) => {
      clearTimeout(timeoutId);
      if (killed) {
        resolve({
          success: false,
          stdout,
          stderr: stderr || `Command timed out after ${options.timeout}ms`,
          exitCode: exitCode ?? 1,
        });
      } else {
        resolve({
          success: exitCode === 0,
          stdout,
          stderr,
          exitCode: exitCode ?? 1,
        });
      }
    });

    proc.on('error', (error) => {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        stdout,
        stderr: error.message,
        exitCode: 1,
      });
    });
  });
}

/**
 * Run multiple examples with a pre-installed local package.
 * Creates a single temp directory, installs the package once,
 * runs all examples, then cleans up.
 */
export async function runExamplesWithPackage(
  examples: string[],
  options: RunExamplesWithPackageOptions,
): Promise<RunExamplesWithPackageResult> {
  const { packagePath, packageManager, installTimeout = 60000, timeout = 5000 } = options;

  const startTime = Date.now();
  const results = new Map<number, ExampleRunResult>();

  // Resolve package path to absolute (required for bun add, npm install from temp dir)
  const absolutePackagePath = path.resolve(packagePath);

  // Create temp working directory
  const workDir = path.join(
    os.tmpdir(),
    `drift-examples-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  try {
    fs.mkdirSync(workDir, { recursive: true });

    // Write package.json for ESM support
    const pkgJson = { name: 'drift-example-runner', type: 'module' };
    fs.writeFileSync(path.join(workDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

    // Detect or use specified package manager
    const pm = packageManager ?? detectPackageManager(options.cwd ?? process.cwd());
    const { cmd, args } = getInstallCommand(pm, absolutePackagePath);

    // Install the local package
    const installResult = await runCommand(cmd, args, {
      cwd: workDir,
      timeout: installTimeout,
    });

    if (!installResult.success) {
      return {
        results,
        installSuccess: false,
        installError:
          installResult.stderr || `${pm} install failed with exit code ${installResult.exitCode}`,
        totalDuration: Date.now() - startTime,
      };
    }

    // Run each example from the work directory
    for (let i = 0; i < examples.length; i++) {
      const example = examples[i];
      if (typeof example === 'string' && example.trim()) {
        results.set(i, await runExample(example, { timeout, cwd: workDir }));
      }
    }

    return {
      results,
      installSuccess: true,
      totalDuration: Date.now() - startTime,
    };
  } finally {
    // Cleanup temp directory
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Dependency installation utilities.
 * Abstracts the install logic for use in CLI and API.
 */

import { detectPackageManager, getInstallCommand } from '../detect/package-manager';
import type { FileSystem, PackageManager } from '../detect/types';

/**
 * Progress event for installation status updates.
 */
export interface InstallProgressEvent {
  /** Current stage */
  stage: 'installing';
  /** Human-readable message */
  message: string;
  /** Progress percentage (0-100), if known */
  progress?: number;
}

/**
 * Callback for receiving installation progress events.
 */
export type InstallProgressCallback = (event: InstallProgressEvent) => void;

/**
 * Result of running a command.
 */
export interface CommandResult {
  /** Exit code (0 = success) */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
}

/**
 * Function that runs a shell command.
 * Abstracts the difference between Node.js execSync and Sandbox runCommand.
 */
export type CommandRunner = (
  cmd: string,
  args: string[],
  options: { cwd: string; timeout?: number },
) => Promise<CommandResult>;

/**
 * Result of dependency installation.
 */
export interface InstallResult {
  /** Whether installation succeeded */
  success: boolean;
  /** Package manager that was used */
  packageManager: PackageManager;
  /** If a fallback was used, which one */
  fallbackUsed?: PackageManager;
  /** Error message if installation failed */
  error?: string;
  /** Detailed error messages from each attempt */
  errors?: string[];
}

/**
 * Options for dependency installation.
 */
export interface InstallOptions {
  /** Timeout in milliseconds for install commands (default: 180000) */
  timeout?: number;
  /** Order of fallback package managers to try */
  fallbackOrder?: PackageManager[];
  /** Progress callback for status updates */
  onProgress?: InstallProgressCallback;
}

/**
 * Default fallback order: bun (fast), then npm with permissive flags.
 */
const DEFAULT_FALLBACK_ORDER: PackageManager[] = ['bun', 'npm'];

/**
 * Install dependencies for a project.
 *
 * This consolidates the install logic from CLI scan.ts and API scan-stream.ts:
 * 1. Detect package manager from lockfile
 * 2. Try primary install command
 * 3. Fall back to other package managers if primary fails
 *
 * @param fs - FileSystem implementation for package manager detection
 * @param cwd - Working directory to install in
 * @param runCommand - Function to run shell commands
 * @param [options] - Installation options
 * @returns Promise resolving to the result of the installation attempt
 *
 * @example
 * ```typescript
 * import { NodeFileSystem, installDependencies, createNodeCommandRunner } from '@driftdev/sdk';
 *
 * const fs = new NodeFileSystem('/path/to/repo');
 * const result = await installDependencies(fs, '/path/to/repo', createNodeCommandRunner());
 *
 * if (result.success) {
 *   console.log(`Installed using ${result.packageManager}`);
 * } else {
 *   console.error(`Install failed: ${result.error}`);
 * }
 * ```
 */
export async function installDependencies(
  fs: FileSystem,
  cwd: string,
  runCommand: CommandRunner,
  options: InstallOptions = {},
): Promise<InstallResult> {
  const { timeout = 180000, fallbackOrder = DEFAULT_FALLBACK_ORDER, onProgress } = options;

  const errors: string[] = [];

  // Detect package manager
  onProgress?.({ stage: 'installing', message: 'Detecting package manager...' });
  const pmInfo = await detectPackageManager(fs);

  // Try primary package manager if lockfile exists
  if (pmInfo.lockfile) {
    onProgress?.({
      stage: 'installing',
      message: `Installing with ${pmInfo.name}...`,
      progress: 25,
    });

    const installCmd = getInstallCommand(pmInfo);
    const result = await runCommand(installCmd[0], installCmd.slice(1), { cwd, timeout });

    if (result.exitCode === 0) {
      onProgress?.({ stage: 'installing', message: 'Dependencies installed', progress: 100 });
      return {
        success: true,
        packageManager: pmInfo.name,
      };
    }

    // Record the error
    const errorMsg = result.stderr.slice(0, 150) || `Exit code ${result.exitCode}`;
    errors.push(`[${installCmd.join(' ')}] ${errorMsg}`);

    // Check for workspace protocol error - bun handles these better
    if (result.stderr.includes('workspace:') || result.stderr.includes('EUNSUPPORTEDPROTOCOL')) {
      onProgress?.({
        stage: 'installing',
        message: 'Workspace protocol detected, trying bun...',
        progress: 35,
      });
    }
  }

  // Try fallbacks
  for (const fallbackPm of fallbackOrder) {
    // Skip if we already tried this as primary
    if (pmInfo.lockfile && fallbackPm === pmInfo.name) continue;

    onProgress?.({
      stage: 'installing',
      message: `Trying ${fallbackPm} fallback...`,
      progress: 50,
    });

    const fallbackCmd = getFallbackInstallCommand(fallbackPm);
    const result = await runCommand(fallbackCmd[0], fallbackCmd.slice(1), { cwd, timeout });

    if (result.exitCode === 0) {
      onProgress?.({ stage: 'installing', message: 'Dependencies installed', progress: 100 });
      return {
        success: true,
        packageManager: fallbackPm,
        fallbackUsed: fallbackPm,
      };
    }

    const errorMsg = result.stderr.slice(0, 150) || `Exit code ${result.exitCode}`;
    errors.push(`[${fallbackCmd.join(' ')}] ${errorMsg}`);
  }

  // All attempts failed
  onProgress?.({
    stage: 'installing',
    message: 'Could not install dependencies',
    progress: 100,
  });

  return {
    success: false,
    packageManager: pmInfo.name,
    error: 'All installation attempts failed',
    errors,
  };
}

/**
 * Get install command for a fallback package manager.
 * Uses permissive flags for npm to handle peer dependency conflicts.
 */
function getFallbackInstallCommand(pm: PackageManager): string[] {
  switch (pm) {
    case 'npm':
      return ['npm', 'install', '--legacy-peer-deps', '--ignore-scripts'];
    case 'bun':
      return ['bun', 'install'];
    case 'yarn':
      return ['yarn', 'install'];
    case 'pnpm':
      return ['pnpm', 'install'];
    default:
      return ['npm', 'install'];
  }
}

/**
 * Create a command runner for Node.js environments using execSync.
 * This is used by the CLI for local dependency installation.
 *
 * @returns CommandRunner that uses child_process.execSync
 *
 * @example
 * ```typescript
 * const runner = createNodeCommandRunner();
 * const result = await runner('npm', ['install'], { cwd: '/path/to/repo' });
 * ```
 */
export function createNodeCommandRunner(): CommandRunner {
  return async (cmd, args, options) => {
    const { execSync } = await import('node:child_process');
    const fullCmd = [cmd, ...args].join(' ');

    try {
      const stdout = execSync(fullCmd, {
        cwd: options.cwd,
        stdio: 'pipe',
        timeout: options.timeout ?? 180000,
      });

      return {
        exitCode: 0,
        stdout: stdout?.toString() ?? '',
        stderr: '',
      };
    } catch (error) {
      const err = error as { status?: number; stdout?: Buffer; stderr?: Buffer; message?: string };
      return {
        exitCode: err.status ?? 1,
        stdout: err.stdout?.toString() ?? '',
        stderr: err.stderr?.toString() ?? err.message ?? 'Unknown error',
      };
    }
  };
}

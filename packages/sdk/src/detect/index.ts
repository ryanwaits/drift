/**
 * Project detection module for I/O-agnostic project analysis.
 *
 * This module provides tools to detect project structure, package manager,
 * monorepo configuration, entry points, and build settings. It works with
 * both Node.js filesystem (for CLI) and Vercel Sandbox (for API).
 *
 * @example
 * ```typescript
 * import { NodeFileSystem, analyzeProject } from '@driftdev/sdk';
 *
 * const fs = new NodeFileSystem('/path/to/repo');
 * const project = await analyzeProject(fs);
 *
 * console.log(project.packageManager.name); // 'pnpm'
 * console.log(project.monorepo.isMonorepo); // true
 * console.log(project.entryPoint.path); // 'src/index.ts'
 * ```
 */

// Build info detection
export { detectBuildInfo, getPrimaryBuildScript } from './build';
// Entry point detection
export { detectEntryPoint, findEntryPointForFile, isPackageEntryPoint } from './entry-point';
// FileSystem implementations
export { NodeFileSystem, SandboxFileSystem } from './filesystem';

// Monorepo detection
export { detectMonorepo, findPackageByName, formatPackageList } from './monorepo';
// Package manager detection
export { detectPackageManager, getInstallCommand, getRunCommand } from './package-manager';
// Types
export type {
  AnalyzeProjectOptions,
  BuildInfo,
  EntryPointInfo,
  EntryPointSource,
  FileSystem,
  MonorepoInfo,
  MonorepoType,
  PackageManager,
  PackageManagerInfo,
  ProjectInfo,
  WorkspacePackage,
} from './types';
export type { PackageExports, PackageJson } from './utils';
// Utilities
export { readPackageJson, safeParseJson } from './utils';

import { detectBuildInfo } from './build';
import { detectEntryPoint } from './entry-point';
import { detectMonorepo, findPackageByName } from './monorepo';
import { detectPackageManager } from './package-manager';
// High-level API
import type { AnalyzeProjectOptions, FileSystem, ProjectInfo } from './types';

/**
 * Analyze a project's structure for scanning.
 *
 * This is the main entry point for project detection. It combines all
 * detection functions into a single call that returns complete project info.
 *
 * For monorepos, you must specify the target package via options.targetPackage.
 * If not specified and a monorepo is detected, an error is thrown with the
 * list of available packages.
 *
 * @param fs - FileSystem implementation (NodeFileSystem or SandboxFileSystem)
 * @param [options] - Options including targetPackage for monorepos
 * @returns Promise that resolves to complete project info
 * @throws Error if monorepo detected without targetPackage specified
 * @throws Error if targetPackage not found in monorepo
 *
 * @example
 * ```typescript
 * import { NodeFileSystem, analyzeProject } from '@driftdev/sdk';
 *
 * // Single package
 * const singleFs = new NodeFileSystem('/path/to/package');
 * const singleProject = await analyzeProject(singleFs);
 *
 * // Monorepo with target package
 * const monoFs = new NodeFileSystem('/path/to/monorepo');
 * const monoProject = await analyzeProject(monoFs, { targetPackage: '@scope/core' });
 * ```
 */
export async function analyzeProject(
  fs: FileSystem,
  options: AnalyzeProjectOptions = {},
): Promise<ProjectInfo> {
  // Run PM and monorepo detection in parallel
  const [packageManager, monorepo] = await Promise.all([
    detectPackageManager(fs),
    detectMonorepo(fs),
  ]);

  // Determine target path for entry point and build detection
  let targetPath = '.';

  if (monorepo.isMonorepo) {
    if (!options.targetPackage) {
      const publicPackages = monorepo.packages.filter((p) => !p.private);
      const packageNames = publicPackages.map((p) => p.name).join(', ');
      throw new Error(
        `Monorepo detected with ${publicPackages.length} packages. ` +
          `Specify target with --package. Available: ${packageNames}`,
      );
    }

    const pkg = findPackageByName(monorepo.packages, options.targetPackage);
    if (!pkg) {
      const available = monorepo.packages.map((p) => p.name).join(', ');
      throw new Error(
        `Package not found: ${options.targetPackage}. Available packages: ${available}`,
      );
    }

    targetPath = pkg.path;
  }

  // Run entry point and build detection in parallel
  const [entryPoint, build] = await Promise.all([
    detectEntryPoint(fs, targetPath),
    detectBuildInfo(fs, targetPath),
  ]);

  return { packageManager, monorepo, entryPoint, build };
}

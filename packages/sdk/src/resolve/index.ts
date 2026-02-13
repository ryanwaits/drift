/**
 * Project resolution utilities.
 * Consolidates the repeated entry point + monorepo detection pattern from CLI commands.
 */

import * as path from 'node:path';
import { detectEntryPoint } from '../detect/entry-point';
import { detectMonorepo, findPackageByName } from '../detect/monorepo';
import type { EntryPointInfo, FileSystem, WorkspacePackage } from '../detect/types';

/**
 * Options for resolving a target package/entry point.
 */
export interface ResolveTargetOptions {
  /** Working directory (usually process.cwd()) */
  cwd: string;
  /** Target package name for monorepos */
  package?: string;
  /** Explicit entry point path (relative to cwd or package dir) */
  entry?: string;
}

/**
 * Result of resolving a target package/entry point.
 */
export interface ResolvedTarget {
  /** Resolved directory containing the package */
  targetDir: string;
  /** Resolved entry point file path (absolute) */
  entryFile: string;
  /** Package info if this is a monorepo package */
  packageInfo?: WorkspacePackage;
  /** Entry point detection info */
  entryPointInfo: EntryPointInfo;
}

/**
 * Resolve a target package and entry point.
 *
 * This consolidates the repeated pattern from CLI commands:
 * 1. If --package specified, detect monorepo and find the package
 * 2. If no entry specified, auto-detect entry point
 * 3. If entry is a directory, detect entry point within it
 *
 * @param fs - FileSystem implementation (NodeFileSystem or SandboxFileSystem)
 * @param options - Resolution options
 * @returns Promise resolving to resolved target info
 * @throws Error if monorepo package not found, or entry point detection fails
 *
 * @example
 * ```typescript
 * import { NodeFileSystem, resolveTarget } from '@driftdev/sdk';
 *
 * // Simple usage
 * const fs = new NodeFileSystem(process.cwd());
 * const { targetDir, entryFile } = await resolveTarget(fs, { cwd: process.cwd() });
 *
 * // With monorepo package
 * const { targetDir, entryFile, packageInfo } = await resolveTarget(fs, {
 *   cwd: process.cwd(),
 *   package: '@myorg/core',
 * });
 * ```
 */
export async function resolveTarget(
  fs: FileSystem,
  options: ResolveTargetOptions,
): Promise<ResolvedTarget> {
  let targetDir = options.cwd;
  let packageInfo: WorkspacePackage | undefined;

  // Handle monorepo package resolution
  if (options.package) {
    const mono = await detectMonorepo(fs);
    if (!mono.isMonorepo) {
      throw new Error('Not a monorepo. Remove --package flag for single-package repos.');
    }
    const pkg = findPackageByName(mono.packages, options.package);
    if (!pkg) {
      const available = mono.packages.map((p) => p.name).join(', ');
      throw new Error(`Package "${options.package}" not found. Available: ${available}`);
    }
    targetDir = path.join(options.cwd, pkg.path);
    packageInfo = pkg;
  }

  // Resolve entry point
  let entryFile: string;
  let entryPointInfo: EntryPointInfo;

  if (!options.entry) {
    // Auto-detect entry point
    entryPointInfo = await detectEntryPoint(fs, getRelativePath(options.cwd, targetDir));
    entryFile = path.join(targetDir, entryPointInfo.path);
  } else {
    // Use explicit entry
    const explicitPath = path.resolve(targetDir, options.entry);

    // Check if entry is a directory
    const isDirectory = await isDir(fs, getRelativePath(options.cwd, explicitPath));

    if (isDirectory) {
      // Entry is a directory, detect entry point within it
      targetDir = explicitPath;
      entryPointInfo = await detectEntryPoint(fs, getRelativePath(options.cwd, explicitPath));
      entryFile = path.join(explicitPath, entryPointInfo.path);
    } else {
      // Entry is a file
      entryFile = explicitPath;
      // Create synthetic entry point info for explicit entry
      entryPointInfo = {
        path: options.entry,
        source: 'explicit',
        isDeclarationOnly: options.entry.endsWith('.d.ts'),
      };
    }
  }

  return {
    targetDir,
    entryFile,
    packageInfo,
    entryPointInfo,
  };
}

/**
 * Get path relative to base, or '.' if same.
 */
function getRelativePath(base: string, target: string): string {
  if (base === target) return '.';
  const rel = path.relative(base, target);
  return rel || '.';
}

/**
 * Check if a path is a directory using the FileSystem abstraction.
 */
async function isDir(fs: FileSystem, relativePath: string): Promise<boolean> {
  // Check if the path exists and has a package.json (indicating it's a package directory)
  // or if it doesn't have an extension (heuristic for directory)
  const hasPackageJson = await fs.exists(path.join(relativePath, 'package.json'));
  if (hasPackageJson) return true;

  // Check for common entry point files to determine if it's a directory
  const commonEntryFiles = ['index.ts', 'index.tsx', 'src/index.ts', 'main.ts'];
  for (const entry of commonEntryFiles) {
    if (await fs.exists(path.join(relativePath, entry))) {
      return true;
    }
  }

  // If the path has no extension, assume it might be a directory
  // This is a heuristic - the actual check happens in the caller
  return !path.extname(relativePath);
}

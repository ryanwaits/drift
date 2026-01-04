/**
 * Project detection types for I/O-agnostic project analysis.
 * Used by both CLI (NodeFileSystem) and API (SandboxFileSystem).
 */

/**
 * Minimal filesystem interface for I/O-agnostic detection.
 * Implementations: NodeFileSystem (CLI), SandboxFileSystem (API)
 */
export interface FileSystem {
  /** Check if a file or directory exists */
  exists(path: string): Promise<boolean>;

  /** Read file contents as string */
  readFile(path: string): Promise<string>;

  /** List directory contents (file/folder names only) */
  readDir(path: string): Promise<string[]>;

  /** Check if path is a directory */
  isDirectory(path: string): Promise<boolean>;
}

/** Supported package managers */
export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

/** Package manager detection result with install/run commands */
export interface PackageManagerInfo {
  /** Package manager name */
  name: PackageManager;

  /** Lockfile that was detected (null if none found) */
  lockfile: string | null;

  /** Arguments for install command, e.g. ['install', '--frozen-lockfile'] */
  installArgs: string[];

  /** Prefix for running scripts, e.g. ['npm', 'run'] or ['pnpm'] */
  runPrefix: string[];
}

/** Monorepo type based on configuration */
export type MonorepoType = 'npm-workspaces' | 'pnpm-workspaces' | 'lerna' | 'none';

/** Monorepo detection result */
export interface MonorepoInfo {
  /** Whether this is a monorepo */
  isMonorepo: boolean;

  /** Type of monorepo configuration */
  type: MonorepoType;

  /** Workspace patterns from config (e.g. ['packages/*']) */
  patterns: string[];

  /** Resolved workspace packages */
  packages: WorkspacePackage[];
}

/** A package within a monorepo workspace */
export interface WorkspacePackage {
  /** Package name from package.json */
  name: string;

  /** Relative path to package directory */
  path: string;

  /** Whether the package is marked as private */
  private: boolean;
}

/** Entry point source - where the entry was detected from */
export type EntryPointSource = 'types' | 'exports' | 'main' | 'module' | 'fallback' | 'explicit';

/** Entry point detection result */
export interface EntryPointInfo {
  /** Path to entry file (relative to package root) */
  path: string;

  /** Where the entry point was detected from */
  source: EntryPointSource;

  /** Whether this is a .d.ts file (no source available) */
  isDeclarationOnly: boolean;
}

/** Build configuration detection result */
export interface BuildInfo {
  /** Build-related script names found (e.g. ['build', 'build:types']) */
  scripts: string[];

  /** Whether any build script was found */
  hasBuildScript: boolean;

  /** Whether TypeScript is configured/installed */
  hasTypeScript: boolean;

  /** Indicators for exotic project types */
  exoticIndicators: {
    /** WASM project (Cargo.toml or wasm-pack scripts) */
    wasm: boolean;

    /** napi-rs native addon project */
    napi: boolean;
  };
}

/** Complete project analysis result */
export interface ProjectInfo {
  /** Package manager info */
  packageManager: PackageManagerInfo;

  /** Monorepo info */
  monorepo: MonorepoInfo;

  /** Entry point info */
  entryPoint: EntryPointInfo;

  /** Build info */
  build: BuildInfo;
}

/** Options for analyzeProject() */
export interface AnalyzeProjectOptions {
  /** Target package name for monorepos */
  targetPackage?: string;
}

/** Parsed tsconfig.json information relevant to source resolution */
export interface TsConfigInfo {
  /** Output directory (where compiled files go) */
  outDir?: string;
  /** Root directory (where source files live) */
  rootDir?: string;
  /** Base URL for module resolution */
  baseUrl?: string;
  /** Path aliases */
  paths?: Record<string, string[]>;
}

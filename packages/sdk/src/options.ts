import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Find the git repository root by walking up from startDir.
 * Returns startDir if not in a git repo.
 */
function findRepoRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return startDir;
}

export interface DriftOptions {
  includePrivate?: boolean;
  followImports?: boolean;
  maxDepth?: number;
  resolveExternalTypes?: boolean;
  /** Enable spec caching (default: true) */
  useCache?: boolean;
  /** Working directory for cache operations (default: git repo root or process.cwd()) */
  cwd?: string;
}

export type NormalizedDriftOptions = DriftOptions & {
  includePrivate: boolean;
  followImports: boolean;
  maxDepth: number;
  useCache: boolean;
  cwd: string;
};

/** Default max depth for type conversion - matches @openpkg-ts/sdk default */
export const DEFAULT_MAX_TYPE_DEPTH = 4;

const DEFAULT_OPTIONS: Pick<
  NormalizedDriftOptions,
  'includePrivate' | 'followImports' | 'maxDepth' | 'useCache'
> = {
  includePrivate: false,
  followImports: true,
  maxDepth: DEFAULT_MAX_TYPE_DEPTH,
  useCache: true,
};

export function normalizeDriftOptions(options: DriftOptions = {}): NormalizedDriftOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    maxDepth: options.maxDepth ?? DEFAULT_MAX_TYPE_DEPTH,
    useCache: options.useCache ?? true,
    cwd: options.cwd ?? findRepoRoot(process.cwd()),
  };
}

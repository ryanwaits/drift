/**
 * GitHub context fetcher for AI-powered build plan generation.
 * Fetches project context via GitHub API without cloning the repository.
 */
import { parseGitHubUrl as parseGitHubUrlFull } from '../github';

/**
 * Repository metadata from GitHub API.
 */
export interface GitHubRepoMetadata {
  owner: string;
  repo: string;
  defaultBranch: string;
  description: string | null;
  language: string | null;
  topics: string[];
  isPrivate: boolean;
}

/**
 * Detected package manager from lockfile.
 */
export type DetectedPackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';

/**
 * Workspace/monorepo configuration.
 */
export interface WorkspaceConfig {
  isMonorepo: boolean;
  tool?: 'npm' | 'yarn' | 'pnpm' | 'lerna' | 'turborepo' | 'nx';
  packages?: string[];
}

/**
 * Build hints detected from project files.
 */
export interface BuildHints {
  hasTypeScript: boolean;
  hasWasm: boolean;
  hasNativeModules: boolean;
  hasBuildScript: boolean;
  buildScript?: string;
  frameworks: string[];
}

/**
 * Complete project context for build plan generation.
 */
export interface GitHubProjectContext {
  /** Repository metadata */
  metadata: GitHubRepoMetadata;
  /** Git ref being analyzed */
  ref: string;
  /** Detected package manager */
  packageManager: DetectedPackageManager;
  /** Workspace/monorepo configuration */
  workspace: WorkspaceConfig;
  /** Build hints from project files */
  buildHints: BuildHints;
  /** Raw file contents for AI analysis */
  files: {
    packageJson?: string;
    tsconfigJson?: string;
    lockfile?: { name: string; content: string };
  };
}

/**
 * Parse GitHub URL into owner and repo.
 * Uses the richer parseGitHubUrl from github/index.ts, returning null on error.
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const { owner, repo } = parseGitHubUrlFull(url);
    return { owner, repo };
  } catch {
    return null;
  }
}

/**
 * Fetch raw file content from GitHub.
 */
async function fetchRawFile(
  owner: string,
  repo: string,
  ref: string,
  path: string,
  authToken?: string,
): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;

  try {
    const headers: Record<string, string> = {};
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    const response = await fetch(url, { headers });
    if (response.ok) {
      return await response.text();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch repository metadata from GitHub API.
 */
async function fetchRepoMetadata(
  owner: string,
  repo: string,
  authToken?: string,
): Promise<GitHubRepoMetadata> {
  const url = `https://api.github.com/repos/${owner}/${repo}`;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Drift-Scanner',
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch repository: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    default_branch: string;
    description: string | null;
    language: string | null;
    topics?: string[];
    private: boolean;
  };

  return {
    owner,
    repo,
    defaultBranch: data.default_branch,
    description: data.description,
    language: data.language,
    topics: data.topics ?? [],
    isPrivate: data.private,
  };
}

/**
 * Detect package manager from lockfiles.
 */
async function detectPackageManager(
  owner: string,
  repo: string,
  ref: string,
  authToken?: string,
): Promise<{ manager: DetectedPackageManager; lockfile?: { name: string; content: string } }> {
  const lockfiles: Array<{ name: string; manager: DetectedPackageManager }> = [
    { name: 'bun.lockb', manager: 'bun' },
    { name: 'pnpm-lock.yaml', manager: 'pnpm' },
    { name: 'yarn.lock', manager: 'yarn' },
    { name: 'package-lock.json', manager: 'npm' },
  ];

  for (const { name, manager } of lockfiles) {
    const content = await fetchRawFile(owner, repo, ref, name, authToken);
    if (content !== null) {
      return { manager, lockfile: { name, content: content.slice(0, 10000) } }; // Truncate large lockfiles
    }
  }

  return { manager: 'unknown' };
}

/**
 * Detect workspace/monorepo configuration.
 */
async function detectWorkspace(
  packageJson: unknown,
  owner: string,
  repo: string,
  ref: string,
  authToken?: string,
): Promise<WorkspaceConfig> {
  // Check for pnpm-workspace.yaml first
  const pnpmWorkspace = await fetchRawFile(owner, repo, ref, 'pnpm-workspace.yaml', authToken);
  if (pnpmWorkspace) {
    // Parse packages from pnpm-workspace.yaml (simple YAML parsing)
    const packagesMatch = pnpmWorkspace.match(/packages:\s*\n((?:\s+-\s+['"]?[^\n]+['"]?\n?)+)/);
    const packages = packagesMatch
      ? packagesMatch[1]
          .split('\n')
          .map((line) => line.replace(/^\s+-\s+['"]?/, '').replace(/['"]?\s*$/, ''))
          .filter(Boolean)
      : undefined;
    return {
      isMonorepo: true,
      tool: 'pnpm',
      packages,
    };
  }

  // Check for lerna.json
  const lernaJson = await fetchRawFile(owner, repo, ref, 'lerna.json', authToken);
  if (lernaJson) {
    return { isMonorepo: true, tool: 'lerna' };
  }

  // Check package.json workspaces (npm/yarn)
  if (packageJson && typeof packageJson === 'object') {
    const pkg = packageJson as Record<string, unknown>;

    if (pkg.workspaces) {
      const workspaces = pkg.workspaces;
      const packages = Array.isArray(workspaces)
        ? workspaces
        : (workspaces as { packages?: string[] }).packages;
      return {
        isMonorepo: true,
        tool: 'npm',
        packages: packages?.filter((p): p is string => typeof p === 'string'),
      };
    }
  }

  return { isMonorepo: false };
}

/**
 * Detect build hints from package.json and tsconfig.json.
 */
function detectBuildHints(packageJson: unknown, tsconfigJson: unknown): BuildHints {
  const hints: BuildHints = {
    hasTypeScript: false,
    hasWasm: false,
    hasNativeModules: false,
    hasBuildScript: false,
    frameworks: [],
  };

  if (!packageJson || typeof packageJson !== 'object') {
    return hints;
  }

  const pkg = packageJson as Record<string, unknown>;
  const deps = {
    ...(typeof pkg.dependencies === 'object' ? pkg.dependencies : {}),
    ...(typeof pkg.devDependencies === 'object' ? pkg.devDependencies : {}),
  } as Record<string, string>;

  // TypeScript detection
  hints.hasTypeScript = 'typescript' in deps || tsconfigJson !== null;

  // WASM detection
  hints.hasWasm = 'wasm-pack' in deps || '@aspect-build/rules_esbuild' in deps;

  // Native modules detection
  hints.hasNativeModules = 'node-gyp' in deps || 'prebuild' in deps || 'napi-rs' in deps;

  // Build script detection
  const scripts = typeof pkg.scripts === 'object' ? (pkg.scripts as Record<string, string>) : {};
  if (scripts.build) {
    hints.hasBuildScript = true;
    hints.buildScript = scripts.build;
  }

  // Framework detection
  const frameworkDeps: Array<{ dep: string; name: string }> = [
    { dep: 'react', name: 'React' },
    { dep: 'vue', name: 'Vue' },
    { dep: 'svelte', name: 'Svelte' },
    { dep: 'next', name: 'Next.js' },
    { dep: 'nuxt', name: 'Nuxt' },
    { dep: 'astro', name: 'Astro' },
    { dep: 'express', name: 'Express' },
    { dep: 'fastify', name: 'Fastify' },
    { dep: 'hono', name: 'Hono' },
  ];

  for (const { dep, name } of frameworkDeps) {
    if (dep in deps) {
      hints.frameworks.push(name);
    }
  }

  return hints;
}

/**
 * Options for fetching GitHub project context.
 */
export interface FetchGitHubContextOptions {
  /** Git ref (branch, tag, or SHA). Defaults to default branch. */
  ref?: string;
  /** Auth token for private repos (GitHub App installation token or PAT). */
  authToken?: string;
}

/**
 * Fetch complete project context from GitHub.
 */
export async function fetchGitHubContext(
  repoUrl: string,
  refOrOptions?: string | FetchGitHubContextOptions,
): Promise<GitHubProjectContext> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    throw new Error(`Invalid GitHub URL: ${repoUrl}`);
  }

  // Normalize options
  const options: FetchGitHubContextOptions =
    typeof refOrOptions === 'string' ? { ref: refOrOptions } : (refOrOptions ?? {});
  const { authToken } = options;

  const { owner, repo } = parsed;

  // Fetch repository metadata
  const metadata = await fetchRepoMetadata(owner, repo, authToken);
  const targetRef = options.ref ?? metadata.defaultBranch;

  // Fetch key files in parallel
  const [packageJsonRaw, tsconfigJsonRaw, pmResult] = await Promise.all([
    fetchRawFile(owner, repo, targetRef, 'package.json', authToken),
    fetchRawFile(owner, repo, targetRef, 'tsconfig.json', authToken),
    detectPackageManager(owner, repo, targetRef, authToken),
  ]);

  // Parse JSON files
  let packageJson: unknown = null;
  let tsconfigJson: unknown = null;

  if (packageJsonRaw) {
    try {
      packageJson = JSON.parse(packageJsonRaw);
    } catch {
      // Invalid JSON, ignore
    }
  }

  if (tsconfigJsonRaw) {
    try {
      tsconfigJson = JSON.parse(tsconfigJsonRaw);
    } catch {
      // Invalid JSON, ignore
    }
  }

  // Detect workspace and build hints
  const workspace = await detectWorkspace(packageJson, owner, repo, targetRef, authToken);
  const buildHints = detectBuildHints(packageJson, tsconfigJson);

  return {
    metadata,
    ref: targetRef,
    packageManager: pmResult.manager,
    workspace,
    buildHints,
    files: {
      packageJson: packageJsonRaw ?? undefined,
      tsconfigJson: tsconfigJsonRaw ?? undefined,
      lockfile: pmResult.lockfile,
    },
  };
}

/**
 * List packages in a monorepo workspace.
 */
export async function listWorkspacePackages(
  owner: string,
  repo: string,
  ref: string,
  patterns: string[],
  authToken?: string,
): Promise<string[]> {
  // For now, we'll use the GitHub API to list directories
  // This is a simplified implementation - a full version would use glob matching
  const packages: string[] = [];

  for (const pattern of patterns) {
    // Extract base directory from pattern (e.g., "packages/*" -> "packages")
    const baseDir = pattern.replace(/\/\*.*$/, '');

    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${baseDir}?ref=${ref}`;
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Drift-Scanner',
      };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      const response = await fetch(url, { headers });

      if (response.ok) {
        const contents = (await response.json()) as Array<{ name: string; type: string }>;
        for (const item of contents) {
          if (item.type === 'dir') {
            packages.push(`${baseDir}/${item.name}`);
          }
        }
      }
    } catch {
      // Directory not found or API error, continue
    }
  }

  return packages;
}

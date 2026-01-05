import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { DOCCOV_CONFIG_FILENAMES } from '../config';
import { colors, getSymbols, supportsUnicode } from '../utils/progress';

export interface InitCommandDependencies {
  fileExists?: typeof fs.existsSync;
  writeFileSync?: typeof fs.writeFileSync;
  readFileSync?: typeof fs.readFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  log?: typeof console.log;
  error?: typeof console.error;
}

type PackageType = 'module' | 'commonjs' | undefined;

const defaultDependencies: Required<InitCommandDependencies> = {
  fileExists: fs.existsSync,
  writeFileSync: fs.writeFileSync,
  readFileSync: fs.readFileSync,
  mkdirSync: fs.mkdirSync,
  log: console.log,
  error: console.error,
};

export function registerInitCommand(
  program: Command,
  dependencies: InitCommandDependencies = {},
): void {
  const { fileExists, writeFileSync, readFileSync, mkdirSync, log, error } = {
    ...defaultDependencies,
    ...dependencies,
  };

  program
    .command('init')
    .description('Initialize DocCov: config, GitHub Action, and badge')
    .option('--cwd <dir>', 'Working directory', process.cwd())
    .option('--skip-action', 'Skip GitHub Action workflow creation')
    .action((options) => {
      const cwd = path.resolve(options.cwd as string);

      const existing = findExistingConfig(cwd, fileExists);
      if (existing) {
        error(
          chalk.red(
            `A DocCov config already exists at ${path.relative(cwd, existing) || './doccov.config.*'}.`,
          ),
        );
        process.exitCode = 1;
        return;
      }

      const packageType = detectPackageType(cwd, fileExists, readFileSync);
      // Use .ts for TypeScript projects, .mts for others
      const targetFormat = packageType === 'module' ? 'ts' : 'mts';

      const fileName = `doccov.config.${targetFormat}`;
      const outputPath = path.join(cwd, fileName);

      if (fileExists(outputPath)) {
        error(chalk.red(`Cannot create ${fileName}; file already exists.`));
        process.exitCode = 1;
        return;
      }

      const sym = getSymbols(supportsUnicode());

      // 1. Create config
      const template = buildConfigTemplate();
      writeFileSync(outputPath, template, { encoding: 'utf8' });
      log(colors.success(`${sym.success} Created ${fileName}`));

      // 2. Create GitHub Action workflow (unless skipped)
      if (!options.skipAction) {
        const workflowDir = path.join(cwd, '.github', 'workflows');
        const workflowPath = path.join(workflowDir, 'doccov.yml');

        if (!fileExists(workflowPath)) {
          mkdirSync(workflowDir, { recursive: true });
          writeFileSync(workflowPath, buildWorkflowTemplate(), { encoding: 'utf8' });
          log(colors.success(`${sym.success} Created .github/workflows/doccov.yml`));
        } else {
          log(
            colors.warning(`${sym.bullet} Skipped .github/workflows/doccov.yml (already exists)`),
          );
        }
      }

      // 3. Detect repo info for badge
      const repoInfo = detectRepoInfo(cwd, fileExists, readFileSync);

      // 4. Output badge snippet
      log('');
      log(chalk.bold('Add this badge to your README:'));
      log('');
      if (repoInfo) {
        log(
          chalk.cyan(
            `[![DocCov](https://doccov.dev/badge/${repoInfo.owner}/${repoInfo.repo})](https://doccov.dev/${repoInfo.owner}/${repoInfo.repo})`,
          ),
        );
      } else {
        log(
          chalk.cyan(
            `[![DocCov](https://doccov.dev/badge/OWNER/REPO)](https://doccov.dev/OWNER/REPO)`,
          ),
        );
        log(chalk.dim('  Replace OWNER/REPO with your GitHub repo'));
      }
      log('');

      // 5. Quick start hint
      log(chalk.dim('Run `doccov check` to verify your documentation coverage'));
    });
}

const findExistingConfig = (cwd: string, fileExists: typeof fs.existsSync): string | null => {
  let current = path.resolve(cwd);
  const { root } = path.parse(current);

  while (true) {
    for (const candidate of DOCCOV_CONFIG_FILENAMES) {
      const candidatePath = path.join(current, candidate);
      if (fileExists(candidatePath)) {
        return candidatePath;
      }
    }

    if (current === root) {
      break;
    }

    current = path.dirname(current);
  }

  return null;
};

const detectPackageType = (
  cwd: string,
  fileExists: typeof fs.existsSync,
  readFileSync: typeof fs.readFileSync,
): PackageType => {
  const packageJsonPath = findNearestPackageJson(cwd, fileExists);
  if (!packageJsonPath) {
    return undefined;
  }

  try {
    const raw = readFileSync(packageJsonPath, 'utf8');
    const parsed = JSON.parse(raw) as { type?: string };
    if (parsed.type === 'module') {
      return 'module';
    }
    if (parsed.type === 'commonjs') {
      return 'commonjs';
    }
  } catch (_error) {
    // Ignore malformed package.json entries and fall back to defaults.
  }

  return undefined;
};

const findNearestPackageJson = (cwd: string, fileExists: typeof fs.existsSync): string | null => {
  let current = path.resolve(cwd);
  const { root } = path.parse(current);

  while (true) {
    const candidate = path.join(current, 'package.json');
    if (fileExists(candidate)) {
      return candidate;
    }

    if (current === root) {
      break;
    }

    current = path.dirname(current);
  }

  return null;
};

const buildConfigTemplate = (): string => {
  return `import { defineConfig } from '@doccov/cli/config';

export default defineConfig({
  // Filter exports to analyze (optional)
  // include: ['MyClass', 'myFunction'],
  // exclude: ['internal*'],

  check: {
    // Fail if coverage drops below threshold
    minCoverage: 80,

    // Fail if drift exceeds threshold
    // maxDrift: 20,
  },
});
`;
};

const buildWorkflowTemplate = (): string => {
  return `name: DocCov

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  doccov:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: doccov/action@v1
        with:
          min-coverage: 80
          comment-on-pr: true
`;
};

const detectRepoInfo = (
  cwd: string,
  fileExists: typeof fs.existsSync,
  readFileSync: typeof fs.readFileSync,
): { owner: string; repo: string } | null => {
  // Try to read from package.json repository field
  const packageJsonPath = findNearestPackageJson(cwd, fileExists);
  if (packageJsonPath) {
    try {
      const raw = readFileSync(packageJsonPath, 'utf8');
      const parsed = JSON.parse(raw) as { repository?: string | { url?: string } };

      let repoUrl: string | undefined;
      if (typeof parsed.repository === 'string') {
        repoUrl = parsed.repository;
      } else if (parsed.repository?.url) {
        repoUrl = parsed.repository.url;
      }

      if (repoUrl) {
        // Parse GitHub URL: github.com/owner/repo or git+https://github.com/owner/repo.git
        const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
        if (match) {
          return { owner: match[1], repo: match[2] };
        }
      }
    } catch {
      // Ignore
    }
  }

  // Try to read from .git/config
  const gitConfigPath = path.join(cwd, '.git', 'config');
  if (fileExists(gitConfigPath)) {
    try {
      const config = readFileSync(gitConfigPath, 'utf8');
      const match = config.match(/url\s*=\s*.*github\.com[/:]([^/]+)\/([^/.]+)/);
      if (match) {
        return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
      }
    } catch {
      // Ignore
    }
  }

  return null;
};

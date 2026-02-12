/**
 * Extract a spec from a git ref.
 * git show <ref>:<path> → tmpdir → extract() → normalize() → cleanup
 */

import { execSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extract } from '@openpkg-ts/sdk';
import { normalize } from '@openpkg-ts/spec';

/**
 * Get the git repository root directory.
 */
function getGitRoot(cwd: string): string {
  return execSync('git rev-parse --show-toplevel', {
    encoding: 'utf-8',
    cwd,
    timeout: 5000,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

/**
 * List all source files tracked at a given ref under a directory prefix.
 */
function listFilesAtRef(ref: string, prefix: string, cwd: string): string[] {
  try {
    const output = execSync(`git ls-tree -r --name-only ${ref} -- ${prefix}`, {
      encoding: 'utf-8',
      cwd,
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Get file content at a specific git ref.
 */
function getFileAtRef(ref: string, filePath: string, cwd: string): string | null {
  try {
    return execSync(`git show ${ref}:${filePath}`, {
      encoding: 'utf-8',
      cwd,
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
}

/**
 * Validate that a git ref exists.
 */
export function validateRef(ref: string, cwd = process.cwd()): boolean {
  try {
    execSync(`git rev-parse --verify ${ref}`, {
      cwd,
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract a normalized spec from a git ref.
 *
 * Strategy:
 * 1. Create tmpdir
 * 2. Reconstruct the source tree at `ref` for the relevant directory
 * 3. Symlink node_modules + copy tsconfig for import resolution
 * 4. Run extract()
 * 5. Cleanup
 */
export async function extractSpecFromRef(
  ref: string,
  entry: string,
  cwd = process.cwd(),
): Promise<ReturnType<typeof normalize>> {
  // Git paths are always repo-root-relative, so resolve against git root
  const gitRoot = getGitRoot(cwd);
  const absEntry = path.resolve(cwd, entry);
  const repoRelEntry = path.relative(gitRoot, absEntry);
  const entryDir = path.dirname(repoRelEntry);

  // Determine source prefix to checkout (the directory containing the entry)
  // For monorepos: packages/sdk/src/index.ts → packages/sdk/
  // For simple: src/index.ts → src/ (but also need root files like tsconfig)
  const srcPrefix = entryDir.includes('/') ? entryDir.split('/').slice(0, 2).join('/') : '.';

  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'drift-git-'));

  try {
    // List and checkout all source files at ref (paths must be repo-root-relative)
    const prefixes = srcPrefix === '.' ? [''] : [srcPrefix];
    const rootFiles = ['tsconfig.json', 'tsconfig.base.json', 'package.json'];

    for (const prefix of prefixes) {
      const files = listFilesAtRef(ref, prefix || '.', gitRoot);
      for (const file of files) {
        if (!file.match(/\.(ts|tsx|json|js|mjs|cjs)$/)) continue;
        const content = getFileAtRef(ref, file, gitRoot);
        if (content === null) continue;
        const destPath = path.join(tmpDir, file);
        mkdirSync(path.dirname(destPath), { recursive: true });
        writeFileSync(destPath, content);
      }
    }

    // Also checkout root config files if not already present
    for (const rootFile of rootFiles) {
      const dest = path.join(tmpDir, rootFile);
      if (!existsSync(dest)) {
        const content = getFileAtRef(ref, rootFile, gitRoot);
        if (content) {
          writeFileSync(dest, content);
        }
      }
    }

    // Symlink node_modules from cwd for import resolution
    const nmSrc = path.join(cwd, 'node_modules');
    const nmDest = path.join(tmpDir, 'node_modules');
    if (existsSync(nmSrc) && !existsSync(nmDest)) {
      symlinkSync(nmSrc, nmDest, 'dir');
    }

    // Also try root node_modules if cwd differs from git root
    if (cwd !== gitRoot) {
      const rootNm = path.join(gitRoot, 'node_modules');
      const rootNmDest = path.join(tmpDir, 'node_modules');
      if (existsSync(rootNm) && !existsSync(rootNmDest)) {
        symlinkSync(rootNm, rootNmDest, 'dir');
      }
    }

    // If entry is inside a nested package, also symlink its node_modules
    if (srcPrefix !== '.') {
      const nestedNm = path.join(gitRoot, srcPrefix, 'node_modules');
      const nestedDest = path.join(tmpDir, srcPrefix, 'node_modules');
      if (existsSync(nestedNm) && !existsSync(nestedDest)) {
        symlinkSync(nestedNm, nestedDest, 'dir');
      }
    }

    // Copy tsconfig from cwd if not in git
    const tsconfigSrc = path.join(cwd, 'tsconfig.json');
    const tsconfigDest = path.join(tmpDir, 'tsconfig.json');
    if (existsSync(tsconfigSrc) && !existsSync(tsconfigDest)) {
      cpSync(tsconfigSrc, tsconfigDest);
    }

    // Extract
    const entryFile = path.join(tmpDir, repoRelEntry);
    if (!existsSync(entryFile)) {
      throw new Error(`Entry file not found at ref ${ref}: ${repoRelEntry}`);
    }

    const result = await extract({ entryFile });
    return normalize(result.spec);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

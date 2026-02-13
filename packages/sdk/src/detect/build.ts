/**
 * Build script and exotic project detection.
 */

import type { BuildInfo, FileSystem } from './types';
import { readPackageJson } from './utils';

/**
 * Script name patterns that indicate build scripts.
 */
const BUILD_SCRIPT_NAMES = new Set([
  'build',
  'compile',
  'tsc',
  'bundle',
  'prepare',
  'prepublish',
  'prepublishOnly',
]);

/**
 * Script name prefixes that indicate build scripts.
 */
const BUILD_SCRIPT_PREFIXES = ['build:', 'compile:', 'bundle:'];

/**
 * Tools that indicate a build script (when found in script contents).
 */
const BUILD_TOOL_PATTERNS = [
  'tsc',
  'esbuild',
  'rollup',
  'webpack',
  'vite build',
  'parcel build',
  'swc',
  'tsup',
  'unbuild',
  'bunup',
  'pkgroll',
  'microbundle',
  'babel',
  'ncc build',
];

/**
 * Detect build configuration and exotic project indicators.
 *
 * @param fs - FileSystem implementation
 * @param [packagePath] - Path to package directory (default: ".")
 * @returns Promise resolving to build info including scripts and exotic indicators
 */
export async function detectBuildInfo(fs: FileSystem, packagePath = '.'): Promise<BuildInfo> {
  const pkgJson = await readPackageJson(fs, packagePath);
  const scripts = pkgJson?.scripts ?? {};
  const scriptNames = Object.keys(scripts);

  // Find build-related scripts by name
  const buildScriptsByName = scriptNames.filter(
    (name) =>
      BUILD_SCRIPT_NAMES.has(name) ||
      BUILD_SCRIPT_PREFIXES.some((prefix) => name.startsWith(prefix)),
  );

  // Also check script contents for build tool invocations
  const buildScriptsByContent = scriptNames.filter((name) => {
    if (buildScriptsByName.includes(name)) return false; // Already found by name
    const content = scripts[name] ?? '';
    return BUILD_TOOL_PATTERNS.some(
      (tool) => content.includes(tool) && !content.includes(`${tool}-`),
    );
  });

  const buildScripts = [...new Set([...buildScriptsByName, ...buildScriptsByContent])];

  // Check for TypeScript
  const tsconfigPath = packagePath === '.' ? 'tsconfig.json' : `${packagePath}/tsconfig.json`;
  const hasTsConfig = await fs.exists(tsconfigPath);
  const hasTsDep =
    pkgJson?.devDependencies?.typescript !== undefined ||
    pkgJson?.dependencies?.typescript !== undefined;
  const hasTypeScript = hasTsConfig || hasTsDep;

  // Detect exotic indicators
  const wasm = await detectWasmProject(fs, packagePath, pkgJson);
  const napi = detectNapiProject(pkgJson);

  return {
    scripts: buildScripts,
    hasBuildScript: buildScripts.length > 0,
    hasTypeScript,
    exoticIndicators: { wasm, napi },
  };
}

/** Known WASM-related packages */
const WASM_PACKAGES = new Set([
  'wasm-pack',
  '@aspect/wasm-pack',
  '@aspect-build/wasm-pack',
  '@aspect/rules_js',
  'wasm-bindgen',
  '@aspect/aspect-cli',
]);

/**
 * Detect if this is a WASM project (Rust/wasm-pack).
 */
async function detectWasmProject(
  fs: FileSystem,
  packagePath: string,
  pkgJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } | null,
): Promise<boolean> {
  // Check for Cargo.toml in package directory
  const pkgCargoPath = packagePath === '.' ? 'Cargo.toml' : `${packagePath}/Cargo.toml`;
  if (await fs.exists(pkgCargoPath)) return true;

  // Check for Cargo.toml at repo root (common for WASM packages)
  if (packagePath !== '.' && (await fs.exists('Cargo.toml'))) return true;

  // Check for WASM-related packages in dependencies
  if (pkgJson) {
    const deps = Object.keys({
      ...(pkgJson.dependencies ?? {}),
      ...(pkgJson.devDependencies ?? {}),
    });

    if (deps.some((dep) => WASM_PACKAGES.has(dep))) {
      return true;
    }
  }

  return false;
}

/** Known napi-rs packages */
const NAPI_PACKAGES = new Set([
  '@napi-rs/cli',
  '@aspect/napi-cli',
  'napi',
  'napi-build',
  'napi-rs',
  'neon',
  '@aspect/neon-cli',
]);

/**
 * Detect if this is a napi-rs native addon project.
 */
function detectNapiProject(
  pkgJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } | null,
): boolean {
  if (!pkgJson) return false;

  const deps = Object.keys({
    ...(pkgJson.dependencies ?? {}),
    ...(pkgJson.devDependencies ?? {}),
  });

  return deps.some((dep) => NAPI_PACKAGES.has(dep) || dep.includes('@aspect/napi'));
}

/**
 * Get the primary build script name to run.
 * Prefers 'build' over 'compile' over 'tsc'.
 */
export function getPrimaryBuildScript(buildInfo: BuildInfo): string | null {
  if (buildInfo.scripts.includes('build')) return 'build';
  if (buildInfo.scripts.includes('compile')) return 'compile';
  if (buildInfo.scripts.includes('tsc')) return 'tsc';
  return buildInfo.scripts[0] ?? null;
}

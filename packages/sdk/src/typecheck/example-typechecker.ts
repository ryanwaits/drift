import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import type { ExampleTypeError, TypecheckOptions, TypecheckResult } from './types';

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
 * Read package.json to get package name
 */
function getPackageName(packagePath: string): string | undefined {
  const pkgJsonPath = path.join(packagePath, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      return pkgJson.name;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Find tsconfig.json in package path or parents
 */
function findTsConfig(packagePath: string): string | undefined {
  let dir = packagePath;
  while (dir !== path.dirname(dir)) {
    const tsConfigPath = path.join(dir, 'tsconfig.json');
    if (fs.existsSync(tsConfigPath)) {
      return tsConfigPath;
    }
    dir = path.dirname(dir);
  }
  return undefined;
}

/**
 * Check if code already imports from the package
 */
function hasPackageImport(code: string, packageName: string): boolean {
  // Match: import ... from 'packageName' or import ... from "packageName"
  const importRegex = new RegExp(
    `import\\s+.*from\\s+['"]${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
  );
  return importRegex.test(code);
}

/**
 * Create a virtual source file content with example code
 */
function createVirtualSource(
  example: string,
  packageName?: string,
  exportNames?: string[],
): string {
  const cleanCode = stripCodeBlockMarkers(example);
  const lines: string[] = [];

  // Add import statement only if:
  // 1. Package name is provided
  // 2. Export names are provided
  // 3. Example doesn't already import from the package
  if (packageName && exportNames && exportNames.length > 0 && !hasPackageImport(cleanCode, packageName)) {
    lines.push(`import { ${exportNames.join(', ')} } from '${packageName}';`);
    lines.push('');
  }

  lines.push(cleanCode);

  return lines.join('\n');
}

/**
 * Parse compiler options from tsconfig
 */
function getCompilerOptions(tsconfigPath?: string): ts.CompilerOptions {
  if (tsconfigPath && fs.existsSync(tsconfigPath)) {
    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    if (!configFile.error) {
      const parsed = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(tsconfigPath),
      );
      return {
        ...parsed.options,
        noEmit: true,
        skipLibCheck: true,
      };
    }
  }

  // Default compiler options
  return {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    esModuleInterop: true,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
  };
}

/**
 * Type-check a single example
 */
export function typecheckExample(
  example: string,
  packagePath: string,
  options: TypecheckOptions = {},
): ExampleTypeError[] {
  const errors: ExampleTypeError[] = [];
  const cleanCode = stripCodeBlockMarkers(example);

  // Get package name for imports
  const packageName = options.packageName ?? getPackageName(packagePath);
  const exportNames = options.exportNames;

  // Find tsconfig
  const tsconfigPath = options.tsconfig ?? findTsConfig(packagePath);
  const compilerOptions = getCompilerOptions(tsconfigPath);

  // Create virtual file content with export names for imports
  const virtualSource = createVirtualSource(cleanCode, packageName, exportNames);
  const virtualFileName = path.join(packagePath, '__drift_example__.ts');

  // Calculate line offset (for import statement we added)
  // Only offset if we added an import (example didn't already have one)
  const addedImport = packageName !== undefined &&
    exportNames &&
    exportNames.length > 0 &&
    !hasPackageImport(cleanCode, packageName);
  const lineOffset = addedImport ? 2 : 0; // import + blank line

  // Create a custom compiler host
  const sourceFile = ts.createSourceFile(
    virtualFileName,
    virtualSource,
    ts.ScriptTarget.ES2022,
    true,
  );

  const defaultHost = ts.createCompilerHost(compilerOptions);
  const customHost: ts.CompilerHost = {
    ...defaultHost,
    getSourceFile: (fileName, languageVersion) => {
      if (fileName === virtualFileName) {
        return sourceFile;
      }
      return defaultHost.getSourceFile(fileName, languageVersion);
    },
    fileExists: (fileName) => {
      if (fileName === virtualFileName) return true;
      return defaultHost.fileExists(fileName);
    },
    readFile: (fileName) => {
      if (fileName === virtualFileName) return virtualSource;
      return defaultHost.readFile(fileName);
    },
  };

  // Create program and get diagnostics
  const program = ts.createProgram([virtualFileName], compilerOptions, customHost);
  const diagnostics = ts.getPreEmitDiagnostics(program, sourceFile);

  // Map diagnostics to example errors
  for (const diagnostic of diagnostics) {
    if (diagnostic.file && diagnostic.start !== undefined) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);

      // Adjust line number to account for import offset
      const exampleLine = line - lineOffset + 1;

      // Skip errors in the import line
      if (exampleLine < 1) continue;

      errors.push({
        exampleIndex: 0,
        line: exampleLine,
        column: character + 1,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        code: diagnostic.code,
      });
    }
  }

  return errors;
}

/**
 * Type-check multiple examples
 */
export function typecheckExamples(
  examples: string[],
  packagePath: string,
  options: TypecheckOptions = {},
): TypecheckResult {
  const allErrors: ExampleTypeError[] = [];
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];
    if (!example || typeof example !== 'string' || !example.trim()) {
      continue;
    }

    const errors = typecheckExample(example, packagePath, options);

    // Update example index for all errors
    for (const error of errors) {
      allErrors.push({ ...error, exampleIndex: i });
    }

    if (errors.length > 0) {
      failed++;
    } else {
      passed++;
    }
  }

  return {
    errors: allErrors,
    passed,
    failed,
  };
}

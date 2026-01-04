import { spinner } from 'cli-utils';
import { buildDocCovSpec, DocCov, NodeFileSystem, resolveTarget } from '@doccov/sdk';
import type { OpenPkg } from '@openpkg-ts/spec';
import chalk from 'chalk';
import type { Command } from 'commander';
import { computeStats } from '../reports';

export function registerInfoCommand(program: Command): void {
  program
    .command('info [entry]')
    .description('Show brief documentation coverage summary')
    .option('--cwd <dir>', 'Working directory', process.cwd())
    .option('--package <name>', 'Target package name (for monorepos)')
    .option('--skip-resolve', 'Skip external type resolution from node_modules')
    .action(async (entry, options) => {
      const spin = spinner('Analyzing documentation coverage');

      try {
        // Resolve target directory and entry point
        const fileSystem = new NodeFileSystem(options.cwd);
        const resolved = await resolveTarget(fileSystem, {
          cwd: options.cwd,
          package: options.package,
          entry: entry as string | undefined,
        });

        const { entryFile, targetDir } = resolved;
        const resolveExternalTypes = !options.skipResolve;

        // Run analysis
        const analyzer = new DocCov({
          resolveExternalTypes,
        });
        const specResult = await analyzer.analyzeFileWithDiagnostics(entryFile);

        if (!specResult) {
          spin.fail('Failed to analyze');
          throw new Error('Failed to analyze documentation coverage.');
        }

        // Build DocCov spec and compute stats
        const openpkg = specResult.spec as OpenPkg;
        const doccov = buildDocCovSpec({
          openpkg,
          openpkgPath: entryFile,
          packagePath: targetDir,
          forgottenExports: specResult.forgottenExports,
        });
        const stats = computeStats(openpkg, doccov);

        spin.success('Analysis complete');

        // Output summary
        console.log('');
        console.log(chalk.bold(`${stats.packageName}@${stats.version}`));
        console.log('');
        console.log(`  Exports:    ${chalk.bold(stats.totalExports.toString())}`);
        console.log(`  Coverage:   ${chalk.bold(`${stats.coverageScore}%`)}`);
        console.log(`  Drift:      ${chalk.bold(`${stats.driftScore}%`)}`);
        console.log('');
      } catch (err) {
        spin.fail('Analysis failed');
        console.error(chalk.red('Error:'), err instanceof Error ? err.message : err);
        process.exit(1);
      }
    });
}

import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEFAULT_REPORT_DIR, findProjectRoot, getDoccovDir, getReportPath } from '@doccov/sdk';
import chalk from 'chalk';

export interface WriteReportOptions {
  /** Report format (json, markdown, html, github) */
  format: string;
  /** Report content to write */
  content: string;
  /** Custom output path (overrides default .doccov/ path) */
  outputPath?: string;
  /** Working directory */
  cwd?: string;
  /** Suppress success message */
  silent?: boolean;
}

export interface WriteReportResult {
  /** Absolute path where report was written */
  path: string;
  /** Format that was written */
  format: string;
  /** Relative path for display */
  relativePath: string;
}

/**
 * Write a report to the .doccov directory (or custom path).
 * Ensures the output directory exists before writing.
 * Uses project root for .doccov location (walks up from cwd to find root).
 */
export function writeReport(options: WriteReportOptions): WriteReportResult {
  const { format, content, outputPath, cwd = process.cwd(), silent = false } = options;

  // Determine output path (use project root for .doccov)
  const doccovDir = getDoccovDir(cwd);
  const reportPath = outputPath
    ? path.resolve(cwd, outputPath)
    : path.join(doccovDir, getReportPath(format).replace(DEFAULT_REPORT_DIR + '/', ''));

  // Ensure directory exists
  const dir = path.dirname(reportPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file
  fs.writeFileSync(reportPath, content);

  // Show path relative to project root for cleaner output (avoids ../../.doccov/...)
  const projectRoot = findProjectRoot(cwd);
  const relativePath = path.relative(projectRoot, reportPath);

  if (!silent) {
    console.log(chalk.green(`✓ Wrote ${format} report to ${relativePath}`));
  }

  return { path: reportPath, format, relativePath };
}

export interface WriteReportsOptions {
  /** Requested report format */
  format: string;
  /** Content for the requested format */
  formatContent: string;
  /** JSON report content (for caching) */
  jsonContent: string;
  /** Custom output path for the requested format */
  outputPath?: string;
  /** Working directory */
  cwd?: string;
}

/**
 * Write reports to .doccov directory.
 *
 * Always writes the JSON report as the canonical cache.
 * Additionally writes the requested format if different from JSON.
 *
 * @returns Array of written report results
 */
export function writeReports(options: WriteReportsOptions): WriteReportResult[] {
  const { format, formatContent, jsonContent, outputPath, cwd = process.cwd() } = options;
  const results: WriteReportResult[] = [];

  // Always write JSON report as canonical cache (silently if not the requested format)
  if (format !== 'json') {
    results.push(
      writeReport({
        format: 'json',
        content: jsonContent,
        cwd,
        silent: true,
      }),
    );
  }

  // Write the requested format
  results.push(
    writeReport({
      format,
      content: format === 'json' ? jsonContent : formatContent,
      outputPath,
      cwd,
    }),
  );

  return results;
}

/**
 * Ensure the .doccov directory exists.
 * Uses project root for .doccov location (walks up from cwd to find root).
 */
export function ensureReportDir(cwd: string = process.cwd()): string {
  const reportDir = getDoccovDir(cwd);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  return reportDir;
}

/**
 * Incremental analyzer for partial result recovery on crash/timeout.
 *
 * Writes analysis results to a temp file as exports are processed,
 * allowing recovery of partial results if the process is interrupted.
 *
 * @module analysis/incremental
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { DriftIssue, ExportAnalysis, MissingDocRule } from '@driftdev/spec';

/**
 * Result from analyzing a single export incrementally.
 */
export interface IncrementalExportResult {
  /** Export ID (usually export name) */
  id: string;
  /** Export name */
  name: string;
  /** Coverage score (0-100) */
  coverageScore: number;
  /** Missing documentation rules */
  missing?: MissingDocRule[];
  /** Drift issues detected */
  drift?: DriftIssue[];
  /** Number of overloads (if > 1) */
  overloadCount?: number;
  /** Timestamp when this result was written */
  timestamp: number;
}

/**
 * Partial analysis state recovered from temp file.
 */
export interface PartialAnalysisState {
  /** Results collected before interruption */
  results: IncrementalExportResult[];
  /** Total exports that were expected */
  totalExpected?: number;
  /** Whether analysis was interrupted */
  interrupted: boolean;
}

/**
 * Options for IncrementalAnalyzer.
 */
export interface IncrementalAnalyzerOptions {
  /** Custom temp directory (defaults to os.tmpdir()) */
  tempDir?: string;
  /** Prefix for temp file name */
  prefix?: string;
}

/**
 * Analyzer that persists results incrementally for crash recovery.
 *
 * Usage:
 * ```ts
 * const analyzer = new IncrementalAnalyzer();
 * analyzer.setTotal(exports.length);
 *
 * for (const exp of exports) {
 *   const result = analyzeExport(exp);
 *   await analyzer.writeResult(result);
 * }
 *
 * // On success, clean up
 * analyzer.cleanup();
 *
 * // On crash, recover partial results:
 * const partial = await analyzer.getPartialResults();
 * ```
 */
export class IncrementalAnalyzer {
  private tempPath: string;
  private totalExpected?: number;
  private resultCount = 0;
  private fileHandle?: fs.promises.FileHandle;

  constructor(options: IncrementalAnalyzerOptions = {}) {
    const tempDir = options.tempDir ?? os.tmpdir();
    const prefix = options.prefix ?? 'drift';
    this.tempPath = path.join(tempDir, `${prefix}-${Date.now()}-${process.pid}.ndjson`);
  }

  /**
   * Get the temp file path (for debugging/logging).
   */
  get path(): string {
    return this.tempPath;
  }

  /**
   * Get count of results written so far.
   */
  get count(): number {
    return this.resultCount;
  }

  /**
   * Set total expected exports (for progress reporting).
   */
  setTotal(total: number): void {
    this.totalExpected = total;
  }

  /**
   * Initialize the file handle for writing.
   * Called automatically on first writeResult, but can be called
   * explicitly for eager initialization.
   */
  async init(): Promise<void> {
    if (!this.fileHandle) {
      this.fileHandle = await fs.promises.open(this.tempPath, 'a');
      // Write header with metadata
      const header = {
        type: 'header',
        startedAt: new Date().toISOString(),
        totalExpected: this.totalExpected,
        pid: process.pid,
      };
      await this.fileHandle.appendFile(JSON.stringify(header) + '\n');
    }
  }

  /**
   * Write a single export result to the temp file.
   */
  async writeResult(result: IncrementalExportResult): Promise<void> {
    await this.init();
    const line = JSON.stringify({ type: 'result', ...result }) + '\n';
    await this.fileHandle!.appendFile(line);
    this.resultCount++;
  }

  /**
   * Write an export analysis result (converts from ExportAnalysis format).
   */
  async writeExportAnalysis(id: string, name: string, analysis: ExportAnalysis): Promise<void> {
    const result: IncrementalExportResult = {
      id,
      name,
      coverageScore: analysis.coverageScore,
      missing: analysis.missing,
      drift: analysis.drift,
      overloadCount: analysis.overloadCount,
      timestamp: Date.now(),
    };
    await this.writeResult(result);
  }

  /**
   * Read partial results from the temp file.
   * Returns empty array if file doesn't exist.
   */
  async getPartialResults(): Promise<PartialAnalysisState> {
    try {
      // Close handle if open (we're reading now)
      if (this.fileHandle) {
        await this.fileHandle.close();
        this.fileHandle = undefined;
      }

      const content = await fs.promises.readFile(this.tempPath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);

      const results: IncrementalExportResult[] = [];
      let totalExpected: number | undefined;

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'header') {
            totalExpected = parsed.totalExpected;
          } else if (parsed.type === 'result') {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { type, ...result } = parsed;
            results.push(result as IncrementalExportResult);
          }
        } catch {
          // Skip malformed lines (could be partial write on crash)
        }
      }

      return {
        results,
        totalExpected,
        interrupted: totalExpected !== undefined && results.length < totalExpected,
      };
    } catch (err) {
      // File doesn't exist or can't be read
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return { results: [], interrupted: false };
      }
      throw err;
    }
  }

  /**
   * Clean up the temp file. Call this on successful completion.
   */
  async cleanup(): Promise<void> {
    try {
      if (this.fileHandle) {
        await this.fileHandle.close();
        this.fileHandle = undefined;
      }
      await fs.promises.unlink(this.tempPath);
    } catch {
      // Ignore errors - file may not exist
    }
  }

  /**
   * Synchronous cleanup for use in signal handlers.
   * Note: May lose last few writes that haven't been flushed.
   */
  cleanupSync(): void {
    try {
      if (this.fileHandle) {
        // Can't close async handle synchronously, just unlink
        this.fileHandle = undefined;
      }
      fs.unlinkSync(this.tempPath);
    } catch {
      // Ignore errors
    }
  }

  /**
   * Check if temp file exists (for recovery detection).
   */
  exists(): boolean {
    return fs.existsSync(this.tempPath);
  }

  /**
   * Get partial results synchronously (for signal handlers).
   * May miss most recent writes.
   */
  getPartialResultsSync(): PartialAnalysisState {
    try {
      const content = fs.readFileSync(this.tempPath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);

      const results: IncrementalExportResult[] = [];
      let totalExpected: number | undefined;

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'header') {
            totalExpected = parsed.totalExpected;
          } else if (parsed.type === 'result') {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { type, ...result } = parsed;
            results.push(result as IncrementalExportResult);
          }
        } catch {
          // Skip malformed lines
        }
      }

      return {
        results,
        totalExpected,
        interrupted: totalExpected !== undefined && results.length < totalExpected,
      };
    } catch {
      return { results: [], interrupted: false };
    }
  }
}

/**
 * Find any orphaned temp files from previous crashed runs.
 * Returns paths to .ndjson files that match the drift pattern.
 */
export function findOrphanedTempFiles(
  tempDir: string = os.tmpdir(),
  prefix: string = 'drift',
): string[] {
  try {
    const files = fs.readdirSync(tempDir);
    return files
      .filter((f) => f.startsWith(prefix) && f.endsWith('.ndjson'))
      .map((f) => path.join(tempDir, f));
  } catch {
    return [];
  }
}

/**
 * Clean up orphaned temp files older than maxAge.
 *
 * @param maxAge - Maximum age in milliseconds (default: 1 hour)
 */
export function cleanupOrphanedTempFiles(
  tempDir: string = os.tmpdir(),
  prefix: string = 'drift',
  maxAge: number = 60 * 60 * 1000,
): number {
  const files = findOrphanedTempFiles(tempDir, prefix);
  const now = Date.now();
  let cleaned = 0;

  for (const file of files) {
    try {
      const stat = fs.statSync(file);
      if (now - stat.mtimeMs > maxAge) {
        fs.unlinkSync(file);
        cleaned++;
      }
    } catch {
      // Ignore errors
    }
  }

  return cleaned;
}

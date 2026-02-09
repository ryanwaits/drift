/**
 * Ratcheting: effective min = max(config.min, highest_ever).
 * Reads high watermark from ~/.drift/projects/<slug>/history.jsonl.
 */

import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { getProjectDir } from '../config/global';

interface HistoryEntry {
  date: string;
  coverage: number;
  [key: string]: unknown;
}

export interface RatchetResult {
  effectiveMin: number;
  watermark: number | null;
  watermarkDate: string | null;
}

export function computeRatchetMin(configMin: number, cwd = process.cwd()): RatchetResult {
  const historyPath = path.join(getProjectDir(cwd), 'history.jsonl');
  if (!existsSync(historyPath)) {
    return { effectiveMin: configMin, watermark: null, watermarkDate: null };
  }

  const lines = readFileSync(historyPath, 'utf-8').split('\n').filter(Boolean);
  let highestCoverage = 0;
  let highestDate: string | null = null;

  for (const line of lines) {
    try {
      const entry: HistoryEntry = JSON.parse(line);
      if (typeof entry.coverage === 'number' && entry.coverage > highestCoverage) {
        highestCoverage = entry.coverage;
        highestDate = entry.date ?? null;
      }
    } catch {
      // skip malformed lines
    }
  }

  if (highestCoverage === 0) {
    return { effectiveMin: configMin, watermark: null, watermarkDate: null };
  }

  return {
    effectiveMin: Math.max(configMin, highestCoverage),
    watermark: highestCoverage,
    watermarkDate: highestDate,
  };
}

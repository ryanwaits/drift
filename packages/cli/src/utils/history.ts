/**
 * History tracking: append-only JSONL file at ~/.drift/projects/<slug>/history.jsonl
 */

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { ensureProjectDir, getProjectDir } from '../config/global';

export interface HistoryEntry {
  date: string;
  package: string;
  coverage: number;
  lint: number;
  exports: number;
  commit?: string;
}

export function appendHistory(entries: HistoryEntry[], cwd = process.cwd()): void {
  const dir = ensureProjectDir(cwd);
  const filePath = path.join(dir, 'history.jsonl');
  const lines = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
  appendFileSync(filePath, lines);
}

export function readHistory(cwd = process.cwd()): HistoryEntry[] {
  const filePath = path.join(getProjectDir(cwd), 'history.jsonl');
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, 'utf-8');
  const entries: HistoryEntry[] = [];
  for (const line of content.split('\n').filter(Boolean)) {
    try {
      entries.push(JSON.parse(line));
    } catch {}
  }
  return entries;
}

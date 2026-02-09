/**
 * Output engine: TTY detection, format routing, rendering primitives.
 * Human output to stdout when TTY. JSON envelope when piped.
 */

import chalk from 'chalk';

// --- Output mode ---

let _forceJson = false;
let _forceHuman = false;

export function setOutputMode(flags: { json?: boolean; human?: boolean }): void {
  _forceJson = !!flags.json;
  _forceHuman = !!flags.human;
}

export function isTTY(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.TERM === 'dumb') return false;
  return !!process.stdout.isTTY;
}

export function shouldRenderHuman(): boolean {
  if (_forceJson) return false;
  if (_forceHuman) return true;
  return isTTY();
}

// --- Symbols ---

export const sym = {
  ok: 'ok',
  x: 'x',
  plus: '+',
  minus: '-',
  tilde: '~',
  bang: '!',
  branch: '|-',
  end: '\\-',
  dot: '.',
  dash: '--',
} as const;

// --- Colors (all gated on isTTY via chalk) ---

export const c = {
  green: (s: string) => chalk.green(s),
  yellow: (s: string) => chalk.yellow(s),
  red: (s: string) => chalk.red(s),
  gray: (s: string) => chalk.gray(s),
  white: (s: string) => chalk.white(s),
  bold: (s: string) => chalk.bold(s),
  dim: (s: string) => chalk.dim(s),
};

// --- Rendering primitives ---

export function progressBar(pct: number, width = 10): string {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  return '|'.repeat(filled) + '.'.repeat(empty);
}

export function coverageColor(pct: number): (s: string) => string {
  if (pct >= 80) return c.green;
  if (pct >= 50) return c.yellow;
  return c.red;
}

export function padRight(s: string, len: number): string {
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

export function padLeft(s: string, len: number): string {
  return s.length >= len ? s : ' '.repeat(len - s.length) + s;
}

export function indent(s: string, n = 2): string {
  const prefix = ' '.repeat(n);
  return s
    .split('\n')
    .map((line) => prefix + line)
    .join('\n');
}

export function separator(width = 47): string {
  return '-'.repeat(width);
}

export function table(rows: string[][], colWidths?: number[]): string {
  if (rows.length === 0) return '';

  const widths =
    colWidths ??
    rows[0].map((_, colIdx) => Math.max(...rows.map((row) => (row[colIdx] ?? '').length)));

  return rows
    .map((row) => row.map((cell, i) => padRight(cell ?? '', widths[i])).join('  '))
    .join('\n');
}

/**
 * Universal output envelope for drift CLI.
 * Human output when TTY. JSON envelope when piped.
 */

import { c, shouldRenderHuman } from './render';

/**
 * Wall-clock duration for the envelope. Reports 0 when SOURCE_DATE_EPOCH is
 * set (reproducible-builds convention) so JSON output is byte-stable across
 * runs and can be diffed/cached in CI.
 */
function elapsed(startTime: number): number {
  if (process.env.SOURCE_DATE_EPOCH !== undefined) return 0;
  return Date.now() - startTime;
}

export interface OutputMeta {
  command: string;
  duration: number;
  version: string;
}

export interface OutputNext {
  suggested: string;
  reason: string;
}

export interface OutputEnvelope<T = unknown> {
  ok: boolean;
  data: T;
  meta: OutputMeta;
  next?: OutputNext;
}

/**
 * Write output. Human-readable to stdout when TTY, JSON envelope otherwise.
 * When humanRenderer is provided and mode is human, renders that instead.
 */
export function formatOutput<T>(
  command: string,
  data: T,
  startTime: number,
  version: string,
  humanRenderer?: (data: T, next?: OutputNext) => string,
  next?: OutputNext,
): OutputEnvelope<T> {
  const duration = elapsed(startTime);
  const envelope: OutputEnvelope<T> = {
    ok: true,
    data,
    meta: { command, duration, version },
    ...(next ? { next } : {}),
  };

  if (humanRenderer && shouldRenderHuman()) {
    process.stdout.write(humanRenderer(data, next));
    process.stdout.write('\n');
  } else {
    process.stdout.write(`${JSON.stringify(envelope)}\n`);
    process.stderr.write(`drift ${command} completed in ${duration}ms\n`);
  }

  return envelope;
}

/**
 * Write error output. Human-readable when TTY, JSON envelope otherwise.
 *
 * Exit codes follow the grep convention so agents/CI can distinguish outcomes
 * without parsing: 0 = clean, 1 = findings or lookup miss, 2 = usage/internal
 * error. Pass exitCode 1 for "not found" results; default 2 is for errors.
 */
export function formatError(
  command: string,
  error: string,
  startTime: number,
  version: string,
  suggestion?: string,
  exitCode: 1 | 2 = 2,
): void {
  const duration = elapsed(startTime);

  if (shouldRenderHuman()) {
    process.stdout.write(`\n  ${c.red('x')} ${error}\n`);
    if (suggestion) process.stdout.write(`  ${c.gray(suggestion)}\n`);
    process.stdout.write('\n');
  } else {
    const envelope = {
      ok: false,
      error,
      meta: { command, duration, version },
    };
    process.stdout.write(`${JSON.stringify(envelope)}\n`);
    process.stderr.write(`drift ${command} failed: ${error}\n`);
  }

  process.exitCode = exitCode;
}

/**
 * Write a warning to stderr. Does not affect exit code.
 */
export function formatWarning(message: string): void {
  if (shouldRenderHuman()) {
    process.stderr.write(`  ${c.yellow('!')} ${message}\n`);
  } else {
    process.stderr.write(`warning: ${message}\n`);
  }
}

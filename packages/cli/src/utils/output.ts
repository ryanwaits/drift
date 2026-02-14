/**
 * Universal output envelope for drift CLI.
 * Human output when TTY. JSON envelope when piped.
 */

import { c, shouldRenderHuman } from './render';

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
  const duration = Date.now() - startTime;
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
 */
export function formatError(
  command: string,
  error: string,
  startTime: number,
  version: string,
  suggestion?: string,
): void {
  const duration = Date.now() - startTime;

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

  process.exitCode = 1;
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

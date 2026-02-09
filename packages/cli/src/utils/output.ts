/**
 * Universal output envelope for drift CLI.
 * Human output when TTY. JSON envelope when piped.
 */

import { shouldRenderHuman, c } from './render';

export interface OutputMeta {
  command: string;
  duration: number;
  version: string;
}

export interface OutputEnvelope<T = unknown> {
  ok: boolean;
  data: T;
  meta: OutputMeta;
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
  humanRenderer?: (data: T) => string,
): OutputEnvelope<T> {
  const duration = Date.now() - startTime;
  const envelope: OutputEnvelope<T> = {
    ok: true,
    data,
    meta: { command, duration, version },
  };

  if (humanRenderer && shouldRenderHuman()) {
    process.stdout.write(humanRenderer(data));
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
export function formatError(command: string, error: string, startTime: number, version: string): void {
  const duration = Date.now() - startTime;

  if (shouldRenderHuman()) {
    process.stdout.write(`\n  ${c.red('x')} ${error}\n\n`);
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

/**
 * Signal handler utilities for graceful shutdown and partial result recovery.
 *
 * @module utils/signal-handler
 */

import type { IncrementalAnalyzer, PartialAnalysisState } from '@doccov/sdk';
import chalk from 'chalk';

/** Handler function type for shutdown */
type ShutdownHandler = () => void | Promise<void>;

/** State for tracking registered handlers */
interface SignalState {
  handlers: ShutdownHandler[];
  incrementalAnalyzer?: IncrementalAnalyzer;
  onPartialResults?: (state: PartialAnalysisState) => void;
  registered: boolean;
}

const state: SignalState = {
  handlers: [],
  registered: false,
};

/**
 * Register signal handlers for graceful shutdown.
 * Call once at CLI startup.
 */
export function registerSignalHandlers(): void {
  if (state.registered) return;

  const handler = (signal: string) => {
    console.error(chalk.yellow(`\n⚠️  Received ${signal}, shutting down...`));

    // Try to output partial results if incremental analyzer is set
    if (state.incrementalAnalyzer && state.onPartialResults) {
      try {
        const partial = state.incrementalAnalyzer.getPartialResultsSync();
        if (partial.results.length > 0) {
          console.error(
            chalk.yellow(`\nPartial results available: ${partial.results.length} exports analyzed`),
          );
          state.onPartialResults(partial);
        }
      } catch {
        // Ignore errors during shutdown
      }
    }

    // Run registered handlers
    for (const h of state.handlers) {
      try {
        h();
      } catch {
        // Ignore errors during shutdown
      }
    }

    process.exit(1);
  };

  process.on('SIGINT', () => handler('SIGINT'));
  process.on('SIGTERM', () => handler('SIGTERM'));

  state.registered = true;
}

/**
 * Set the incremental analyzer for partial result recovery.
 * When a signal is received, partial results will be output.
 */
export function setIncrementalAnalyzer(
  analyzer: IncrementalAnalyzer,
  onPartialResults: (state: PartialAnalysisState) => void,
): void {
  state.incrementalAnalyzer = analyzer;
  state.onPartialResults = onPartialResults;
}

/**
 * Clear the incremental analyzer (on successful completion).
 */
export function clearIncrementalAnalyzer(): void {
  state.incrementalAnalyzer = undefined;
  state.onPartialResults = undefined;
}

/**
 * Register a shutdown handler to be called on SIGINT/SIGTERM.
 */
export function onShutdown(handler: ShutdownHandler): void {
  state.handlers.push(handler);
}

/**
 * Remove a shutdown handler.
 */
export function removeShutdownHandler(handler: ShutdownHandler): void {
  const idx = state.handlers.indexOf(handler);
  if (idx >= 0) {
    state.handlers.splice(idx, 1);
  }
}

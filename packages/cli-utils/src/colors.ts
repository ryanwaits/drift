import type { ChalkInstance } from 'chalk';
import chalk from 'chalk';

// Color scheme
export const colors: Record<string, ChalkInstance> = {
  // Status colors
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.cyan,
  muted: chalk.gray,

  // Emphasis
  bold: chalk.bold,
  dim: chalk.dim,
  underline: chalk.underline,

  // Branded
  primary: chalk.cyan,
  secondary: chalk.magenta,

  // Semantic
  path: chalk.cyan,
  number: chalk.yellow,
  code: chalk.gray,
};

export interface Symbols {
  success: string;
  error: string;
  warning: string;
  info: string;
  spinner: readonly string[];
  bullet: string;
  arrow: string;
  arrowRight: string;
  line: string;
  corner: string;
  vertical: string;
  horizontalLine: string;
}

// Unicode symbols (with ASCII fallbacks)
export const symbols: Symbols = {
  // Status
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',

  // Progress
  spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const,
  bullet: '•',
  arrow: '→',
  arrowRight: '›',

  // Decorative
  line: '─',
  corner: '└',
  vertical: '│',
  horizontalLine: '─',
};

// ASCII fallbacks for non-unicode terminals
export const asciiSymbols: Symbols = {
  success: '+',
  error: 'x',
  warning: '!',
  info: 'i',
  spinner: ['-', '\\', '|', '/'] as const,
  bullet: '*',
  arrow: '->',
  arrowRight: '>',
  line: '-',
  corner: '\\',
  vertical: '|',
  horizontalLine: '-',
};

// Helper to get appropriate symbols based on unicode support
export function getSymbols(unicodeSupport = true): Symbols {
  return unicodeSupport ? symbols : asciiSymbols;
}

// Pre-styled status prefixes
export const prefix: Record<string, string> = {
  success: colors.success(symbols.success),
  error: colors.error(symbols.error),
  warning: colors.warning(symbols.warning),
  info: colors.info(symbols.info),
};

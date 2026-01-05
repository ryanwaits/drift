import { colors, getSymbols } from './colors';
import { getTerminalWidth, stripAnsi, supportsUnicode } from './utils';

export interface SummaryItem {
  /** Key/label for this item */
  key: string;
  /** Value to display */
  value: string | number;
  /** Optional status indicator */
  status?: 'pass' | 'fail' | 'warn' | 'info';
  /** Optional threshold for comparison */
  threshold?: { value: number; operator: '<' | '>' | '<=' | '>=' };
}

export interface SummaryOptions {
  /** Title for the summary */
  title?: string;
  /** Show a box around the summary (default: false) */
  boxed?: boolean;
  /** Minimum width for keys (for alignment) */
  keyWidth?: number;
}

export class Summary {
  private items: SummaryItem[] = [];
  private title: string | undefined;
  private boxed: boolean;
  private keyWidth: number | undefined;
  private symbols = getSymbols(supportsUnicode());

  constructor(options: SummaryOptions = {}) {
    this.title = options.title;
    this.boxed = options.boxed ?? false;
    this.keyWidth = options.keyWidth;
  }

  /** Add an item to the summary */
  add(item: SummaryItem): this {
    this.items.push(item);
    return this;
  }

  /** Add a simple key-value pair */
  addKeyValue(key: string, value: string | number, status?: SummaryItem['status']): this {
    return this.add({ key, value, status });
  }

  /** Add item with threshold comparison */
  addWithThreshold(key: string, value: number, threshold: SummaryItem['threshold']): this {
    const status = this.evaluateThreshold(value, threshold) ? 'pass' : 'fail';
    return this.add({ key, value, status, threshold });
  }

  /** Render and print the summary */
  print(): void {
    const output = this.render();
    console.log(output);
  }

  /** Render the summary to a string */
  render(): string {
    if (this.items.length === 0) return '';

    const lines: string[] = [];
    const termWidth = getTerminalWidth();

    // Calculate key width for alignment
    const calculatedKeyWidth = this.keyWidth ?? Math.max(...this.items.map((i) => i.key.length));

    if (this.boxed) {
      return this.renderBoxed(calculatedKeyWidth, termWidth);
    }

    // Title
    if (this.title) {
      lines.push(colors.bold(this.title));
      lines.push('');
    }

    // Items
    for (const item of this.items) {
      lines.push(this.formatItem(item, calculatedKeyWidth));
    }

    return lines.join('\n');
  }

  private renderBoxed(keyWidth: number, termWidth: number): string {
    const lines: string[] = [];
    const unicode = supportsUnicode();

    // Box characters
    const box = unicode
      ? { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' }
      : { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|' };

    // Calculate content width
    const contentLines = this.items.map((item) => this.formatItem(item, keyWidth));
    const maxContentWidth = Math.max(
      ...contentLines.map((l) => stripAnsi(l).length),
      this.title ? this.title.length : 0,
    );
    const innerWidth = Math.min(maxContentWidth + 2, termWidth - 4);

    // Top border
    lines.push(box.tl + box.h.repeat(innerWidth) + box.tr);

    // Title
    if (this.title) {
      const padding = innerWidth - this.title.length;
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      lines.push(
        `${box.v}${' '.repeat(leftPad)}${colors.bold(this.title)}${' '.repeat(rightPad)}${box.v}`,
      );
      lines.push(`${box.v}${' '.repeat(innerWidth)}${box.v}`);
    }

    // Items
    for (const line of contentLines) {
      const visibleLen = stripAnsi(line).length;
      const padding = innerWidth - visibleLen - 1;
      lines.push(`${box.v} ${line}${' '.repeat(Math.max(0, padding))}${box.v}`);
    }

    // Bottom border
    lines.push(box.bl + box.h.repeat(innerWidth) + box.br);

    return lines.join('\n');
  }

  private formatItem(item: SummaryItem, keyWidth: number): string {
    const key = item.key.padEnd(keyWidth);
    const value = String(item.value);

    // Status indicator
    let indicator = '';
    if (item.status) {
      switch (item.status) {
        case 'pass':
          indicator = `${colors.success(this.symbols.success)} `;
          break;
        case 'fail':
          indicator = `${colors.error(this.symbols.error)} `;
          break;
        case 'warn':
          indicator = `${colors.warning(this.symbols.warning)} `;
          break;
        case 'info':
          indicator = `${colors.info(this.symbols.info)} `;
          break;
      }
    }

    // Threshold display
    let thresholdStr = '';
    if (item.threshold) {
      const { operator, value: thresh } = item.threshold;
      thresholdStr = colors.muted(` (${operator} ${thresh})`);
    }

    // Color value based on status
    let coloredValue = value;
    if (item.status === 'pass') coloredValue = colors.success(value);
    else if (item.status === 'fail') coloredValue = colors.error(value);
    else if (item.status === 'warn') coloredValue = colors.warning(value);

    return `${indicator}${colors.muted(key)}  ${coloredValue}${thresholdStr}`;
  }

  private evaluateThreshold(value: number, threshold: SummaryItem['threshold']): boolean {
    if (!threshold) return true;
    const { operator, value: thresh } = threshold;
    switch (operator) {
      case '<':
        return value < thresh;
      case '>':
        return value > thresh;
      case '<=':
        return value <= thresh;
      case '>=':
        return value >= thresh;
    }
  }
}

/** Format a single key-value pair (standalone helper) */
export function formatKeyValue(
  key: string,
  value: string | number,
  options?: { keyWidth?: number; status?: SummaryItem['status'] },
): string {
  const keyWidth = options?.keyWidth ?? key.length;
  const paddedKey = key.padEnd(keyWidth);
  const symbols = getSymbols(supportsUnicode());

  let indicator = '';
  let coloredValue = String(value);

  if (options?.status) {
    switch (options.status) {
      case 'pass':
        indicator = `${colors.success(symbols.success)} `;
        coloredValue = colors.success(String(value));
        break;
      case 'fail':
        indicator = `${colors.error(symbols.error)} `;
        coloredValue = colors.error(String(value));
        break;
      case 'warn':
        indicator = `${colors.warning(symbols.warning)} `;
        coloredValue = colors.warning(String(value));
        break;
      case 'info':
        indicator = `${colors.info(symbols.info)} `;
        break;
    }
  }

  return `${indicator}${colors.muted(paddedKey)}  ${coloredValue}`;
}

/** Create a summary builder */
export function summary(options?: SummaryOptions): Summary {
  return new Summary(options);
}

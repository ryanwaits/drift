/**
 * Sparkline: render a series of values as unicode bar chars.
 */

const BARS = '▁▂▃▄▅▆▇█';

export function sparkline(values: number[]): string {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((v) => BARS[Math.min(Math.round(((v - min) / range) * 7), 7)]).join('');
}

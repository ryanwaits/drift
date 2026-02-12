/**
 * Fuzzy matching for export names.
 * No external deps — substring + case-insensitive + word-boundary scoring.
 */

export function fuzzyMatch(query: string, name: string): number {
  const q = query.toLowerCase();
  const n = name.toLowerCase();

  // Exact match
  if (n === q) return 100;

  // Starts with
  if (n.startsWith(q)) return 90;

  // Contains as substring
  if (n.includes(q)) return 70;

  // Match against split compound name (camelCase, PascalCase)
  const words = splitCompoundName(n);
  for (const word of words) {
    if (word === q) return 80;
    if (word.startsWith(q)) return 60;
  }

  // Levenshtein for close typos (only if lengths are similar)
  if (Math.abs(q.length - n.length) <= 3) {
    const dist = levenshtein(q, n);
    if (dist <= 2) return 50 - dist * 10;
  }

  return 0;
}

export function fuzzySearch(
  query: string,
  items: { name: string }[],
): { name: string; score: number }[] {
  return items
    .map((item) => ({ name: item.name, score: fuzzyMatch(query, item.name) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function fuzzyTop(query: string, items: { name: string }[], n = 3): string[] {
  return fuzzySearch(query, items)
    .slice(0, n)
    .map((r) => r.name);
}

function splitCompoundName(name: string): string[] {
  // Split on camelCase/PascalCase boundaries and underscores
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }

  return dp[m][n];
}

/**
 * Detect if a string looks like a file path vs a search term.
 */
export function looksLikeFilePath(s: string): boolean {
  if (s.includes('/') || s.includes('\\')) return true;
  if (
    s.endsWith('.ts') ||
    s.endsWith('.tsx') ||
    s.endsWith('.js') ||
    s.endsWith('.mts') ||
    s.endsWith('.cts')
  )
    return true;
  if (s.startsWith('.')) return true;
  return false;
}

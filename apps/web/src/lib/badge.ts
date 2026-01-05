export type BadgeStyle = 'flat' | 'flat-square' | 'for-the-badge';

/**
 * DocCov report structure (subset needed for badge).
 */
export interface DocCovReportBadge {
  doccov: string;
  summary: {
    score?: number;
    totalExports?: number;
    health?: {
      score: number;
    };
    drift?: {
      total: number;
    };
  };
}

/**
 * Fetch JSON from GitHub raw content.
 * Edge-compatible - uses only fetch.
 */
async function fetchGitHubJson<T>(
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<T | null> {
  const urls = [
    `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`,
    `https://raw.githubusercontent.com/${owner}/${repo}/master/${path}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return (await res.json()) as T;
      }
    } catch {
      // Try next URL
    }
  }

  return null;
}

/**
 * DocCov report result for badge display.
 */
export interface DocCovReportResult {
  score: number;
  driftScore?: number;
}

/**
 * Fetch DocCov report from GitHub.
 * Returns health score and drift data from doccov.json.
 *
 * Path should be `.doccov/{packageName}/doccov.json`
 * For scoped packages: `.doccov/@org/pkg/doccov.json`
 */
export async function fetchDocCovReport(
  owner: string,
  repo: string,
  options: { ref?: string; path?: string } = {},
): Promise<DocCovReportResult | null> {
  const ref = options.ref ?? 'main';
  // No universal default - path is package-specific
  // Try common locations if not specified
  const reportPath = options.path ?? '.doccov/doccov.json';

  const report = await fetchGitHubJson<DocCovReportBadge>(owner, repo, reportPath, ref);

  if (!report?.summary) {
    return null;
  }

  // Prefer health.score, fall back to summary.score
  const score = report.summary.health?.score ?? report.summary.score;
  if (typeof score !== 'number') {
    return null;
  }

  // Calculate drift percentage (% of exports with drift issues)
  let driftScore: number | undefined;
  if (report.summary.drift && report.summary.totalExports) {
    driftScore = Math.round((report.summary.drift.total / report.summary.totalExports) * 100);
  }

  return { score, driftScore };
}

export type BadgeColor =
  | 'brightgreen'
  | 'green'
  | 'yellowgreen'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'lightgrey';

export interface BadgeOptions {
  label: string;
  message: string;
  color: BadgeColor;
  style?: BadgeStyle;
}

export function getColorForScore(score: number): BadgeColor {
  if (score >= 90) return 'brightgreen';
  if (score >= 80) return 'green';
  if (score >= 70) return 'yellowgreen';
  if (score >= 60) return 'yellow';
  if (score >= 50) return 'orange';
  return 'red';
}

export function getDriftColor(score: number): BadgeColor {
  // Inverse of coverage - lower is better
  if (score <= 5) return 'brightgreen';
  if (score <= 10) return 'green';
  if (score <= 20) return 'yellowgreen';
  if (score <= 30) return 'yellow';
  if (score <= 50) return 'orange';
  return 'red';
}

const BADGE_COLORS: Record<BadgeColor, string> = {
  brightgreen: '#4c1',
  green: '#97ca00',
  yellowgreen: '#a4a61d',
  yellow: '#dfb317',
  orange: '#fe7d37',
  red: '#e05d44',
  lightgrey: '#9f9f9f',
};

function generateFlatBadge(label: string, message: string, bgColor: string): string {
  const labelWidth = label.length * 7 + 10;
  const messageWidth = message.length * 7 + 10;
  const totalWidth = labelWidth + messageWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${message}">
  <title>${label}: ${message}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${bgColor}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text aria-hidden="true" x="${labelWidth + messageWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${message}</text>
    <text x="${labelWidth + messageWidth / 2}" y="14">${message}</text>
  </g>
</svg>`;
}

function generateFlatSquareBadge(label: string, message: string, bgColor: string): string {
  const labelWidth = label.length * 7 + 10;
  const messageWidth = message.length * 7 + 10;
  const totalWidth = labelWidth + messageWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${message}">
  <title>${label}: ${message}</title>
  <g shape-rendering="crispEdges">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${bgColor}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + messageWidth / 2}" y="14">${message}</text>
  </g>
</svg>`;
}

function generateForTheBadge(label: string, message: string, bgColor: string): string {
  const labelUpper = label.toUpperCase();
  const messageUpper = message.toUpperCase();
  const labelWidth = labelUpper.length * 10 + 20;
  const messageWidth = messageUpper.length * 10 + 20;
  const totalWidth = labelWidth + messageWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="28" role="img" aria-label="${label}: ${message}">
  <title>${label}: ${message}</title>
  <g shape-rendering="crispEdges">
    <rect width="${labelWidth}" height="28" fill="#555"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="28" fill="${bgColor}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="10" font-weight="bold">
    <text x="${labelWidth / 2}" y="18">${labelUpper}</text>
    <text x="${labelWidth + messageWidth / 2}" y="18">${messageUpper}</text>
  </g>
</svg>`;
}

export function generateBadgeSvg(options: BadgeOptions): string {
  const { label, message, color, style = 'flat' } = options;
  const bgColor = BADGE_COLORS[color];

  switch (style) {
    case 'flat-square':
      return generateFlatSquareBadge(label, message, bgColor);
    case 'for-the-badge':
      return generateForTheBadge(label, message, bgColor);
    default:
      return generateFlatBadge(label, message, bgColor);
  }
}

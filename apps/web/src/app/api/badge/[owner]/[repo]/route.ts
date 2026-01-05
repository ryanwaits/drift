import type { NextRequest } from 'next/server';
import {
  type BadgeStyle,
  fetchDocCovReport,
  generateBadgeSvg,
  getColorForScore,
} from '@/lib/badge';

const CACHE_HEADERS_SUCCESS = {
  'Content-Type': 'image/svg+xml',
  'Cache-Control': 'public, max-age=300, stale-if-error=3600',
};

const CACHE_HEADERS_ERROR = {
  'Content-Type': 'image/svg+xml',
  'Cache-Control': 'no-cache',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> },
) {
  const { owner, repo } = await params;
  const searchParams = request.nextUrl.searchParams;

  const ref = searchParams.get('ref') ?? searchParams.get('branch') ?? 'main';
  const path = searchParams.get('path'); // optional override
  const style = (searchParams.get('style') ?? 'flat') as BadgeStyle;

  try {
    const report = await fetchDocCovReport(owner, repo, { ref, path: path ?? undefined });

    if (!report) {
      const svg = generateBadgeSvg({
        label: 'docs',
        message: 'not found',
        color: 'lightgrey',
        style,
      });
      return new Response(svg, { status: 404, headers: CACHE_HEADERS_ERROR });
    }

    const svg = generateBadgeSvg({
      label: 'docs',
      message: `${report.score}%`,
      color: getColorForScore(report.score),
      style,
    });

    return new Response(svg, { status: 200, headers: CACHE_HEADERS_SUCCESS });
  } catch {
    const svg = generateBadgeSvg({
      label: 'docs',
      message: 'error',
      color: 'red',
      style,
    });
    return new Response(svg, { status: 500, headers: CACHE_HEADERS_ERROR });
  }
}

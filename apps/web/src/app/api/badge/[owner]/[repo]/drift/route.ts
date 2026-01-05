import type { NextRequest } from 'next/server';
import { type BadgeStyle, fetchDocCovReport, generateBadgeSvg, getDriftColor } from '@/lib/badge';

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
  const path = searchParams.get('path');
  const style = (searchParams.get('style') ?? 'flat') as BadgeStyle;

  try {
    const report = await fetchDocCovReport(owner, repo, { ref, path: path ?? undefined });

    if (!report) {
      const svg = generateBadgeSvg({
        label: 'drift',
        message: 'not found',
        color: 'lightgrey',
        style,
      });
      return new Response(svg, { status: 404, headers: CACHE_HEADERS_ERROR });
    }

    const driftScore = report.driftScore ?? 0;

    const svg = generateBadgeSvg({
      label: 'drift',
      message: `${driftScore}%`,
      color: getDriftColor(driftScore),
      style,
    });

    return new Response(svg, { status: 200, headers: CACHE_HEADERS_SUCCESS });
  } catch {
    const svg = generateBadgeSvg({
      label: 'drift',
      message: 'error',
      color: 'red',
      style,
    });
    return new Response(svg, { status: 500, headers: CACHE_HEADERS_ERROR });
  }
}

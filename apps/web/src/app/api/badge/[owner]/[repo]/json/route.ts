import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { fetchDocCovReport, getColorForScore } from '@/lib/badge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> },
) {
  const { owner, repo } = await params;
  const searchParams = request.nextUrl.searchParams;

  const ref = searchParams.get('ref') ?? searchParams.get('branch') ?? 'main';
  const path = searchParams.get('path');

  try {
    const report = await fetchDocCovReport(owner, repo, { ref, path: path ?? undefined });

    if (!report) {
      return NextResponse.json(
        { schemaVersion: 1, label: 'docs', message: 'not found', color: 'lightgrey' },
        { status: 404, headers: { 'Cache-Control': 'no-cache' } },
      );
    }

    return NextResponse.json(
      {
        schemaVersion: 1,
        label: 'docs',
        message: `${report.score}%`,
        color: getColorForScore(report.score),
      },
      { status: 200, headers: { 'Cache-Control': 'public, max-age=300, stale-if-error=3600' } },
    );
  } catch {
    return NextResponse.json(
      { schemaVersion: 1, label: 'docs', message: 'error', color: 'red' },
      { status: 500, headers: { 'Cache-Control': 'no-cache' } },
    );
  }
}

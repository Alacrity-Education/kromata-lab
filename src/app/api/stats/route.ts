import { NextResponse } from 'next/server';
import { getStats } from '@/lib/usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Machine-readable usage report. The /stats page renders the same data. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(await getStats(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

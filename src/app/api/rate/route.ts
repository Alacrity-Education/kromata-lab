import { NextResponse, type NextRequest } from 'next/server';
import { attachSession, readSession } from '@/lib/session';
import { appendUsage } from '@/lib/usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Thumbs up or down on one conversion.
 *
 * Written as its own row in the usage log rather than edited into the conversion's row: ratings
 * arrive later, and rewriting a line in an append-only file means rewriting the file. The two are
 * joined by conversion id when stats are computed.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = readSession(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON object' }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b['id'] !== 'string' || b['id'].length === 0) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }
  if (b['rating'] !== 1 && b['rating'] !== -1) {
    return NextResponse.json({ error: 'rating must be 1 or -1' }, { status: 400 });
  }

  await appendUsage({
    t: 'rate',
    id: b['id'],
    at: new Date().toISOString(),
    sid: session.sid,
    rating: b['rating'],
  });

  return attachSession(NextResponse.json({ ok: true }), session);
}

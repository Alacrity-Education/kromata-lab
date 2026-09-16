import { NextResponse, type NextRequest } from 'next/server';
import { listAllPalettes, saveCustomPalette } from '@/lib/palettes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Presets plus every palette the team has saved. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { palettes: await listAllPalettes() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/** Save a custom palette so the rest of the team can pick it from the list. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON object' }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b['name'] !== 'string' || typeof b['colors'] !== 'string') {
    return NextResponse.json({ error: 'name and colors are required' }, { status: 400 });
  }
  try {
    const saved = await saveCustomPalette(b['name'], b['colors']);
    return NextResponse.json({ saved, palettes: await listAllPalettes() }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not save that palette' },
      { status: 400 },
    );
  }
}

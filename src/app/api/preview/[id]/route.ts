import { NextResponse, type NextRequest } from 'next/server';
import { readUploadBytes } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Serve the stored downscaled copy of an upload: the "before" half of every comparison.
 *
 * Served from the server rather than from an object URL of the original File so a reload does not
 * lose the comparison, and so the browser is never holding a 25 MB bitmap per image.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  let bytes: Buffer | null = null;
  try {
    bytes = await readUploadBytes(id, true);
  } catch {
    bytes = null;
  }
  if (!bytes) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(bytes.byteLength),
      // Immutable: an upload id always names the same bytes.
      'Cache-Control': 'private, max-age=86400, immutable',
    },
  });
}

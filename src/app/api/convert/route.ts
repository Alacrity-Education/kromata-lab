import { NextResponse, type NextRequest } from 'next/server';
import { mapImage } from '@alacrity-education/kromata-core';
import { EXTENSION, MIME, parseConvertRequest } from '@/lib/convert-options';
import { resolveRequestedPalette } from '@/lib/palettes';
import { readUploadBytes, readUploadMeta } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Map one stored upload and return the image bytes.
 *
 * `kind: 'preview'` renders from the downscaled copy and is what the debounced controls call;
 * `kind: 'download'` renders from the original at full resolution.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let options;
  try {
    options = parseConvertRequest(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad request' },
      { status: 400 },
    );
  }

  const meta = readUploadMeta(options.id);
  if (!meta) {
    return NextResponse.json(
      { error: 'That image is no longer on the server. Upload it again.' },
      { status: 404 },
    );
  }

  let palette;
  let label;
  try {
    ({ palette, label } = resolveRequestedPalette(options.palette));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad palette' },
      { status: 400 },
    );
  }

  const isPreview = options.kind === 'preview';
  const source = readUploadBytes(options.id, isPreview);
  if (!source) {
    return NextResponse.json({ error: 'That image is no longer on the server.' }, { status: 404 });
  }

  const started = performance.now();
  let result: Buffer;
  try {
    result = await mapImage(source, {
      palette,
      mode: options.mode,
      averageBoxSize: options.averageBoxSize,
      blur: options.blur,
      dither: options.dither,
      colorSpace: options.colorSpace,
      preserveAlpha: true,
      output: { format: options.format, quality: options.quality },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Conversion failed' },
      { status: 500 },
    );
  }
  const ms = Math.round(performance.now() - started);

  const stem = meta.name.replace(/\.[^.]+$/, '') || 'image';
  const filename = `${stem}.${label.replace(/[^a-z0-9-]+/gi, '-')}.${EXTENSION[options.format]}`;

  return new NextResponse(new Uint8Array(result), {
    status: 200,
    headers: {
      'Content-Type': MIME[options.format],
      'Content-Length': String(result.byteLength),
      'Cache-Control': 'no-store',
      'X-Kromata-Ms': String(ms),
      'X-Kromata-Filename': encodeURIComponent(filename),
      ...(options.kind === 'download'
        ? { 'Content-Disposition': `attachment; filename="${filename}"` }
        : {}),
    },
  });
}

import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { mapImage } from '@alacrity-education/kromata-core';
import { EXTENSION, MIME, parseConvertRequest } from '@/lib/convert-options';
import { resolveRequestedPalette } from '@/lib/palettes';
import { attachSession, readSession } from '@/lib/session';
import { readUploadBytes, readUploadMeta } from '@/lib/storage';
import { appendUsage } from '@/lib/usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Map one stored upload and return the image bytes.
 *
 * `kind: 'preview'` renders from the downscaled copy and is what the debounced controls call;
 * `kind: 'download'` renders from the original at full resolution.
 *
 * The conversion id comes back in a response header so the client can attach a rating to it later.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = readSession(req);

  let options;
  try {
    options = parseConvertRequest(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad request' },
      { status: 400 },
    );
  }

  const meta = await readUploadMeta(options.id);
  if (!meta) {
    return NextResponse.json(
      { error: 'That image is no longer on the server. Upload it again.' },
      { status: 404 },
    );
  }

  let palette;
  let label;
  try {
    ({ palette, label } = await resolveRequestedPalette(options.palette));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad palette' },
      { status: 400 },
    );
  }

  const isPreview = options.kind === 'preview';
  const source = await readUploadBytes(options.id, isPreview);
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

  const conversionId = randomUUID();
  void appendUsage({
    t: 'conv',
    id: conversionId,
    at: new Date().toISOString(),
    sid: session.sid,
    kind: options.kind,
    palette: label,
    mode: options.mode,
    colorSpace: options.colorSpace,
    dither: options.dither,
    blur: options.blur,
    width: isPreview ? meta.previewWidth : meta.width,
    height: isPreview ? meta.previewHeight : meta.height,
    ms,
  });

  const stem = meta.name.replace(/\.[^.]+$/, '') || 'image';
  const filename = `${stem}.${label.replace(/[^a-z0-9-]+/gi, '-')}.${EXTENSION[options.format]}`;

  const res = new NextResponse(new Uint8Array(result), {
    status: 200,
    headers: {
      'Content-Type': MIME[options.format],
      'Content-Length': String(result.byteLength),
      'Cache-Control': 'no-store',
      'X-Kromata-Conversion-Id': conversionId,
      'X-Kromata-Ms': String(ms),
      'X-Kromata-Filename': encodeURIComponent(filename),
      ...(options.kind === 'download'
        ? { 'Content-Disposition': `attachment; filename="${filename}"` }
        : {}),
    },
  });
  return attachSession(res, session);
}

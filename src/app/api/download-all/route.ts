import { NextResponse, type NextRequest } from 'next/server';
import { zip, type Zippable } from 'fflate';
import { mapImage } from '@alacrity-education/kromata-core';
import { EXTENSION, parseConvertRequest } from '@/lib/convert-options';
import { resolveRequestedPalette } from '@/lib/palettes';
import { readUploadBytes, readUploadMeta } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Enough for a working batch, low enough that one request cannot exhaust the server's memory. */
const MAX_FILES = 50;

function zipAsync(files: Zippable): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    // Level 0 (store): PNG, WebP and JPEG are already compressed, so deflating them again costs
    // real time and saves almost nothing.
    zip(files, { level: 0 }, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

/** Convert several stored uploads at full resolution and return them as one zip. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Expected a JSON object' }, { status: 400 });
  }

  const ids = Array.isArray(body['ids']) ? body['ids'].filter((i) => typeof i === 'string') : [];
  if (ids.length === 0) return NextResponse.json({ error: 'No images selected' }, { status: 400 });
  if (ids.length > MAX_FILES) {
    return NextResponse.json({ error: `Too many images (${MAX_FILES} max)` }, { status: 400 });
  }

  let options;
  try {
    // Validate once against the first id; every file in the batch shares the same settings.
    options = parseConvertRequest({ ...body, id: ids[0], kind: 'download' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad request' },
      { status: 400 },
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

  const slug = label.replace(/[^a-z0-9-]+/gi, '-');
  const entries: Zippable = {};
  const failures: string[] = [];
  const used = new Set<string>();

  for (const id of ids) {
    const meta = readUploadMeta(id);
    const source = meta ? readUploadBytes(id, false) : null;
    if (!meta || !source) {
      failures.push(id);
      continue;
    }
    try {
      const result = await mapImage(source, {
        palette,
        mode: options.mode,
        averageBoxSize: options.averageBoxSize,
        blur: options.blur,
        dither: options.dither,
        colorSpace: options.colorSpace,
        preserveAlpha: true,
        output: { format: options.format, quality: options.quality },
      });

      const stem = meta.name.replace(/\.[^.]+$/, '') || 'image';
      let name = `${stem}.${slug}.${EXTENSION[options.format]}`;
      // Two uploads can share a filename; a zip with duplicate entries loses one of them.
      for (let n = 2; used.has(name); n++) {
        name = `${stem} (${n}).${slug}.${EXTENSION[options.format]}`;
      }
      used.add(name);
      entries[name] = new Uint8Array(result);

    } catch {
      failures.push(meta.name);
    }
  }

  if (Object.keys(entries).length === 0) {
    return NextResponse.json({ error: 'None of the selected images could be converted' }, { status: 500 });
  }

  // Copied into a fresh view so the type is a plain ArrayBuffer-backed Uint8Array, which is
  // what BodyInit accepts.
  const archive = new Uint8Array(await zipAsync(entries));
  return new NextResponse(archive, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(archive.byteLength),
      'Content-Disposition': `attachment; filename="kromata-${slug}.zip"`,
      'Cache-Control': 'no-store',
      ...(failures.length > 0 ? { 'X-Kromata-Failed': String(failures.length) } : {}),
    },
  });
}

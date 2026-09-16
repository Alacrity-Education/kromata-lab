import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { UPLOADS_DIR } from './paths';

/**
 * Uploaded originals, kept server side so the interactive controls do not re-upload a 25 MB file
 * on every slider nudge.
 *
 * Each upload stores three things: the original bytes, a downscaled copy that every preview is
 * rendered from, and a small metadata record.
 */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Long edge of the copy that previews are rendered from. Full resolution is used on download. */
export const PREVIEW_MAX_EDGE = 1600;
/** Uploads are swept after this long. Long enough for a working session, short enough to not pile up. */
export const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;

export interface UploadMeta {
  id: string;
  name: string;
  type: string;
  bytes: number;
  width: number;
  height: number;
  previewWidth: number;
  previewHeight: number;
  uploadedAt: string;
}

/** Ids come from randomUUID, but anything reaching the filesystem gets checked anyway. */
const ID_RE = /^[0-9a-f-]{36}$/;

function assertId(id: string): string {
  if (!ID_RE.test(id)) throw new Error('Bad upload id');
  return id;
}

const originalPath = (id: string) => path.join(UPLOADS_DIR, `${assertId(id)}.bin`);
const previewPath = (id: string) => path.join(UPLOADS_DIR, `${assertId(id)}.preview.png`);
const metaPath = (id: string) => path.join(UPLOADS_DIR, `${assertId(id)}.json`);

export async function saveUpload(
  bytes: Buffer,
  name: string,
  type: string,
): Promise<UploadMeta> {
  await mkdir(UPLOADS_DIR, { recursive: true });

  // Orientation is applied here so width/height and every later render agree with each other.
  const oriented = sharp(bytes, { failOn: 'none' }).rotate();
  const meta = await oriented.metadata();
  if (!meta.width || !meta.height) throw new Error('Could not read image dimensions');

  const id = randomUUID();
  const preview = await sharp(bytes, { failOn: 'none' })
    .rotate()
    .resize({
      width: PREVIEW_MAX_EDGE,
      height: PREVIEW_MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 6 })
    .toBuffer({ resolveWithObject: true });

  const record: UploadMeta = {
    id,
    name,
    type,
    bytes: bytes.byteLength,
    width: meta.width,
    height: meta.height,
    previewWidth: preview.info.width,
    previewHeight: preview.info.height,
    uploadedAt: new Date().toISOString(),
  };

  await writeFile(originalPath(id), bytes);
  await writeFile(previewPath(id), preview.data);
  await writeFile(metaPath(id), JSON.stringify(record));
  return record;
}

export async function readUploadMeta(id: string): Promise<UploadMeta | null> {
  try {
    return JSON.parse(await readFile(metaPath(id), 'utf8')) as UploadMeta;
  } catch {
    return null;
  }
}

export async function readUploadBytes(id: string, preview: boolean): Promise<Buffer | null> {
  try {
    return await readFile(preview ? previewPath(id) : originalPath(id));
  } catch {
    return null;
  }
}

/**
 * Drop uploads older than the TTL. Called opportunistically on upload rather than on a timer, so
 * there is nothing to schedule and an idle server does no work.
 */
export async function sweepOldUploads(now = Date.now()): Promise<number> {
  let removed = 0;
  let entries: string[];
  try {
    entries = await readdir(UPLOADS_DIR);
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(UPLOADS_DIR, entry);
    try {
      const info = await stat(full);
      if (now - info.mtimeMs > UPLOAD_TTL_MS) {
        await rm(full, { force: true });
        removed++;
      }
    } catch {
      // A file that vanished under us is already in the state we wanted.
    }
  }
  return removed;
}

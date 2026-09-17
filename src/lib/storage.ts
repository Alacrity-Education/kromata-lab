import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

/**
 * Uploaded images, held in memory.
 *
 * Nothing is written to disk: the container is stateless, so it needs no volume and a redeploy
 * leaves nothing behind. The tradeoff is deliberate — uploads are transient working files, not
 * documents. They disappear on restart, and because the store lives in one process this assumes a
 * single replica (two replicas behind a round-robin proxy would miss each other's uploads).
 *
 * Uploading once and referring to the result by id is still what keeps the controls responsive:
 * the debounced preview re-renders from a stored copy instead of re-posting the original.
 */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Long edge of the copy previews render from. Downloads always use the original. */
export const PREVIEW_MAX_EDGE = 1600;
/** Dropped after this long without use. Long enough for a working session. */
export const UPLOAD_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * Ceiling on everything held at once. Past it the least recently used uploads are dropped, so a
 * busy afternoon cannot walk the container into the OOM killer. Roughly 20 full-size photos.
 */
export const MAX_STORE_BYTES = Number(process.env['KROMATA_MAX_STORE_MB'] ?? 512) * 1024 * 1024;

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

interface StoredUpload {
  meta: UploadMeta;
  original: Buffer;
  preview: Buffer;
  lastUsed: number;
}

// Insertion order is maintained by Map, and touching an entry re-inserts it, so the first key is
// always the least recently used.
const store = new Map<string, StoredUpload>();
let storedBytes = 0;

function drop(id: string): void {
  const entry = store.get(id);
  if (!entry) return;
  storedBytes -= entry.original.byteLength + entry.preview.byteLength;
  store.delete(id);
}

function sweep(now = Date.now()): void {
  for (const [id, entry] of store) {
    if (now - entry.lastUsed > UPLOAD_TTL_MS) drop(id);
  }
  // Then evict oldest-first until the store fits.
  for (const id of store.keys()) {
    if (storedBytes <= MAX_STORE_BYTES) break;
    drop(id);
  }
}

function touch(id: string): StoredUpload | undefined {
  const entry = store.get(id);
  if (!entry) return undefined;
  entry.lastUsed = Date.now();
  store.delete(id);
  store.set(id, entry);
  return entry;
}

export async function saveUpload(bytes: Buffer, name: string, type: string): Promise<UploadMeta> {
  // Orientation is applied here so width/height and every later render agree with each other.
  const meta = await sharp(bytes, { failOn: 'none' }).rotate().metadata();
  if (!meta.width || !meta.height) throw new Error('Could not read image dimensions');

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

  const id = randomUUID();
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

  store.set(id, { meta: record, original: bytes, preview: preview.data, lastUsed: Date.now() });
  storedBytes += bytes.byteLength + preview.data.byteLength;
  sweep();
  return record;
}

export function readUploadMeta(id: string): UploadMeta | null {
  return touch(id)?.meta ?? null;
}

export function readUploadBytes(id: string, preview: boolean): Buffer | null {
  const entry = touch(id);
  if (!entry) return null;
  return preview ? entry.preview : entry.original;
}

/** Diagnostics, so "why did my image disappear" has an answer. */
export function storeStatus(): { count: number; bytes: number; limitBytes: number } {
  return { count: store.size, bytes: storedBytes, limitBytes: MAX_STORE_BYTES };
}

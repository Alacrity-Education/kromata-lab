'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Controls, { type Settings } from './Controls';
import Dropzone, { type RejectedFile } from './Dropzone';
import ImageResult, { type Item, type ViewMode } from './ImageResult';
import PalettePicker, { CUSTOM_KEY, type PaletteSummary } from './PalettePicker';
import styles from './LabClient.module.css';

/** Long enough that dragging a slider does not fire a request per pixel, short enough to feel live. */
const DEBOUNCE_MS = 300;

const DEFAULT_SETTINGS: Settings = {
  mode: 'nearest',
  averageBoxSize: 2,
  blur: 0,
  dither: 'none',
  colorSpace: 'lab',
};

interface UploadResponse {
  uploaded: Array<{ id: string; name: string; width: number; height: number }>;
  rejected: RejectedFile[];
  error?: string;
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function LabClient({ initialPalettes }: { initialPalettes: PaletteSummary[] }) {
  const [palettes, setPalettes] = useState(initialPalettes);
  const [paletteKey, setPaletteKey] = useState(initialPalettes[0]?.key ?? 'nord');
  const [customText, setCustomText] = useState('');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [view, setView] = useState<ViewMode>('split');
  const [items, setItems] = useState<Item[]>([]);
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  // Object URLs are revoked by hand; React will not do it and each one pins a decoded bitmap.
  const urlsRef = useRef(new Map<string, string>());
  const setResultUrl = useCallback((id: string, url: string | undefined) => {
    const previous = urlsRef.current.get(id);
    if (previous && previous !== url) URL.revokeObjectURL(previous);
    if (url) urlsRef.current.set(id, url);
    else urlsRef.current.delete(id);
  }, []);

  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  /** What the server should map with: either a saved/preset key or the raw custom text. */
  const paletteSpec = paletteKey === CUSTOM_KEY ? customText : paletteKey;

  const conversionBody = useMemo(
    () => ({
      palette: paletteSpec,
      mode: settings.mode,
      averageBoxSize: settings.averageBoxSize,
      blur: settings.blur,
      dither: settings.dither,
      colorSpace: settings.colorSpace,
    }),
    [paletteSpec, settings],
  );

  const ids = items.map((i) => i.id).join(',');
  const bodyKey = JSON.stringify(conversionBody);

  /**
   * Re-render every image whenever the settings or the image list change.
   *
   * Debounced, and any in-flight batch is aborted when a newer one starts, so dragging a slider
   * leaves exactly one request outstanding rather than a queue of stale ones. Images are converted
   * one at a time: the work is CPU-bound, so firing them in parallel would only make the first
   * result arrive later.
   */
  useEffect(() => {
    if (items.length === 0) return;
    if (paletteSpec.trim().length === 0) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setItems((prev) => prev.map((i) => ({ ...i, status: 'working' as const })));

      for (const id of ids.split(',')) {
        if (controller.signal.aborted) return;
        try {
          const res = await fetch('/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...conversionBody, id, kind: 'preview', format: 'png' }),
            signal: controller.signal,
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? `Conversion failed (${res.status})`);
          }
          const conversionId = res.headers.get('X-Kromata-Conversion-Id') ?? undefined;
          const ms = Number(res.headers.get('X-Kromata-Ms') ?? 0);
          const url = URL.createObjectURL(await res.blob());
          setResultUrl(id, url);
          setItems((prev) =>
            prev.map((i) =>
              i.id === id
                ? { ...i, status: 'done', resultUrl: url, conversionId, ms, rating: undefined }
                : i,
            ),
          );
        } catch (err) {
          if (controller.signal.aborted) return;
          const message = err instanceof Error ? err.message : 'Conversion failed';
          setItems((prev) =>
            prev.map((i) => (i.id === id ? { ...i, status: 'error', error: message } : i)),
          );
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyKey, ids]);

  async function upload(files: File[]) {
    setUploading(true);
    setBanner(null);
    try {
      const form = new FormData();
      for (const f of files) form.append('files', f);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const body = (await res.json()) as UploadResponse;
      setRejected(body.rejected ?? []);
      if (!res.ok && (body.uploaded ?? []).length === 0) {
        if (body.error) setBanner(body.error);
        return;
      }
      setItems((prev) => [
        ...prev,
        ...body.uploaded.map(
          (u): Item => ({
            id: u.id,
            name: u.name,
            width: u.width,
            height: u.height,
            status: 'pending',
          }),
        ),
      ]);
    } catch {
      setBanner('Upload failed. Is the server still running?');
    } finally {
      setUploading(false);
    }
  }

  async function rate(item: Item, rating: 1 | -1) {
    if (!item.conversionId) return;
    const next = item.rating === rating ? undefined : rating;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, rating: next } : i)));
    if (next === undefined) return; // toggling off is a local undo; nothing to record
    await fetch('/api/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.conversionId, rating: next }),
    }).catch(() => setBanner('Could not record that rating.'));
  }

  async function download(item: Item) {
    setDownloadingId(item.id);
    setBanner(null);
    try {
      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...conversionBody, id: item.id, kind: 'download', format: 'png' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Download failed');
      }
      const name = decodeURIComponent(res.headers.get('X-Kromata-Filename') ?? 'kromata.png');
      saveBlob(await res.blob(), name);
    } catch (err) {
      setBanner(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  }

  async function downloadAll() {
    setZipping(true);
    setBanner(null);
    try {
      const res = await fetch('/api/download-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...conversionBody, ids: items.map((i) => i.id), format: 'png' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Could not build the zip');
      }
      const failed = res.headers.get('X-Kromata-Failed');
      saveBlob(await res.blob(), 'kromata.zip');
      if (failed) setBanner(`${failed} image(s) could not be converted and were left out.`);
    } catch (err) {
      setBanner(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setZipping(false);
    }
  }

  function remove(item: Item) {
    setResultUrl(item.id, undefined);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  const done = items.filter((i) => i.status === 'done').length;
  const working = items.some((i) => i.status === 'working' || i.status === 'pending');

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <h1 className={styles.title}>Kromata Lab</h1>
          <Link className={styles.statsLink} href="/stats">
            Stats
          </Link>
        </div>

        <Dropzone onFiles={(f) => void upload(f)} busy={uploading} rejected={rejected} />

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Palette</h2>
          <PalettePicker
            palettes={palettes}
            value={paletteKey}
            custom={customText}
            onChange={setPaletteKey}
            onCustomChange={setCustomText}
            onSaved={(next, key) => {
              setPalettes(next);
              setPaletteKey(key);
            }}
          />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Settings</h2>
          <Controls settings={settings} onChange={setSettings} />
        </section>
      </aside>

      <main className={styles.main}>
        {banner && <p className={styles.banner}>{banner}</p>}

        <div className={styles.toolbar}>
          <div className={styles.viewSwitch}>
            {(
              [
                ['split', 'Split'],
                ['pair', '2-up'],
                ['grid', 'Grid'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={`${styles.viewBtn} ${view === mode ? styles.on : ''}`}
                onClick={() => setView(mode)}
              >
                {label}
              </button>
            ))}
          </div>
          <span className={styles.spacer} />
          <span className={styles.status}>
            {items.length === 0
              ? 'No images'
              : working
                ? `Rendering ${done}/${items.length}…`
                : `${items.length} image${items.length === 1 ? '' : 's'}`}
          </span>
          <button
            type="button"
            className={styles.button}
            disabled={items.length === 0 || zipping}
            onClick={() => void downloadAll()}
          >
            {zipping ? 'Building zip…' : 'Download all'}
          </button>
        </div>

        {items.length === 0 ? (
          <p className={styles.empty}>
            Drop images on the left to get started. Previews render at reduced size; downloads are
            always full resolution.
          </p>
        ) : (
          <div className={`${styles.results} ${styles[view]}`}>
            {items.map((item) => (
              <ImageResult
                key={item.id}
                item={item}
                view={view}
                onRate={(i, r) => void rate(i, r)}
                onDownload={(i) => void download(i)}
                onRemove={remove}
                downloading={downloadingId === item.id}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

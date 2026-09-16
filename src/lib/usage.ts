import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, USAGE_LOG } from './paths';

/**
 * The usage log. One JSON object per line, append only.
 *
 * Two record kinds share the file: a `conv` row per conversion and a `rate` row per thumbs
 * up/down. Ratings arrive after the conversion they refer to, and rewriting a line in place would
 * mean rewriting the file, so they are separate rows joined by `id` when stats are computed.
 *
 * `kind` separates interactive previews from downloads. Every conversion is logged as specified,
 * but previews fire on every debounced control change, so counting them alone would measure slider
 * fiddling rather than use. Both numbers are reported.
 */

export interface ConversionRecord {
  t: 'conv';
  id: string;
  at: string;
  sid: string;
  kind: 'preview' | 'download';
  palette: string;
  mode: string;
  colorSpace: string;
  dither: string;
  blur: number;
  width: number;
  height: number;
  ms: number;
}

export interface RatingRecord {
  t: 'rate';
  id: string;
  at: string;
  sid: string;
  rating: 1 | -1;
}

export type UsageRecord = ConversionRecord | RatingRecord;

/**
 * Appends are serialized through one promise chain. Individual writes are small enough that the
 * O_APPEND write would be atomic anyway, but this also keeps ordering stable under concurrency.
 */
let queue: Promise<void> = Promise.resolve();

export function appendUsage(record: UsageRecord): Promise<void> {
  queue = queue
    .then(async () => {
      await mkdir(path.dirname(USAGE_LOG), { recursive: true });
      await appendFile(USAGE_LOG, JSON.stringify(record) + '\n', 'utf8');
    })
    .catch((err) => {
      // The log must never take a conversion down with it.
      console.error('usage log append failed:', err);
    });
  return queue;
}

export async function readUsage(): Promise<UsageRecord[]> {
  let text: string;
  try {
    text = await readFile(USAGE_LOG, 'utf8');
  } catch {
    return [];
  }
  const out: UsageRecord[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as UsageRecord);
    } catch {
      // A torn final line from an interrupted write should not break the whole report.
    }
  }
  return out;
}

export interface Stats {
  generatedAt: string;
  totals: {
    conversions: number;
    previews: number;
    downloads: number;
    sessions: number;
    images: number;
    ratings: number;
  };
  perDay: Array<{ date: string; conversions: number; downloads: number; sessions: number }>;
  perPalette: Array<{ palette: string; conversions: number; downloads: number; avgRating: number | null; ratings: number }>;
  perSession: Array<{ session: string; conversions: number; downloads: number; days: number; firstSeen: string; lastSeen: string }>;
  perMode: Array<{ mode: string; conversions: number }>;
  rating: { up: number; down: number; average: number | null };
  timing: { medianMs: number | null; p95Ms: number | null };
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

/**
 * Aggregate the whole log. It is read and folded on every request rather than kept in memory,
 * which stays honest across restarts and is fine at the scale this is for (an internal team).
 */
export function summarize(records: UsageRecord[]): Stats {
  const conversions = records.filter((r): r is ConversionRecord => r.t === 'conv');
  const ratings = records.filter((r): r is RatingRecord => r.t === 'rate');

  // A conversion can be rated more than once if someone changes their mind; last write wins.
  const ratingById = new Map<string, RatingRecord>();
  for (const r of ratings) ratingById.set(r.id, r);
  const convById = new Map(conversions.map((c) => [c.id, c]));

  const days = new Map<string, { conversions: number; downloads: number; sessions: Set<string> }>();
  const palettes = new Map<string, { conversions: number; downloads: number; up: number; down: number }>();
  const sessions = new Map<
    string,
    { conversions: number; downloads: number; days: Set<string>; first: string; last: string }
  >();
  const modes = new Map<string, number>();

  for (const c of conversions) {
    const day = c.at.slice(0, 10);

    const d = days.get(day) ?? { conversions: 0, downloads: 0, sessions: new Set<string>() };
    d.conversions++;
    if (c.kind === 'download') d.downloads++;
    d.sessions.add(c.sid);
    days.set(day, d);

    const p = palettes.get(c.palette) ?? { conversions: 0, downloads: 0, up: 0, down: 0 };
    p.conversions++;
    if (c.kind === 'download') p.downloads++;
    palettes.set(c.palette, p);

    const s = sessions.get(c.sid) ?? {
      conversions: 0,
      downloads: 0,
      days: new Set<string>(),
      first: c.at,
      last: c.at,
    };
    s.conversions++;
    if (c.kind === 'download') s.downloads++;
    s.days.add(day);
    if (c.at < s.first) s.first = c.at;
    if (c.at > s.last) s.last = c.at;
    sessions.set(c.sid, s);

    modes.set(c.mode, (modes.get(c.mode) ?? 0) + 1);
  }

  let up = 0;
  let down = 0;
  for (const r of ratingById.values()) {
    if (r.rating === 1) up++;
    else down++;
    const conv = convById.get(r.id);
    if (!conv) continue;
    const p = palettes.get(conv.palette);
    if (!p) continue;
    if (r.rating === 1) p.up++;
    else p.down++;
  }

  const durations = conversions.map((c) => c.ms).sort((a, b) => a - b);
  const totalRatings = up + down;

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      conversions: conversions.length,
      previews: conversions.filter((c) => c.kind === 'preview').length,
      downloads: conversions.filter((c) => c.kind === 'download').length,
      sessions: sessions.size,
      images: new Set(conversions.map((c) => `${c.width}x${c.height}:${c.sid}`)).size,
      ratings: totalRatings,
    },
    perDay: [...days.entries()]
      .map(([date, d]) => ({
        date,
        conversions: d.conversions,
        downloads: d.downloads,
        sessions: d.sessions.size,
      }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    perPalette: [...palettes.entries()]
      .map(([palette, p]) => ({
        palette,
        conversions: p.conversions,
        downloads: p.downloads,
        ratings: p.up + p.down,
        avgRating: p.up + p.down === 0 ? null : (p.up - p.down) / (p.up + p.down),
      }))
      .sort((a, b) => b.conversions - a.conversions),
    perSession: [...sessions.entries()]
      .map(([session, s]) => ({
        session,
        conversions: s.conversions,
        downloads: s.downloads,
        days: s.days.size,
        firstSeen: s.first,
        lastSeen: s.last,
      }))
      .sort((a, b) => b.conversions - a.conversions),
    perMode: [...modes.entries()]
      .map(([mode, conversions]) => ({ mode, conversions }))
      .sort((a, b) => b.conversions - a.conversions),
    rating: { up, down, average: totalRatings === 0 ? null : (up - down) / totalRatings },
    timing: { medianMs: median(durations), p95Ms: percentile(durations, 95) },
  };
}

export async function getStats(): Promise<Stats> {
  return summarize(await readUsage());
}

export { DATA_DIR };

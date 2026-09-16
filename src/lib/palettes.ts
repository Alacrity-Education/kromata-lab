import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { paletteNames, palettes as presets, parsePalette, toHex } from '@alacrity-education/kromata-core';
import type { Palette, RGB } from '@alacrity-education/kromata-core';
import { PALETTES_FILE } from './paths';

/**
 * Saved custom palettes, so the team can share brand colors rather than pasting hex lists to each
 * other. Stored as one JSON file under the data directory.
 */

export interface SavedPalette {
  id: string;
  name: string;
  colors: RGB[];
  createdAt: string;
}

export interface PaletteSummary {
  key: string;
  name: string;
  colors: string[];
  source?: string;
  saved: boolean;
}

export const MAX_SAVED_PALETTES = 200;
export const MAX_PALETTE_COLORS = 256;

let queue: Promise<unknown> = Promise.resolve();

async function readSaved(): Promise<SavedPalette[]> {
  try {
    const parsed = JSON.parse(await readFile(PALETTES_FILE, 'utf8'));
    return Array.isArray(parsed) ? (parsed as SavedPalette[]) : [];
  } catch {
    return [];
  }
}

export async function listSavedPalettes(): Promise<SavedPalette[]> {
  return readSaved();
}

/** Presets first, then anything the team has saved. */
export async function listAllPalettes(): Promise<PaletteSummary[]> {
  const saved = await readSaved();
  return [
    ...paletteNames.map((key) => {
      const p = presets[key]!;
      return {
        key,
        name: p.name,
        colors: p.colors.map(toHex),
        ...(p.source ? { source: p.source } : {}),
        saved: false,
      };
    }),
    ...saved.map((p) => ({
      key: `saved:${p.id}`,
      name: p.name,
      colors: p.colors.map(toHex),
      saved: true,
    })),
  ];
}

export async function saveCustomPalette(name: string, colorsText: string): Promise<SavedPalette> {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error('Give the palette a name');
  if (trimmed.length > 60) throw new Error('Palette name is too long (60 characters max)');

  // parsePalette does the real validation and throws a message worth showing the user.
  const parsed = parsePalette(colorsText);
  if (parsed.colors.length > MAX_PALETTE_COLORS) {
    throw new Error(`Too many colors (${MAX_PALETTE_COLORS} max)`);
  }

  // Serialized so two people saving at once cannot lose one of the two writes.
  const result = (queue = queue.then(async () => {
    const saved = await readSaved();
    if (saved.length >= MAX_SAVED_PALETTES) {
      throw new Error(`Saved palette limit reached (${MAX_SAVED_PALETTES})`);
    }
    const record: SavedPalette = {
      id: randomUUID(),
      name: trimmed,
      colors: parsed.colors,
      createdAt: new Date().toISOString(),
    };
    await mkdir(path.dirname(PALETTES_FILE), { recursive: true });
    await writeFile(PALETTES_FILE, JSON.stringify([...saved, record], null, 2), 'utf8');
    return record;
  })).then((r) => r as SavedPalette);

  return result;
}

/**
 * Turn whatever the client asked for into a real palette: a preset key, a `saved:<id>` reference,
 * or a raw hex list typed into the custom box.
 */
export async function resolveRequestedPalette(
  spec: string,
): Promise<{ palette: Palette; label: string }> {
  const key = spec.trim();
  if (key.startsWith('saved:')) {
    const id = key.slice('saved:'.length);
    const saved = (await readSaved()).find((p) => p.id === id);
    if (!saved) throw new Error('That saved palette no longer exists');
    return { palette: { name: saved.name, colors: saved.colors }, label: key };
  }
  const preset = presets[key.toLowerCase()];
  if (preset) return { palette: preset, label: key.toLowerCase() };
  return { palette: parsePalette(key), label: 'custom' };
}

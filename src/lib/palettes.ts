import { paletteNames, palettes as presets, parsePalette, toHex } from '@alacrity-education/kromata-core';
import type { Palette } from '@alacrity-education/kromata-core';

/**
 * Palettes available to the Lab.
 *
 * Presets come from the core library. Anything else is typed into the custom box and travels with
 * the request; nothing is stored server side, so the container holds no state. To add a palette
 * permanently, add it to the core library's presets and bump the dependency.
 */

export interface PaletteSummary {
  key: string;
  name: string;
  colors: string[];
  source?: string;
}

export function listAllPalettes(): PaletteSummary[] {
  return paletteNames.map((key) => {
    const p = presets[key]!;
    return {
      key,
      name: p.name,
      colors: p.colors.map(toHex),
      ...(p.source ? { source: p.source } : {}),
    };
  });
}

/**
 * Turn what the client asked for into a real palette: a preset key, or a raw hex list typed into
 * the custom box.
 */
export function resolveRequestedPalette(spec: string): { palette: Palette; label: string } {
  const key = spec.trim();
  const preset = presets[key.toLowerCase()];
  if (preset) return { palette: preset, label: key.toLowerCase() };
  return { palette: parsePalette(key), label: 'custom' };
}

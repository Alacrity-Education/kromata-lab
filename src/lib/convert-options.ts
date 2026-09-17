import type { ColorSpace, DitherMode, MapMode, OutputFormat } from '@alacrity-education/kromata-core';

/**
 * Validation for the conversion request body. Everything the client sends is checked here before
 * it reaches core, so a malformed request is a 400 with a readable message rather than a 500.
 */

export const MAX_BLUR = 20;
export const MAX_BOX = 64;

export interface ConvertRequest {
  id: string;
  kind: 'preview' | 'download';
  palette: string;
  mode: MapMode;
  averageBoxSize: number;
  blur: number;
  dither: DitherMode;
  colorSpace: ColorSpace;
  format: OutputFormat;
  quality: number;
}

/** Defaults the UI opens with: the combination that looks best on a real photograph. */
export const DEFAULTS = {
  palette: 'nord',
  mode: 'nearest',
  averageBoxSize: 2,
  blur: 0,
  dither: 'none',
  colorSpace: 'rgb',
  format: 'png',
  quality: 90,
} as const;

function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
  field: string,
): T {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new Error(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

function num(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
  field: string,
  integer = false,
): number {
  if (value === undefined || value === null) return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
    throw new Error(`${field} must be ${integer ? 'an integer' : 'a number'} from ${min} to ${max}`);
  }
  return n;
}

export function parseConvertRequest(body: unknown): ConvertRequest {
  if (!body || typeof body !== 'object') throw new Error('Expected a JSON object');
  const b = body as Record<string, unknown>;

  if (typeof b['id'] !== 'string' || b['id'].length === 0) throw new Error('id is required');
  if (typeof b['palette'] !== 'string' || b['palette'].trim().length === 0) {
    throw new Error('palette is required');
  }

  return {
    id: b['id'],
    kind: pick(b['kind'], ['preview', 'download'] as const, 'preview', 'kind'),
    palette: b['palette'],
    mode: pick(b['mode'], ['nearest', 'average'] as const, DEFAULTS.mode, 'mode'),
    averageBoxSize: num(b['averageBoxSize'], 1, MAX_BOX, DEFAULTS.averageBoxSize, 'averageBoxSize', true),
    blur: num(b['blur'], 0, MAX_BLUR, DEFAULTS.blur, 'blur'),
    dither: pick(b['dither'], ['none', 'floyd-steinberg'] as const, DEFAULTS.dither, 'dither'),
    colorSpace: pick(b['colorSpace'], ['rgb', 'lab'] as const, DEFAULTS.colorSpace, 'colorSpace'),
    format: pick(b['format'], ['png', 'jpeg', 'webp', 'avif'] as const, DEFAULTS.format, 'format'),
    quality: num(b['quality'], 1, 100, DEFAULTS.quality, 'quality', true),
  };
}

export const EXTENSION: Record<OutputFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
  avif: 'avif',
};

export const MIME: Record<OutputFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
};

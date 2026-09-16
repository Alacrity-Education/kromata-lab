import path from 'node:path';

/**
 * Everything the Lab persists lives under one directory, outside the Next build output, so it can
 * be mounted as a volume. Override with KROMATA_DATA_DIR (the Dockerfile does).
 */
export const DATA_DIR = process.env['KROMATA_DATA_DIR'] ?? path.join(process.cwd(), 'data');

export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const USAGE_LOG = path.join(DATA_DIR, 'usage.jsonl');
export const PALETTES_FILE = path.join(DATA_DIR, 'palettes.json');

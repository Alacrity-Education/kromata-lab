import { NextResponse } from 'next/server';
import { listAllPalettes } from '@/lib/palettes';

export const runtime = 'nodejs';

/** The built-in presets. Custom palettes travel with the request; none are stored. */
export function GET(): NextResponse {
  return NextResponse.json({ palettes: listAllPalettes() });
}

import { randomUUID } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';

/**
 * An anonymous per-browser id, used only to group rows in the usage log so "how many people came
 * back" is answerable. Nothing is tied to a person, and there is no auth: the Lab runs on an
 * internal network.
 */
export const SESSION_COOKIE = 'kromata_sid';

const SID_RE = /^[0-9a-f-]{36}$/;

export function readSession(req: NextRequest): { sid: string; isNew: boolean } {
  const existing = req.cookies.get(SESSION_COOKIE)?.value;
  if (existing && SID_RE.test(existing)) return { sid: existing, isNew: false };
  return { sid: randomUUID(), isNew: true };
}

export function attachSession<T extends NextResponse>(
  res: T,
  session: { sid: string; isNew: boolean },
): T {
  if (!session.isNew) return res;
  res.cookies.set(SESSION_COOKIE, session.sid, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

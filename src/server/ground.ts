import 'server-only';

/** Server-side ground-server configuration. Never imported by client code. */
export const GROUND = (process.env.GROUND_API_URL ?? '').replace(/\/$/, '');
export const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
export const AT = 'cp_at';
export const RT = 'cp_rt';

export const errorJson = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function groundFetch(path: string, init: RequestInit & { timeoutMs?: number } = {}) {
  return fetch(`${GROUND}${path}`, { ...init, cache: 'no-store', signal: AbortSignal.timeout(init.timeoutMs ?? 30_000) });
}

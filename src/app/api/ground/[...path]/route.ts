import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

import { AT, COOKIE_SECURE, GROUND, RT, errorJson, groundFetch } from '@/server/ground';

/**
 * Same-origin proxy to the existing CosmicPulse FastAPI ground server.
 *
 * - The browser never learns GROUND_API_URL and never holds tokens: login
 *   responses are stripped of access/refresh tokens, which are stored in
 *   httpOnly, SameSite=Strict cookies and attached here as a bearer header.
 * - A 401 triggers one refresh-token rotation (POST /auth/refresh) and retry.
 * - Only an allow-list of ground paths used by the web app is forwarded.
 * - Request bodies are never logged (they may contain health data).
 */
const ALLOW: RegExp[] = [
  /^auth\/(login|logout|me|refresh)$/,
  /^sync\/(push|pull)$/,
  /^assistant(\/status)?$/,
  /^astronauts\/[\w-]+\/(vitals|records|environment|administrations)$/,
  /^readings$/,
  /^missions(\/[\w-]+)?$/,
];

const cookieOpts = (maxAge: number) => ({ httpOnly: true, secure: COOKIE_SECURE, sameSite: 'strict' as const, path: '/api/ground', maxAge });

async function forward(req: NextRequest, path: string, token?: string) {
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.clone().text();
  return groundFetch(`/${path}${req.nextUrl.search}`, {
    method: req.method,
    body,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    timeoutMs: path === 'assistant' ? 50_000 : 30_000,
  });
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const path = (await ctx.params).path.join('/');
  if (!GROUND) return errorJson(503, 'not_configured', 'No ground server configured on this web server (GROUND_API_URL).');
  if (!ALLOW.some((r) => r.test(path))) return errorJson(404, 'not_found', 'Unknown ground route.');
  const jar = await cookies();
  const deviceId = req.headers.get('x-device-id') ?? undefined;

  try {
    if (path === 'auth/login') {
      const r = await forward(req, path);
      const j = (await r.json().catch(() => null)) as Record<string, unknown> | null;
      if (!r.ok || !j) return Response.json(j ?? { error: { code: 'login_failed', message: 'Sign-in failed.' } }, { status: r.status });
      if (j.status === 'ok') {
        jar.set(AT, String(j.accessToken), cookieOpts(60 * 60));
        jar.set(RT, String(j.refreshToken), cookieOpts(60 * 60 * 24 * 30));
        const reqBody = JSON.parse((await req.text()) || '{}') as { deviceId?: string };
        jar.set('cp_dev', reqBody.deviceId ?? '', cookieOpts(60 * 60 * 24 * 30));
        return Response.json({ status: 'ok', user: j.user, expiresAt: j.expiresAt });
      }
      return Response.json(j, { status: r.status });
    }
    if (path === 'auth/logout') {
      const at = jar.get(AT)?.value;
      if (at) await forward(req, path, at).catch(() => null);
      jar.delete({ name: AT, path: '/api/ground' });
      jar.delete({ name: RT, path: '/api/ground' });
      return Response.json({ ok: true });
    }

    let at = jar.get(AT)?.value;
    let r = await forward(req, path, at);
    if (r.status === 401 && jar.get(RT)?.value) {
      const rr = await groundFetch('/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: jar.get(RT)!.value, deviceId: deviceId ?? jar.get('cp_dev')?.value ?? '' }) });
      if (rr.ok) {
        const t = (await rr.json()) as { accessToken: string; refreshToken: string };
        jar.set(AT, t.accessToken, cookieOpts(60 * 60));
        jar.set(RT, t.refreshToken, cookieOpts(60 * 60 * 24 * 30));
        at = t.accessToken;
        r = await forward(req, path, at);
      } else {
        jar.delete({ name: AT, path: '/api/ground' });
        jar.delete({ name: RT, path: '/api/ground' });
      }
    }
    const text = await r.text();
    return new Response(text, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') ?? 'application/json', 'Cache-Control': 'no-store' } });
  } catch (e) {
    const timeout = (e as Error).name === 'TimeoutError';
    return errorJson(timeout ? 504 : 502, timeout ? 'timeout' : 'unreachable', timeout ? 'The ground server did not answer in time.' : 'The ground server is unreachable.');
  }
}

export { handle as GET, handle as POST, handle as DELETE };

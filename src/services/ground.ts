import { networkAllowed, useConnectivity } from './connectivity';

/**
 * Client for the CosmicPulse ground server, always through this app's own
 * server routes (`/api/ground/*`). The browser never sees the ground URL or
 * the session tokens (httpOnly cookies set by the route handlers).
 */
export class GroundError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: 'offline' | 'timeout' | 'network' | 'auth' | 'http' | 'not_configured' = 'http',
  ) {
    super(message);
  }
}

export async function ground<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  if (!networkAllowed()) throw new GroundError(0, 'No ground link — this will be retried when the link returns.', 'offline');
  if (!useConnectivity.getState().configured) throw new GroundError(0, 'No ground server configured.', 'not_configured');
  try {
    const res = await fetch(`/api/ground${path}`, {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
    if (res.status === 401) throw new GroundError(401, 'Session expired — sign in again.', 'auth');
    if (res.status === 503) {
      const j = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
      throw new GroundError(503, j?.error?.message ?? 'Ground server unavailable.', j?.error?.code === 'not_configured' ? 'not_configured' : 'network');
    }
    if (!res.ok) {
      const env = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new GroundError(res.status, env?.error?.message ?? `Request failed (${res.status})`, 'http');
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof GroundError) throw e;
    if ((e as Error).name === 'TimeoutError' || (e as Error).name === 'AbortError') throw new GroundError(408, 'The ground server did not answer in time.', 'timeout');
    throw new GroundError(0, 'Network unavailable.', 'network');
  }
}

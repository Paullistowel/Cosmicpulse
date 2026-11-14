import { GROUND, groundFetch } from '@/server/ground';

/** Is a ground server configured and reachable? (No secrets returned.) */
export async function GET() {
  if (!GROUND) return Response.json({ configured: false, reachable: false }, { headers: { 'Cache-Control': 'no-store' } });
  try {
    const r = await groundFetch('/health', { timeoutMs: 5000 });
    const j = (await r.json().catch(() => ({}))) as { version?: string };
    return Response.json({ configured: true, reachable: r.ok, version: j.version }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ configured: true, reachable: false }, { headers: { 'Cache-Control': 'no-store' } });
  }
}

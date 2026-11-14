import type { NextRequest } from 'next/server';

import { osdrGet, toStudy } from '@/server/osdr';

/** GET /api/osdr/search?term=astronaut&from=0&size=10 — proxied OSDR Search API (type=cgene). */
export async function GET(req: NextRequest) {
  const term = (req.nextUrl.searchParams.get('term') ?? '').trim().slice(0, 120);
  const size = Math.min(25, Math.max(1, Number(req.nextUrl.searchParams.get('size') ?? 10) || 10));
  const from = Math.max(0, Number(req.nextUrl.searchParams.get('from') ?? 0) || 0);
  if (!term) return Response.json({ error: { code: 'bad_request', message: 'term is required' } }, { status: 400 });
  try {
    const { data, cachedAt, stale } = await osdrGet<{ hits: { total: number; hits: { _source: Record<string, unknown> }[] } }>(
      `/osdr/data/search?term=${encodeURIComponent(term)}&type=cgene&from=${from}&size=${size}`,
    );
    return Response.json(
      { source: 'NASA OSDR Search API', endpoint: 'https://osdr.nasa.gov/osdr/data/search', total: data.hits.total, studies: data.hits.hits.map(toStudy), cachedAt, stale },
      { headers: { 'Cache-Control': 'public, max-age=600' } },
    );
  } catch (e) {
    return Response.json({ error: { code: 'osdr_unavailable', message: `NASA OSDR is unavailable right now (${(e as Error).message}). The bundled evidence library still works offline.` } }, { status: 502 });
  }
}

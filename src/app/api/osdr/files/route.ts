import type { NextRequest } from 'next/server';

import { OSDR_BASE, osdrGet } from '@/server/osdr';

/** GET /api/osdr/files?osd=575 — proxied OSDR Data File API (public, non-restricted files only). */
export async function GET(req: NextRequest) {
  const osd = (req.nextUrl.searchParams.get('osd') ?? '').replace(/^OSD-/i, '');
  if (!/^\d{1,5}$/.test(osd)) return Response.json({ error: { code: 'bad_request', message: 'osd must be an OSD number, e.g. 575' } }, { status: 400 });
  try {
    type F = { category: string; file_name: string; file_size: number; remote_url: string; restricted: boolean; date_created: number };
    const { data, cachedAt, stale } = await osdrGet<{ studies: Record<string, { file_count: number; study_files: F[] }> }>(`/osdr/data/osd/files/${osd}`);
    const [accession, study] = Object.entries(data.studies)[0] ?? [];
    if (!study) return Response.json({ error: { code: 'not_found', message: `OSD-${osd} not found` } }, { status: 404 });
    return Response.json({
      source: 'NASA OSDR Data File API',
      accession,
      fileCount: study.file_count,
      files: study.study_files
        .filter((f) => !f.restricted)
        .map((f) => ({ category: f.category, name: f.file_name, size: f.file_size, url: OSDR_BASE + f.remote_url, created: new Date(f.date_created * 1000).toISOString().slice(0, 10) })),
      cachedAt,
      stale,
    });
  } catch (e) {
    return Response.json({ error: { code: 'osdr_unavailable', message: `NASA OSDR is unavailable (${(e as Error).message}).` } }, { status: 502 });
  }
}

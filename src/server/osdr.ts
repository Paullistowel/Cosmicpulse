import 'server-only';

/**
 * NASA OSDR public API client (server-side only — the API's CORS policy only
 * allows osdr.nasa.gov, so browsers cannot call it directly).
 *
 * Verified endpoints (2026-11-14):
 *   Search:     GET {BASE}/osdr/data/search?term=&type=cgene&from=&size=
 *   Data files: GET {BASE}/osdr/data/osd/files/{n}
 * Responses are cached in memory for 6 h; on failure the last good response
 * is served with `stale: true`.
 */
export const OSDR_BASE = (process.env.OSDR_API_BASE ?? 'https://osdr.nasa.gov').replace(/\/$/, '');
const TTL = 6 * 3_600_000;
const cache = new Map<string, { at: number; data: unknown }>();

export async function osdrGet<T>(path: string): Promise<{ data: T; cachedAt: string; stale: boolean }> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL) return { data: hit.data as T, cachedAt: new Date(hit.at).toISOString(), stale: false };
  try {
    const r = await fetch(`${OSDR_BASE}${path}`, { headers: { Accept: 'application/json', 'User-Agent': 'CosmicPulse-Web/0.1 (research client)' }, signal: AbortSignal.timeout(20_000), cache: 'no-store' });
    if (!r.ok) throw new Error(`OSDR responded ${r.status}`);
    const data = (await r.json()) as T;
    cache.set(path, { at: Date.now(), data });
    if (cache.size > 200) cache.delete(cache.keys().next().value as string);
    return { data, cachedAt: new Date().toISOString(), stale: false };
  } catch (e) {
    if (hit) return { data: hit.data as T, cachedAt: new Date(hit.at).toISOString(), stale: true };
    throw e;
  }
}

export type OsdrStudy = {
  accession: string;
  title: string;
  description: string;
  organism: string;
  projectType: string;
  mission?: string;
  missionStart?: string;
  missionEnd?: string;
  assays: string[];
  releaseDate?: string;
  url: string;
};

type Hit = { _source: Record<string, unknown> };

export function toStudy(h: Hit): OsdrStudy {
  const s = h._source;
  const str = (k: string) => (typeof s[k] === 'string' ? (s[k] as string) : '');
  const mission = (s['Mission'] ?? {}) as { Name?: string; 'Start Date'?: string; 'End Date'?: string };
  const rel = Number(s['Study Public Release Date']);
  const acc = str('Accession');
  return {
    accession: acc,
    title: str('Study Title'),
    description: str('Study Description').slice(0, 700),
    organism: str('organism'),
    projectType: str('Project Type'),
    mission: mission.Name || undefined,
    missionStart: mission['Start Date'] || undefined,
    missionEnd: mission['End Date'] || undefined,
    assays: str('Study Assay Measurement Type').split(/\s{2,}/).map((x) => x.trim()).filter(Boolean),
    releaseDate: Number.isFinite(rel) && rel > 0 ? new Date(rel * 1000).toISOString().slice(0, 10) : undefined,
    url: `https://osdr.nasa.gov/bio/repo/data/studies/${acc}`,
  };
}

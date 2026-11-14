'use client';

import { CloudOff, Database, ExternalLink, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Badge, Button, Card, Input, Notice } from '@/components/ui';
import { networkAllowed } from '@/services/connectivity';

type Study = { accession: string; title: string; description: string; organism: string; projectType: string; mission?: string; assays: string[]; releaseDate?: string; url: string };
type Result = { term: string; total: number; studies: Study[]; cachedAt: string; stale?: boolean; offline?: boolean };
const KEY = 'cosmicpulse.osdr.cache.v1';
const SUGGEST = ['astronaut', 'Inspiration4', 'radiation', 'bone loss', 'microgravity immune', 'sleep'];

function readCache(): Record<string, Result> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Result>;
  } catch {
    return {};
  }
}

/** Live search of NASA OSDR (server-side proxy), with the last results cached for offline use. */
export function OsdrSearch() {
  const [term, setTerm] = useState('astronaut');
  const [res, setRes] = useState<Result | null>(() => {
    const c = readCache()['astronaut'];
    return c ? { ...c, offline: !networkAllowed() } : null;
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async (q: string) => {
    const t = q.trim();
    if (!t) return;
    setLoading(true);
    setError(null);
    const cache = readCache();
    if (!networkAllowed()) {
      setLoading(false);
      if (cache[t.toLowerCase()]) return setRes({ ...cache[t.toLowerCase()], offline: true });
      return setError('Offline — live OSDR search needs a network link. Cached searches: ' + (Object.keys(cache).join(', ') || 'none yet') + '.');
    }
    try {
      const r = await fetch(`/api/osdr/search?term=${encodeURIComponent(t)}&size=8`, { signal: AbortSignal.timeout(25_000) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? 'OSDR unavailable');
      const out: Result = { term: t, total: j.total, studies: j.studies, cachedAt: j.cachedAt, stale: j.stale };
      setRes(out);
      try {
        const next = { ...cache, [t.toLowerCase()]: out };
        const keys = Object.keys(next).slice(-12);
        localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(keys.map((k) => [k, next[k]]))));
      } catch {
        /* storage full or blocked */
      }
    } catch (e) {
      const c = cache[t.toLowerCase()];
      if (c) setRes({ ...c, offline: true });
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const first = useRef(true);
  useEffect(() => {
    if (first.current && !res) void run('astronaut');
    first.current = false;
  });

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        <Badge label="NASA OSDR Search API · live" tone="info" icon={Database} />
        <Badge label="type=cgene (OSDR records)" />
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(term);
        }}>
        <label htmlFor="osdr" className="sr-only">
          Search NASA OSDR
        </label>
        <Input id="osdr" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search space-biology datasets" maxLength={120} />
        <Button type="submit" icon={Search} loading={loading}>
          Search
        </Button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {SUGGEST.map((s) => (
          <button key={s} onClick={() => { setTerm(s); void run(s); }} className="t-caption rounded-full border border-line-strong px-2.5 py-1 text-ink-2 hover:text-ink">
            {s}
          </button>
        ))}
      </div>
      {error && <Notice tone="warning" icon={CloudOff} title="Live search unavailable">{error}{res?.offline ? ' Showing cached results.' : ''}</Notice>}
      {res && (
        <div className="flex flex-col gap-2">
          <p className="t-caption text-ink-3">
            {res.total} datasets match “{res.term}” · {res.offline ? `cached ${new Date(res.cachedAt).toLocaleString()}` : `retrieved ${new Date(res.cachedAt).toLocaleString()}`}
            {res.stale ? ' (server cache, OSDR unreachable)' : ''}
          </p>
          {res.studies.map((s) => (
            <a key={s.accession} href={s.url} title={s.description} target="_blank" rel="noreferrer" className="flex flex-col gap-1 rounded-[18px] border border-line p-3.5 hover:bg-sunken">
              <span className="flex flex-wrap items-center gap-1.5">
                <Badge label={s.accession} tone="info" />
                {s.organism && <Badge label={s.organism} />}
                {s.mission && <Badge label={s.mission} />}
                {s.releaseDate && <span className="t-telemetry text-ink-3">released {s.releaseDate}</span>}
                <ExternalLink size={12} className="ml-auto text-ink-3" />
              </span>
              <span className="t-headline">{s.title}</span>
              {s.assays.length > 0 && <span className="t-caption text-ink-3">Assays: {s.assays.slice(0, 4).join(' · ')}</span>}
            </a>
          ))}
        </div>
      )}
      <p className="t-caption text-ink-3">Historical study data — not live telemetry. Courtesy NASA OSDR.</p>
    </Card>
  );
}

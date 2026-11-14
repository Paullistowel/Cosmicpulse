'use client';

import { ArrowLeft, Database, ExternalLink, FileText, Quote } from 'lucide-react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Inspiration4Explorer } from '@/components/research/inspiration4';
import { Badge, Card, Notice, Overline, PageHeader, LearnMore } from '@/components/ui';
import { HAZARDS } from '@/research/hazards';
import { NATURE_LABEL, SOURCE_BY_ID } from '@/research/sources';
import { award } from '@/game/progress';
import { networkAllowed } from '@/services/connectivity';

type FileList = { files: { category: string; name: string; size: number; url: string; created: string }[]; cachedAt: string };

function OsdrFiles({ osd }: { osd: string }) {
  const [d, setD] = useState<FileList | null>(null);
  const [err, setErr] = useState<string | null>(() => (networkAllowed() ? null : 'Offline — the file list loads from NASA OSDR when a link is available.'));
  useEffect(() => {
    if (!networkAllowed()) return;
    fetch(`/api/osdr/files?osd=${osd.replace('OSD-', '')}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error?.message ?? 'Unavailable');
        setD(j);
      })
      .catch((e) => setErr((e as Error).message));
  }, [osd]);
  return (
    <Card className="flex flex-col gap-2">
      <Overline>Public files (OSDR Data File API)</Overline>
      {err && <Notice tone="warning">{err}</Notice>}
      {!d && !err && <p className="t-callout text-ink-3">Loading file list…</p>}
      {d?.files.map((f) => (
        <a key={f.name} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-[14px] px-2 py-2 hover:bg-sunken">
          <FileText size={15} className="shrink-0 text-ink-3" />
          <span className="min-w-0 flex-1">
            <span className="t-callout block truncate">{f.name}</span>
            <span className="t-caption text-ink-3">{f.category} · {(f.size / 1024).toFixed(0)} KB · {f.created}</span>
          </span>
          <ExternalLink size={13} className="text-ink-3" />
        </a>
      ))}
    </Card>
  );
}

export default function SourcePage() {
  const { id } = useParams<{ id: string }>();
  const s = SOURCE_BY_ID.get(id);
  useEffect(() => {
    if (s) award('research_read', s.id);
  }, [s]);
  if (!s) notFound();
  const hazards = HAZARDS.filter((h) => h.science.some((x) => x.ref.startsWith(`${s.id}#`)) || h.datasetIds.includes(s.id));
  const osd = s.identifiers?.find((x) => x.startsWith('OSD-'));
  const rows: [string, string | undefined][] = [
    ['Organisation', s.org],
    ['Resource type', NATURE_LABEL[s.nature]],
    ['Original URL', s.url],
    ['Identifiers', s.identifiers?.join(' · ')],
    ['Data collected', s.collected],
    ['Published', s.published],
    ['Page updated', s.updated],
    ['Retrieved by CosmicPulse', s.retrievedAt],
    ['Machine-readable', s.machineReadable ? 'Yes' : 'No — research documentation'],
    ['Currency', s.currency],
    ['Usage & licence', s.usage],
    ['Attribution', s.attribution],
  ];
  return (
    <div className="flex flex-col gap-6">
      <Link href="/research" className="t-callout flex items-center gap-1 text-ink-2 hover:text-ink"><ArrowLeft size={16} /> Research library</Link>
      <div className="flex flex-wrap gap-1.5">
        <Badge label={s.org} tone="primary" size="md" />
        <Badge label={NATURE_LABEL[s.nature]} size="md" />
        {s.challengeResource && <Badge label="Space Apps 2026 challenge resource" tone="demo" size="md" />}
        {s.machineReadable && <Badge label="Machine-readable" tone="success" icon={Database} size="md" />}
      </div>
      <PageHeader title={s.title} subtitle={s.summary} actions={<a href={s.url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-pill px-3.5 text-[13px] font-medium text-on-pill">Open original <ExternalLink size={14} /></a>} />
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="flex flex-col gap-6 xl:col-span-3">
          <Card className="flex flex-col gap-3">
            <Overline>Information extracted</Overline>
            {s.facts.length === 0 && <p className="t-callout text-ink-3">Nothing extracted — see limitations.</p>}
            <div className="grid gap-2 sm:grid-cols-3">
              {s.facts.slice(0, 3).map((f) => (
                <div key={f.id} className="flex flex-col gap-2 rounded-[18px] bg-sunken p-3.5">
                  <Quote size={18} className="text-primary" />
                  <p className="t-callout line-clamp-5" title={f.text}>{f.text}</p>
                </div>
              ))}
            </div>
            {s.facts.length > 3 && (
              <LearnMore title={`${s.facts.length - 3} more facts`}>
                {s.facts.slice(3).map((f) => <p key={f.id}>• {f.text}{f.units ? ` (${f.units})` : ''}</p>)}
              </LearnMore>
            )}
          </Card>
          {(s.id === 'osd-575' || s.id === 'osd-569') && <Inspiration4Explorer />}
          {osd && <OsdrFiles osd={osd} />}
        </div>
        <div className="flex flex-col gap-6 xl:col-span-2">
          <LearnMore title="Provenance">
            <dl className="flex flex-col gap-2">
              {rows.filter(([, v]) => v).map(([k, v]) => (
                <div key={k}>
                  <dt className="t-caption text-ink-3">{k}</dt>
                  <dd className="t-callout break-words">{k === 'Original URL' ? <a href={v} target="_blank" rel="noreferrer" className="text-primary hover:underline">{v}</a> : v}</dd>
                </div>
              ))}
            </dl>
          </LearnMore>
          <Card className="flex flex-col gap-2">
            <Overline>How CosmicPulse uses it</Overline>
            <ul className="t-callout list-disc space-y-1 pl-5 text-ink-2">{s.usedFor.slice(0, 3).map((u) => <li key={u}>{u}</li>)}</ul>
            {hazards.length > 0 && <div className="flex flex-wrap gap-1.5 pt-1">{hazards.map((h) => <Link key={h.id} href={`/risk/${h.id}`}><Badge label={h.name} tone="primary" /></Link>)}</div>}
          </Card>
          {s.limitations && <Notice tone="warning" title="Limitations">{s.limitations}</Notice>}
        </div>
      </div>
    </div>
  );
}

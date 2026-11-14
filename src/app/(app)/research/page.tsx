'use client';

import { BookOpenText, Bot, Database, ExternalLink, FlaskConical, Pencil, Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Inspiration4Explorer } from '@/components/research/inspiration4';
import { OsdrSearch } from '@/components/research/osdr-search';
import { Badge, Chip, Input, PageHeader, Section, cn } from '@/components/ui';
import { HRP_STUDIES } from '@/research/hazards';
import { searchEvidence } from '@/research/search';
import { CHALLENGE_SOURCES, NATURE_LABEL, SOURCES, type SourceOrg } from '@/research/sources';

const TOPICS = [
  { q: 'radiation', label: 'Radiation', emoji: '☢️' },
  { q: 'sleep', label: 'Sleep', emoji: '🌙' },
  { q: 'bone', label: 'Bones', emoji: '🦴' },
  { q: 'heart', label: 'Heart', emoji: '❤️' },
  { q: 'immune', label: 'Immunity', emoji: '🛡️' },
  { q: 'isolation', label: 'Isolation', emoji: '🧑‍🚀' },
];
const COVERS = ['/images/nasa/iss-orbit.jpg', '/images/nasa/cupola.jpg', '/images/nasa/solar-flare.jpg', '/images/nasa/treadmill.jpg', '/images/nasa/mission-control.jpg'];

const CLASSES = [
  { icon: Database, tone: 'info' as const, label: 'NASA research data', body: 'Published datasets (NASA OSDR) and agency research pages — historical/experimental, with provenance.' },
  { icon: Pencil, tone: 'neutral' as const, label: 'Your recorded measurements', body: 'Manual entries, Bluetooth sensors and phone-synced wearable data — labelled with source and time.' },
  { icon: FlaskConical, tone: 'demo' as const, label: 'Simulated telemetry', body: 'SYNTHETIC demo data from mission scenarios — never presented as real measurements.' },
  { icon: Bot, tone: 'primary' as const, label: 'AI-generated explanations', body: 'Assistant text grounded in the above; cites sources and never invents data.' },
];

export default function ResearchPage() {
  const [org, setOrg] = useState<SourceOrg | 'all'>('all');
  const [q, setQ] = useState('');
  const hits = useMemo(() => (q.trim().length > 2 ? searchEvidence(q, 8) : []), [q]);
  const list = SOURCES.filter((s) => !s.challengeResource && (org === 'all' || s.org === org));
  return (
    <div className="flex flex-col gap-8">
      <PageHeader overline="Research & evidence" title="NASA research library" subtitle="The scientific foundation behind every CosmicPulse assessment — extracted from the official Space Apps 2026 challenge resources and NASA’s open data, with full provenance. Available offline." />

      {/* Big search with topic chips */}
      <section className="relative overflow-hidden rounded-[28px] p-5 sm:p-7" style={{ background: 'radial-gradient(70% 120% at 100% 0%, color-mix(in srgb, var(--violet) 22%, transparent), transparent 60%), var(--surface)' }}>
        <div className="relative">
          <Search size={22} className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-ink-3" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search space science…" className="h-14 rounded-full pl-14 text-[17px]" aria-label="Search the evidence library" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <button key={t.q} onClick={() => setQ(t.q)} className={cn('t-callout flex items-center gap-1.5 rounded-full px-3.5 py-2 font-medium transition-colors', q === t.q ? 'bg-pill text-on-pill' : 'bg-sunken hover:bg-[color-mix(in_srgb,var(--primary)_14%,var(--sunken))]')}>
              <span aria-hidden>{t.emoji}</span>{t.label}
            </button>
          ))}
        </div>
        {q.trim().length > 2 && (
          <div className="mt-4 flex flex-col gap-1">
            {hits.length === 0 && <p className="t-callout text-ink-3">Nothing found — try another word.</p>}
            {hits.map((h, i) => (
              <Link key={i} href={h.kind === 'study' ? h.url : `/research/${h.ref.split('#')[0]}`} target={h.kind === 'study' ? '_blank' : undefined} className="flex flex-col gap-0.5 rounded-[14px] p-2.5 hover:bg-sunken">
                <span className="t-caption text-primary">{h.org} · {h.kind === 'fact' ? h.sourceTitle : h.kind === 'risk' ? 'HRP risk' : 'HRP study'}</span>
                <span className="t-callout line-clamp-2">{h.text}</span>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Kinds of information">
          {CLASSES.map((c) => <span key={c.label} title={c.body}><Badge label={c.label} tone={c.tone} icon={c.icon} /></span>)}
        </div>
      </section>

      <Section title="The five mission resources" description="The five NASA and CSA resources supplied for the Health Monitoring Software challenge.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {CHALLENGE_SOURCES.map((s, i) => (
            <Link key={s.id} href={`/research/${s.id}`} title={s.summary} className="group relative flex h-56 flex-col justify-end overflow-hidden rounded-[24px] p-4 text-white">
              <Image src={COVERS[i % COVERS.length]} alt="" fill sizes="(min-width: 1280px) 20vw, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#05080D] via-[#05080D]/45 to-transparent" />
              <span className="relative mb-auto flex gap-1.5"><Badge label={s.org} tone={s.org === 'CSA' ? 'accent' : 'primary'} /></span>
              <span className="t-headline relative line-clamp-3">{s.title}</span>
              <span className="t-telemetry relative mt-1 text-white/70">{s.facts.length} FACTS</span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="NASA open data: Inspiration4 crew" description="Real, downloadable NASA OSDR data integrated into the app (bundled for offline use).">
        <Inspiration4Explorer />
      </Section>

      <Section title="Explore NASA OSDR" description="Live dataset search through the documented OSDR Search API (proxied server-side; results cached for offline).">
        <OsdrSearch />
      </Section>

      <Section title="Data repositories, standards & literature">
        <div className="flex flex-wrap gap-2">
          {(['all', 'NASA OSDR', 'NASA', 'Literature'] as const).map((o) => <Chip key={o} selected={org === o} onClick={() => setOrg(o)}>{o === 'all' ? 'All' : o}</Chip>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => (
            <Link key={s.id} href={`/research/${s.id}`} title={s.summary} className="card flex flex-col gap-1.5 p-4 transition-transform hover:-translate-y-0.5">
              <span className="flex flex-wrap gap-1.5">
                <Badge label={s.org} tone="info" />
                <Badge label={NATURE_LABEL[s.nature]} />
                {s.machineReadable && <Badge label="Machine-readable" tone="success" icon={Database} />}
              </span>
              <span className="t-headline">{s.title}</span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Ongoing HRP research" description="Investigations listed on NASA’s “Ongoing HRP Research in Space” page.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {HRP_STUDIES.map((s) => (
            <a key={s.id} href={s.url} target="_blank" rel="noreferrer" title={s.aim} className="card flex flex-col gap-1 p-4 hover:-translate-y-0.5">
              <span className="flex items-center justify-between"><Badge label={s.setting} tone={s.setting === 'Artemis II' ? 'primary' : 'neutral'} /><ExternalLink size={13} className="text-ink-3" /></span>
              <span className="t-headline">{s.name}</span>
            </a>
          ))}
        </div>
      </Section>
      <p className="t-caption flex items-center gap-1.5 text-ink-3"><BookOpenText size={13} /> NASA and CSA content is cited for research context. Neither agency endorses CosmicPulse. Full source list: NASA_DATA_SOURCES.md.</p>
    </div>
  );
}

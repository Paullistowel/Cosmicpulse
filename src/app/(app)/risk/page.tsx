'use client';

import { ChevronRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { DataSourceBanner } from '@/components/health';
import { Badge, Card, Notice, PageHeader, cn } from '@/components/ui';
import { HAZARD_STATUS_COPY } from '@/intel/hazard-profile';
import { HAZARD_ICON, HAZARD_IMAGE } from '@/lib/hazard-ui';
import { HAZARDS, HRP_RISKS } from '@/research/hazards';
import { useHazards } from '@/store/engine-runner';
import { TONE_CLASS } from '@/theme';


export default function RiskPage() {
  const profiles = useHazards();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        overline="Spaceflight risk intelligence"
        title="The five hazards of human spaceflight"
        subtitle="NASA’s Human Research Program groups the dangers of spaceflight into five hazards. Each card links the science to the changes CosmicPulse sees in your own data."
      />
      <DataSourceBanner compact />
      <Notice title="Relevance, not diagnosis">“Worth watching” means linked to your recent changes — never a diagnosis.</Notice>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {HAZARDS.map((h) => {
          const p = profiles.find((x) => x.hazard === h.id)!;
          const c = HAZARD_STATUS_COPY[p.status];
          const Icon = HAZARD_ICON[h.id];
          return (
            <Link key={h.id} href={`/risk/${h.id}`} className="card group flex flex-col overflow-hidden p-0 transition-transform hover:-translate-y-0.5 hover:shadow-float sm:p-0">
              <div className="relative h-32">
                <Image src={HAZARD_IMAGE[h.id]} alt="" fill sizes="(min-width: 1280px) 33vw, 50vw" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                <span className="glass absolute top-3 left-3 flex size-9 items-center justify-center rounded-full"><Icon size={17} /></span>
                <span className="absolute top-3 right-3"><Badge label={c.label} tone={c.tone} size="md" /></span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-5">
                <h2 className="t-title3">{h.name}</h2>
                <p className="t-callout text-ink-2">{h.short}</p>
                <div className="mt-1 flex flex-col gap-1">
                  {p.signals.slice(0, 3).map((s) => (
                    <p key={s.id} className="t-caption flex items-center gap-2"><span className={cn('size-2 rounded-full', s.level === 'attention' ? 'bg-warning' : 'bg-info')} />{s.label}{s.synthetic ? ' · synthetic' : ''}</p>
                  ))}
                  {p.findings.slice(0, 2).map((f) => <p key={f.id} className="t-caption flex items-center gap-2"><span className="size-2 rounded-full bg-primary" />{f.title}</p>)}
                  {!p.signals.length && !p.findings.length && <p className="t-caption text-ink-3">No linked changes in your data.</p>}
                </div>
                <p className="t-caption mt-auto flex items-center gap-1 pt-2 text-ink-3">{h.riskIds.length} HRP risks · {h.studyIds.length} studies <ChevronRight size={13} className="ml-auto" /></p>
              </div>
            </Link>
          );
        })}
        <Card className="flex flex-col gap-2 md:col-span-2 xl:col-span-3">
          <h2 className="t-title3">All 17 NASA HRP risks</h2>
          <p className="t-callout text-ink-2">From “Risks of Human Spaceflight”, grouped as on the NASA page.</p>
          <div className="grid gap-4 md:grid-cols-3">
          {(['Human Physiology', 'Behavioral Performance and Human Factors', 'Space Radiation'] as const).map((g) => (
            <div key={g} className="mt-1">
              <p className="t-overline mb-1 text-ink-3">{g}</p>
              <ul className="t-caption flex flex-col gap-0.5 text-ink-2">
                {HRP_RISKS.filter((r) => r.group === g).map((r) => <li key={r.id}>{r.name.replace('Risk of ', '')}</li>)}
              </ul>
            </div>
          ))}
          </div>
          <a href="https://www.nasa.gov/hrp/risks/" target="_blank" rel="noreferrer" className={cn('t-caption mt-2 self-start rounded-full px-2 py-1', TONE_CLASS.primary)}>nasa.gov/hrp/risks ↗</a>
        </Card>
      </div>
    </div>
  );
}

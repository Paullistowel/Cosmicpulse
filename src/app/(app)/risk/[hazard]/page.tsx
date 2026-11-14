'use client';

import { AlertTriangle, ArrowLeft, BookOpenText, Database, ExternalLink, FlaskConical, ShieldAlert, Sparkles, Stethoscope } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';

import { useDock } from '@/components/assistant/use-assistant';
import { Badge, Button, Card, Notice, Overline, Section, SeverityBadge, cn, LearnMore } from '@/components/ui';
import { VITAL_META } from '@/data/vitals';
import { ENV_LABEL, findProtocol } from '@/engine';
import { HAZARD_STATUS_COPY } from '@/intel/hazard-profile';
import { HAZARD_BY_ID, PROTOTYPE_GUIDANCE_LABEL, riskById, studyById, type HazardId } from '@/research/hazards';
import { SOURCE_BY_ID, resolveRef } from '@/research/sources';
import { useEffect } from 'react';

import { award } from '@/game/progress';
import { useHazards } from '@/store/engine-runner';
import { HAZARD_ICON, HAZARD_IMAGE } from '@/lib/hazard-ui';

function List({ items, icon: Icon, tone }: { items: string[]; icon: typeof AlertTriangle; tone: string }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((x) => (
        <li key={x} className="t-callout flex items-start gap-2 text-ink-2">
          <Icon size={15} className={cn('mt-0.5 shrink-0', tone)} /> <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

export default function HazardPage() {
  const { hazard } = useParams<{ hazard: string }>();
  const h = HAZARD_BY_ID[hazard as HazardId];
  const profiles = useHazards();
  const queue = useDock((s) => s.queue);
  useEffect(() => {
    if (h) award('hazard_explored', h.id);
  }, [h]);
  if (!h) notFound();
  const p = profiles.find((x) => x.hazard === h.id)!;
  const c = HAZARD_STATUS_COPY[p.status];
  const Icon = HAZARD_ICON[h.id];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/risk" className="t-callout flex items-center gap-1 text-ink-2 hover:text-ink"><ArrowLeft size={16} /> Risk intelligence</Link>
      <section className="relative overflow-hidden rounded-[30px] p-6 text-white shadow-card sm:p-8">
        <Image src={HAZARD_IMAGE[h.id]} alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/10" />
        <div className="relative flex max-w-2xl flex-col gap-3">
          <span className="flex items-center gap-2"><Icon size={18} /><span className="t-overline text-white/80">NASA hazard of human spaceflight</span></span>
          <h1 className="t-display">{h.name}</h1>
          <p className="t-body text-white/90">{h.short}</p>
          <div className="flex flex-wrap gap-2"><Badge label={`Your data: ${c.label}`} tone={c.tone} size="md" /><Button size="sm" variant="secondary" icon={Sparkles} onClick={() => queue(`How could ${h.name.toLowerCase()} affect my health, given my recent data?`)}>Ask CosmicPulse</Button></div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="flex flex-col gap-6 xl:col-span-3">
          <Section title="What the science says">
            <Card className="flex flex-col gap-3">
              {h.science.slice(0, 1).map((s) => <ScienceLine key={s.ref + s.text} s={s} big />)}
              {h.science.length > 1 && (
                <LearnMore title={`More science (${h.science.length - 1})`}>
                  {h.science.slice(1).map((s) => <ScienceLine key={s.ref + s.text} s={s} />)}
                </LearnMore>
              )}
            </Card>
          </Section>

          <Section title="Physiological & behavioural risks" description="Named NASA HRP risks associated with this hazard.">
            <div className="grid gap-3 sm:grid-cols-2">
              {h.riskIds.map((id) => {
                const r = riskById(id)!;
                return (
                  <Card key={id} className="flex flex-col gap-1.5">
                    <Badge label={r.group} className="self-start" />
                    <p className="t-headline">{r.name}</p>
                    {r.metrics.length > 0 ? <p className="t-caption text-ink-3">CosmicPulse watches: {r.metrics.map((m) => VITAL_META[m].shortLabel).join(', ')}</p> : <p className="t-caption text-ink-3">Not observable with CosmicPulse sensors — documented for context.</p>}
                  </Card>
                );
              })}
            </div>
          </Section>

          <Section title="NASA research supporting this">
            <div className="grid gap-3 sm:grid-cols-2">
              {h.studyIds.map((id) => {
                const s = studyById(id)!;
                return (
                  <a key={id} href={s.url} title={s.aim} target="_blank" rel="noreferrer" className="card flex flex-col gap-1.5 p-4 transition-transform hover:-translate-y-0.5">
                    <span className="flex items-center justify-between"><Badge label={s.setting} tone={s.setting === 'Artemis II' ? 'primary' : 'neutral'} /><ExternalLink size={13} className="text-ink-3" /></span>
                    <span className="t-headline">{s.name}</span>
                  </a>
                );
              })}
            </div>
            {h.datasetIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {h.datasetIds.map((d) => <Link key={d} href={`/research/${d}`}><Badge label={`${SOURCE_BY_ID.get(d)?.identifiers?.[0] ?? d} · NASA OSDR dataset`} tone="info" icon={Database} size="md" /></Link>)}
              </div>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-6 xl:col-span-2">
          <Section title="Your data">
            <Card className="flex flex-col gap-3">
              <Badge label={c.label} tone={c.tone} size="md" className="self-start" />
              <p className="t-callout text-ink-2">{p.narrative}</p>
              {p.signals.map((s) => (
                <div key={s.id} className="rounded-[16px] bg-sunken p-3">
                  <p className="t-headline flex flex-wrap items-center gap-2">{s.label} <Badge label={s.level === 'attention' ? 'Attention' : 'Watch'} tone={s.level === 'attention' ? 'warning' : 'info'} />{s.synthetic && <Badge label="SYNTHETIC" tone="demo" icon={FlaskConical} />}</p>
                  <p className="t-callout text-ink-2">{s.detail}</p>
                </div>
              ))}
              {p.findings.map((f) => (
                <Link key={f.id} href={`/alerts/${encodeURIComponent(f.id)}`} className="flex items-center justify-between gap-2 rounded-[16px] bg-sunken p-3 hover:bg-line-strong/40">
                  <span className="t-callout font-medium">{f.title}</span>
                  <SeverityBadge severity={f.severity} />
                </Link>
              ))}
            </Card>
          </Section>
          <Section title="Health indicators monitored">
            <Card className="flex flex-wrap gap-2">
              {h.indicators.map((i) => (
                <div key={i.label} title={i.why} className="rounded-full bg-sunken px-3 py-1.5">
                  {i.metric ? <Link href={`/vitals/${i.metric}`} className="t-headline hover:underline">{i.label}</Link> : <p className="t-headline">{i.label}{i.env ? <span className="t-caption ml-1 text-ink-3">({ENV_LABEL[i.env]})</span> : null}</p>}
                </div>
              ))}
            </Card>
          </Section>
          <Card className="flex flex-col gap-4">
            <Notice tone="neutral" icon={ShieldAlert}>{PROTOTYPE_GUIDANCE_LABEL}</Notice>
            <div><Overline className="mb-2">Potential warning signs</Overline><List items={h.warningSigns} icon={AlertTriangle} tone="text-warning-ink" /></div>
            <div><Overline className="mb-2">Preventive measures</Overline><List items={h.prevention} icon={ShieldAlert} tone="text-success" /></div>
            <div><Overline className="mb-2">Recommended actions</Overline><List items={h.actions} icon={ShieldAlert} tone="text-primary" /></div>
            <div><Overline className="mb-2">When to escalate</Overline><List items={h.escalation} icon={Stethoscope} tone="text-critical" /></div>
            <div className="flex flex-wrap gap-1.5">
              {h.protocolIds.map((id) => { const pr = findProtocol(id); return pr ? <Badge key={id} label={`${pr.id} v${pr.version} · ${pr.title}`} tone="accent" /> : null; })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ScienceLine({ s, big }: { s: { ref: string; text: string }; big?: boolean }) {
  const r = resolveRef(s.ref);
  return (
    <p className={big ? 't-body flex items-start gap-2.5' : 't-callout flex items-start gap-2'}>
      <BookOpenText size={big ? 18 : 15} className="mt-0.5 shrink-0 text-primary" />
      <span>{s.text} {r && <Link href={`/research/${r.source.id}`} className="t-caption font-medium whitespace-nowrap text-primary hover:underline">[{r.source.org}]</Link>}</span>
    </p>
  );
}

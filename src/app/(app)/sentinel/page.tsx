'use client';

import { Activity, BellRing, BookOpenText, CheckCircle2, Clock, HeartPulse, HelpCircle, ListChecks, Pause, Play, Stethoscope, TrendingUp, Volume2, VolumeX } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { AssistantChat } from '@/components/assistant/chat';
import { RelationDiagram, SentinelOrb } from '@/components/sentinel';
import { toast } from '@/components/toast';
import { Badge, Button, ButtonLink, Card, EmptyState, FindingKindBadge, Overline, SeverityBadge, alertCategory, cn, Summary } from '@/components/ui';
import { ALERT_STATE_COPY } from '@/features/intelligence/intel';
import { ago, stamp } from '@/features/health/vitals';
import { award } from '@/game/progress';
import { useNow } from '@/hooks/use-now';
import { REASSESS, SENTINEL_VERSION, buildBriefing, relationGraph, sevenQuestions, useFollowUps } from '@/sentinel/sentinel';
import { useDataSource } from '@/services/data-source';
import { useEngine, useHazards } from '@/store/engine-runner';
import { useHealth } from '@/store/health';
import { TONE_CLASS } from '@/theme';

function SentinelInner() {
  const now = useNow(30_000);
  const sp = useSearchParams();
  const router = useRouter();
  const engine = useEngine();
  const hazards = useHazards();
  const ds = useDataSource();
  const h = useHealth();
  const fu = useFollowUps();
  const findings = engine.findings;
  const [sel, setSel] = useState<string | undefined>(sp.get('finding') ?? findings[0]?.id);
  const f = findings.find((x) => x.id === sel) ?? findings[0];
  const due = fu.list.filter((x) => x.status === 'open' && new Date(x.dueAt).getTime() <= now);
  const briefing = useMemo(() => buildBriefing({ name: h.profile.name, mission: h.mission, risk: engine.risk, readiness: engine.readiness, findings, hazards, sleep: h.sleepRecords, moods: h.moods, synthetic: ds.state === 'demo' || ds.state === 'mixed', dueFollowUps: due.length, now }), [h, engine, findings, hazards, ds.state, due.length, now]);
  const [playing, setPlaying] = useState(false);
  const [shown, setShown] = useState(briefing.items.length);
  const [voice, setVoice] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setPlaying(false);
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  };
  const play = () => {
    stop();
    setShown(0);
    setPlaying(true);
    award('briefing_viewed');
    if (voice && typeof speechSynthesis !== 'undefined') {
      const u = new SpeechSynthesisUtterance(`${briefing.headline}. ${briefing.status}. ${briefing.items.map((i) => `${i.title}. ${i.detail}`).join(' ')}`);
      u.rate = 1.02;
      speechSynthesis.speak(u);
    }
    let i = 0;
    timer.current = setInterval(() => {
      i++;
      setShown(i);
      if (i >= briefing.items.length) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setTimeout(() => setPlaying(false), 900);
      }
    }, 1400);
  };
  useEffect(() => () => stop(), []); // cleanup on unmount

  const seven = f ? sevenQuestions(f, { measurements: h.measurements, baselines: engine.baselines, now, alert: h.alerts.find((a) => a.insightId === f.id) }) : null;
  const graph = f ? relationGraph(f, h.sleepRecords, now) : null;
  const reviewed = f ? fu.reviewed[f.id] : undefined;
  const openFu = f ? fu.list.find((x) => x.findingId === f.id && x.status === 'open') : undefined;
  const history = [...h.alerts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);

  return (
    <div className="flex flex-col gap-6">
      {/* Identity + briefing */}
      <section data-tour="sentinel-hero" className="relative overflow-hidden rounded-[30px] p-6 shadow-card sm:p-8" style={{ background: 'radial-gradient(70% 90% at 15% 30%, color-mix(in srgb, var(--violet) 28%, transparent), transparent 60%), radial-gradient(60% 80% at 90% 80%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 60%), var(--surface)' }}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <SentinelOrb size={168} speaking={playing} />
          <div className="min-w-0 flex-1">
            <p className="t-overline text-violet">Chapter 04 · Your daily mission · Sentinel AI</p>
            <h1 className="t-title1">{briefing.headline}</h1>
            <p className="t-title3 mt-1 font-normal text-ink-2">{briefing.status}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button icon={playing ? Pause : Play} onClick={playing ? stop : play}>{playing ? 'Stop briefing' : 'Play daily briefing'}</Button>
              <Button variant="secondary" icon={voice ? Volume2 : VolumeX} aria-pressed={voice} onClick={() => setVoice((v) => !v)}>{voice ? 'Read aloud on' : 'Read aloud off'}</Button>
            </div>
            <p className="t-caption mt-2 text-ink-3">Rule-based ({SENTINEL_VERSION}) · explains, never diagnoses.</p>
          </div>
        </div>
        <ol className="mt-6 grid gap-2 md:grid-cols-2" aria-live="polite">
          {briefing.items.map((it, i) => (
            <li key={it.title + i} className={cn('flex gap-3 rounded-[18px] bg-sunken/70 p-3 transition-all duration-500', i < shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0')}>
              <span className={cn('mt-1 size-2.5 shrink-0 rounded-full', it.tone === 'critical' ? 'bg-critical' : it.tone === 'warning' ? 'bg-warning' : it.tone === 'demo' ? 'bg-demo' : it.tone === 'info' ? 'bg-info' : 'bg-success')} />
              <span className="min-w-0">
                {it.href ? <Link href={it.href} className="t-headline hover:underline">{it.title}</Link> : <span className="t-headline">{it.title}</span>}
                <span className="t-callout line-clamp-2 block text-ink-2" title={it.detail}>{it.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        {/* Findings rail */}
        <Card className="flex h-fit flex-col gap-1 p-3 sm:p-3">
          <Overline className="px-2 pt-1 pb-2">Detected patterns ({findings.length})</Overline>
          {findings.length === 0 && <EmptyState icon={CheckCircle2} title="Nothing to explain" body="No changes from your baseline or mission rules right now." />}
          {findings.map((x) => {
            const c = alertCategory(x.severity);
            return (
              <button key={x.id} onClick={() => { setSel(x.id); router.replace(`/sentinel?finding=${encodeURIComponent(x.id)}`, { scroll: false }); }} aria-pressed={f?.id === x.id} className={cn('flex flex-col gap-1 rounded-[16px] p-3 text-left', f?.id === x.id ? 'bg-pill text-on-pill' : 'hover:bg-sunken')}>
                <span className="flex items-center gap-2"><span className={cn('size-2 rounded-full', c.label === 'Critical' ? 'bg-critical' : c.label === 'Warning' ? 'bg-warning' : 'bg-success')} /><span className="t-caption opacity-80">{c.label}{x.simulated ? ' · synthetic' : ''}{fu.reviewed[x.id] ? ' · reviewed' : ''}</span></span>
                <span className="t-callout font-medium">{x.title}</span>
              </button>
            );
          })}
        </Card>

        {/* Explanation */}
        {f && seven ? (
          <div className="flex flex-col gap-4">
            <Card className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5"><FindingKindBadge kind={f.kind} /><SeverityBadge severity={f.severity} />{f.simulated && <Badge label="SYNTHETIC — demonstration" tone="demo" />}</div>
              <h2 className="t-title2">{f.title}</h2>
              <ol className="grid gap-3 lg:grid-cols-2">
                {seven.answers.map((a, i) => {
                  const Q = Q_ICON[i] ?? Q_ICON[0];
                  const safety = i === seven.answers.length - 1;
                  return (
                  <li key={a.q} className={cn('flex gap-3 rounded-[18px] p-3.5', safety ? 'bg-critical-soft/60 ring-1 ring-[color-mix(in_srgb,var(--critical)_30%,transparent)]' : 'bg-sunken/60')}>
                    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', safety ? 'bg-critical-soft text-critical' : 'bg-violet-soft text-violet')}><Q.icon size={17} aria-hidden /></span>
                    <div className="min-w-0">
                      <p className="t-headline">{Q.label}</p>
                      {/* Safety answer is never shortened. */}
                      {safety ? <p className="t-callout text-ink-2">{a.a}</p> : <Summary text={a.a} className="t-callout text-ink-2" />}
                      {a.refs?.map((r) => <Link key={r.href + r.text} href={r.href} className="t-caption mt-1 flex items-start gap-1 text-primary hover:underline"><BookOpenText size={12} className="mt-0.5 shrink-0" />{r.source}</Link>)}
                    </div>
                  </li>
                  );
                })}
              </ol>
              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                <Button size="sm" icon={CheckCircle2} disabled={!!reviewed} onClick={() => { fu.markReviewed(f.id); award('recommendation_reviewed', f.id); toast('Recommendation reviewed'); }}>{reviewed ? `Reviewed ${ago(reviewed, now)}` : 'Mark recommendation reviewed'}</Button>
                <Button size="sm" variant="outline" icon={Clock} disabled={!!openFu} onClick={() => { const x = fu.track(f, REASSESS[seven.tier].hours); toast(`Follow-up scheduled · reassess ${new Date(x.dueAt).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`); }}>{openFu ? `Follow-up due ${new Date(openFu.dueAt).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` : `Track follow-up (${REASSESS[seven.tier].hours} h)`}</Button>
                <ButtonLink size="sm" variant="ghost" href={`/alerts/${encodeURIComponent(f.id)}`}>Full 8-point detail</ButtonLink>
              </div>
            </Card>
            {graph && graph.nodes.length > 2 && (
              <Card className="flex flex-col gap-2">
                <Overline>How these measurements relate</Overline>
                <RelationDiagram g={graph} />
              </Card>
            )}
          </div>
        ) : (
          <Card><EmptyState icon={BellRing} title="No active patterns" body="Sentinel keeps watching your data every minute. Ask a question below any time." /></Card>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section id="followups" className="flex flex-col gap-3">
          <h2 className="t-title3 px-1">Follow-up tracking</h2>
          <Card className="flex flex-col gap-2">
            {fu.list.length === 0 && <p className="t-callout text-ink-3">No follow-ups. Use “Track follow-up” on a pattern to schedule a reassessment.</p>}
            {fu.list.slice(0, 10).map((x) => {
              const overdue = x.status === 'open' && new Date(x.dueAt).getTime() <= now;
              return (
                <div key={x.id} className="flex flex-wrap items-center gap-2 rounded-[14px] bg-sunken/60 p-3">
                  <ListChecks size={16} className="text-ink-2" />
                  <span className="min-w-0 flex-1"><span className="t-callout block font-medium">{x.title}</span><span className={cn('t-caption', overdue ? 'text-warning-ink' : 'text-ink-3')}>{x.status === 'done' ? `Completed · ${x.outcome}` : `${overdue ? 'Due now' : 'Due'} ${stamp(x.dueAt)}`}</span></span>
                  {x.status === 'open' && (
                    <>
                      {x.metric && <ButtonLink size="sm" variant="secondary" href={`/record?type=${x.metric}`}>Re-measure</ButtonLink>}
                      {(['Settled', 'Persisting', 'Worse'] as const).map((o) => <Button key={o} size="sm" variant="ghost" onClick={() => { fu.complete(x.id, o); award('followup_completed', x.id); toast(o === 'Worse' ? 'Logged — consider contacting the crew medical officer' : 'Follow-up completed', o === 'Worse' ? 'warning' : 'success'); }}>{o}</Button>)}
                    </>
                  )}
                </div>
              );
            })}
          </Card>
          <h2 className="t-title3 mt-2 px-1">Alert history</h2>
          <Card className="flex flex-col gap-1 py-2">
            {history.length === 0 && <p className="t-callout px-2 py-3 text-ink-3">No alerts yet.</p>}
            {history.map((a) => (
              <Link key={a.id} href={`/alerts/${encodeURIComponent(a.insightId)}`} className="flex items-center gap-2 rounded-[14px] px-2 py-2 hover:bg-sunken">
                <span className="t-callout min-w-0 flex-1 truncate">{a.title}</span>
                <span className={cn('t-caption rounded-full px-2 py-0.5', TONE_CLASS[ALERT_STATE_COPY[a.state].tone])}>{ALERT_STATE_COPY[a.state].label}</span>
                <span className="t-telemetry text-ink-3">{ago(a.updatedAt, now)}</span>
              </Link>
            ))}
          </Card>
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="t-title3 px-1">Talk to Sentinel</h2>
          <Card className="flex h-[560px] flex-col"><AssistantChat compact /></Card>
        </section>
      </div>
    </div>
  );
}

const Q_ICON: { icon: typeof Clock; label: string }[] = [
  { icon: TrendingUp, label: 'What changed?' },
  { icon: Activity, label: 'Which readings?' },
  { icon: HeartPulse, label: 'Why it matters' },
  { icon: HelpCircle, label: 'Possible causes' },
  { icon: CheckCircle2, label: 'What to do' },
  { icon: Clock, label: 'When to re-check' },
  { icon: Stethoscope, label: 'When to call medical' },
];

export default function SentinelPage() {
  return <Suspense><SentinelInner /></Suspense>;
}

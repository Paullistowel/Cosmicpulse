'use client';

import { AlertTriangle, ArrowRight, BedDouble, Brain, CheckCircle2, ChevronRight, Footprints, RadioTower, Siren, Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';

import { DataSourceBanner, MetClock, ROLE_LABEL, VitalTile } from '@/components/health';
import { MissionArt, RankMeter } from '@/components/game';
import { SentinelOrb } from '@/components/sentinel';
import { useLinkSummary } from '@/components/shell/app-shell';
import { Badge, Card, LivePulse, Overline, ProgressBar, Section, cn } from '@/components/ui';
import { HealthDial } from '@/components/viz';
import { SCENARIOS } from '@/data/demo/scenarios';
import { MISSION_TYPE_LABEL } from '@/engine';
import { fmtDistance, summarize } from '@/engine/activity';
import { RISK_COPY } from '@/features/intelligence/intel';
import { PHASE_LABEL, ago, formatDelay } from '@/features/health/vitals';
import { DAILY, dailyProgress } from '@/game/objectives';
import { ACTIVITY, useProgress } from '@/game/progress';
import { useClientValue, usePrefersReducedMotion } from '@/hooks/use-client-value';
import { useNow } from '@/hooks/use-now';
import { webglAvailable } from '@/components/twin/body-map';
import { greeting } from '@/lib/format';
import { buildBriefing, useFollowUps } from '@/sentinel/sentinel';
import { useDataSource } from '@/services/data-source';
import { useDeviceLink } from '@/services/device-data';
import { useActivity, useResolvedActivity } from '@/store/activity';
import { useEngine, useHazards } from '@/store/engine-runner';
import { useHealth } from '@/store/health';
import { useSettings } from '@/store/settings';
import { TONE_TEXT } from '@/theme';
import { Guide, type Pose } from '@/components/companion';
import { STATUS_COPY, SYSTEMS, systemStatus, type BodySystem, type SystemId, type SystemStatus } from '@/twin/systems';

const GLANCE = ['heart_rate', 'hrv', 'spo2', 'blood_pressure', 'temperature', 'respiratory_rate'] as const;
const HubScene = dynamic(() => import('@/components/universe/hub-scene'), { ssr: false });

export default function CommandCentre() {
  const webgl = useClientValue(webglAvailable, false);
  const reduced = usePrefersReducedMotion(useSettings((s) => s.motion));
  const now = useNow(30_000);
  const engine = useEngine();
  const hazards = useHazards();
  const h = useHealth();
  const ds = useDataSource();
  const link = useLinkSummary();
  const scenario = useSettings((s) => s.scenario);
  const events = useProgress((s) => s.events);
  const fu = useFollowUps((s) => s.list);
  const me = h.crew.find((c) => c.id === h.astronautId);
  const day = Math.max(0, Math.floor((now - new Date(h.mission.launchedAt).getTime()) / 86_400_000));
  const risk = RISK_COPY[engine.risk.level];
  const moodsRecent = h.moods.filter((m) => now - new Date(m.at).getTime() < 7 * 86_400_000);
  const systems = useMemo(() => SYSTEMS.map((s) => ({ s, ...systemStatus(s.id, { measurements: h.measurements, findings: engine.findings, moodsRecent: moodsRecent.length, now }) })), [h.measurements, engine.findings, moodsRecent.length, now]);
  const dueFu = fu.filter((x) => x.status === 'open' && new Date(x.dueAt).getTime() <= now).length;
  const briefing = useMemo(() => buildBriefing({ name: h.profile.name, mission: h.mission, risk: engine.risk, readiness: engine.readiness, findings: engine.findings, hazards, sleep: h.sleepRecords, moods: h.moods, synthetic: ds.state === 'demo' || ds.state === 'mixed', dueFollowUps: dueFu, now }), [h, engine, hazards, ds.state, dueFu, now]);
  const counts = systems.reduce((a, x) => ({ ...a, [x.status]: (a[x.status] ?? 0) + 1 }), {} as Record<SystemStatus, number>);
  const lColor = link.failed ? 'var(--critical)' : link.state === 'online' ? 'var(--success)' : link.state === 'not_configured' ? '#9AA8BA' : 'var(--warning)';
  const progress = Math.min(1, day / h.mission.plannedDays);

  const feed = useMemo(() => {
    const items: { at: string; icon: typeof Sparkles; text: string; href?: string; tone: string }[] = [
      ...h.alerts.slice(0, 6).map((a) => ({ at: a.updatedAt, icon: AlertTriangle, text: `${a.title} · ${a.state}${a.simulated ? ' · synthetic' : ''}`, href: `/sentinel?finding=${encodeURIComponent(a.insightId)}`, tone: a.severity === 'critical' ? 'text-critical' : 'text-warning-ink' })),
      ...events.slice(-6).map((e) => ({ at: e.at, icon: CheckCircle2, text: `${ACTIVITY[e.type].label} (+${e.xp} XP)`, href: '/missions', tone: 'text-accent' })),
      ...h.moods.slice(-3).map((m) => ({ at: m.at, icon: Brain, text: `Mood check-in · mood ${m.mood}/5, stress ${m.stress}/5`, href: '/wellness', tone: 'text-[var(--series-1)]' })),
      ...fu.slice(0, 3).map((x) => ({ at: x.createdAt, icon: Sparkles, text: `Follow-up ${x.status === 'done' ? `completed (${x.outcome})` : 'scheduled'}: ${x.title}`, href: '/sentinel#followups', tone: 'text-violet' })),
    ];
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 7);
  }, [h.alerts, events, h.moods, fu]);

  return (
    <div className="flex flex-col gap-7">
      {/* ---------- Immersive mission hero ---------- */}
      <section className="relative overflow-hidden rounded-[30px] text-white shadow-float xl:min-h-[540px]" aria-label={`Mission ${h.mission.designator}, day ${day}`}>
        {/* Fallback / loading picture underneath the live 3D universe */}
        <Image src="/images/nasa/earth-night.jpg" alt="" fill priority sizes="100vw" className="object-cover opacity-40" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_70%_40%,#0B1640_0%,#05080D_70%)] opacity-80" />
        {webgl && <div className="absolute inset-0"><HubScene reducedMotion={reduced} /></div>}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#05080D]/55 to-[#05080D]/90 sm:bg-gradient-to-r sm:from-[#05080D]/90 sm:via-[#05080D]/35 sm:to-transparent" />
        <div className="relative grid gap-6 p-6 sm:p-8 xl:min-h-[540px] xl:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Link href="/settings" aria-label="Profile" className="relative size-12 shrink-0 overflow-hidden rounded-full border-2 border-white/40"><Image src="/images/visor.jpg" alt="" fill sizes="48px" className="object-cover object-[35%_20%]" /></Link>
              <div className="min-w-0">
                <p className="t-overline text-[#9FE6F2]">Chapter 04 · Your daily mission</p>
                <h1 className="t-title1 truncate">{greeting(new Date(now))}, {h.profile.name.split(' ')[0]}</h1>
                <p className="t-caption text-white/70">{[me?.callsign, me ? ROLE_LABEL[me.role] : undefined, 'fictional demo crew'].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="t-telemetry rounded-full bg-white/15 px-3 py-1 backdrop-blur">{h.mission.designator}</span>
              <span className="t-telemetry rounded-full bg-white/15 px-3 py-1 backdrop-blur">{MISSION_TYPE_LABEL[h.mission.type].toUpperCase()}</span>
              <span className="t-telemetry rounded-full bg-[#7CC8F2]/25 px-3 py-1 text-[#CFEFFF]">{PHASE_LABEL[h.mission.phase].toUpperCase()}</span>
              <Link href="/settings#sources"><span className="t-telemetry rounded-full bg-[#D8B66A]/25 px-3 py-1 text-[#F2E2B8]">SCENARIO · {SCENARIOS.find((s) => s.id === scenario)?.title.toUpperCase()}</span></Link>
            </div>
            <div>
              <p className="t-overline text-white/60">Mission elapsed time</p>
              <MetClock launchedAt={h.mission.launchedAt} />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <span className="flex items-center gap-2"><LivePulse live={link.state === 'online'} color={lColor} size={7} /><span className="t-telemetry">{link.copy.label.toUpperCase()}</span></span>
              <span className="t-telemetry text-white/70">DELAY {formatDelay(h.mission.commDelaySec).toUpperCase()}</span>
              <span className="t-telemetry text-white/70">{link.queued} QUEUED</span>
            </div>
            {/* Mission timeline */}
            <div className="mt-1 max-w-xl">
              <div className="relative h-2 rounded-full bg-white/15">
                <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#62D2E6] to-[#A99BFF]" style={{ width: `${progress * 100}%` }} />
                <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#05080D]" style={{ left: `${progress * 100}%` }} />
              </div>
              <div className="t-telemetry mt-2 flex justify-between text-white/60"><span>LAUNCH</span><span>DAY {day} · {PHASE_LABEL[h.mission.phase].toUpperCase()}</span><span>DAY {h.mission.plannedDays}</span></div>
            </div>
            <div className="mt-auto pt-2"><NovaBriefing now={now} /></div>
          </div>
          <Link href="/assessments" className="glass flex flex-col gap-2 rounded-[26px] p-5 text-ink transition-transform hover:-translate-y-0.5 xl:w-[340px] xl:self-end xl:justify-self-end" aria-label={`Overall health ${risk.label}`}>
            <div className="flex items-start justify-between">
              <div><Overline className="text-ink-2">Astronaut health overview</Overline><p className={cn('t-title2', TONE_TEXT[risk.tone])}>{risk.label}</p></div>
              <ArrowRight size={18} className="text-ink-3" />
            </div>
            <HealthDial risk={engine.risk} readiness={engine.readiness} size={250} />
            <p className="t-callout text-ink-2">{engine.risk.escalationText}</p>
          </Link>
        </div>
      </section>

      <DataSourceBanner compact />

      {/* ---------- Sentinel daily briefing ---------- */}
      <section className="relative grid gap-5 overflow-hidden rounded-[30px] p-5 shadow-card md:grid-cols-[auto_1fr_auto] md:items-center sm:p-6" style={{ background: 'radial-gradient(60% 120% at 0% 50%, color-mix(in srgb, var(--violet) 22%, transparent), transparent 60%), var(--surface)' }} aria-label="Sentinel daily briefing">
        <SentinelOrb size={96} />
        <div className="min-w-0">
          <p className="t-overline text-violet">Sentinel daily briefing</p>
          <p className="t-title3">{briefing.status}</p>
          <ul className="mt-2 grid gap-1.5 lg:grid-cols-2">
            {briefing.items.slice(0, 4).map((it, i) => (
              <li key={it.title + i} className="t-callout flex items-start gap-2"><span className={cn('mt-1.5 size-2 shrink-0 rounded-full', it.tone === 'critical' ? 'bg-critical' : it.tone === 'warning' ? 'bg-warning' : it.tone === 'demo' ? 'bg-demo' : it.tone === 'info' ? 'bg-info' : 'bg-success')} /><span><span className="font-medium">{it.title}</span> <span className="text-ink-2">— {it.detail}</span></span></li>
            ))}
          </ul>
        </div>
        <Link href="/sentinel" className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-pill px-5 text-sm font-medium text-on-pill md:self-center"><Sparkles size={16} /> Play full briefing</Link>
      </section>

      {/* ---------- Your body today (realistic anatomy preview → digital twin) ---------- */}
      <BodyToday systems={systems} counts={counts} />
      <div className="grid gap-7 xl:grid-cols-[1.4fr_1fr]">
        <Section title="Key vitals" action={{ label: 'Health analytics', href: '/analytics' }}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {GLANCE.map((t) => <VitalTile key={t} type={t} measurements={h.measurements} baseline={engine.baselines[t]} now={now} />)}
          </div>
        </Section>
        <Section title="Today’s mission objectives" action={{ label: 'All missions', href: '/missions' }}>
          <Card className="flex flex-col gap-1 py-2">
            {DAILY.slice(0, 4).map((o) => {
              const p = dailyProgress(o, events, now);
              return (
                <Link key={o.id} href={o.href} className="flex items-center gap-3 rounded-[16px] px-2 py-2 hover:bg-sunken">
                  <MissionArt art={o.art} size={40} />
                  <span className="min-w-0 flex-1"><span className="t-callout block font-medium">{o.title}</span><span className="t-caption block truncate text-ink-3">{o.explain}</span></span>
                  {p.complete ? <CheckCircle2 size={18} className="text-success" aria-label="Complete" /> : <Badge label={`+${o.xp}`} tone="primary" />}
                </Link>
              );
            })}
          </Card>
          <RankMeter />
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SleepMini now={now} />
        <ActivityMini now={now} />
        <MoodMini count={moodsRecent.length} avgMood={moodsRecent.length ? moodsRecent.reduce((a, m) => a + m.mood, 0) / moodsRecent.length : undefined} avgStress={moodsRecent.length ? moodsRecent.reduce((a, m) => a + m.stress, 0) / moodsRecent.length : undefined} />
      </div>

      <JourneyStrip />

      <div className="grid gap-7 xl:grid-cols-[1.4fr_1fr]">
        <Section title="Recent developments" action={{ label: 'Mission timeline', href: '/timeline' }}>
          <Card className="flex flex-col py-2">
            {feed.length === 0 && <p className="t-callout px-2 py-4 text-ink-3">Nothing new yet.</p>}
            {feed.map((f, i) => (
              <Link key={i} href={f.href ?? '#'} className="flex items-center gap-3 rounded-[14px] px-2 py-2.5 hover:bg-sunken">
                <f.icon size={16} className={cn('shrink-0', f.tone)} />
                <span className="t-callout min-w-0 flex-1 truncate">{f.text}</span>
                <span className="t-telemetry shrink-0 text-ink-3">{ago(f.at, now)}</span>
              </Link>
            ))}
          </Card>
        </Section>
        <div className="flex flex-col gap-4">
          <Link href="/emergency" className="flex min-h-[72px] items-center gap-4 rounded-[24px] bg-critical p-4 text-white hover:opacity-95" aria-label="Emergency assistance">
            <span className="flex size-11 items-center justify-center rounded-full bg-white/20"><Siren size={22} /></span>
            <span className="flex-1"><span className="t-headline block">Emergency assistance</span><span className="t-caption block text-white/90">Report an incident with vitals and approved guidance</span></span>
            <ChevronRight size={20} />
          </Link>
          <DevicesSync now={now} />
        </div>
      </div>
    </div>
  );
}

function SleepMini({ now }: { now: number }) {
  const sleep = useHealth((s) => s.sleepRecords);
  const last7 = [...sleep].filter((r) => now - new Date(r.night).getTime() < 7 * 86_400_000).sort((a, b) => a.night.localeCompare(b.night));
  const last = last7[last7.length - 1];
  return (
    <Link href="/sleep" className="relative flex flex-col gap-3 overflow-hidden rounded-[26px] p-5 text-white shadow-card transition-transform hover:-translate-y-0.5" aria-label="Sleep and recovery">
      <Image src="/images/nasa/quarters.jpg" alt="" fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0B1730]/70 to-[#05080D]/90" />
      <div className="relative flex items-center gap-2"><BedDouble size={16} /><span className="t-overline text-white/80">Sleep & recovery</span></div>
      <p className="relative t-metric-lg">{last ? last.hours.toFixed(1) : '—'}<span className="t-telemetry ml-1 text-white/70">h last night</span></p>
      <div className="relative flex h-14 items-end gap-1.5" aria-hidden>
        {last7.map((r) => <span key={r.id} className="flex-1 rounded-t-md bg-[#A99BFF]" style={{ height: `${Math.min(100, (r.hours / 9) * 100)}%`, opacity: r.hours < 6 ? 0.55 : 1 }} />)}
      </div>
      <p className="relative t-caption text-white/75">{last7.length ? `${(last7.reduce((a, r) => a + r.hours, 0) / last7.length).toFixed(1)} h average over ${last7.length} nights` : 'No sleep records'}{last && (last.source.kind === 'simulated' || last.source.kind === 'demo') ? ' · synthetic' : ''}</p>
    </Link>
  );
}

function ActivityMini({ now }: { now: number }) {
  const act = useResolvedActivity();
  const prefs = useActivity((s) => s.prefs);
  const t = summarize(act.days, 'day', now, prefs);
  return (
    <Link href="/activity" className="relative flex flex-col gap-3 overflow-hidden rounded-[26px] p-5 text-white shadow-card transition-transform hover:-translate-y-0.5" aria-label="Activity">
      <Image src="/images/nasa/treadmill.jpg" alt="" fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#05080D]/50 to-[#05080D]/90" />
      <div className="relative flex items-center justify-between"><span className="flex items-center gap-2"><Footprints size={16} /><span className="t-overline text-white/80">Physical activity</span></span>{act.demo && <span className="t-caption rounded-full bg-[#D8B66A]/30 px-2 py-0.5 text-[#F2E2B8]">SYNTHETIC</span>}</div>
      <p className="relative t-metric-lg">{t.steps.toLocaleString('en-US')}<span className="t-telemetry ml-1 text-white/70">steps</span></p>
      <div className="relative"><ProgressBar value={t.goalProgress} label="Step goal" /></div>
      <p className="relative t-caption text-white/75">{fmtDistance(t.distanceM)} {t.distanceEstimated ? 'estimated' : 'measured'} · {Math.round(t.exerciseMin)} min exercise · goal {t.goal.toLocaleString('en-US')}</p>
    </Link>
  );
}

function MoodMini({ count, avgMood, avgStress }: { count: number; avgMood?: number; avgStress?: number }) {
  return (
    <Link href="/wellness" className="relative flex flex-col gap-3 overflow-hidden rounded-[26px] p-5 shadow-card transition-transform hover:-translate-y-0.5" style={{ background: 'linear-gradient(140deg, color-mix(in srgb, var(--violet) 26%, var(--surface)), var(--surface))' }} aria-label="Mental wellness">
      <div className="flex items-center gap-2"><Brain size={16} className="text-violet" /><span className="t-overline text-ink-2">Mental wellness</span></div>
      {count ? (
        <>
          <div className="flex items-end gap-6">
            <div><p className="t-metric-lg">{avgMood!.toFixed(1)}</p><p className="t-caption text-ink-3">mood / 5</p></div>
            <div><p className="t-metric-lg">{avgStress!.toFixed(1)}</p><p className="t-caption text-ink-3">stress / 5</p></div>
          </div>
          <p className="t-caption text-ink-3">{count} check-ins this week · private to this device</p>
        </>
      ) : (
        <>
          <p className="t-title3">How are you feeling today?</p>
          <p className="t-callout text-ink-2">A 20-second check-in helps Sentinel notice changes linked to isolation and confinement early.</p>
          <span className="t-callout mt-auto font-medium text-violet">Check in →</span>
        </>
      )}
    </Link>
  );
}

function DevicesSync({ now }: { now: number }) {
  const link = useLinkSummary();
  const dev = useDeviceLink();
  return (
    <Link href="/settings#sources" className="card flex flex-col gap-3 p-5" aria-label="Devices and sync">
      <div className="flex items-center justify-between"><span className="flex items-center gap-2"><RadioTower size={15} className="text-ink-2" /><Overline>Devices & sync</Overline></span><ChevronRight size={16} className="text-ink-3" /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><Overline>Phone data</Overline><p className="t-headline">{dev.lastPullAt ? ago(dev.lastPullAt, now) : 'Off'}</p><p className="t-caption truncate text-ink-3">{dev.lastPullAt ? dev.sources.slice(0, 2).join(', ') || 'Ground sync' : 'sign in to ground'}</p></div>
        <div><Overline>Queued</Overline><p className="t-headline">{link.queued}</p><p className="t-caption text-ink-3">{link.failed ? `${link.failed} failed` : 'events'}</p></div>
        <div><Overline>Last sync</Overline><p className="t-headline">{link.lastSyncAt ? ago(link.lastSyncAt, now) : 'Never'}</p><p className="t-caption truncate text-ink-3">{link.copy.label}</p></div>
      </div>
    </Link>
  );
}

/** Where each system sits on the anatomy preview image (percent of the image box). */
const HOTSPOT: Record<SystemId, { x: number; y: number }> = {
  neuro: { x: 49.7, y: 15.3 },
  respiratory: { x: 45.5, y: 29.5 },
  cardiovascular: { x: 52, y: 33 },
  immune: { x: 54.5, y: 37.5 },
  metabolic: { x: 48.5, y: 44 },
  musculoskeletal: { x: 46, y: 67.5 },
};
const STATUS_GLYPH: Record<SystemStatus, string> = { normal: '✓', attention: '!', high: '!!', unknown: '?' };

function BodyToday({ systems, counts }: { systems: { s: BodySystem; status: SystemStatus; findings: { title: string }[] }[]; counts: Record<SystemStatus, number> }) {
  return (
    <section className="twin-stage relative grid overflow-hidden rounded-[30px] md:grid-cols-[minmax(260px,0.9fr)_1.1fr]" aria-label="Your body today">
      <Link href="/twin" className="group relative flex h-[440px] justify-center md:h-[540px]" aria-label="Open the digital twin">
        {/* box keeps the render's aspect ratio so hotspots stay on their organs */}
        <span className="relative h-full aspect-[935/1142] transition-transform duration-700 group-hover:scale-[1.02]">
        <Image src="/images/twin/body-preview.png" alt="Realistic anatomical model of the human body: skeleton, organs and blood vessels inside translucent skin" fill sizes="(min-width: 768px) 40vw, 100vw" className="object-contain" />
        {systems.map(({ s, status }) => (
          <span key={s.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${HOTSPOT[s.id].x}%`, top: `${HOTSPOT[s.id].y}%` }} aria-hidden>
            <span className="absolute inset-0 animate-ping rounded-full opacity-40 motion-reduce:animate-none" style={{ background: STATUS_COPY[status].color }} />
            <span className="relative flex size-5 items-center justify-center rounded-full text-[9px] font-bold text-[#05080D] ring-2 ring-[#05080D]/60" style={{ background: STATUS_COPY[status].color }}>{STATUS_GLYPH[status]}</span>
          </span>
        ))}
        </span>
      </Link>
      <div className="flex flex-col justify-center gap-4 p-5 sm:p-7">
        <div>
          <p className="t-overline text-accent">Your body today</p>
          <h2 className="t-title1">{counts.high ? 'Something needs medical review' : counts.attention ? 'A few things to watch' : counts.normal ? 'Systems look usual for you' : 'Waiting for readings'}</h2>
        </div>
        <ul className="grid gap-1 sm:grid-cols-2">
          {systems.map(({ s, status, findings }) => (
            <li key={s.id}>
              <Link href="/twin" className="flex items-center gap-3 rounded-[16px] px-2 py-2 hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]" aria-label={`${s.name}: ${STATUS_COPY[status].label}`}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-[#05080D]" style={{ background: STATUS_COPY[status].color }} aria-hidden>{STATUS_GLYPH[status]}</span>
                <span className="min-w-0">
                  <span className="t-callout block font-medium">{s.name}</span>
                  <span className="t-caption block truncate text-ink-3">{findings[0]?.title ?? STATUS_COPY[status].label}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/twin" className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-pill px-5 text-sm font-medium text-on-pill">Explore your digital twin <ArrowRight size={16} /></Link>
      </div>
    </section>
  );
}

const DOORS = [
  { href: '/twin', title: 'My Health', line: 'Your body lab, Sentinel and health story', image: '/images/nasa/cupola.jpg', tint: '#62D2E6' },
  { href: '/sentinel', title: 'Sentinel', line: 'Your AI health companion', image: '/images/nasa/aurora.jpg', tint: '#A99BFF' },
  { href: '/simulator', title: 'Explore', line: 'Expeditions into space hazards', image: '/images/nasa/solar-flare.jpg', tint: '#F2B84B' },
  { href: '/missions', title: 'My Rewards', line: 'Missions, insignia and rank', image: '/images/nasa/iss-orbit.jpg', tint: '#3FD38E' },
];

function JourneyStrip() {
  return (
    <section aria-label="Where to next" className="flex flex-col gap-3">
      <h2 className="t-title2 px-1">Where to next, Explorer?</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {DOORS.map((d) => (
          <Link key={d.href} href={d.href} className="group relative h-44 overflow-hidden rounded-[26px] text-white sm:h-56">
            <Image src={d.image} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#05080D] via-[#05080D]/30 to-transparent" />
            <span className="absolute inset-x-0 top-0 h-1 opacity-80" style={{ background: d.tint }} />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
              <div>
                <p className="t-title3">{d.title}</p>
                <p className="t-caption text-white/75">{d.line}</p>
              </div>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur transition-transform group-hover:translate-x-0.5"><ArrowRight size={16} /></span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Nova's mission line: one contextual next step, chosen from real state (never from "good" numbers). */
function NovaBriefing({ now }: { now: number }) {
  const alerts = useHealth((s) => s.alerts);
  const sleep = useHealth((s) => s.sleepRecords);
  const events = useProgress((s) => s.events);
  const profileName = useHealth((s) => s.profile.name.split(' ')[0]);
  const callsign = useSettings((s) => s.callsign);
  const name = callsign || profileName;
  const urgent = alerts.find((a) => (a.state === 'active' || a.state === 'escalated') && (a.severity === 'high' || a.severity === 'critical'));
  const health = DAILY.find((o) => o.id === 'd-health')!;
  const nights = [...sleep].filter((r) => now - new Date(r.night).getTime() < 8 * 86_400_000).sort((a, b) => a.night.localeCompare(b.night));
  const last = nights[nights.length - 1];
  const prior = nights.slice(0, -1);
  const avg = prior.length >= 3 ? prior.reduce((a, r) => a + r.hours, 0) / prior.length : undefined;
  const nextObj = DAILY.find((o) => !dailyProgress(o, events, now).complete);

  let line: string;
  let pose: Pose = 'wave';
  let action: { label: string; href: string } | undefined;
  if (urgent) {
    line = `Something needs attention: ${urgent.title.toLowerCase()}${urgent.simulated ? ' (synthetic demo data)' : ''}. Let’s look at it together.`;
    pose = 'point';
    action = { label: 'See what changed', href: `/sentinel?finding=${encodeURIComponent(urgent.insightId)}` };
  } else if (!dailyProgress(health, events, now).complete) {
    line = `Welcome back, ${name}! Let’s check how your body is doing today.`;
    action = { label: 'Start today’s health check', href: health.href };
  } else if (last && avg !== undefined && last.hours < avg - 1) {
    line = `Your sleep was shorter than usual (${last.hours.toFixed(1)} h vs ${avg.toFixed(1)} h). Let’s take a closer look.`;
    pose = 'think';
    action = { label: 'Open sleep report', href: '/sleep' };
  } else if (nextObj) {
    line = `Nice work! Next objective: ${nextObj.title.toLowerCase()}.`;
    pose = 'point';
    action = { label: nextObj.action, href: nextObj.href };
  } else {
    line = 'Great work! You completed today’s health mission. 🚀';
    pose = 'celebrate';
    action = { label: 'See your rewards', href: '/missions' };
  }
  return (
    <section aria-label="Nova, your guide" data-tour="hub-nova" className="-mb-4 -ml-2">
      <Guide say={line} pose={pose} size={104} tone="dark">
        {action && <Link href={action.href} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-semibold text-[#05080D] shadow-[0_0_30px_rgba(124,200,242,0.35)] transition-transform hover:scale-[1.03]">{action.label} <ArrowRight size={16} /></Link>}
      </Guide>
    </section>
  );
}

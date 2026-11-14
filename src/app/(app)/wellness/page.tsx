'use client';

import { Brain, Lock, MessageSquareHeart, Plus, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { toast } from '@/components/toast';
import { Badge, Button, ButtonLink, Card, EmptyState, Field, IconButton, Input, Notice, Overline, PageHeader, ScalePicker, Section, Stat, Textarea } from '@/components/ui';
import { CONFERENCE_REQUEST } from '@/features/medical/lib';
import { stamp } from '@/features/health/vitals';
import { award } from '@/game/progress';
import { useNow } from '@/hooks/use-now';
import { CONFINEMENT_ITEMS } from '@/intel/checkins';
import { HAZARD_STATUS_COPY } from '@/intel/hazard-profile';
import { useHazards } from '@/store/engine-runner';
import { useHealth } from '@/store/health';

export default function WellnessPage() {
  const now = useNow(60_000);
  const moods = useHealth((s) => s.moods);
  const checkins = useHealth((s) => s.checkins);
  const journal = useHealth((s) => s.journal);
  const addCheckin = useHealth((s) => s.addCheckin);
  const delMood = useHealth((s) => s.deleteMood);
  const addJournal = useHealth((s) => s.addJournal);
  const delJournal = useHealth((s) => s.deleteJournal);
  const sendMsg = useHealth((s) => s.sendCrewMessage);
  const iso = useHazards().find((h) => h.hazard === 'isolation')!;
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [jTitle, setJTitle] = useState('');
  const [jBody, setJBody] = useState('');

  const sorted = useMemo(() => [...moods].sort((a, b) => a.at.localeCompare(b.at)), [moods]);
  const data = sorted.slice(-40).map((m) => ({ t: new Date(m.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), Mood: m.mood, Energy: m.energy, Stress: m.stress }));
  const week = sorted.filter((m) => new Date(m.at).getTime() > now - 7 * 86_400_000);
  const avg = (k: 'mood' | 'energy' | 'stress') => (week.length ? (week.reduce((a, m) => a + m[k], 0) / week.length).toFixed(1) : '—');
  const lastCheck = [...checkins].sort((a, b) => b.at.localeCompare(a.at))[0];
  const c = HAZARD_STATUS_COPY[iso.status];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader overline="Monitoring" title="Mental wellness" subtitle="Mood, stress and psychological wellbeing check-ins, with confinement-related self-assessment. Private by default." actions={<ButtonLink href="/record?tab=mood" icon={Plus} size="sm">Mood check-in</ButtonLink>} />
      <Notice icon={Lock} title="Private to this device">Never synced or sent to the cloud. Never a diagnosis.</Notice>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><Stat label="Mood (7 d)" value={avg('mood')} unit="/5" detail={`${week.length} check-ins`} /></Card>
        <Card><Stat label="Energy (7 d)" value={avg('energy')} unit="/5" /></Card>
        <Card><Stat label="Stress (7 d)" value={avg('stress')} unit="/5" detail="higher = more stressed" /></Card>
        <Card><Stat label="Confinement check-in" value={lastCheck ? lastCheck.score : '—'} unit={lastCheck ? '/100' : undefined} detail={lastCheck ? stamp(lastCheck.at) : 'not taken yet'} /></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="flex flex-col gap-2 xl:col-span-2">
          <Overline>Check-in trend</Overline>
          {data.length < 2 ? (
            <EmptyState icon={Brain} title="Not enough check-ins yet" body="Two or more check-ins draw a trend. A 20-second check-in each day makes changes visible early." action={<ButtonLink href="/record?tab=mood" size="sm">Check in now</ButtonLink>} />
          ) : (
            <figure aria-label="Mood, energy and stress over time">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                  <XAxis dataKey="t" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 14, border: 'none', background: 'var(--surface)', boxShadow: 'var(--shadow-float)', fontSize: 12 }} />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                  <Line dataKey="Mood" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  <Line dataKey="Energy" stroke="var(--series-4)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  <Line dataKey="Stress" stroke="var(--series-2)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </figure>
          )}
        </Card>
        <Card className="flex flex-col gap-3">
          <Overline>Isolation & confinement</Overline>
          <Badge label={c.label} tone={c.tone} size="md" className="self-start" />
          <p className="t-callout text-ink-2">{iso.narrative}</p>
          {iso.signals.map((s) => <p key={s.id} className="t-caption"><span className="font-semibold">{s.label}:</span> <span className="text-ink-2">{s.detail}</span></p>)}
          <Link href="/risk/isolation" className="t-caption font-medium text-primary hover:underline">NASA evidence on isolation & confinement →</Link>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Confinement wellbeing check-in" description="Six prototype self-report items (1–5). Not a validated clinical instrument.">
          <Card>
            <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); if (CONFINEMENT_ITEMS.some((i) => !answers[i.id])) return toast('Answer all six items', 'warning'); const r = addCheckin(answers); award('confinement_checkin'); setAnswers({}); toast(`Check-in saved · ${r.score}/100`); }}>
              {CONFINEMENT_ITEMS.map((i) => <ScalePicker key={i.id} name={i.id} label={i.label} low={i.low} high={i.high} value={answers[i.id]} onChange={(v) => setAnswers((a) => ({ ...a, [i.id]: v }))} />)}
              <Button type="submit" icon={Users}>Save check-in</Button>
            </form>
            {checkins.length > 0 && (
              <div className="mt-5 flex flex-col gap-1">
                <Overline>History</Overline>
                {[...checkins].reverse().slice(0, 8).map((x) => <p key={x.id} className="t-caption flex justify-between text-ink-2"><span>{stamp(x.at)}{x.lowest ? ` · lowest: ${x.lowest}` : ''}</span><span className="font-semibold tabular">{x.score}/100</span></p>)}
              </div>
            )}
          </Card>
        </Section>
        <div className="flex flex-col gap-6">
          <Section title="Support">
            <Card className="flex flex-col gap-3">
              <p className="t-callout text-ink-2">Talking early helps — ask for a private call with the flight psychologist.</p>
              <Button variant="secondary" icon={MessageSquareHeart} onClick={() => { sendMsg(CONFERENCE_REQUEST, 'Flight psychologist (demo)'); toast('Request queued for the next communication pass'); }}>Request private conference</Button>
              <p className="t-caption text-ink-3">If you feel unsafe or have thoughts of self-harm, use <Link href="/emergency" className="font-semibold text-critical">Emergency</Link> and tell the crew medical officer now.</p>
            </Card>
          </Section>
          <Section title="Private journal">
            <Card className="flex flex-col gap-3">
              <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (!jBody.trim()) return; addJournal({ title: jTitle.trim() || 'Untitled', body: jBody.trim(), shareWithSummaries: false }); setJTitle(''); setJBody(''); toast('Journal entry saved'); }}>
                <Field label="Title" htmlFor="jt"><Input id="jt" value={jTitle} onChange={(e) => setJTitle(e.target.value)} maxLength={80} /></Field>
                <Field label="Entry" htmlFor="jb"><Textarea id="jb" rows={3} value={jBody} onChange={(e) => setJBody(e.target.value)} maxLength={4000} /></Field>
                <Button type="submit" size="sm" className="self-start" disabled={!jBody.trim()}>Save entry</Button>
              </form>
              {journal.slice(0, 5).map((j) => (
                <div key={j.id} className="flex items-start gap-2 rounded-[14px] bg-sunken p-3">
                  <div className="min-w-0 flex-1"><p className="t-callout font-medium">{j.title}</p><p className="t-caption line-clamp-2 text-ink-2">{j.body}</p><p className="t-telemetry text-ink-3">{stamp(j.at)}</p></div>
                  <IconButton icon={Trash2} label="Delete entry" onClick={() => { if (confirm('Delete this journal entry?')) delJournal(j.id); }} />
                </div>
              ))}
            </Card>
          </Section>
        </div>
      </div>

      {sorted.length > 0 && (
        <Section title="Recent check-ins">
          <Card className="py-2">
            {[...sorted].reverse().slice(0, 10).map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-[14px] px-2 py-2">
                <span className="t-callout flex-1">{stamp(m.at)} · mood {m.mood} · energy {m.energy} · stress {m.stress}{m.tags.length ? ` · ${m.tags.join(', ')}` : ''}</span>
                <IconButton icon={Trash2} label="Delete check-in" onClick={() => delMood(m.id)} />
              </div>
            ))}
          </Card>
        </Section>
      )}
    </div>
  );
}

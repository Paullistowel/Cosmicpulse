'use client';

import { CheckCircle2, Send, Siren } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Badge, Button, Card, Field, Notice, Overline, Textarea, cn } from '@/components/ui';
import { VITAL_META } from '@/data/vitals';
import { EMERGENCY_KINDS, MARK, SEVERITY_OPTIONS, emergencyIncident, emergencySchema, hasMark, kindMeta, type EmergencyKind } from '@/features/emergency/lib';
import { FLIGHT_SURGEON, linkedProtocols, priorityMessageBody, vitalsSnapshot } from '@/features/medical/lib';
import { useHealth } from '@/store/health';

/**
 * Emergency assistance (mobile src/app/emergency.tsx). No decorative motion,
 * large targets, high contrast. Works fully offline: the incident and the
 * priority message are stored on board and queue for ground.
 */
export default function EmergencyPage() {
  const profile = useHealth((s) => s.profile);
  const crew = useHealth((s) => s.crew);
  const astronautId = useHealth((s) => s.astronautId);
  const ms = useHealth((s) => s.measurements);
  const report = useHealth((s) => s.reportIncident);
  const addEntry = useHealth((s) => s.addIncidentEntry);
  const send = useHealth((s) => s.sendCrewMessage);
  const [kind, setKind] = useState<EmergencyKind>();
  const [severity, setSeverity] = useState<'serious' | 'critical'>('critical');
  const [desc, setDesc] = useState('');
  const [err, setErr] = useState<string>();
  const [incId, setIncId] = useState<string>();
  const inc = useHealth((s) => s.incidents.find((i) => i.id === incId));
  const vitals = vitalsSnapshot(ms);
  const me = crew.find((c) => c.id === astronautId);

  const submit = () => {
    const parsed = emergencySchema.safeParse({ kind, severity, description: desc });
    if (!parsed.success) return setErr(parsed.error.issues[0].message);
    setErr(undefined);
    const created = report(emergencyIncident(parsed.data, profile.name, vitals));
    addEntry(created.id, MARK.activated, profile.name);
    setIncId(created.id);
    window.scrollTo({ top: 0 });
  };

  if (inc) {
    const protocols = linkedProtocols(inc.protocolIds);
    const ack = hasMark(inc, MARK.acknowledged);
    const pri = hasMark(inc, MARK.priorityQueued);
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div className="rounded-[24px] bg-critical p-5 text-white">
          <p className="t-overline text-white/80">Emergency active</p>
          <h1 className="t-title1">{inc.title}</h1>
          <p className="t-callout text-white/90">Incident recorded on board {new Date(inc.openedAt).toLocaleTimeString()}. Alert the crew now.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button size="lg" variant={ack ? 'secondary' : 'primary'} icon={CheckCircle2} disabled={ack} onClick={() => addEntry(inc.id, MARK.acknowledged, profile.name)}>{ack ? 'CMO acknowledged' : 'Crew medical officer acknowledges'}</Button>
          <Button size="lg" variant={pri ? 'secondary' : 'critical'} icon={Send} disabled={pri} onClick={() => { send(priorityMessageBody({ callsign: me?.callsign, name: profile.name, vitals: inc.vitalsSnapshot, incidentId: inc.id }), FLIGHT_SURGEON, inc.id); addEntry(inc.id, MARK.priorityQueued, profile.name); }}>{pri ? 'Priority message queued' : 'Priority message to flight surgeon'}</Button>
        </div>
        {protocols.map((p) => (
          <Card key={p.id} className="flex flex-col gap-2">
            <p className="t-title3">{p.id} v{p.version} · {p.title}</p>
            <ol className="t-body list-decimal space-y-2 pl-6">{p.steps.map((s, i) => <li key={i}>{s.text}{s.caution && <span className="t-callout block font-semibold text-critical">{s.caution}</span>}</li>)}</ol>
            <p className="t-callout"><span className="font-semibold">Escalation: </span>{p.escalation}</p>
            <p className="t-caption text-ink-3">Demonstration knowledge base — not flight-approved. Follow your mission’s approved procedures.</p>
          </Card>
        ))}
        <Card className="flex flex-col gap-2">
          <Overline>Vitals captured</Overline>
          {inc.vitalsSnapshot.length ? inc.vitalsSnapshot.map((v) => <p key={v.type} className="t-headline">{VITAL_META[v.type].label}: {v.value} <span className="t-caption text-ink-3">{new Date(v.at).toLocaleString()}</span></p>) : <p className="t-callout">No recent vitals on board.</p>}
        </Card>
        <Link href={`/medical?incident=${inc.id}`} className="t-callout font-medium text-primary hover:underline">Open incident timeline →</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-critical text-white"><Siren size={24} /></span>
        <div><h1 className="t-title1">Emergency assistance</h1><p className="t-callout text-ink-2">Logs an incident with your vitals and shows first-response steps. It does not call mission control.</p></div>
      </div>
      <Notice tone="critical" title="Alert your crew first">Call out to your crew and medical officer now.</Notice>
      <fieldset>
        <legend className="t-headline mb-2">What is happening?</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {EMERGENCY_KINDS.map((k) => (
            <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)} className={cn('flex min-h-24 flex-col items-start justify-between gap-2 rounded-[20px] border-2 p-4 text-left', kind === k.id ? 'border-critical bg-critical-soft' : 'border-line-strong bg-surface')}>
              <k.icon size={22} className={kind === k.id ? 'text-critical' : 'text-ink-2'} />
              <span className="t-headline">{k.label}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="t-headline mb-2">Severity</legend>
        <div className="grid grid-cols-2 gap-3">
          {SEVERITY_OPTIONS.map((o) => <button key={o.value} type="button" aria-pressed={severity === o.value} onClick={() => setSeverity(o.value)} className={cn('h-14 rounded-[18px] border-2 text-base font-semibold', severity === o.value ? 'border-critical bg-critical text-white' : 'border-line-strong')}>{o.label}</button>)}
        </div>
      </fieldset>
      <Field label="Description" htmlFor="ed" error={err}><Textarea id="ed" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Symptoms, when it started, what has been done" /></Field>
      <Card className="flex flex-wrap gap-2">
        <Overline className="w-full">Vitals that will be attached</Overline>
        {vitals.length ? vitals.map((v) => <Badge key={v.type} label={`${VITAL_META[v.type].shortLabel} ${v.value}`} size="md" />) : <p className="t-callout text-ink-3">No recent vitals.</p>}
      </Card>
      {kind && <p className="t-callout text-ink-2">Guidance: {linkedProtocols(kindMeta(kind).protocolIds).map((p) => `${p.id} ${p.title}`).join(' · ')}</p>}
      <Button size="lg" variant="critical" icon={Siren} onClick={submit}>Record emergency</Button>
    </div>
  );
}

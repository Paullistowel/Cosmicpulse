'use client';

import { CheckSquare, ClipboardList, FileText, MessageSquare, Pill, Send, Siren, Square } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';

import { Sheet } from '@/components/sheet';
import { toast } from '@/components/toast';
import { Badge, Button, ButtonLink, Card, EmptyState, Field, Input, Notice, Overline, PageHeader, Segmented, Select, SourceBadge, Textarea, cn } from '@/components/ui';
import type { Incident, IncidentStatus } from '@/data/types';
import { AUTH_OPTIONS, CATEGORY_LABEL, DELIVERY_LABEL, FLIGHT_SURGEON, SEVERITY_LABEL, STATUS_FLOW, STATUS_LABEL, authorisedByText, commTiming, completedSteps, earliestReplyAt, inventorySummary, linkedProtocols, sortIncidents, sortThread, stepDoneText, stepUndoneText, stockStatus, type AuthKind } from '@/features/medical/lib';
import { ago, stamp } from '@/features/health/vitals';
import { useNow } from '@/hooks/use-now';
import { PROTOCOLS } from '@/engine';
import { useHealth } from '@/store/health';

type Tab = 'incidents' | 'medications' | 'inventory' | 'comms' | 'records';

function IncidentSheet({ inc, onClose }: { inc: Incident; onClose: () => void }) {
  const me = useHealth((s) => s.profile.name);
  const addEntry = useHealth((s) => s.addIncidentEntry);
  const setStatus = useHealth((s) => s.setIncidentStatus);
  const live = useHealth((s) => s.incidents.find((x) => x.id === inc.id)) ?? inc;
  const [note, setNote] = useState('');
  const protocols = linkedProtocols(live.protocolIds);
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()} title={live.title} description={`${CATEGORY_LABEL[live.category]} · ${SEVERITY_LABEL[live.severity]} · opened ${stamp(live.openedAt)}`} wide>
      <div className="flex flex-col gap-5">
        <p className="t-callout">{live.description}</p>
        {live.vitalsSnapshot.length > 0 && <div className="flex flex-wrap gap-1.5">{live.vitalsSnapshot.map((v) => <Badge key={v.type} label={`${v.type.replace('_', ' ')} ${v.value}`} />)}</div>}
        <Field label="Status" htmlFor="ist">
          <Segmented label="Incident status" value={live.status} onChange={(v: IncidentStatus) => { setStatus(live.id, v, me); toast(`Status → ${STATUS_LABEL[v]}`); }} options={STATUS_FLOW.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
        </Field>
        {protocols.map((p) => {
          const done = completedSteps(live.timeline, p);
          return (
            <div key={p.id} className="rounded-[18px] bg-sunken p-4">
              <p className="t-headline">{p.id} v{p.version} · {p.title}</p>
              <p className="t-caption mb-2 text-ink-3">Demonstration knowledge base — not flight-approved. Ticks are logged to the timeline.</p>
              <ol className="flex flex-col gap-1.5">
                {p.steps.map((s, i) => (
                  <li key={i}>
                    <button className="t-callout flex w-full items-start gap-2 text-left" onClick={() => addEntry(live.id, done.has(i) ? stepUndoneText(p, i) : stepDoneText(p, i), me)}>
                      {done.has(i) ? <CheckSquare size={17} className="mt-0.5 shrink-0 text-success" /> : <Square size={17} className="mt-0.5 shrink-0 text-ink-3" />}
                      <span className={done.has(i) ? 'text-ink-3 line-through' : ''}>{s.text}{s.caution && <span className="t-caption block text-warning-ink">{s.caution}</span>}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
        <div>
          <Overline className="mb-2">Timeline</Overline>
          <ol className="flex flex-col gap-2 border-l border-line pl-4">
            {live.timeline.map((e, i) => <li key={i} className="t-callout"><span className="t-telemetry text-ink-3">{stamp(e.at)} · {e.by}</span><br />{e.text}</li>)}
          </ol>
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; addEntry(live.id, note.trim(), me); setNote(''); }}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" aria-label="Add a note" maxLength={500} />
          <Button type="submit" size="md">Add</Button>
        </form>
      </div>
    </Sheet>
  );
}

function AdministerSheet({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const item = useHealth((s) => s.inventory.find((i) => i.id === itemId))!;
  const me = useHealth((s) => s.profile.name);
  const record = useHealth((s) => s.recordAdministration);
  const [qty, setQty] = useState('1');
  const [kind, setKind] = useState<AuthKind>('flight_surgeon');
  const [protocolId, setProtocolId] = useState(PROTOCOLS[0].id);
  const [other, setOther] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string>();
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()} title={`Record administration · ${item.name}`} description={`${item.strength} ${item.form} · ${item.quantity} in stock`}>
      <form className="flex flex-col gap-4" onSubmit={(e) => {
        e.preventDefault();
        const authorisedBy = authorisedByText(kind, { protocolId, other });
        if (!reason.trim()) return setErr('Record the reason.');
        const r = record({ itemId, quantity: Number(qty), authorisedBy, reason: reason.trim(), recordedBy: me });
        if (!r.ok) return setErr(r.error);
        toast('Administration recorded');
        onClose();
      }}>
        <Notice tone="warning">CosmicPulse never chooses or doses medication. Record only what an authorised person instructed.</Notice>
        <Field label="Quantity" htmlFor="q"><Input id="q" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <Field label="Authorised by" htmlFor="auth"><Select id="auth" value={kind} onChange={(e) => setKind(e.target.value as AuthKind)}>{AUTH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
        {kind === 'cmo_protocol' && <Field label="Protocol" htmlFor="pr"><Select id="pr" value={protocolId} onChange={(e) => setProtocolId(e.target.value)}>{PROTOCOLS.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.title}</option>)}</Select></Field>}
        {kind === 'other' && <Field label="Who authorised it" htmlFor="oth"><Input id="oth" value={other} onChange={(e) => setOther(e.target.value)} /></Field>}
        <Field label="Reason" htmlFor="rs" error={err}><Textarea id="rs" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <Button type="submit">Record</Button>
      </form>
    </Sheet>
  );
}

function MedicalInner() {
  const now = useNow(60_000);
  const sp = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>((sp.get('tab') as Tab) ?? 'incidents');
  const incidents = useHealth((s) => s.incidents);
  const medications = useHealth((s) => s.medications);
  const doseLogs = useHealth((s) => s.doseLogs);
  const logDose = useHealth((s) => s.logDose);
  const inventory = useHealth((s) => s.inventory);
  const administrations = useHealth((s) => s.administrations);
  const messages = useHealth((s) => s.messages);
  const records = useHealth((s) => s.records);
  const mission = useHealth((s) => s.mission);
  const send = useHealth((s) => s.sendCrewMessage);
  const [admin, setAdmin] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const openId = sp.get('incident');
  const openInc = incidents.find((i) => i.id === openId);
  const summary = inventorySummary(inventory, now);
  const today = useMemo(() => doseLogs.filter((d) => new Date(d.scheduledFor).toDateString() === new Date(now).toDateString()), [doseLogs, now]);
  const timing = commTiming(mission);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader overline="Records" title="Medical" subtitle="Incidents, medication records, the medical kit, flight-surgeon communications and medical records." actions={<ButtonLink href="/emergency" variant="critical" icon={Siren} size="sm">Report emergency</ButtonLink>} />
      <Segmented label="Medical section" value={tab} onChange={setTab} options={[{ value: 'incidents', label: `Incidents (${incidents.filter((i) => i.status !== 'resolved').length})` }, { value: 'medications', label: 'Medications' }, { value: 'inventory', label: 'Medical kit' }, { value: 'comms', label: 'Comms' }, { value: 'records', label: 'Records' }]} />

      {tab === 'incidents' && (
        <Card className="py-2">
          {incidents.length === 0 && <EmptyState icon={ClipboardList} title="No incidents" body="Symptoms logged under Record data and emergency reports appear here." />}
          {sortIncidents(incidents).map((i) => (
            <button key={i.id} onClick={() => router.replace(`/medical?incident=${i.id}`)} className="flex w-full flex-wrap items-center gap-3 rounded-[14px] px-2 py-3 text-left hover:bg-sunken">
              <span className={cn('size-2.5 rounded-full', i.severity === 'critical' || i.severity === 'serious' ? 'bg-critical' : i.severity === 'moderate' ? 'bg-warning' : 'bg-info')} />
              <span className="min-w-0 flex-1"><span className="t-callout block font-medium">{i.title}</span><span className="t-caption text-ink-3">{CATEGORY_LABEL[i.category]} · opened {ago(i.openedAt, now)} by {i.reportedBy}</span></span>
              <Badge label={SEVERITY_LABEL[i.severity]} tone={i.severity === 'critical' || i.severity === 'serious' ? 'critical' : i.severity === 'moderate' ? 'warning' : 'info'} />
              <Badge label={STATUS_LABEL[i.status]} tone={i.status === 'resolved' ? 'success' : 'neutral'} />
            </button>
          ))}
        </Card>
      )}

      {tab === 'medications' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="flex flex-col gap-2">
            <Overline>Active medication records</Overline>
            {medications.filter((m) => m.active).map((m) => (
              <div key={m.id} className="flex items-start gap-3 rounded-[14px] bg-sunken p-3">
                <Pill size={16} className="mt-0.5 text-ink-2" />
                <div className="min-w-0 flex-1"><p className="t-callout font-medium">{m.name} {m.strength}</p><p className="t-caption text-ink-2">{m.instructions}{m.prescriber ? ` · ${m.prescriber}` : ''}</p></div>
                <SourceBadge source={m.source} />
              </div>
            ))}
            {!medications.some((m) => m.active) && <p className="t-callout text-ink-3">No active medications.</p>}
            <p className="t-caption text-ink-3">Medication records are authorised by the flight surgeon. CosmicPulse never recommends or changes doses.</p>
          </Card>
          <Card className="flex flex-col gap-2">
            <Overline>Today’s doses</Overline>
            {today.length === 0 && <p className="t-callout text-ink-3">No scheduled doses today.</p>}
            {today.map((d) => {
              const m = medications.find((x) => x.id === d.medicationId);
              return (
                <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-[14px] px-1 py-2">
                  <span className="t-callout flex-1">{new Date(d.scheduledFor).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {m?.name ?? 'Medication'} {m?.strength}</span>
                  <Badge label={d.status} tone={d.status === 'taken' ? 'success' : d.status === 'pending' ? 'neutral' : 'warning'} />
                  {d.status !== 'taken' && <Button size="sm" onClick={() => { logDose(d.id, 'taken'); toast('Dose logged as taken'); }}>Taken</Button>}
                  {d.status === 'pending' && <Button size="sm" variant="ghost" onClick={() => logDose(d.id, 'skipped')}>Skip</Button>}
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {tab === 'inventory' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2"><Badge label={`${summary.total} items`} size="md" />{summary.low > 0 && <Badge label={`${summary.low} low`} tone="warning" size="md" />}{summary.expiring > 0 && <Badge label={`${summary.expiring} expiring`} tone="warning" size="md" />}{summary.expired > 0 && <Badge label={`${summary.expired} expired`} tone="critical" size="md" />}{summary.out > 0 && <Badge label={`${summary.out} out of stock`} tone="critical" size="md" />}</div>
          <Card className="overflow-x-auto p-0 sm:p-0">
            <table className="w-full min-w-[700px] text-left">
              <thead><tr className="t-overline border-b border-line text-ink-3">{['Item', 'Kit', 'Stock', 'Expires', 'Status', ''].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {inventory.map((i) => {
                  const st = stockStatus(i, now);
                  return (
                    <tr key={i.id} className="t-callout border-b border-line last:border-0">
                      <td className="px-4 py-2.5"><span className="font-medium">{i.name}</span><span className="t-caption block text-ink-3">{i.strength} {i.form} · lot {i.lot}</span></td>
                      <td className="px-4 py-2.5 text-ink-2">{i.kit}</td>
                      <td className="px-4 py-2.5 tabular">{i.quantity} <span className="text-ink-3">/ min {i.minimum}</span></td>
                      <td className="px-4 py-2.5 tabular">{i.expiresAt.slice(0, 10)}</td>
                      <td className="px-4 py-2.5"><Badge label={st.label} tone={st.level === 'critical' ? 'critical' : st.level === 'warning' ? 'warning' : 'success'} /></td>
                      <td className="px-4 py-2.5 text-right"><Button size="sm" variant="outline" disabled={i.quantity <= 0} onClick={() => setAdmin(i.id)}>Record use</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <Card className="flex flex-col gap-1">
            <Overline>Administration log</Overline>
            {administrations.slice(0, 10).map((a) => <p key={a.id} className="t-caption text-ink-2">{stamp(a.at)} · {inventory.find((i) => i.id === a.itemId)?.name ?? a.itemId} ×{a.quantity} · authorised by {a.authorisedBy} · {a.reason}</p>)}
            {!administrations.length && <p className="t-callout text-ink-3">No administrations recorded.</p>}
          </Card>
        </div>
      )}

      {tab === 'comms' && (
        <Card className="flex flex-col gap-3">
          <Notice title={`One-way delay ${timing.oneWay}`}>{timing.roundTrip ? `Round trip about ${timing.roundTrip}. ` : ''}Messages are queued on board and delivered when the ground link allows.</Notice>
          <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
            {sortThread(messages).map((m) => (
              <div key={m.id} className={cn('max-w-[85%] rounded-[18px] px-4 py-2.5', m.direction === 'outbound' ? 'self-end bg-pill text-on-pill' : 'self-start bg-sunken')}>
                <p className="t-callout">{m.body}</p>
                <p className={cn('t-telemetry mt-1', m.direction === 'outbound' ? 'text-on-pill/70' : 'text-ink-3')}>{m.direction === 'outbound' ? `to ${m.to}` : `from ${m.from}`} · {stamp(m.at)} · {DELIVERY_LABEL[m.delivery]}{m.direction === 'outbound' ? ` · reply ≥ ${new Date(earliestReplyAt(m.at, mission)).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
              </div>
            ))}
            {!messages.length && <p className="t-callout text-ink-3">No messages yet.</p>}
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!msg.trim()) return; send(msg.trim(), FLIGHT_SURGEON); setMsg(''); toast('Message queued'); }}>
            <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message the flight surgeon" aria-label="Message the flight surgeon" maxLength={1000} />
            <Button type="submit" icon={Send}>Send</Button>
          </form>
        </Card>
      )}

      {tab === 'records' && (
        <Card className="py-2">
          {records.map((r) => (
            <div key={r.id} className="flex flex-wrap items-start gap-3 rounded-[14px] px-2 py-3">
              <FileText size={16} className="mt-0.5 text-ink-3" />
              <div className="min-w-0 flex-1"><p className="t-callout font-medium">{r.title}</p><p className="t-caption text-ink-2">{r.summary}</p><p className="t-telemetry text-ink-3">{r.category.replace('_', ' ')} · {r.date.slice(0, 10)}{r.provider ? ` · ${r.provider}` : ''}</p></div>
              <SourceBadge source={r.source} />
            </div>
          ))}
          {!records.length && <EmptyState icon={MessageSquare} title="No records" />}
        </Card>
      )}
      {openInc && <IncidentSheet inc={openInc} onClose={() => router.replace('/medical')} />}
      {admin && <AdministerSheet itemId={admin} onClose={() => setAdmin(null)} />}
      <p className="t-caption text-ink-3">Fictional demo crew and records. <Link href="/reports" className="text-primary hover:underline">Generate an emergency medical summary →</Link></p>
    </div>
  );
}

export default function MedicalPage() {
  return <Suspense><MedicalInner /></Suspense>;
}

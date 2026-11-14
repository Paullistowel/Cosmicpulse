'use client';

import { Bluetooth, CloudOff, Database, Download, FlaskConical, LogIn, LogOut, Pencil, Play, RadioTower, RefreshCw, Rocket, Smartphone, Trash2, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useClientValue } from '@/hooks/use-client-value';

import { useLinkSummary } from '@/components/shell/app-shell';
import { useTour } from '@/components/tour';
import { toast } from '@/components/toast';
import { Badge, Button, Card, Field, Input, LearnMore, LivePulse, Notice, Overline, PageHeader, Section, Segmented, Select, Toggle } from '@/components/ui';
import { DEMO_CONDITIONS, type DemoConditionId } from '@/data/demo/conditions';
import { SCENARIOS, type ScenarioId } from '@/data/demo/scenarios';
import { DEFAULT_THRESHOLDS, type Thresholds } from '@/data/vitals';
import { ago } from '@/features/health/vitals';
import { useNow } from '@/hooks/use-now';
import { checkGround, useConnectivity } from '@/services/connectivity';
import { STATE_COPY, metricList, useDataSource } from '@/services/data-source';
import { pullGroundVitals, useDeviceLink } from '@/services/device-data';
import { useSession } from '@/services/session';
import { discardFailed, retryFailed, syncNow, useSync } from '@/services/sync';
import { connectBluetooth, disconnectBluetooth, useBle, webBluetoothSupported } from '@/services/web-bluetooth';
import { useActivity } from '@/store/activity';
import { runEngineOnce } from '@/store/engine-runner';
import { useHealth } from '@/store/health';
import { useSettings } from '@/store/settings';
import { eraseVault, vaultStatus } from '@/store/vault';

function GroundCard() {
  const now = useNow(30_000);
  const conn = useConnectivity();
  const user = useSession((s) => s.user);
  const signIn = useSession((s) => s.signIn);
  const signOut = useSession((s) => s.signOut);
  const dev = useDeviceLink();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [totp, setTotp] = useState('');
  const [mfa, setMfa] = useState(false);
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-success-soft text-success"><Smartphone size={18} /></span>
        <div className="flex-1">
          <h3 className="t-title3">1 · Live device data</h3>
          <p className="t-callout text-ink-2">Apple Watch → iPhone Health app → CosmicPulse iPhone app → ground server → this browser.</p>
        </div>
      </div>
      <LearnMore title="Why not connect Apple Health directly?">Web browsers cannot access Apple HealthKit or pair with an Apple Watch. The native CosmicPulse iPhone app reads HealthKit with your permission and syncs authorised readings to the CosmicPulse ground server; this web app shows them with their original device, measurement time and sync time.</LearnMore>
      <div className="flex flex-wrap items-center gap-2">
        <Badge label={conn.configured ? (conn.ground ? `Ground server reachable${conn.groundVersion ? ` · v${conn.groundVersion}` : ''}` : 'Ground server unreachable') : 'No ground server configured'} tone={conn.configured ? (conn.ground ? 'success' : 'warning') : 'neutral'} icon={RadioTower} size="md" />
        <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => void checkGround()}>Check</Button>
      </div>
      {!conn.configured && <p className="t-caption text-ink-3">Set <code>GROUND_API_URL</code> on the web server (see README) to enable sign-in and phone sync. Everything else works standalone.</p>}
      {conn.configured && !user && (
        <form className="flex flex-col gap-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const r = await signIn(email, pw, totp); setBusy(false); if (r.ok) { toast('Signed in to ground'); void pullGroundVitals().catch(() => {}); } else { setErr(r.error); setMfa(!!r.mfa); } }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email" htmlFor="em"><Input id="em" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
            <Field label="Password" htmlFor="pw"><Input id="pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></Field>
          </div>
          {mfa && <Field label="Authenticator code" htmlFor="totp"><Input id="totp" inputMode="numeric" maxLength={6} value={totp} onChange={(e) => setTotp(e.target.value)} /></Field>}
          {err && <p role="alert" className="t-caption text-critical">{err}</p>}
          <Button type="submit" icon={LogIn} loading={busy} disabled={!conn.ground}>Sign in</Button>
          <p className="t-caption text-ink-3">🔒 Tokens never touch page scripts.</p>
        </form>
      )}
      {user && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge label={`Signed in · ${user.name}`} tone="success" size="md" />
            <Badge label={user.role.replace('_', ' ')} size="md" />
            <Button size="sm" variant="ghost" icon={LogOut} onClick={() => { void signOut(); toast('Signed out'); }}>Sign out</Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Overline>Last pull</Overline><p className="t-headline">{dev.lastPullAt ? ago(dev.lastPullAt, now) : 'Never'}</p><p className="t-caption text-ink-3">{dev.lastPullCount ?? 0} new readings</p></div>
            <div><Overline>Sources seen</Overline><p className="t-callout">{dev.sources.join(', ') || 'None yet'}</p></div>
          </div>
          {dev.lastError && <p className="t-caption text-warning-ink">{dev.lastError}</p>}
          <Button size="sm" variant="secondary" icon={RefreshCw} loading={dev.pulling} onClick={async () => { try { const n = await pullGroundVitals({ days: 90 }); toast(`${n} new readings from ground`); } catch (e) { toast((e as Error).message, 'warning'); } }} className="self-start">Pull device data now</Button>
        </div>
      )}
    </Card>
  );
}

function BluetoothCard() {
  const ble = useBle();
  const supported = useClientValue(webBluetoothSupported, false);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-info-soft text-info"><Bluetooth size={18} /></span>
        <div className="flex-1"><h3 className="t-headline">Bluetooth medical sensor (Web Bluetooth)</h3><p className="t-callout text-ink-2">❤️ 🩺 🫁 🌡️ ⚖️ Straps, cuffs, oximeters, thermometers, scales.</p></div>
      </div>
      {!supported ? (
        <Notice tone="neutral" icon={CloudOff}>Not in this browser — use Chrome or Edge.</Notice>
      ) : ble.status === 'connected' ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2"><LivePulse live /><span className="t-headline">{ble.deviceName}</span><Badge label={ble.services.join(', ')} /></div>
          {ble.live && <p className="t-metric">{ble.live.text}</p>}
          <p className="t-caption text-ink-3">{ble.recorded} readings recorded with source “Live · {ble.deviceName}”. Heart rate is stored as a 1-minute mean.</p>
          <Button size="sm" variant="outline" onClick={disconnectBluetooth} className="self-start">Disconnect</Button>
        </div>
      ) : (
        <>
          {ble.error && <p className="t-caption text-critical">{ble.error}</p>}
          <Button size="sm" icon={Bluetooth} loading={ble.status === 'requesting'} onClick={() => connectBluetooth().then(() => toast('Sensor connected')).catch(() => {})} className="self-start">Connect a sensor</Button>
          <p className="t-caption text-ink-3">Apple Watch does not expose these profiles to browsers.</p>
        </>
      )}
    </Card>
  );
}

function ThresholdsCard() {
  const t = useSettings((s) => s.thresholds);
  const by = useSettings((s) => s.thresholdsSetBy);
  const set = useSettings((s) => s.set);
  const [draft, setDraft] = useState<Record<keyof Thresholds, string>>(() => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, String(v)])) as Record<keyof Thresholds, string>);
  const [name, setName] = useState(by ?? '');
  const LABELS: Record<keyof Thresholds, string> = { bpSystolicHigh: 'Systolic high (mmHg)', bpDiastolicHigh: 'Diastolic high (mmHg)', glucoseLow: 'Glucose low (mg/dL)', glucoseHigh: 'Glucose high (mg/dL)', hrLow: 'Resting HR low (bpm)', hrHigh: 'Resting HR high (bpm)', spo2Low: 'SpO₂ low (%)' };
  return (
    <Card className="flex flex-col gap-4">
      <Notice tone="warning">Prototype defaults — not flight-medicine limits. Clinician changes only.</Notice>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(LABELS) as (keyof Thresholds)[]).map((k) => <Field key={k} label={LABELS[k]} htmlFor={k}><Input id={k} inputMode="numeric" value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} /></Field>)}
        <Field label="Set by (clinician)" htmlFor="tby"><Input id="tby" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => { const next = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, Number(v)])) as Thresholds; if (Object.values(next).some((v) => !Number.isFinite(v) || v <= 0)) return toast('All thresholds must be positive numbers', 'warning'); if (!name.trim()) return toast('Record who set the thresholds', 'warning'); set('thresholds', next); set('thresholdsSetBy', name.trim()); toast('Thresholds saved'); }}>Save thresholds</Button>
        <Button size="sm" variant="ghost" onClick={() => { set('thresholds', DEFAULT_THRESHOLDS); set('thresholdsSetBy', undefined); setDraft(Object.fromEntries(Object.entries(DEFAULT_THRESHOLDS).map(([k, v]) => [k, String(v)])) as Record<keyof Thresholds, string>); setName(''); toast('Defaults restored'); }}>Restore defaults</Button>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const now = useNow(30_000);
  const st = useSettings();
  const ds = useDataSource();
  const link = useLinkSummary();
  const sync = useSync();
  const loadScenario = useHealth((s) => s.loadScenario);
  const reconcile = useHealth((s) => s.reconcileDemo);
  const wipe = useHealth((s) => s.wipe);
  const manualCount = useHealth((s) => s.measurements.filter((m) => m.source.kind === 'manual').length);
  const manualAct = useActivity((s) => s.manual.length);
  const [sw, setSw] = useState(() => (typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? 'checking…' : 'not supported'));
  const [notifAsked, setNotif] = useState<string | null>(null);
  const notifInitial = useClientValue(() => (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'), 'unsupported');
  const notif = notifAsked ?? notifInitial;
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration().then((r) => setSw(r?.active ? 'active — app shell and research cached for offline' : process.env.NODE_ENV === 'production' ? 'installing' : 'disabled in development'));
  }, []);
  const c = STATE_COPY[ds.state];
  const condition = DEMO_CONDITIONS.find((x) => x.id === st.demoCondition);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader overline="System" title="Settings & data sources" subtitle="Where your data comes from, how it syncs, and how CosmicPulse behaves offline." />

      <Section title="Data sources" id="sources" description="Three clearly separated sources. Real readings always take priority per metric; synthetic data never overwrites them.">
        <Card className="flex flex-wrap items-center gap-3">
          <Badge label={`Current mode: ${c.label}`} tone={c.tone} icon={ds.state === 'demo' || ds.state === 'mixed' ? FlaskConical : Database} size="md" />
          <p className="t-callout flex-1 text-ink-2">{c.detail} {ds.real.length > 0 && <>Real: {metricList(ds.real)}. </>}{ds.simulated.length > 0 && <>Synthetic: {metricList(ds.simulated)}.</>}</p>
          <p className="t-telemetry text-ink-3">{ds.breakdown.live} live · {ds.breakdown.synced} synced · {ds.breakdown.manual} manual · {ds.breakdown.synthetic} synthetic</p>
        </Card>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="flex flex-col gap-4">
            <GroundCard />
            <BluetoothCard />
          </div>
          <div className="flex flex-col gap-4">
            <Card className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-sunken text-ink-2"><Pencil size={18} /></span>
                <div className="flex-1"><h3 className="t-title3">2 · Manual input</h3><p className="t-callout text-ink-2">Validated entries with units and timestamps, stored as “Entered manually”.</p></div>
              </div>
              <p className="t-callout">{manualCount} manual vital readings · {manualAct} manual activity days</p>
              <Link href="/record" className="t-callout font-medium text-primary hover:underline">Record health data →</Link>
            </Card>
            <Card className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-demo-soft text-demo"><FlaskConical size={18} /></span>
                <div className="flex-1"><h3 className="t-title3">3 · Simulation (SYNTHETIC / DEMO)</h3><p className="t-callout text-ink-2">Fictional demo telemetry — always labelled.</p></div>
              </div>
              <Toggle id="sim" checked={st.demoFallback} onChange={(v) => { st.set('demoFallback', v); reconcile({ regenerate: v }); runEngineOnce(); toast(v ? 'Simulation on — synthetic data fills metrics without real readings' : 'Simulation off — only real data is shown'); }} label="Use simulated telemetry" description="Fills only the metrics that have no real readings." />
              <Field label="Mission scenario" htmlFor="scn">
                <Select id="scn" value={st.scenario} onChange={(e) => { const id = e.target.value as ScenarioId; st.set('scenario', id); loadScenario(id); runEngineOnce(); toast('Scenario loaded'); }}>
                  {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </Select>
              </Field>
              <p className="t-caption -mt-2 text-ink-3">{SCENARIOS.find((s) => s.id === st.scenario)?.description}</p>
              <Field label="Health condition to simulate" htmlFor="cnd" hint={condition ? `${condition.description} Expected: ${condition.expected}. The detection engine is not told — it must find it.` : undefined}>
                <Select id="cnd" value={st.demoCondition} disabled={!st.demoFallback} onChange={(e) => { st.set('demoCondition', e.target.value as DemoConditionId); reconcile({ regenerate: true }); runEngineOnce(); toast('Simulated condition applied'); }}>
                  {DEMO_CONDITIONS.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                </Select>
              </Field>
              <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => { reconcile({ regenerate: true }); runEngineOnce(); toast('Synthetic data regenerated'); }} className="self-start" disabled={!st.demoFallback}>Regenerate synthetic data</Button>
            </Card>
          </div>
        </div>
      </Section>

      <Section title="Link & sync" id="link" description="Offline-first: everything works without a link; changes queue and sync later.">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="flex flex-col gap-3">
            <div className="flex items-center gap-2"><Badge label={link.copy.label} tone={link.state === 'online' ? 'success' : link.state === 'not_configured' ? 'neutral' : 'warning'} icon={link.state === 'online' ? RadioTower : WifiOff} size="md" /></div>
            <p className="t-callout text-ink-2">{link.copy.detail}</p>
            <Toggle id="los" checked={link.conn.simulateLos} onChange={(v) => { link.conn.setSimulateLos(v); toast(v ? 'Loss of signal simulated — all network calls blocked' : 'Link restored'); }} label="Simulate loss of signal" description="Blocks every ground, assistant and OSDR request from this tab to demonstrate offline operation." />
          </Card>
          <Card className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3">
              <div><Overline>Queued</Overline><p className="t-metric">{sync.queue.length}</p></div>
              <div><Overline>Failed</Overline><p className="t-metric">{sync.failed.length}</p></div>
              <div><Overline>Last sync</Overline><p className="t-headline">{sync.lastSyncAt ? ago(sync.lastSyncAt, now) : 'Never'}</p></div>
            </div>
            <p className="t-caption text-ink-3">Status: {sync.status}{sync.lastError ? ` · ${sync.lastError}` : ''} · pushed {sync.stats.pushed} · pulled {sync.stats.pulled} · duplicates {sync.stats.duplicates}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={RefreshCw} onClick={() => void syncNow({ force: true }).then(() => toast(useSync.getState().status === 'error' ? 'Sync failed — will retry' : useSync.getState().status === 'waiting' ? 'No ground link — queued' : 'Synced'))}>Sync now</Button>
              {sync.failed.length > 0 && <Button size="sm" variant="secondary" onClick={retryFailed}>Retry failed</Button>}
            </div>
            {sync.failed.slice(0, 5).map((e) => <p key={e.id} className="t-caption flex items-center justify-between gap-2 text-ink-2">{e.entity} {e.entityId} — {e.lastError}<button className="text-critical" onClick={() => discardFailed(e.id)}>Discard</button></p>)}
            {sync.conflicts.slice(0, 3).map((x) => <p key={x.at + x.entityId} className="t-caption text-ink-3">Conflict on {x.entity} {x.entityId}: ground copy applied ({ago(x.at, now)}).</p>)}
          </Card>
        </div>
      </Section>

      <Section title="Offline & security" id="offline">
        <Card className="grid gap-4 sm:grid-cols-3">
          <div><Overline>Encrypted vault</Overline><p className="t-callout">{vaultStatus.available ? 'AES-GCM-256, non-extractable key in this browser' : 'Unavailable — data kept in memory only'}</p>{vaultStatus.lastError && <p className="t-caption text-warning-ink">{vaultStatus.lastError}</p>}</div>
          <div><Overline>Offline app</Overline><p className="t-callout">{sw}</p></div>
          <div><Overline>Offline intelligence</Overline><p className="t-callout">Everything runs on board.</p></div>
        </Card>
      </Section>

      <Section title="Preferences">
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="t-headline">Appearance</span><Segmented label="Theme" value={st.theme} onChange={(v) => st.set('theme', v)} options={[{ value: 'light', label: 'Pearl' }, { value: 'dark', label: 'Deep space' }, { value: 'system', label: 'System' }]} /></div>
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="t-headline">Motion</span><Segmented label="Motion" value={st.motion} onChange={(v) => st.set('motion', v)} options={[{ value: 'system', label: 'System' }, { value: 'reduced', label: 'Reduced' }, { value: 'full', label: 'Full' }]} /></div>
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="t-headline">Units</span><Segmented label="Units" value={st.units} onChange={(v) => st.set('units', v)} options={[{ value: 'metric', label: 'Metric' }, { value: 'us', label: 'US' }]} /></div>
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="t-headline">Glucose</span><Segmented label="Glucose unit" value={st.glucoseUnit} onChange={(v) => st.set('glucoseUnit', v)} options={[{ value: 'mg/dL', label: 'mg/dL' }, { value: 'mmol/L', label: 'mmol/L' }]} /></div>
          <div className="flex flex-wrap items-center justify-between gap-3"><span><span className="t-headline block">Browser notifications</span><span className="t-caption text-ink-3">Only for REAL high-severity alerts; simulated alerts stay in-app. Status: {notif}</span></span><Button size="sm" variant="secondary" disabled={notif !== 'default'} onClick={() => Notification.requestPermission().then(setNotif)}>Enable</Button></div>
        </Card>
      </Section>

      <Section title="Alert thresholds"><ThresholdsCard /></Section>

      <Section title="About CosmicPulse" id="about">
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/intro?replay=1" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-pill px-4 text-[13px] font-medium text-on-pill"><Play size={15} /> Replay launch</Link>
            <Link href="/welcome" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-[13px] font-medium"><Rocket size={15} /> Replay mission briefing</Link>
            <button onClick={() => useTour.getState().start()} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-[13px] font-medium"><Play size={15} /> Replay guided tour</button>
          </div>
          <Toggle id="introSound" checked={st.introSound} onChange={(v) => st.set('introSound', v)} label="Introduction sound" description="Ambient soundtrack synthesised in your browser (no audio files). Off by default." />
          <LearnMore title="Credits & licences">
            <p><span className="font-semibold text-ink-2">Prototype.</span> CosmicPulse is a NASA Space Apps Challenge prototype — not a medical device and not NASA-certified. It never diagnoses.</p>
            <p><span className="font-semibold text-ink-2">3D anatomy:</span> BodyParts3D, © 2008 Database Center for Life Science (DBCLS), licensed CC BY-SA 2.1 JP; reduced for the web by CosmicPulse (the derived model is shared under the same licence).</p>
            <p><span className="font-semibold text-ink-2">Imagery:</span> NASA Image and Video Library (public domain). NASA does not endorse CosmicPulse. Heart illustration: Patrick J. Lynch, CC BY 2.5.</p>
            <p><span className="font-semibold text-ink-2">Research:</span> NASA Human Research Program, Canadian Space Agency, NASA OSDR — see the Research library for sources.</p>
          </LearnMore>
        </Card>
      </Section>

      <Section title="Your data">
        <Card className="flex flex-wrap gap-2">
          <Link href="/history" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-[13px] font-medium"><Download size={15} /> Export (Health history)</Link>
          <Button size="sm" variant="critical" icon={Trash2} onClick={async () => { if (!confirm('Erase all CosmicPulse data stored in this browser (health vault, settings, conversations)? This cannot be undone.')) return; wipe(); await eraseVault(); localStorage.clear(); toast('Local data erased'); setTimeout(() => location.reload(), 600); }}>Erase local data</Button>
        </Card>
      </Section>
    </div>
  );
}

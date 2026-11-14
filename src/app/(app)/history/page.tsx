'use client';

import { BellRing, Download, HeartPulse, History as HistoryIcon, Moon, Search, Smile, Stethoscope, Users } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { useUnits } from '@/components/health';
import { Button, Card, Chip, EmptyState, Input, PageHeader, SourceBadge, cn } from '@/components/ui';
import type { DataSource } from '@/data/types';
import { VITAL_META, displayUnit, formatValue } from '@/data/vitals';
import { useHealth } from '@/store/health';

type Row = { id: string; at: string; kind: 'vital' | 'sleep' | 'mood' | 'incident' | 'alert' | 'checkin'; title: string; value: string; source?: DataSource; href?: string };
type SourceFilter = 'all' | 'real' | 'synthetic' | 'manual';

const KIND_STYLE: Record<Row['kind'], { icon: typeof HeartPulse; color: string }> = {
  vital: { icon: HeartPulse, color: '#FF6B7A' },
  sleep: { icon: Moon, color: '#A99BFF' },
  mood: { icon: Smile, color: '#62D2E6' },
  checkin: { icon: Users, color: '#7CB4FF' },
  incident: { icon: Stethoscope, color: '#F2B84B' },
  alert: { icon: BellRing, color: '#FF8A5C' },
};

export default function HistoryPage() {
  const units = useUnits();
  const ms = useHealth((s) => s.measurements);
  const sleep = useHealth((s) => s.sleepRecords);
  const moods = useHealth((s) => s.moods);
  const incidents = useHealth((s) => s.incidents);
  const alerts = useHealth((s) => s.alerts);
  const checkins = useHealth((s) => s.checkins);
  const [kinds, setKinds] = useState<Row['kind'][]>(['vital', 'sleep', 'mood', 'incident', 'alert', 'checkin']);
  const [src, setSrc] = useState<SourceFilter>('all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(100);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [
      ...ms.filter((m) => m.type !== 'sleep').map((m) => ({ id: m.id, at: m.takenAt, kind: 'vital' as const, title: VITAL_META[m.type].label, value: `${formatValue(m, units)} ${displayUnit(m.type, units)}${m.qualityFlag ? ' · quality-flagged' : ''}`, source: m.source, href: `/vitals/${m.type}` })),
      ...sleep.map((r) => ({ id: r.id, at: r.night, kind: 'sleep' as const, title: 'Sleep', value: `${r.hours.toFixed(1)} h · quality ${r.quality} · ${r.disruptions} wake-ups`, source: r.source, href: '/sleep' })),
      ...moods.map((m) => ({ id: m.id, at: m.at, kind: 'mood' as const, title: 'Mood check-in', value: `mood ${m.mood} · energy ${m.energy} · stress ${m.stress}`, source: { kind: 'manual' } as DataSource, href: '/wellness' })),
      ...checkins.map((c) => ({ id: c.id, at: c.at, kind: 'checkin' as const, title: 'Confinement check-in', value: `${c.score}/100`, source: { kind: 'manual' } as DataSource, href: '/wellness' })),
      ...incidents.map((i) => ({ id: i.id, at: i.openedAt, kind: 'incident' as const, title: i.title, value: `${i.severity} · ${i.status.replace('_', ' ')}`, href: `/medical?incident=${i.id}` })),
      ...alerts.map((a) => ({ id: a.id, at: a.createdAt, kind: 'alert' as const, title: a.title, value: `${a.severity} · ${a.state}${a.simulated ? ' · synthetic' : ''}`, href: `/alerts/${encodeURIComponent(a.insightId)}` })),
    ];
    const syn = (s?: DataSource) => s?.kind === 'simulated' || s?.kind === 'demo';
    return out
      .filter((r) => kinds.includes(r.kind))
      .filter((r) => src === 'all' || (src === 'synthetic' ? syn(r.source) : src === 'manual' ? r.source?.kind === 'manual' : r.source && !syn(r.source)))
      .filter((r) => !q || `${r.title} ${r.value}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [ms, sleep, moods, checkins, incidents, alerts, kinds, src, q, units]);

  const exportFile = (fmt: 'csv' | 'json') => {
    const body =
      fmt === 'json'
        ? JSON.stringify({ exportedAt: new Date().toISOString(), note: 'CosmicPulse export. Records with source simulated/demo are SYNTHETIC.', measurements: ms, sleepRecords: sleep, moods, checkins, incidents, alerts }, null, 2)
        : ['measured_at,type,value,value2,unit,source_kind,source_device,provider,context,quality_flag,synced_at', ...ms.map((m) => [m.takenAt, m.type, m.value, m.value2 ?? '', m.unit, m.source.kind, 'deviceName' in m.source ? m.source.deviceName : '', m.provider ?? '', m.context ?? '', (m.qualityFlag ?? '').replaceAll(',', ';'), m.syncedAt ?? ''].join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: fmt === 'json' ? 'application/json' : 'text/csv' }));
    a.download = `cosmicpulse-history-${new Date().toISOString().slice(0, 10)}.${fmt}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const KIND_LABEL: Record<Row['kind'], string> = { vital: 'Vitals', sleep: 'Sleep', mood: 'Mood', checkin: 'Check-ins', incident: 'Incidents', alert: 'Alerts' };
  return (
    <div className="flex flex-col gap-6">
      <PageHeader overline="Records" title="Health history" subtitle="Every stored record in one timeline, with its source. Filter, search and export." actions={<><Button size="sm" variant="outline" icon={Download} onClick={() => exportFile('csv')}>CSV</Button><Button size="sm" variant="outline" icon={Download} onClick={() => exportFile('json')}>JSON</Button></>} />
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(KIND_LABEL) as Row['kind'][]).map((k) => {
            const K = KIND_STYLE[k];
            const on = kinds.includes(k);
            return (
              <button key={k} aria-pressed={on} onClick={() => setKinds((x) => (x.includes(k) ? x.filter((y) => y !== k) : [...x, k]))} className={cn('t-callout flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 font-medium transition-opacity', on ? 'bg-sunken' : 'opacity-45')}>
                <span className="flex size-7 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${K.color} 20%, transparent)`, color: K.color }}><K.icon size={14} /></span>{KIND_LABEL[k]}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'real', 'manual', 'synthetic'] as SourceFilter[]).map((s) => <Chip key={s} selected={src === s} onClick={() => setSrc(s)}>{s === 'all' ? 'All sources' : s === 'real' ? 'Real only' : s === 'manual' ? 'Manual only' : 'Synthetic only'}</Chip>)}
          <div className="relative ml-auto w-full sm:w-64">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search history" className="h-10 pl-9" />
          </div>
        </div>
      </div>
      <Card className="p-0 sm:p-0">
        {rows.length === 0 ? (
          <EmptyState icon={HistoryIcon} title="Nothing matches" body="Change the filters or record new data." />
        ) : (
          <ul>
            {rows.slice(0, limit).map((r, i, arr) => {
              const K = KIND_STYLE[r.kind];
              const day = r.at.slice(0, 10);
              const newDay = i === 0 || arr[i - 1].at.slice(0, 10) !== day;
              return (
                <li key={`${r.kind}-${r.id}`}>
                  {newDay && <p className="t-overline sticky top-16 z-10 bg-surface/90 px-4 py-2 text-ink-3 backdrop-blur sm:px-5">{new Date(r.at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p>}
                  <Link href={r.href ?? '#'} className="flex items-center gap-3 px-4 py-2.5 hover:bg-sunken sm:px-5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${K.color} 18%, transparent)`, color: K.color }} aria-hidden><K.icon size={18} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="t-caption block text-ink-3">{r.title}</span>
                      <span className="t-headline block truncate">{r.value}</span>
                    </span>
                    <span className="t-telemetry hidden shrink-0 text-ink-3 sm:block">{new Date(r.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    {r.source && <SourceBadge source={r.source} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {rows.length > limit && <div className="p-4 text-center"><Button size="sm" variant="secondary" onClick={() => setLimit((l) => l + 200)}>Show more ({rows.length - limit} remaining)</Button></div>}
      </Card>
    </div>
  );
}

'use client';

import { Database, ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge, Card, LearnMore, Select } from '@/components/ui';
import { CrewChart } from '@/components/viz';
import data from '@/research/data/inspiration4.json';

type Analyte = { key: string; label: string; unit: string; refLow?: number; refHigh?: number; points: { crew: string; day: string; value: number }[] };
type Panel = { osd: string; panel: string; file: string; fileUrl: string; analytes: Analyte[] };

/**
 * REAL NASA OSDR DATA — Inspiration4 crew blood panels (bundled snapshot,
 * works offline). Shown as research context: how individuals' values move
 * from their own pre-flight levels around a short spaceflight.
 */
export function Inspiration4Explorer() {
  const panels = data.panels as Panel[];
  const all = panels.flatMap((p) => p.analytes.map((a) => ({ ...a, osd: p.osd, panel: p.panel, fileUrl: p.fileUrl })));
  const [key, setKey] = useState('glucose');
  const a = all.find((x) => x.key === key) ?? all[0];
  const crew = [...new Set(a.points.map((p) => p.crew))];
  const rows = useMemo(() => data.timepoints.map((day) => ({ day, ...Object.fromEntries(a.points.filter((p) => p.day === day).map((p) => [p.crew, p.value])) })).filter((r) => Object.keys(r).length > 1), [a]);
  const pre = (c: string) => {
    const vs = a.points.filter((p) => p.crew === c && p.day.startsWith('L-')).map((p) => p.value);
    return vs.length ? vs.reduce((x, y) => x + y, 0) / vs.length : NaN;
  };
  const r1 = (c: string) => a.points.find((p) => p.crew === c && p.day === 'R+1')?.value;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex flex-wrap gap-1.5">
            <Badge label="REAL NASA OSDR DATA" tone="info" icon={Database} />
            <Badge label={`${a.osd} · historical`} />
          </div>
          <h3 className="t-title3">{data.title}</h3>
          <div className="flex flex-wrap gap-1.5">
            <span className="t-caption rounded-full bg-sunken px-2.5 py-1">🚀 {data.mission.name}</span>
            <span className="t-caption rounded-full bg-sunken px-2.5 py-1">📅 {data.mission.durationDays} days</span>
            <span className="t-caption rounded-full bg-sunken px-2.5 py-1">🧑‍🚀 {data.mission.crewSize} crew</span>
          </div>
        </div>
        <label className="flex w-full flex-col gap-1 sm:w-64">
          <span className="t-caption text-ink-2">Analyte</span>
          <Select value={key} onChange={(e) => setKey(e.target.value)}>
            {panels.map((p) => (
              <optgroup key={p.osd} label={`${p.osd} · ${p.panel}`}>
                {p.analytes.map((x) => (
                  <option key={x.key} value={x.key}>
                    {x.label} ({x.unit})
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </label>
      </div>
      <CrewChart ariaLabel={`${a.label} for Inspiration4 crew across mission timepoints`} rows={rows} crew={crew} unit={a.unit} refLow={a.refLow} refHigh={a.refHigh} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] text-left">
          <caption className="t-caption mb-1 text-left text-ink-3">Each crew member vs their own pre-flight normal.</caption>
          <thead>
            <tr className="t-overline text-ink-3">
              <th className="py-1.5 pr-3 font-medium">Crew</th>
              <th className="py-1.5 pr-3 font-medium">Pre-flight mean</th>
              <th className="py-1.5 pr-3 font-medium">R+1</th>
              <th className="py-1.5 font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {crew.map((c) => {
              const p = pre(c);
              const v = r1(c);
              const d = v !== undefined && Number.isFinite(p) ? ((v - p) / p) * 100 : undefined;
              return (
                <tr key={c} className="t-callout border-t border-line">
                  <td className="py-1.5 pr-3 font-medium">{c}</td>
                  <td className="py-1.5 pr-3 tabular">{Number.isFinite(p) ? p.toFixed(a.unit === 'cells/µL' ? 0 : 2) : '—'} {a.unit}</td>
                  <td className="py-1.5 pr-3 tabular">{v ?? '—'}</td>
                  <td className="py-1.5 tabular">{d !== undefined ? `${d > 0 ? '+' : ''}${d.toFixed(1)}%` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <LearnMore title="Where this data comes from">
        <p className="[overflow-wrap:anywhere]">
          File {panels.find((p) => p.osd === a.osd)?.file} · retrieved {data.retrievedAt.slice(0, 10)} via the OSDR Data File API · reference range {a.refLow}–{a.refHigh} {a.unit} as reported by the laboratory. {data.timepointNote}
        </p>
        <p>{data.license}</p>
        <a href={a.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 self-start text-primary hover:underline">
          Download source CSV from NASA OSDR <ExternalLink size={11} />
        </a>
        <p>Four private astronauts on a 3-day flight are not a norm for long-duration crews; CosmicPulse never compares your readings against these values.</p>
      </LearnMore>
    </Card>
  );
}

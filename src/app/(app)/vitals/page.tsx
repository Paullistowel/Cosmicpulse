'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { DataSourceBanner, useUnits } from '@/components/health';
import { ButtonLink, Card, PageHeader, Segmented, SourceBadge, Badge } from '@/components/ui';
import { TrendChart } from '@/components/viz';
import { VITAL_META, classify, displayUnit, formatValue } from '@/data/vitals';
import type { VitalType } from '@/data/types';
import { VITAL_ICON } from '@/features/health/meta';
import { ago, baselineBand, latestOf } from '@/features/health/vitals';
import { useNow } from '@/hooks/use-now';
import { RANGE_OPTIONS, trendPoints, type RangeKey } from '@/lib/series';
import { useEngine } from '@/store/engine-runner';
import { useHealth } from '@/store/health';
import { useSettings } from '@/store/settings';

const ORDER: VitalType[] = ['heart_rate', 'hrv', 'blood_pressure', 'spo2', 'temperature', 'respiratory_rate', 'glucose', 'weight'];

export default function VitalsPage() {
  const now = useNow(60_000);
  const units = useUnits();
  const thresholds = useSettings((s) => s.thresholds);
  const measurements = useHealth((s) => s.measurements);
  const engine = useEngine();
  const [range, setRange] = useState<RangeKey>('7d');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        overline="Monitoring"
        title="Vital signs"
        subtitle="Every vital with its trend, your personal baseline band and where each reading came from."
        actions={
          <>
            <Segmented label="Time range" value={range} onChange={setRange} options={RANGE_OPTIONS.filter((o) => o.value !== 'all')} />
            <ButtonLink href="/record" icon={Plus} size="sm">
              Record reading
            </ButtonLink>
          </>
        }
      />
      <DataSourceBanner compact />
      <div className="grid gap-4 lg:grid-cols-2">
        {ORDER.map((type) => {
          const meta = VITAL_META[type];
          const Icon = VITAL_ICON[type];
          const latest = latestOf(measurements, type, now);
          const pts = trendPoints(measurements, type, range, now, units);
          const band = classify(latest ?? { type, value: NaN }, thresholds);
          return (
            <Card key={type} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link href={`/vitals/${type}`} className="flex items-center gap-2.5 hover:underline">
                  <span className="flex size-9 items-center justify-center rounded-full bg-sunken text-ink-2">
                    <Icon size={17} />
                  </span>
                  <span>
                    <span className="t-headline block">{meta.label}</span>
                    <span className="t-caption block text-ink-3">{pts.length} readings · {range}</span>
                  </span>
                </Link>
                {latest ? (
                  <div className="text-right">
                    <p className="t-metric">
                      {formatValue(latest, units)} <span className="t-telemetry text-ink-3">{displayUnit(type, units)}</span>
                    </p>
                    <p className="t-telemetry text-ink-3">{ago(latest.takenAt, now)}</p>
                  </div>
                ) : (
                  <Badge label="No data" />
                )}
              </div>
              <TrendChart ariaLabel={`${meta.label} trend`} points={pts} unit={displayUnit(type, units)} decimals={type === 'temperature' || type === 'weight' ? 1 : 0} band={baselineBand(engine.baselines[type], type, units)} height={170} secondLabel={type === 'blood_pressure' ? 'Diastolic' : undefined} />
              <div className="flex flex-wrap items-center gap-2">
                {latest && <SourceBadge source={latest.source} />}
                {latest && band && band.tone !== 'success' && <Badge label={band.label} tone={band.tone === 'critical' ? 'critical' : band.tone === 'warning' ? 'warning' : 'info'} />}
                <Link href={`/vitals/${type}`} className="t-caption ml-auto font-medium text-ink-2 hover:text-ink">
                  Details →
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

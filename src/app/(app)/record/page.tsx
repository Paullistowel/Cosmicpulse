'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Activity, BedDouble, Brain, HeartPulse, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useUnits } from '@/components/health';
import { toast } from '@/components/toast';
import { Button, Card, Field, Input, Notice, PageHeader, ScalePicker, Segmented, Select, Textarea } from '@/components/ui';
import type { MeasurementContext, VitalType } from '@/data/types';
import { CONTEXT_LABEL, VITAL_META, classify, displayUnit, toCanonical, toDisplay, type UnitPrefs } from '@/data/vitals';
import { vitalsSnapshot } from '@/features/medical/lib';
import { award } from '@/game/progress';
import { useSession } from '@/services/session';
import { useActivity } from '@/store/activity';
import { useHealth } from '@/store/health';
import { useSettings } from '@/store/settings';

type Tab = 'vital' | 'sleep' | 'activity' | 'mood' | 'symptoms';
const TYPES: VitalType[] = ['heart_rate', 'blood_pressure', 'spo2', 'temperature', 'respiratory_rate', 'glucose', 'hrv', 'weight'];

/** Yesterday's date (YYYY-MM-DD) for the sleep form default. */
const yesterday = () => new Date(new Date().getTime() - 86_400_000).toISOString().slice(0, 10);

const localNow = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

/** Timestamp: valid, not in the future (2 min grace), not older than 1 year. */
const when = z.string().refine((v) => {
  const t = new Date(v).getTime();
  return Number.isFinite(t) && t <= Date.now() + 120_000 && t >= Date.now() - 365 * 86_400_000;
}, 'Use a time within the last year, not in the future.');

function vitalSchema(type: VitalType, units: UnitPrefs) {
  const meta = VITAL_META[type];
  const [lo, hi] = meta.plausible.map((v) => toDisplay(type, v, units));
  const num = (label: string, min: number, max: number) =>
    z.string().trim().min(1, `Enter ${label}.`).refine((v) => !Number.isNaN(Number(v)), 'Numbers only.').refine((v) => Number(v) >= min && Number(v) <= max, `${label[0].toUpperCase()}${label.slice(1)} must be between ${Math.round(min * 10) / 10} and ${Math.round(max * 10) / 10} ${displayUnit(type, units)}.`);
  return z
    .object({
      value: num(type === 'blood_pressure' ? 'systolic' : 'a value', lo, hi),
      value2: type === 'blood_pressure' ? num('diastolic', meta.plausible2![0], meta.plausible2![1]) : z.string().optional(),
      context: z.string(),
      takenAt: when,
      note: z.string().max(280).optional(),
    })
    .refine((d) => type !== 'blood_pressure' || Number(d.value) > Number(d.value2), { path: ['value2'], message: 'Diastolic must be lower than systolic.' });
}

function VitalForm({ initial }: { initial?: VitalType }) {
  const units = useUnits();
  const thresholds = useSettings((s) => s.thresholds);
  const add = useHealth((s) => s.addMeasurement);
  const router = useRouter();
  const [type, setType] = useState<VitalType>(initial && TYPES.includes(initial) ? initial : 'heart_rate');
  const meta = VITAL_META[type];
  const schema = useMemo(() => vitalSchema(type, units), [type, units]);
  type F = z.infer<typeof schema>;
  const { register, handleSubmit, formState, reset, watch } = useForm<F>({ resolver: zodResolver(schema), defaultValues: { value: '', value2: '', context: meta.contexts[0], takenAt: localNow(), note: '' } });
  const v = watch('value');
  const preview = v && !Number.isNaN(Number(v)) ? classify({ type, value: toCanonical(type, Number(v), units), value2: Number(watch('value2')) || undefined, context: watch('context') as MeasurementContext }, thresholds) : null;

  const submit = (d: F) => {
    const value = Math.round(toCanonical(type, Number(d.value), units) * 100) / 100;
    add({
      type,
      value,
      value2: type === 'blood_pressure' ? Number(d.value2) : undefined,
      unit: meta.unit,
      takenAt: new Date(d.takenAt).toISOString(),
      source: { kind: 'manual' },
      provider: 'manual',
      context: d.context as MeasurementContext,
      note: d.note || undefined,
      original: displayUnit(type, units) !== meta.unit ? { value: Number(d.value), unit: displayUnit(type, units) } : undefined,
    });
    award('vital_recorded');
    toast(`${meta.label} saved on this device${useSession.getState().user ? ' and queued for ground sync' : ''}.`);
    reset({ value: '', value2: '', context: meta.contexts[0], takenAt: localNow(), note: '' });
    router.push(`/vitals/${type}`);
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
      <Field label="Measurement" htmlFor="type">
        <Select
          id="type"
          value={type}
          onChange={(e) => {
            const t = e.target.value as VitalType;
            setType(t);
            reset({ value: '', value2: '', context: VITAL_META[t].contexts[0], takenAt: localNow(), note: '' });
          }}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {VITAL_META[t].label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={type === 'blood_pressure' ? 'Systolic (mmHg)' : `Value (${displayUnit(type, units)})`} htmlFor="value" error={formState.errors.value?.message}>
          <Input id="value" inputMode="decimal" autoComplete="off" aria-invalid={!!formState.errors.value} {...register('value')} />
        </Field>
        {type === 'blood_pressure' ? (
          <Field label="Diastolic (mmHg)" htmlFor="value2" error={formState.errors.value2?.message}>
            <Input id="value2" inputMode="numeric" aria-invalid={!!formState.errors.value2} {...register('value2')} />
          </Field>
        ) : (
          <Field label="Context" htmlFor="context">
            <Select id="context" {...register('context')}>
              {meta.contexts.map((c) => (
                <option key={c} value={c}>
                  {CONTEXT_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      {type === 'blood_pressure' && (
        <Field label="Context" htmlFor="context">
          <Select id="context" {...register('context')}>
            {meta.contexts.map((c) => (
              <option key={c} value={c}>
                {CONTEXT_LABEL[c]}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Measured at" htmlFor="takenAt" error={formState.errors.takenAt?.message} hint="Local time. The original measurement time is kept separately from when it syncs.">
        <Input id="takenAt" type="datetime-local" {...register('takenAt')} />
      </Field>
      <Field label="Note (optional)" htmlFor="note" error={formState.errors.note?.message}>
        <Textarea id="note" rows={2} maxLength={280} placeholder="e.g. after treadmill session" {...register('note')} />
      </Field>
      {preview && (
        <Notice tone={preview.tone === 'critical' ? 'critical' : preview.tone === 'warning' ? 'warning' : preview.tone === 'success' ? 'success' : 'info'} title={preview.label}>
          Guideline band for display only — the engine will also compare this with your personal baseline.
        </Notice>
      )}
      <p className="t-caption text-ink-3">{meta.reference}</p>
      <Button type="submit" loading={formState.isSubmitting}>
        Save {meta.shortLabel}
      </Button>
    </form>
  );
}

const sleepSchema = z.object({
  night: z.string().refine((v) => new Date(v).getTime() <= Date.now() && new Date(v).getTime() > Date.now() - 365 * 86_400_000, 'Choose a night within the last year.'),
  hours: z.string().refine((v) => Number(v) >= 0 && Number(v) <= 20, 'Hours must be between 0 and 20.'),
  disruptions: z.string().refine((v) => Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 30, '0–30 disruptions.'),
  note: z.string().max(280).optional(),
});

function SleepForm() {
  const addSleep = useHealth((s) => s.addSleep);
  const [quality, setQuality] = useState(3);
  const router = useRouter();
  const { register, handleSubmit, formState } = useForm<z.infer<typeof sleepSchema>>({ resolver: zodResolver(sleepSchema), defaultValues: { night: yesterday(), hours: '', disruptions: '0' } });
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit((d) => {
        addSleep({ night: new Date(`${d.night}T23:00:00`).toISOString(), hours: Number(d.hours), quality: quality * 20, disruptions: Number(d.disruptions), note: d.note });
        award('sleep_logged');
        toast('Sleep saved');
        router.push('/sleep');
      })}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Night of" htmlFor="night" error={formState.errors.night?.message}>
          <Input id="night" type="date" {...register('night')} />
        </Field>
        <Field label="Hours slept" htmlFor="hours" error={formState.errors.hours?.message}>
          <Input id="hours" inputMode="decimal" placeholder="7.0" {...register('hours')} />
        </Field>
        <Field label="Wake-ups" htmlFor="disruptions" error={formState.errors.disruptions?.message}>
          <Input id="disruptions" inputMode="numeric" {...register('disruptions')} />
        </Field>
      </div>
      <ScalePicker name="sq" label="Sleep quality" low="Very poor" high="Excellent" value={quality} onChange={setQuality} />
      <Field label="Note (optional)" htmlFor="snote">
        <Textarea id="snote" rows={2} {...register('note')} />
      </Field>
      <Button type="submit">Save sleep</Button>
    </form>
  );
}

const actSchema = z.object({
  date: z.string().refine((v) => new Date(v).getTime() <= Date.now(), 'Not in the future.'),
  steps: z.string().refine((v) => v === '' || (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 100000), '0–100,000 steps.'),
  distanceKm: z.string().refine((v) => v === '' || (Number(v) >= 0 && Number(v) <= 100), '0–100 km.'),
  exerciseMin: z.string().refine((v) => v === '' || (Number(v) >= 0 && Number(v) <= 600), '0–600 minutes.'),
});

function ActivityForm() {
  const addManual = useActivity((s) => s.addManual);
  const router = useRouter();
  const { register, handleSubmit, formState } = useForm<z.infer<typeof actSchema>>({ resolver: zodResolver(actSchema), defaultValues: { date: new Date().toISOString().slice(0, 10), steps: '', distanceKm: '', exerciseMin: '' } });
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={handleSubmit((d) => {
        if (!d.steps && !d.distanceKm && !d.exerciseMin) return toast('Enter at least one value', 'warning');
        addManual({ date: d.date, steps: d.steps ? Number(d.steps) : undefined, distanceM: d.distanceKm ? Number(d.distanceKm) * 1000 : undefined, exerciseMin: d.exerciseMin ? Number(d.exerciseMin) : undefined });
        award('activity_logged');
        toast('Activity saved');
        router.push('/activity');
      })}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" htmlFor="adate" error={formState.errors.date?.message}>
          <Input id="adate" type="date" {...register('date')} />
        </Field>
        <Field label="Steps" htmlFor="steps" error={formState.errors.steps?.message}>
          <Input id="steps" inputMode="numeric" {...register('steps')} />
        </Field>
        <Field label="Distance (km)" htmlFor="dist" error={formState.errors.distanceKm?.message} hint="Leave empty if unknown — CosmicPulse labels step-based distance as estimated.">
          <Input id="dist" inputMode="decimal" {...register('distanceKm')} />
        </Field>
        <Field label="Exercise (minutes)" htmlFor="exm" error={formState.errors.exerciseMin?.message}>
          <Input id="exm" inputMode="numeric" {...register('exerciseMin')} />
        </Field>
      </div>
      <p className="t-caption text-ink-3">Replaces any earlier manual entry for that date.</p>
      <Button type="submit">Save activity</Button>
    </form>
  );
}

const MOOD_TAGS = ['Rested', 'Focused', 'Homesick', 'Irritable', 'Lonely', 'Motivated', 'Anxious', 'Overloaded'];

function MoodForm() {
  const addMood = useHealth((s) => s.addMood);
  const [mood, setMood] = useState<number>();
  const [energy, setEnergy] = useState<number>();
  const [stress, setStress] = useState<number>();
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const router = useRouter();
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!mood || !energy || !stress) return toast('Answer all three scales', 'warning');
        addMood({ mood: mood as 1, energy: energy as 1, stress: stress as 1, tags, note: note.trim() || undefined });
        award('mood_checkin');
        toast('Check-in saved');
        router.push('/wellness');
      }}>
      <ScalePicker name="mood" label="Mood" low="Very low" high="Very good" value={mood} onChange={setMood} />
      <ScalePicker name="energy" label="Energy" low="Exhausted" high="Energetic" value={energy} onChange={setEnergy} />
      <ScalePicker name="stress" label="Stress" low="Calm" high="Very stressed" value={stress} onChange={setStress} />
      <fieldset>
        <legend className="t-headline mb-2">Tags (optional)</legend>
        <div className="flex flex-wrap gap-2">
          {MOOD_TAGS.map((t) => (
            <button type="button" key={t} aria-pressed={tags.includes(t)} onClick={() => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))} className={`h-8 rounded-full border px-3 text-[13px] ${tags.includes(t) ? 'border-transparent bg-pill text-on-pill' : 'border-line-strong text-ink-2'}`}>
              {t}
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Private note (optional)" htmlFor="mnote" hint="Notes stay on this device and are never sent to the cloud assistant.">
        <Textarea id="mnote" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button type="submit">Save check-in</Button>
    </form>
  );
}

const SYMPTOMS = ['Headache', 'Nausea', 'Dizziness', 'Congestion', 'Back pain', 'Eye irritation', 'Vision change', 'Fatigue', 'Fever / chills', 'Shortness of breath', 'Skin rash', 'Insomnia'];

function SymptomForm() {
  const report = useHealth((s) => s.reportIncident);
  const profile = useHealth((s) => s.profile);
  const ms = useHealth((s) => s.measurements);
  const [picked, setPicked] = useState<string[]>([]);
  const [severity, setSeverity] = useState<'minor' | 'moderate'>('minor');
  const [desc, setDesc] = useState('');
  const router = useRouter();
  const urgent = picked.includes('Shortness of breath') || picked.includes('Vision change');
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!picked.length) return toast('Select at least one symptom', 'warning');
        const inc = report({
          title: `Symptoms: ${picked.join(', ')}`,
          category: 'illness',
          severity,
          reportedBy: profile.name,
          description: desc.trim() || `Self-reported: ${picked.join(', ')}.`,
          vitalsSnapshot: vitalsSnapshot(ms),
          protocolIds: picked.includes('Fever / chills') ? ['AEG-MD-002'] : picked.includes('Vision change') || picked.includes('Headache') ? ['AEG-MD-005'] : picked.includes('Insomnia') || picked.includes('Fatigue') ? ['AEG-BH-001'] : picked.includes('Nausea') || picked.includes('Dizziness') ? ['AEG-MD-001'] : [],
        });
        toast('Symptoms logged for crew medical officer review');
        router.push(`/medical?incident=${inc.id}`);
      }}>
      <fieldset>
        <legend className="t-headline mb-2">Symptoms</legend>
        <div className="flex flex-wrap gap-2">
          {SYMPTOMS.map((s) => (
            <button type="button" key={s} aria-pressed={picked.includes(s)} onClick={() => setPicked((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]))} className={`h-9 rounded-full border px-3.5 text-[13px] ${picked.includes(s) ? 'border-transparent bg-pill text-on-pill' : 'border-line-strong text-ink-2'}`}>
              {s}
            </button>
          ))}
        </div>
      </fieldset>
      {urgent && (
        <Notice tone="critical" title="Breathing difficulty or sudden vision change can be urgent">
          If severe or worsening, use <Link href="/emergency" className="font-semibold underline">Emergency</Link> now instead of a routine log.
        </Notice>
      )}
      <Field label="How bad is it?" htmlFor="sev">
        <Segmented label="Severity" value={severity} onChange={setSeverity} options={[{ value: 'minor', label: 'Mild' }, { value: 'moderate', label: 'Moderate' }]} />
      </Field>
      <Field label="Description (optional)" htmlFor="sdesc">
        <Textarea id="sdesc" rows={3} maxLength={600} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="When did it start? Anything that helps or worsens it?" />
      </Field>
      <p className="t-caption text-ink-3">Saved as an incident with your latest vitals for the medical officer.</p>
      <Button type="submit">Log symptoms</Button>
    </form>
  );
}

function RecordInner() {
  const sp = useSearchParams();
  const initialType = (sp.get('type') ?? undefined) as VitalType | undefined;
  const [tab, setTab] = useState<Tab>((sp.get('tab') as Tab) ?? 'vital');
  const TABS: { value: Tab; label: string; icon: typeof HeartPulse; blurb: string }[] = [
    { value: 'vital', label: 'Vital sign', icon: HeartPulse, blurb: 'Heart rate, blood pressure, SpO₂, temperature, respiratory rate, glucose, HRV or weight.' },
    { value: 'sleep', label: 'Sleep', icon: BedDouble, blurb: 'Hours, quality and wake-ups for one night.' },
    { value: 'activity', label: 'Activity', icon: Activity, blurb: 'Daily steps, distance and exercise minutes.' },
    { value: 'mood', label: 'Mood & stress', icon: Brain, blurb: 'A 20-second check-in on mood, energy and stress.' },
    { value: 'symptoms', label: 'Symptoms', icon: Stethoscope, blurb: 'Log how you feel for medical review.' },
  ];
  const cur = TABS.find((t) => t.value === tab)!;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader overline="Manual input" title="Record health data" subtitle="Entries are validated, stored encrypted on this device with source “Entered manually”, and queued for ground sync when signed in." />
      <Segmented label="What to record" value={tab} onChange={setTab} options={TABS.map((t) => ({ value: t.value, label: t.label }))} />
      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-sunken text-ink-2">
            <cur.icon size={18} />
          </span>
          <div>
            <h2 className="t-title3">{cur.label}</h2>
            <p className="t-callout text-ink-2">{cur.blurb}</p>
          </div>
        </div>
        {tab === 'vital' && <VitalForm initial={initialType} />}
        {tab === 'sleep' && <SleepForm />}
        {tab === 'activity' && <ActivityForm />}
        {tab === 'mood' && <MoodForm />}
        {tab === 'symptoms' && <SymptomForm />}
      </Card>
    </div>
  );
}

export default function RecordPage() {
  return (
    <Suspense>
      <RecordInner />
    </Suspense>
  );
}

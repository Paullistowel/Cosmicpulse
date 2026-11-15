'use client';

import * as Switch from '@radix-ui/react-switch';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Cpu,
  FileDown,
  FlaskConical,
  BookOpen,
  Info,
  Loader2,
  Pencil,
  Radio,
  RefreshCw,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { forwardRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

import type { DataSource, FindingKind, Severity } from '@/data/types';
import { sourceLabel } from '@/lib/format';
import { TONE_CLASS, type Tone } from '@/theme';

export { cn } from '@/lib/cn';
import { cn } from '@/lib/cn';
import { PageIntro } from '@/components/story';

/* ---------------------------------- Surfaces ---------------------------------- */

export function Card({ className, tone, children, as: As = 'div', ...rest }: { className?: string; tone?: Tone; children: ReactNode; as?: 'div' | 'section' | 'article' } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <As className={cn(tone && tone !== 'neutral' ? cn('rounded-[24px]', TONE_CLASS[tone].split(' ')[1]) : 'card', 'p-4 sm:p-5', className)} {...rest}>
      {children}
    </As>
  );
}

export function LinkCard({ href, className, children, label }: { href: string; className?: string; children: ReactNode; label?: string }) {
  return (
    <Link href={href} aria-label={label} className={cn('card block p-4 transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:shadow-float active:scale-[0.99] sm:p-5', className)}>
      {children}
    </Link>
  );
}

export function Glass({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('glass rounded-[20px]', className)} {...rest}>
      {children}
    </div>
  );
}

/* ---------------------------------- Text ---------------------------------- */

export function Overline({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('t-overline text-ink-3', className)}>{children}</p>;
}

export function Section({ title, action, children, className, id, description }: { title: string; description?: ReactNode; action?: { label: string; href?: string; onClick?: () => void }; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={cn('flex flex-col gap-3', className)} aria-labelledby={id ? `${id}-h` : undefined}>
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h2 id={id ? `${id}-h` : undefined} className="t-title3">
            {title}
          </h2>
          {description && <SectionNote text={description} />}
        </div>
        {action &&
          (action.href ? (
            <Link href={action.href} className="t-callout flex shrink-0 items-center gap-0.5 font-medium text-ink-2 hover:text-ink">
              {action.label}
              <ChevronRight size={15} />
            </Link>
          ) : (
            <button onClick={action.onClick} className="t-callout shrink-0 font-medium text-ink-2 hover:text-ink">
              {action.label}
            </button>
          ))}
      </div>
      {children}
    </section>
  );
}

/** Page header → visual chapter header (image, story rail, Nova). The subtitle stays available behind "What's this?". */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; overline?: string; actions?: ReactNode }) {
  return <PageIntro title={title} detail={subtitle} actions={actions} />;
}

/** Short notes show inline; longer ones fold behind an info button (text-minimal by default). */
function SectionNote({ text }: { text: ReactNode }) {
  const [open, setOpen] = useState(false);
  const long = typeof text !== 'string' || text.length > 70;
  if (!long) return <p className="t-callout mt-0.5 text-ink-2">{text}</p>;
  return (
    <>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="t-caption mt-1 inline-flex items-center gap-1 rounded-full bg-sunken px-2.5 py-1 text-ink-2 hover:text-ink">
        <Info size={13} aria-hidden /> {open ? 'Hide' : 'What’s this?'}
      </button>
      {open && <p className="t-callout mt-1.5 max-w-3xl text-ink-2">{text}</p>}
    </>
  );
}

/** First sentence as a concise summary, the full text one tap away (for long AI explanations). */
export function Summary({ text, className, min = 140 }: { text: string; className?: string; min?: number }) {
  const [open, setOpen] = useState(false);
  const m = text.match(/^(.{20,}?[.!?])(\s|$)/);
  const short = m && m[1].length < text.length - 15 ? m[1] : null;
  if (!short || text.length <= min) return <p className={className}>{text}</p>;
  return (
    <p className={className}>
      {open ? text : short}{' '}
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="t-caption font-semibold text-primary hover:underline">{open ? 'Less' : 'More'}</button>
    </p>
  );
}

/** Collapsible "Learn more" drawer for methodology and science — content kept, hidden by default. */
export function LearnMore({ title = 'Learn more', children, className }: { title?: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('rounded-[18px] bg-sunken/70', className)}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="t-callout flex w-full items-center gap-2 px-3.5 py-2.5 text-left font-medium text-ink-2 hover:text-ink">
        <BookOpen size={15} className="shrink-0 text-primary" aria-hidden />
        <span className="flex-1">{title}</span>
        <ChevronRight size={15} className={cn('transition-transform', open && 'rotate-90')} aria-hidden />
      </button>
      {open && <div className="t-callout flex flex-col gap-2 px-3.5 pb-3 text-ink-2">{children}</div>}
    </div>
  );
}

/* ---------------------------------- Badges ---------------------------------- */

export function Badge({ label, tone = 'neutral', icon: Icon, size = 'sm', className, title }: { label: string; tone?: Tone; icon?: LucideIcon; size?: 'sm' | 'md'; className?: string; title?: string }) {
  return (
    <span title={title} className={cn('t-caption inline-flex max-w-full shrink-0 items-center gap-1 rounded-full px-2 whitespace-nowrap', size === 'md' ? 'py-[5px]' : 'py-[3px]', TONE_CLASS[tone], className)}>
      {Icon && <Icon size={12} strokeWidth={2.4} aria-hidden />}
      <span className="truncate">{label}</span>
    </span>
  );
}

const SOURCE_MAP: Record<DataSource['kind'], { tone: Tone; icon: LucideIcon }> = {
  live: { tone: 'success', icon: Radio },
  synced: { tone: 'info', icon: RefreshCw },
  manual: { tone: 'neutral', icon: Pencil },
  demo: { tone: 'demo', icon: FlaskConical },
  simulated: { tone: 'demo', icon: Cpu },
  clinician: { tone: 'accent', icon: Stethoscope },
  import: { tone: 'neutral', icon: FileDown },
};

/** Every measurement shows its provenance — never hidden. */
export function SourceBadge({ source, className }: { source: DataSource; className?: string }) {
  const m = SOURCE_MAP[source.kind];
  const label = source.kind === 'simulated' || source.kind === 'demo' ? `SYNTHETIC · ${sourceLabel(source).replace(/^Simulated · /, '')}` : sourceLabel(source);
  return <Badge label={label} tone={m.tone} icon={m.icon} className={className} />;
}

const SEVERITY: Record<Severity, { label: string; tone: Tone; icon: LucideIcon }> = {
  info: { label: 'Informational', tone: 'info', icon: Info },
  low: { label: 'Informational', tone: 'info', icon: Info },
  moderate: { label: 'Attention recommended', tone: 'warning', icon: AlertTriangle },
  high: { label: 'Medical review recommended', tone: 'warning', icon: AlertTriangle },
  critical: { label: 'Urgent attention', tone: 'critical', icon: AlertOctagon },
};
export const severityTone = (s: Severity): Tone => SEVERITY[s].tone;
export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEVERITY[severity];
  return <Badge label={s.label} tone={s.tone} icon={s.icon} />;
}

/** Normal / Warning / Critical — the three web alert categories mapped from the four engine tiers. */
export function alertCategory(s: Severity): { label: 'Normal' | 'Warning' | 'Critical'; tone: Tone } {
  if (s === 'critical') return { label: 'Critical', tone: 'critical' };
  if (s === 'moderate' || s === 'high') return { label: 'Warning', tone: 'warning' };
  return { label: 'Normal', tone: 'success' };
}

const KIND: Record<FindingKind, { label: string; tone: Tone; icon: LucideIcon }> = {
  education: { label: 'Education', tone: 'neutral', icon: Info },
  statistical_anomaly: { label: 'Statistical pattern', tone: 'primary', icon: Cpu },
  screening_indicator: { label: 'Screening indicator', tone: 'accent', icon: FlaskConical },
  risk_estimate: { label: 'Risk estimate', tone: 'warning', icon: AlertTriangle },
  confirmed_diagnosis: { label: 'Clinician diagnosis', tone: 'success', icon: CheckCircle2 },
};
export function FindingKindBadge({ kind }: { kind: FindingKind }) {
  const k = KIND[kind];
  return <Badge label={k.label} tone={k.tone} icon={k.icon} />;
}

export function SyntheticBadge({ label = 'SYNTHETIC / DEMO DATA', className }: { label?: string; className?: string }) {
  return <Badge label={label} tone="demo" icon={FlaskConical} className={className} />;
}

/* ---------------------------------- Controls ---------------------------------- */

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'critical' | 'outline';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-pill text-on-pill hover:opacity-90',
  secondary: 'bg-sunken text-ink hover:bg-line-strong/60',
  ghost: 'text-ink-2 hover:bg-sunken hover:text-ink',
  critical: 'bg-critical text-white hover:opacity-90',
  outline: 'border border-line-strong text-ink hover:bg-sunken',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; icon?: LucideIcon; loading?: boolean }>(function Button(
  { variant = 'primary', size = 'md', icon: Icon, loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 rounded-full font-medium transition-[transform,opacity,background-color] duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm' ? 'h-9 px-3.5 text-[13px]' : size === 'lg' ? 'h-12 px-6 text-[15px]' : 'h-11 px-5 text-sm',
        BTN[variant],
        className,
      )}
      {...rest}>
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : Icon ? <Icon size={size === 'sm' ? 15 : 17} aria-hidden /> : null}
      {children}
    </button>
  );
});

export function ButtonLink({ href, variant = 'primary', size = 'md', icon: Icon, children, className }: { href: string; variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn('inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[transform,opacity] duration-150 active:scale-[0.97]', size === 'sm' ? 'h-9 px-3.5 text-[13px]' : size === 'lg' ? 'h-12 px-6 text-[15px]' : 'h-11 px-5 text-sm', BTN[variant], className)}>
      {Icon && <Icon size={size === 'sm' ? 15 : 17} aria-hidden />}
      {children}
    </Link>
  );
}

export function IconButton({ icon: Icon, label, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return (
    <button aria-label={label} title={label} className={cn('inline-flex size-10 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-sunken hover:text-ink', className)} {...rest}>
      <Icon size={18} aria-hidden />
    </button>
  );
}

/** Ink-pill segmented control (mobile SegmentedControl). */
export function Segmented<T extends string>({ value, onChange, options, label, className, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-sunken p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'shrink-0 rounded-full font-medium whitespace-nowrap transition-colors duration-200',
            size === 'sm' ? 'h-7 px-3 text-xs' : 'h-8 px-3.5 text-[13px]',
            value === o.value ? 'bg-pill text-on-pill shadow-sm' : 'text-ink-2 hover:text-ink',
          )}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ selected, onClick, children, className }: { selected?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button aria-pressed={selected} onClick={onClick} className={cn('h-8 shrink-0 rounded-full border px-3 text-[13px] font-medium transition-colors', selected ? 'border-transparent bg-pill text-on-pill' : 'border-line-strong text-ink-2 hover:text-ink', className)}>
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label, description, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: ReactNode; disabled?: boolean; id: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="t-headline block">{label}</span>
        {description && <span className="t-callout mt-0.5 block text-ink-2">{description}</span>}
      </label>
      <Switch.Root id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} className="relative mt-0.5 h-7 w-12 shrink-0 rounded-full bg-line-strong transition-colors data-[state=checked]:bg-success disabled:opacity-50">
        <Switch.Thumb className="block size-6 translate-x-0.5 rounded-full bg-white shadow transition-transform duration-200 data-[state=checked]:translate-x-[22px]" />
      </Switch.Root>
    </div>
  );
}

/* ---------------------------------- Forms ---------------------------------- */

export function Field({ label, hint, error, children, htmlFor, className }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="t-caption text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="t-caption text-critical">
          {error}
        </p>
      ) : hint ? (
        <p className="t-caption text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

const inputCls = 'h-11 w-full rounded-[14px] border border-line-strong bg-raised px-3.5 text-[15px] text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none aria-[invalid=true]:border-critical';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(inputCls, className)} {...p} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return (
    <select ref={ref} className={cn(inputCls, 'appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238C908B' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...p}>
      {children}
    </select>
  );
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(inputCls, 'h-auto min-h-24 py-3', className)} {...p} />;
});

/** 1–5 scale picker (mobile ScalePicker). */
export function ScalePicker({ value, onChange, label, low, high, name }: { value?: number; onChange: (v: number) => void; label: string; low: string; high: string; name: string }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="t-headline mb-1">{label}</legend>
      <div className="flex gap-2" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} of 5`}
            name={name}
            onClick={() => onChange(n)}
            className={cn('h-11 flex-1 rounded-[14px] text-[15px] font-semibold tabular transition-colors', value === n ? 'bg-pill text-on-pill' : 'bg-sunken text-ink-2 hover:text-ink')}>
            {n}
          </button>
        ))}
      </div>
      <div className="t-caption flex justify-between text-ink-3">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </fieldset>
  );
}

/* ---------------------------------- Feedback ---------------------------------- */

export function Notice({ tone = 'info', title, children, icon: Icon = Info, className, action }: { tone?: Tone; title?: string; children?: ReactNode; icon?: LucideIcon; className?: string; action?: ReactNode }) {
  return (
    <div role={tone === 'critical' ? 'alert' : 'note'} className={cn('flex gap-3 rounded-[18px] p-3.5', TONE_CLASS[tone].split(' ')[1], className)}>
      <Icon size={18} className={cn('mt-0.5 shrink-0', TONE_CLASS[tone].split(' ')[0])} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className={cn('t-headline', TONE_CLASS[tone].split(' ')[0])}>{title}</p>}
        {children && <div className="t-callout text-ink-2">{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-sunken text-ink-2">
        <Icon size={22} aria-hidden />
      </div>
      <p className="t-headline">{title}</p>
      {body && <p className="t-callout max-w-md text-ink-2">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-[14px] bg-sunken', className)} aria-hidden />;
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px bg-line', className)} role="separator" />;
}

export function LivePulse({ live, color = 'var(--success)', size = 8 }: { live: boolean; color?: string; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-hidden>
      {live && <span className="live-ring absolute inset-0 rounded-full" style={{ background: color }} />}
      <span className="relative inline-block rounded-full" style={{ width: size, height: size, background: color }} />
    </span>
  );
}

export function Stat({ label, value, unit, detail, tone }: { label: string; value: ReactNode; unit?: string; detail?: ReactNode; tone?: Tone }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <Overline>{label}</Overline>
      <p className="flex items-baseline gap-1">
        <span className={cn('t-metric truncate', tone && TONE_CLASS[tone].split(' ')[0])}>{value}</span>
        {unit && <span className="t-telemetry text-ink-3">{unit}</span>}
      </p>
      {detail && <div className="t-caption truncate text-ink-3">{detail}</div>}
    </div>
  );
}

export function ProgressBar({ value, max = 1, tone = 'accent', label }: { value: number; max?: number; tone?: Tone; label: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full overflow-hidden rounded-full bg-sunken">
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, background: `var(--${tone === 'warning' ? 'warning' : tone === 'neutral' ? 'ink-3' : tone})` }} />
    </div>
  );
}

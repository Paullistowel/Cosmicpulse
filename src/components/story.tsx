'use client';

import { motion, useReducedMotion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { Nova, type Pose } from '@/components/companion';
import { cn } from '@/lib/cn';
import { Info } from 'lucide-react';

import { CHAPTERS, CHAPTER_BY_ID, chapterFor, type ChapterId } from '@/lib/nav';

/** The seven-chapter story map. Every chapter is always reachable — a map, not a gate. */
export function JourneyRail({ current, className }: { current: ChapterId; className?: string }) {
  const idx = CHAPTERS.findIndex((c) => c.id === current);
  return (
    <nav aria-label="Mission story" className={cn('flex flex-wrap items-center gap-y-1', className)}>
      {CHAPTERS.map((c, i) => (
        <span key={c.id} className="flex items-center">
          {i > 0 && <span className={cn('h-px w-2.5 sm:w-5', i <= idx ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]')} aria-hidden />}
          <Link
            href={c.href}
            aria-current={c.id === current ? 'step' : undefined}
            title={`Chapter ${c.n} · ${c.name}`}
            className={cn(
              't-telemetry flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 transition-colors',
              c.id === current ? 'bg-[var(--accent)] text-[var(--bg)]' : i < idx ? 'text-[var(--accent)] ring-1 ring-[var(--accent)]' : 'text-ink-3 ring-1 ring-[var(--border-strong)] hover:text-ink',
            )}>
            {c.id === current ? <span className="whitespace-nowrap">{c.n} · {c.name.toUpperCase()}</span> : c.n}
          </Link>
        </span>
      ))}
    </nav>
  );
}

/**
 * Chapter opening at the top of each section: story image, chapter rail, one-line title and
 * Nova introducing what you can do here.
 */
export function SectionIntro({ chapter, title, say, pose = 'point', actions, className, image, detail }: { chapter: ChapterId; title: string; say?: ReactNode; pose?: Pose; actions?: ReactNode; className?: string; image?: string; detail?: ReactNode }) {
  const c = CHAPTER_BY_ID[chapter];
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  return (
    <header data-tour="page-intro" className={cn('relative isolate overflow-hidden rounded-[30px] px-5 py-5 sm:px-7', className)}>
      <div className="absolute inset-0 -z-10" aria-hidden>
        <Image src={image ?? c.image} alt="" fill sizes="(min-width: 1024px) 70vw, 100vw" className="object-cover opacity-55 [mask-image:linear-gradient(90deg,transparent,black_60%)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg)] via-[color-mix(in_srgb,var(--bg)_70%,transparent)] to-transparent" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <motion.div initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="flex min-w-0 flex-1 flex-col gap-2">
          <JourneyRail current={chapter} />
          <h1 className="t-display mt-1 sm:text-[40px] sm:leading-[46px]">{title}</h1>
          {say && (
            <div className="flex items-end gap-2">
              <Nova pose={pose} size={64} className="-mb-1 shrink-0" />
              <p className="t-body relative mb-3 max-w-xl rounded-[18px] rounded-bl-[5px] bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] px-3.5 py-2 font-medium backdrop-blur">{say}</p>
            </div>
          )}
          {detail && (
            <div>
              <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="t-caption inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] px-2.5 py-1 text-ink-2 backdrop-blur hover:text-ink">
                <Info size={13} aria-hidden /> {open ? 'Hide details' : 'What’s this?'}
              </button>
              {open && <p className="t-callout mt-2 max-w-2xl text-ink-2">{detail}</p>}
            </div>
          )}
        </motion.div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Nova's simple line and a picture for each page (route-based), used by every PageHeader. */
const PAGE_COPY: { match: string; say: string; pose?: Pose; image?: string }[] = [
  { match: '/research/', say: 'Let’s look inside a real NASA study!', pose: 'point', image: '/images/nasa/blood-sample.jpg' },
  { match: '/research', say: 'Real space science lives here. Search it or open a study!', pose: 'point', image: '/images/nasa/mission-control.jpg' },
  { match: '/assistant', say: 'Ask me anything about your health data.', pose: 'wave', image: '/images/nasa/aurora.jpg' },
  { match: '/vitals/', say: 'Here’s the full story of this reading. Touch the chart to explore!', pose: 'point', image: '/images/heart.jpg' },
  { match: '/vitals', say: 'Your vital signs. Tap one to see its story.', pose: 'point', image: '/images/nasa/blood-sample.jpg' },
  { match: '/assessments', say: 'Your check-up: how ready is your body today?', pose: 'think', image: '/images/nasa/mission-control.jpg' },
  { match: '/settings', say: 'Mission controls — choose where your data comes from.', pose: 'point', image: '/images/nasa/mission-control.jpg' },
  { match: '/record', say: 'Add a reading. It only takes a moment!', pose: 'wave', image: '/images/nasa/blood-sample.jpg' },
  { match: '/wellness', say: 'How are you feeling? Your mind matters on a mission.', pose: 'wave', image: '/images/nasa/cupola.jpg' },
  { match: '/sleep', say: 'Sleep recharges your body. Let’s look at last night.', pose: 'think', image: '/images/nasa/quarters.jpg' },
  { match: '/activity', say: 'Moving keeps bones and muscles strong in space!', pose: 'celebrate', image: '/images/nasa/treadmill.jpg' },
  { match: '/alerts/', say: 'Let’s understand this alert together.', pose: 'think', image: '/images/nasa/mission-control.jpg' },
  { match: '/alerts', say: 'Anything unusual shows up here — with what to do next.', pose: 'point', image: '/images/nasa/mission-control.jpg' },
  { match: '/history', say: 'Every record from your mission, all in one place.', pose: 'think', image: '/images/nasa/earth-night.jpg' },
  { match: '/medical', say: 'Your medical kit, medicines and incident log.', pose: 'point', image: '/images/nasa/blood-sample.jpg' },
  { match: '/risk', say: 'Which space dangers matter most for you right now?', pose: 'think', image: '/images/nasa/solar-flare.jpg' },
  { match: '/reports', say: 'Make a report for your flight surgeon.', pose: 'point', image: '/images/nasa/mission-control.jpg' },
];

export function PageIntro({ title, detail, actions }: { title: string; detail?: ReactNode; actions?: ReactNode }) {
  const pathname = usePathname();
  const copy = PAGE_COPY.find((p) => (p.match.endsWith('/') ? pathname.startsWith(p.match) : pathname === p.match || pathname.startsWith(`${p.match}/`)));
  return <SectionIntro chapter={chapterFor(pathname)} title={title} say={copy?.say} pose={copy?.pose} image={copy?.image} detail={detail} actions={actions} />;
}

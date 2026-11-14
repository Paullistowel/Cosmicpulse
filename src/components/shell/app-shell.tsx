'use client';

import * as Popover from '@radix-ui/react-popover';
import { Bell, ChevronsLeft, ChevronsRight, FlaskConical, HelpCircle, Menu, RadioTower, Siren, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { SpaceBackdrop } from '@/components/brand/backdrop';
import { CosmicMark, Wordmark } from '@/components/brand/mark';
import { Sheet } from '@/components/sheet';
import { Badge, Button, LivePulse, cn } from '@/components/ui';
import { ago } from '@/features/health/vitals';
import { useNow } from '@/hooks/use-now';
import { RankMeter } from '@/components/game';
import { ALL_NAV, MOBILE_TABS, NAV, activeHref, hubFor, type NavItem } from '@/lib/nav';
import { LINK_COPY, linkState, useConnectivity } from '@/services/connectivity';
import { STATE_COPY, useDataSource } from '@/services/data-source';
import { useSync } from '@/services/sync';
import { useHealth } from '@/store/health';
import { useSettings } from '@/store/settings';
import { AssistantDock } from '@/components/assistant/dock';
import { TourOverlay, useTour } from '@/components/tour';


function NavLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = activeHref(pathname) === item.href;
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      data-tour={item.section ? `nav-${item.section}` : undefined}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        'group flex h-10 items-center gap-3 rounded-full px-3 text-[14px] font-medium transition-colors duration-200',
        item.section && !collapsed && 'h-[52px] text-[15px]',
        active ? 'bg-pill text-on-pill shadow-sm' : 'text-ink-2 hover:bg-sunken hover:text-ink',
        collapsed && 'justify-center px-0',
      )}>
      <Icon size={item.section ? 20 : 18} aria-hidden className="shrink-0" />
      {!collapsed && (
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate">{item.label}</span>
          {item.section && item.hint && <span className={cn('truncate text-[11px] font-normal', active ? 'opacity-60' : 'text-ink-3')}>{item.hint}</span>}
        </span>
      )}
      {collapsed && <span className="sr-only">{item.label}</span>}
    </Link>
  );
}

/* --------------------------------- Status pills --------------------------------- */

export function useLinkSummary() {
  const conn = useConnectivity();
  const state = linkState(conn);
  const queued = useSync((s) => s.queue.length);
  const failed = useSync((s) => s.failed.length);
  const lastSyncAt = useSync((s) => s.lastSyncAt);
  return { state, copy: LINK_COPY[state], queued, failed, lastSyncAt, conn };
}

export function LinkPill({ compact }: { compact?: boolean }) {
  const l = useLinkSummary();
  const color = l.failed ? 'var(--critical)' : l.state === 'online' ? 'var(--success)' : l.state === 'not_configured' ? 'var(--ink-3)' : 'var(--warning)';
  return (
    <Link href="/settings#link" className="glass flex h-9 items-center gap-2 rounded-full px-3" title={l.copy.detail} aria-label={`${l.copy.label}. ${l.copy.detail} ${l.queued} queued.`}>
      {l.state === 'no_network' || l.state === 'los_simulated' ? <WifiOff size={14} className="text-warning-ink" aria-hidden /> : <LivePulse live={l.state === 'online'} color={color} size={7} />}
      {!compact && <span className="t-telemetry whitespace-nowrap">{l.copy.label.toUpperCase()}</span>}
      {l.queued > 0 && <span className="t-telemetry rounded-full bg-sunken px-1.5 text-ink-2">{l.queued}</span>}
    </Link>
  );
}

export function DataModePill({ compact }: { compact?: boolean }) {
  const ds = useDataSource();
  const c = STATE_COPY[ds.state];
  return (
    <Link href="/settings#sources" title={c.detail} aria-label={`Data mode: ${c.label}. ${c.detail}`}>
      <Badge label={compact ? c.short : `${c.short} DATA`} tone={c.tone} icon={ds.state === 'demo' || ds.state === 'mixed' ? FlaskConical : RadioTower} size="md" />
    </Link>
  );
}

function Notifications() {
  const list = useHealth((s) => s.notifications);
  const markAll = useHealth((s) => s.markAllNotificationsRead);
  const markRead = useHealth((s) => s.markNotificationRead);
  const now = useNow(60_000);
  const unread = list.filter((n) => !n.read).length;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} className="glass relative flex size-9 items-center justify-center rounded-full text-ink-2 hover:text-ink">
          <Bell size={17} />
          {unread > 0 && <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-[min(380px,calc(100vw-24px))] rounded-[24px] bg-surface p-2 shadow-float">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="t-headline">Notifications</p>
            {unread > 0 && (
              <button className="t-caption text-primary" onClick={markAll}>
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {list.length === 0 && <p className="t-callout px-3 py-6 text-center text-ink-3">No notifications.</p>}
            {list.slice(0, 30).map((n) => (
              <Link
                key={n.id}
                href={n.href?.replace('/intelligence/finding/', '/alerts/') ?? '/alerts'}
                onClick={() => markRead(n.id)}
                className={cn('flex gap-3 rounded-[16px] px-3 py-2.5 hover:bg-sunken', !n.read && 'bg-primary-soft/50')}>
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-primary')} aria-hidden />
                <span className="min-w-0">
                  <span className="t-callout block font-medium">{n.title}</span>
                  <span className="t-caption block text-ink-2">{n.body}</span>
                  <span className="t-telemetry mt-0.5 block text-ink-3">{ago(n.at, now)}</span>
                </span>
              </Link>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Hub tabs: a section's sub-pages (progressive disclosure). */
function HubTabs() {
  const pathname = usePathname();
  const hub = hubFor(pathname);
  if (!hub) return null;
  return (
    <nav aria-label={`${hub.label} sections`} className="no-print mb-5 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {hub.tabs.map((t) => {
        const on = pathname === t.href || (t.href !== hub.root && pathname.startsWith(`${t.href}/`));
        return (
          <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined} className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors', on ? 'bg-pill text-on-pill' : 'text-ink-2 hover:bg-sunken hover:text-ink')}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/* ------------------------------------ Shell ------------------------------------ */

export function AppShell({ children }: { children: ReactNode }) {
  const collapsed = useSettings((s) => s.sidebarCollapsed);
  const setSetting = useSettings((s) => s.set);
  const [moreOpen, setMoreOpen] = useState(false);
  const startTour = useTour((s) => s.start);
  const pathname = usePathname();
  const router = useRouter();
  const welcomed = useSettings((s) => s.welcomed);
  const emergency = pathname.startsWith('/emergency');
  const introSeen = useSettings((s) => s.introSeen);
  // First visit: cinematic introduction, then the mission briefing. Never blocks Emergency.
  useEffect(() => {
    if (emergency) return;
    if (!introSeen && !welcomed) router.replace('/intro');
    else if (!welcomed) router.replace('/welcome');
  }, [welcomed, introSeen, emergency, router]);

  return (
    <div className="min-h-dvh">
      <SpaceBackdrop glow={emergency ? 'critical' : 'default'} />
      <a href="#main" className="sr-only z-[80] rounded-full bg-pill px-4 py-2 text-on-pill focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className={cn('glass fixed inset-y-3 left-3 z-40 hidden flex-col rounded-[30px] transition-[width] duration-300 ease-out lg:flex', collapsed ? 'w-[76px]' : 'w-[248px]')} aria-label="Primary">
        <div className={cn('flex h-16 items-center px-4', collapsed && 'justify-center px-0')}>
          <Link href="/" aria-label="CosmicPulse home">
            {collapsed ? <CosmicMark size={36} /> : <Wordmark size={20} />}
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          {NAV.map((g) => (
            <div key={g.group} className="mt-3 first:mt-0">
              {!collapsed && <p className="t-overline mb-1.5 px-3 text-ink-3">{g.group}</p>}
              <div className="flex flex-col gap-0.5">
                {g.items.map((i) => (
                  <NavLink key={i.href} item={i} collapsed={collapsed} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        {!collapsed && (
          <div className="border-t border-line px-4 py-3">
            <RankMeter compact />
          </div>
        )}
        <div className="border-t border-line p-3">
          <button onClick={() => setSetting('sidebarCollapsed', !collapsed)} className="flex h-9 w-full items-center justify-center gap-2 rounded-full text-[13px] text-ink-3 hover:bg-sunken hover:text-ink" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <ChevronsRight size={16} /> : (
              <>
                <ChevronsLeft size={16} /> Collapse
              </>
            )}
          </button>
        </div>
      </aside>

      <div className={cn('transition-[padding] duration-300 ease-out', collapsed ? 'lg:pl-[100px]' : 'lg:pl-[272px]')}>
        {/* Top bar */}
        <header className="no-print sticky top-0 z-30 px-4 pt-3 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center gap-2">
            <Link href="/" className="lg:hidden" aria-label="CosmicPulse home">
              <span className="hidden sm:inline">
                <Wordmark size={18} />
              </span>
              <span className="sm:hidden">
                <CosmicMark size={34} />
              </span>
            </Link>
            <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
              <span className="hidden sm:block">
                <DataModePill />
              </span>
              <span className="sm:hidden">
                <DataModePill compact />
              </span>
              <span className="hidden md:block">
                <LinkPill />
              </span>
              <span className="md:hidden">
                <LinkPill compact />
              </span>
              <Notifications />
              <button onClick={startTour} aria-label="Guided tour and help" title="Guided tour" className="glass flex size-9 items-center justify-center rounded-full text-ink-2 hover:text-ink">
                <HelpCircle size={17} />
              </button>
              <Link href="/emergency" data-tour="emergency" aria-label="Emergency assistance" className="flex h-9 items-center gap-1.5 rounded-full bg-critical px-3 text-[13px] font-semibold text-white shadow-sm hover:opacity-90">
                <Siren size={16} aria-hidden />
                <span className="hidden sm:inline">Emergency</span>
              </Link>
            </div>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-[1440px] px-4 pt-3 pb-32 sm:px-6 lg:px-8 lg:pb-16">
          <HubTabs />
          {children}
        </main>
      </div>

      {/* Mobile tab bar */}
      <nav className="no-print glass fixed inset-x-3 bottom-3 z-40 flex h-16 items-center justify-around gap-0.5 rounded-full px-1.5 lg:hidden" aria-label="Primary">
        {MOBILE_TABS.map((i) => {
          const active = activeHref(pathname) === i.href;
          const Icon = i.icon;
          return (
            <Link key={i.href} href={i.href} data-tour={i.section ? `nav-${i.section}` : undefined} aria-current={active ? 'page' : undefined} className={cn('flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[10px] font-medium', active ? 'bg-pill text-on-pill' : 'text-ink-2')}>
              <Icon size={19} aria-hidden />
              {i.label}
            </Link>
          );
        })}
        <button onClick={() => setMoreOpen(true)} className="flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[10px] font-medium text-ink-2" aria-label="More sections">
          <Menu size={19} aria-hidden />
          More
        </button>
      </nav>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen} title="All sections">
        <div className="flex flex-col gap-4 pb-4">
          {NAV.map((g) => (
            <div key={g.group}>
              <p className="t-overline mb-1.5 px-3 text-ink-3">{g.group}</p>
              {g.items.map((i) => (
                <NavLink key={i.href} item={i} onNavigate={() => setMoreOpen(false)} />
              ))}
            </div>
          ))}
          <Button variant="critical" icon={Siren} onClick={() => { setMoreOpen(false); router.push('/emergency'); }}>
            Emergency assistance
          </Button>
        </div>
      </Sheet>

      {!pathname.startsWith('/assistant') && !pathname.startsWith('/sentinel') && !emergency && <AssistantDock />}
      <TourOverlay />
      <span className="sr-only" aria-live="polite">
        {ALL_NAV.find((i) => i.href === activeHref(pathname))?.label}
      </span>
    </div>
  );
}

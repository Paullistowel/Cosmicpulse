'use client';

import { cn } from './ui';
import type { RelationGraph } from '@/sentinel/sentinel';

/**
 * Sentinel visual identity: a violet–cyan core inside orbital scan rings.
 * `speaking` intensifies the rings while the briefing plays. Static under
 * reduced motion (CSS media query + data-motion).
 */
export function SentinelOrb({ size = 160, speaking = false, className }: { size?: number; speaking?: boolean; className?: string }) {
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }} aria-hidden>
      <style>{`
        @keyframes sn-spin { to { transform: rotate(360deg); } }
        @keyframes sn-breathe { 0%,100% { transform: scale(1); opacity:.9 } 50% { transform: scale(1.06); opacity:1 } }
        @keyframes sn-ping { 0% { transform: scale(.6); opacity:.55 } 100% { transform: scale(1.35); opacity:0 } }
        .sn-r1 { animation: sn-spin 14s linear infinite; } .sn-r2 { animation: sn-spin 22s linear infinite reverse; }
        .sn-core { animation: sn-breathe 4s ease-in-out infinite; } .sn-ping { animation: sn-ping 1.6s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) { .sn-r1,.sn-r2,.sn-core,.sn-ping { animation: none !important; } }
        :root[data-motion='reduced'] .sn-r1, :root[data-motion='reduced'] .sn-r2, :root[data-motion='reduced'] .sn-core, :root[data-motion='reduced'] .sn-ping { animation: none !important; }
      `}</style>
      {speaking && <span className="sn-ping absolute inset-0 rounded-full border-2 border-[var(--violet)]" />}
      <svg viewBox="0 0 160 160" className="absolute inset-0">
        <defs>
          <radialGradient id="snc" cx="40%" cy="35%" r="70%">
            <stop offset="0" stopColor="#EAF1F8" />
            <stop offset=".35" stopColor="#A99BFF" />
            <stop offset=".75" stopColor="#3A6FD8" />
            <stop offset="1" stopColor="#0B1730" />
          </radialGradient>
          <linearGradient id="snr" x1="0" x2="1">
            <stop offset="0" stopColor="#62D2E6" />
            <stop offset="1" stopColor="#A99BFF" stopOpacity=".2" />
          </linearGradient>
        </defs>
        <g className="sn-r1" style={{ transformOrigin: '80px 80px' }}>
          <circle cx="80" cy="80" r="74" fill="none" stroke="url(#snr)" strokeWidth="1.5" strokeDasharray="4 10" />
          <circle cx="80" cy="6" r="3" fill="#62D2E6" />
        </g>
        <g className="sn-r2" style={{ transformOrigin: '80px 80px' }}>
          <circle cx="80" cy="80" r="60" fill="none" stroke="#A99BFF" strokeOpacity={speaking ? 0.9 : 0.45} strokeWidth="2" strokeDasharray="60 18 8 18" />
        </g>
        <g className="sn-core" style={{ transformOrigin: '80px 80px' }}>
          <circle cx="80" cy="80" r="38" fill="url(#snc)" />
          <path d="M54 82h10l5-10 8 20 6-16 4 6h19" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />
        </g>
      </svg>
    </div>
  );
}

/** Relationship diagram: contributing signals → finding, with the link explained in words. */
export function RelationDiagram({ g }: { g: RelationGraph }) {
  const inputs = g.nodes.filter((n) => n.kind !== 'finding');
  const finding = g.nodes.find((n) => n.kind === 'finding')!;
  const H = Math.max(160, inputs.length * 54 + 20);
  return (
    <figure aria-label={`How ${inputs.map((n) => n.label).join(', ')} relate to ${finding.label}`} className="overflow-x-auto">
      <svg viewBox={`0 0 560 ${H}`} className="w-full min-w-[460px]" role="img">
        {inputs.map((n, i) => {
          const y = 30 + i * 54;
          const link = g.links.find((l) => l.from === n.id);
          const col = n.kind === 'behaviour' ? 'var(--violet)' : 'var(--primary)';
          return (
            <g key={n.id}>
              <path d={`M200 ${y} C 300 ${y}, 300 ${H / 2}, 380 ${H / 2}`} stroke={col} strokeOpacity=".55" strokeWidth="2" fill="none" />
              <rect x="10" y={y - 18} width="190" height="36" rx="18" fill="var(--sunken)" stroke={col} strokeOpacity=".5" />
              <text x="26" y={y + 5} fontSize="13" fill="var(--ink)" fontWeight="600">{n.label}</text>
              {n.z !== undefined && <text x="190" y={y + 5} fontSize="11" textAnchor="end" fill="var(--ink-3)" fontFamily="monospace">z {n.z > 0 ? '+' : ''}{n.z.toFixed(1)}</text>}
              {link && <text x="290" y={y - 6 + (H / 2 - y) * 0.45} fontSize="10" fill="var(--ink-3)" textAnchor="middle">{link.label.length > 34 ? `${link.label.slice(0, 34)}…` : link.label}</text>}
            </g>
          );
        })}
        <rect x="380" y={H / 2 - 26} width="170" height="52" rx="16" fill="var(--warning-soft)" stroke="var(--warning)" />
        <foreignObject x="388" y={H / 2 - 22} width="154" height="44">
          <p className="t-caption font-semibold text-ink" style={{ lineHeight: '14px' }}>{finding.label}</p>
        </foreignObject>
      </svg>
      <figcaption className="t-caption mt-1 text-ink-3">Lines show which of your measurements moved together to produce this finding. Values are robust z-scores against your own baseline.</figcaption>
    </figure>
  );
}

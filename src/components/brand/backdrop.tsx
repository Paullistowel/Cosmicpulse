'use client';

import { useEffect, useRef } from 'react';

/**
 * Living deep-space backdrop behind every screen: three parallax star layers that react to
 * the pointer and to scrolling, occasional shooting stars, drifting nebula light and a
 * distant ringed planet. One lightweight 2D canvas; pauses when the tab is hidden and
 * renders a still frame with reduced motion. Decorative only (aria-hidden).
 */
export function SpaceBackdrop({ glow = 'default' }: { glow?: 'default' | 'critical' }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    if (!g) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
    const dark = () => document.documentElement.dataset.theme !== 'light';
    let w = 0;
    let h = 0;
    let dpr = 1;
    // Seeded so the field is stable between visits.
    let seed = 1969;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const layers = [
      { n: 140, depth: 0.15, size: 0.7, alpha: 0.5 },
      { n: 70, depth: 0.4, size: 1.1, alpha: 0.75 },
      { n: 28, depth: 0.9, size: 1.7, alpha: 0.95 },
    ].map((l) => ({ ...l, stars: Array.from({ length: l.n }, () => ({ x: rnd(), y: rnd(), tw: rnd() * Math.PI * 2, hue: rnd() < 0.18 ? (rnd() < 0.5 ? '#CFC6FF' : '#BFEFFA') : '#FFFFFF' })) }));
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
    let nextShoot = performance.now() + 2500;

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const draw = (now: number) => {
      g.clearRect(0, 0, w, h);
      if (!dark()) return;
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;
      const scroll = window.scrollY;
      for (const l of layers) {
        const ox = pointer.x * 24 * l.depth + (reduced ? 0 : now * 0.0006 * l.depth);
        const oy = pointer.y * 16 * l.depth - scroll * 0.08 * l.depth;
        for (const s of l.stars) {
          const x = (((s.x * w + ox) % w) + w) % w;
          const y = (((s.y * h + oy) % h) + h) % h;
          const tw = reduced ? 1 : 0.6 + 0.4 * Math.sin(now * 0.0015 + s.tw);
          g.globalAlpha = l.alpha * tw;
          g.fillStyle = s.hue;
          g.beginPath();
          g.arc(x, y, l.size, 0, Math.PI * 2);
          g.fill();
          if (l.depth > 0.8) {
            // soft glint on the nearest stars
            g.globalAlpha = 0.18 * tw;
            g.beginPath();
            g.arc(x, y, l.size * 3.2, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
      if (!reduced) {
        if (!shoot && now > nextShoot) {
          shoot = { x: Math.random() * w * 0.7 + w * 0.2, y: Math.random() * h * 0.35, vx: -(6 + Math.random() * 4), vy: 2.5 + Math.random() * 2, life: 1 };
          nextShoot = now + 5000 + Math.random() * 7000;
        }
        if (shoot) {
          const grd = g.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 14, shoot.y - shoot.vy * 14);
          grd.addColorStop(0, `rgba(220,240,255,${0.9 * shoot.life})`);
          grd.addColorStop(1, 'rgba(220,240,255,0)');
          g.globalAlpha = 1;
          g.strokeStyle = grd;
          g.lineWidth = 1.6;
          g.beginPath();
          g.moveTo(shoot.x, shoot.y);
          g.lineTo(shoot.x - shoot.vx * 14, shoot.y - shoot.vy * 14);
          g.stroke();
          shoot.x += shoot.vx;
          shoot.y += shoot.vy;
          shoot.life -= 0.012;
          if (shoot.life <= 0 || shoot.x < -100) shoot = null;
        }
      }
      g.globalAlpha = 1;
    };

    let raf = 0;
    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    if (reduced) draw(0);
    else raf = requestAnimationFrame(loop);

    const onMove = (e: PointerEvent) => {
      pointer.tx = e.clientX / window.innerWidth - 0.5;
      pointer.ty = e.clientY / window.innerHeight - 0.5;
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) raf = requestAnimationFrame(loop);
    };
    const onScroll = () => reduced && draw(0);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(70% 60% at 85% 105%, var(--haze), transparent 70%)' }} />
      {/* drifting nebula light */}
      <div className="nebula nebula-a absolute -top-[20%] -left-[10%] h-[70vh] w-[70vh] rounded-full" />
      <div className="nebula nebula-b absolute top-[35%] -right-[15%] h-[80vh] w-[80vh] rounded-full" />
      {/* distant ringed planet */}
      <div className="dark-only absolute right-[6%] bottom-[8%] hidden lg:block">
        <div className="planet-far relative size-40 rounded-full" />
        <div className="absolute top-1/2 left-1/2 h-10 w-72 -translate-x-1/2 -translate-y-1/2 -rotate-[18deg] rounded-[50%] border-2 border-[#A99BFF]/25" />
      </div>
      <div
        className="absolute inset-x-0 top-0 h-[60vh]"
        style={{ background: glow === 'critical' ? 'radial-gradient(95% 55% at 50% -30%, transparent 55%, color-mix(in srgb, var(--critical) 25%, transparent) 82%, transparent 100%)' : 'radial-gradient(95% 55% at 50% -30%, transparent 55%, var(--limb) 82%, transparent 100%)' }}
      />
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
    </div>
  );
}

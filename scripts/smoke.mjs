#!/usr/bin/env node
/**
 * Browser smoke test: opens every route in headless Chromium, waits for the
 * encrypted vault to hydrate, records console errors / page errors / failed
 * requests, and saves screenshots (desktop + phone).
 *
 *   BASE_URL=http://localhost:3100 CHROME_PATH=... node scripts/smoke.mjs [route ...]
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const OUT = process.env.SHOT_DIR ?? 'test-results/screens';
const ROUTES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['/', '/intro', '/welcome', '/twin', '/sentinel', '/simulator', '/timeline', '/missions', '/achievements', '/station', '/vitals', '/vitals/heart_rate', '/vitals/blood_pressure', '/analytics', '/sleep', '/activity', '/wellness', '/assistant', '/alerts', '/assessments', '/risk', '/risk/isolation', '/research', '/research/osd-575', '/record', '/history', '/medical', '/reports', '/settings', '/emergency'];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
let failures = 0;
for (const vp of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'phone', width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  // Skip the first-run onboarding redirect (tested separately via /welcome).
  await ctx.addInitScript(() => {
    try {
      sessionStorage.setItem('cp.landed', '1');
      const k = 'cosmicpulse.settings.v1';
      const cur = JSON.parse(localStorage.getItem(k) || '{"state":{},"version":2}');
      if (!cur.state.welcomed) localStorage.setItem(k, JSON.stringify({ ...cur, state: { ...cur.state, welcomed: true, introSeen: true, tourDone: true }, version: 2 }));
    } catch {}
  });
  const page = await ctx.newPage();
  for (const r of ROUTES) {
    const errors = [];
    const onConsole = (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`);
    const onPageError = (e) => errors.push(`pageerror: ${e.message}`);
    const onResp = (res) => res.status() >= 500 && errors.push(`HTTP ${res.status()} ${res.url()}`);
    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    page.on('response', onResp);
    try {
      await page.goto(BASE + r, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForSelector('#main', { timeout: 30_000 });
      await page.waitForTimeout(600);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) errors.push(`horizontal overflow ${overflow}px`);
      await page.screenshot({ path: `${OUT}/${vp.name}${r === '/' ? '-home' : r.replaceAll('/', '-')}.png`, fullPage: vp.name === 'desktop' });
    } catch (e) {
      errors.push(`navigation: ${e.message.split('\n')[0]}`);
    }
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('response', onResp);
    const ignorable = errors.filter((e) => !/favicon|Download the React DevTools/.test(e));
    if (ignorable.length) failures++;
    console.log(`${ignorable.length ? 'FAIL' : 'ok  '} ${vp.name.padEnd(7)} ${r}${ignorable.length ? '\n      ' + ignorable.slice(0, 4).join('\n      ') : ''}`);
  }
  await ctx.close();
}
await browser.close();
console.log(failures ? `${failures} route checks failed` : 'all routes ok');
process.exit(failures ? 1 : 0);

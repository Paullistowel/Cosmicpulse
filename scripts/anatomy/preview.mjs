#!/usr/bin/env node
/**
 * Render a transparent still of the anatomical twin for the Home screen
 * (public/images/twin/body-preview.png). Needs the dev server running and Chrome:
 *   BASE_URL=http://localhost:3100 CHROME_PATH=/path/to/chrome node scripts/anatomy/preview.mjs
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1300 }, deviceScaleFactor: 1.5, reducedMotion: 'reduce' });
await ctx.addInitScript(() => localStorage.setItem('cosmicpulse.settings.v1', JSON.stringify({ state: { welcomed: true, introSeen: true }, version: 2 })));
const page = await ctx.newPage();
await page.goto(`${BASE}/twin`, { waitUntil: 'networkidle', timeout: 120_000 });
await page.waitForTimeout(6000);
await page.addStyleTag({ content: 'html,body,body *{background:transparent!important;box-shadow:none!important} body *{visibility:hidden!important} .twin-stage canvas{visibility:visible!important}' });
await page.waitForTimeout(800);
const canvas = page.locator('.twin-stage canvas').first();
await canvas.screenshot({ path: 'public/images/twin/body-preview.png', omitBackground: true });
await browser.close();
console.log('wrote public/images/twin/body-preview.png');

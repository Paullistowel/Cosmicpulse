#!/usr/bin/env node
/**
 * Downloads the NASA Image and Video Library assets used by CosmicPulse into
 * public/images/nasa and writes credits.json (title, NASA ID, centre, date,
 * source URL). API: https://images-api.nasa.gov (public, no key).
 * NASA imagery is generally not copyrighted; NASA does not endorse CosmicPulse.
 * Resizing uses macOS `sips` when available; otherwise originals are kept.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const OUT = resolve(dirname(new URL(import.meta.url).pathname), '../public/images/nasa');
export const ASSETS = {
  treadmill: 'iss018e030101',
  quarters: 'iss054e022260',
  aurora: 'iss058e005282',
  'solar-flare': 'GSFC_20171208_Archive_e001210',
  'mission-control': 'jsc2006e38928',
  cupola: 'iss058e003901',
  mars: 'PIA19679',
  'blood-sample': 'iss071e414653',
  'earth-night': 'iss070e062746',
  'iss-orbit': 's88e5157',
};

mkdirSync(OUT, { recursive: true });
const credits = {};
for (const [key, id] of Object.entries(ASSETS)) {
  const meta = (await (await fetch(`https://images-api.nasa.gov/search?nasa_id=${encodeURIComponent(id)}`)).json()).collection.items[0]?.data[0];
  const files = (await (await fetch(`https://images-api.nasa.gov/asset/${encodeURIComponent(id)}`)).json()).collection.items.map((i) => i.href);
  const pick = files.find((h) => /~large\.jpg$/i.test(h)) ?? files.find((h) => /~medium\.jpg$/i.test(h)) ?? files.find((h) => /~orig\.jpe?g$/i.test(h)) ?? files.find((h) => /\.jpe?g$/i.test(h));
  if (!pick) {
    console.warn(`no jpg for ${id}`);
    continue;
  }
  const url = pick.replace(/^http:/, 'https:').replace(/ /g, '%20');
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const file = `${OUT}/${key}.jpg`;
  writeFileSync(file, buf);
  try {
    // Downscale only (never upscale) to ≤ 1600 px, JPEG quality 72.
    const w = Number(/pixelWidth: (\d+)/.exec(execFileSync('sips', ['-g', 'pixelWidth', file]).toString())?.[1] ?? 0);
    if (w > 1600) execFileSync('sips', ['-Z', '1600', file, '--out', file], { stdio: 'ignore' });
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '72', file, '--out', file], { stdio: 'ignore' });
  } catch {
    /* sips unavailable — keep original */
  }
  credits[key] = { nasaId: id, title: meta?.title, center: meta?.center, dateCreated: meta?.date_created?.slice(0, 10), source: `https://images.nasa.gov/details/${id}`, file: `/images/nasa/${key}.jpg`, license: 'NASA imagery — generally public domain in the U.S.; no NASA endorsement implied.' };
  console.log(`${key}: ${id} (${(buf.length / 1024).toFixed(0)} KB)`);
}
writeFileSync(`${OUT}/credits.json`, JSON.stringify({ retrievedAt: new Date().toISOString(), api: 'https://images-api.nasa.gov', images: credits }, null, 2) + '\n');

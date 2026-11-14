#!/usr/bin/env node
/**
 * Download BodyParts3D source meshes (CC BY-SA 2.1 JP, © 2008 DBCLS) in priority
 * order into .anatomy-cache/stl. Resumable: complete files are skipped, partial
 * files continue with HTTP Range. Run: node scripts/anatomy/fetch.mjs [--max-mb 400]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = path.join(root, '.anatomy-cache/stl');
fs.mkdirSync(out, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'manifest.json'), 'utf8'));
const sizes = JSON.parse(fs.readFileSync(path.join(here, 'stlsizes.json'), 'utf8'));
const BASE = 'https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/main/assets/BodyParts3D_data/stl';
const maxMb = Number(process.argv[process.argv.indexOf('--max-mb') + 1]) || Infinity;
const CONC = 4;

// Priority phases: [structure, max file size MB]. Most visual value per byte first;
// within a phase, small files first. Later phases pick up what earlier ones capped.
const PHASES = [
  ['liver'], ['stomach'], ['spleen'], ['kidneys'], ['pancreas'], ['thymus'], ['eyes'], ['arteries'], ['veins'], ['airway'], ['lungs'], ['heart'],
  ['brain', 13, /white matter|cerebellum|pons|medulla|midbrain, nsn/], ['intestines'],
  ['skin'],
  ['skeleton', 2.5], ['spinalcord'],
  ['muscles', 2.5], ['skeleton'], ['diaphragm'], ['brain'], ['muscles'],
];
const names = Object.fromEntries(Object.values(manifest).flatMap((s) => s.ids.map((id, i) => [id, s.names[i]])));
const jobs = [];
const seen = new Set();
for (const [key, maxMb, rx] of PHASES) {
  const s = manifest[key];
  if (!s) continue;
  const ids = s.ids.filter((id) => !seen.has(id) && (!maxMb || sizes[id] <= maxMb * 1e6) && (!rx || rx.test(names[id]))).sort((a, b) => sizes[a] - sizes[b]);
  for (const id of ids) {
    seen.add(id);
    jobs.push({ id, key, size: sizes[id] });
  }
}
let budget = maxMb * 1e6;
const queue = jobs.filter((j) => (budget -= j.size) >= 0 || maxMb === Infinity);

async function get(job, attempt = 0) {
  const file = path.join(out, `${job.id}.stl`);
  const have = fs.existsSync(file) ? fs.statSync(file).size : 0;
  if (have === job.size) return 'cached';
  try {
    const res = await fetch(`${BASE}/${job.id}.stl`, { headers: have ? { Range: `bytes=${have}-` } : {}, signal: AbortSignal.timeout(15 * 60_000) });
    if (!(res.ok || res.status === 206)) throw new Error(`HTTP ${res.status}`);
    const append = res.status === 206 && have > 0;
    const ws = fs.createWriteStream(file, { flags: append ? 'a' : 'w' });
    for await (const chunk of res.body) ws.write(chunk);
    await new Promise((r) => ws.end(r));
    if (fs.statSync(file).size !== job.size) throw new Error('size mismatch');
    return 'ok';
  } catch (e) {
    if (attempt < 8) {
      await new Promise((r) => setTimeout(r, Math.min(60_000, 2000 * 2 ** attempt)));
      return get(job, attempt + 1);
    }
    return `failed: ${e.message}`;
  }
}

let done = 0;
let bytes = 0;
const t0 = Date.now();
async function worker() {
  while (queue.length) {
    const job = queue.shift();
    const r = await get(job);
    done++;
    bytes += job.size;
    const rate = bytes / 1e3 / ((Date.now() - t0) / 1e3);
    console.log(`[${done}/${jobs.length}] ${job.key.padEnd(11)} ${job.id.padEnd(11)} ${(job.size / 1e6).toFixed(2)}MB ${r}  (${rate.toFixed(0)} kB/s avg)`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
console.log('done');

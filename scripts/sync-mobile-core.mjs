#!/usr/bin/env node
/**
 * Copies the CosmicPulse mobile app's platform-independent TypeScript core
 * (domain model, demo data, Intelligence Engine, shared contract and pure
 * feature helpers) into this web app, unchanged except for a provenance header.
 *
 * The mobile repository is only READ — never written.
 *
 *   MOBILE_APP_PATH=../Aegis npm run sync:mobile        # copy
 *   MOBILE_APP_PATH=../Aegis npm run sync:mobile -- --check   # report drift only
 *
 * Copied files keep their original `@/…` import paths, which resolve here
 * through tsconfig `paths` (`@/*` → `src/*`). `lucide-react-native` is aliased
 * to `lucide-react` (identical icon names) and `@/theme` provides the `Tone`
 * type, so the files compile on the web without edits.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const mobile = resolve(root, process.env.MOBILE_APP_PATH ?? '../Aegis');
const check = process.argv.includes('--check');

/** Directories copied recursively and single files, relative to `<mobile>/src`. */
export const SHARED = {
  dirs: ['data', 'engine'],
  files: [
    'shared/contract.ts',
    'lib/format.ts',
    'lib/analysis.ts',
    'lib/interactions.ts',
    'services/health-integrations/ble/gatt.ts',
    'features/health/vitals.ts',
    'features/health/meta.ts',
    'features/intelligence/intel.ts',
    'features/medical/lib.ts',
    'features/medical/report-model.ts',
    'features/assistant/context.ts',
    'features/emergency/lib.ts',
  ],
};

const HEADER = (rel) =>
  `/* Copied verbatim from the CosmicPulse mobile app (src/${rel}) by scripts/sync-mobile-core.mjs.\n * Edit the mobile original and re-run \`npm run sync:mobile\`; do not edit this copy. */\n`;

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

if (!existsSync(join(mobile, 'src'))) {
  console.error(`Mobile app not found at ${mobile}. Set MOBILE_APP_PATH.`);
  process.exit(1);
}
const srcRoot = join(mobile, 'src');
const list = [...SHARED.dirs.flatMap((d) => walk(join(srcRoot, d))), ...SHARED.files.map((f) => join(srcRoot, f))];
let changed = 0;
const manifest = [];
for (const abs of list) {
  const rel = relative(srcRoot, abs);
  const body = readFileSync(abs, 'utf8');
  const out = HEADER(rel) + body;
  const dest = join(root, 'src', rel);
  const prev = existsSync(dest) ? readFileSync(dest, 'utf8') : null;
  manifest.push({ file: rel, sha256: createHash('sha256').update(body).digest('hex').slice(0, 16) });
  if (prev === out) continue;
  changed++;
  console.log(`${check ? 'DRIFT' : 'copy '} src/${rel}`);
  if (!check) {
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, out);
  }
}
if (!check) writeFileSync(join(root, 'src', 'mobile-core.manifest.json'), JSON.stringify({ source: 'CosmicPulse mobile app', syncedAt: new Date().toISOString(), files: manifest }, null, 2) + '\n');
console.log(`${list.length} shared files, ${changed} ${check ? 'out of date' : 'updated'}.`);
if (check && changed) process.exit(2);

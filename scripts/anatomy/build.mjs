#!/usr/bin/env node
/**
 * Build the CosmicPulse anatomical digital-twin model from BodyParts3D meshes.
 *
 *   node scripts/anatomy/fetch.mjs   # download source STLs (resumable)
 *   node scripts/anatomy/build.mjs   # → public/models/anatomy.glb + anatomy.json
 *
 * Pipeline: parse STL → weld vertices → meshoptimizer simplification to a per-structure
 * triangle budget → merge each structure into one mesh → mm/Z-up to m/Y-up, feet at y=0 →
 * smooth normals → GLB (one named node per structure) → gltfpack meshopt compression.
 * Structures with no downloaded parts are skipped and reported (the app handles that).
 *
 * Source: BodyParts3D, © 2008 Database Center for Life Science (DBCLS), CC BY-SA 2.1 JP.
 * The derived model is therefore also CC BY-SA 2.1 JP (see public/models/CREDITS.md).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MeshoptSimplifier } from 'meshoptimizer';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const cache = path.join(root, '.anatomy-cache/stl');
const outDir = path.join(root, 'public/models');
fs.mkdirSync(outDir, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'manifest.json'), 'utf8'));
const sizes = JSON.parse(fs.readFileSync(path.join(here, 'stlsizes.json'), 'utf8'));

/** Triangle budget per structure (whole model ≈ 330k triangles before compression). */
const BUDGET = {
  skin: 52000, muscles: 110000, skeleton: 90000, brain: 30000, heart: 14000, lungs: 16000, arteries: 6000, veins: 5000,
  liver: 5000, stomach: 3000, intestines: 12000, kidneys: 4000, spleen: 1800, pancreas: 1800, thymus: 1600,
  airway: 5000, eyes: 1600, diaphragm: 4000, spinalcord: 2500,
};

await MeshoptSimplifier.ready;

function readStl(file) {
  const buf = fs.readFileSync(file);
  const n = buf.readUInt32LE(80);
  if (84 + n * 50 === buf.length) {
    const pos = new Float32Array(n * 9);
    for (let t = 0; t < n; t++) {
      const o = 84 + t * 50 + 12;
      for (let k = 0; k < 9; k++) pos[t * 9 + k] = buf.readFloatLE(o + k * 4);
    }
    return pos;
  }
  // ASCII fallback
  const txt = buf.toString('utf8');
  const v = [...txt.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)].flatMap((m) => [+m[1], +m[2], +m[3]]);
  return new Float32Array(v);
}

/** Triangle soup → indexed mesh (welded on a 0.01 mm grid). */
function weld(soup) {
  const map = new Map();
  const verts = [];
  const idx = new Uint32Array(soup.length / 3);
  for (let i = 0; i < soup.length; i += 3) {
    const key = `${Math.round(soup[i] * 100)},${Math.round(soup[i + 1] * 100)},${Math.round(soup[i + 2] * 100)}`;
    let id = map.get(key);
    if (id === undefined) {
      id = verts.length / 3;
      map.set(key, id);
      verts.push(soup[i], soup[i + 1], soup[i + 2]);
    }
    idx[i / 3] = id;
  }
  // drop degenerate triangles
  const keep = [];
  for (let t = 0; t < idx.length; t += 3) if (idx[t] !== idx[t + 1] && idx[t + 1] !== idx[t + 2] && idx[t] !== idx[t + 2]) keep.push(idx[t], idx[t + 1], idx[t + 2]);
  return { pos: new Float32Array(verts), idx: new Uint32Array(keep) };
}

function simplify(mesh, targetTris) {
  const target = Math.max(3, Math.floor(targetTris) * 3);
  if (mesh.idx.length <= target) return mesh;
  let [idx] = MeshoptSimplifier.simplify(mesh.idx, mesh.pos, 3, target, 0.02, ['Prune']);
  if (idx.length > target * 1.6) [idx] = MeshoptSimplifier.simplify(mesh.idx, mesh.pos, 3, target, 0.08, ['Prune']);
  // compact vertices
  const remap = new Int32Array(mesh.pos.length / 3).fill(-1);
  const pos = [];
  const out = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) {
    let r = remap[idx[i]];
    if (r < 0) {
      r = remap[idx[i]] = pos.length / 3;
      pos.push(mesh.pos[idx[i] * 3], mesh.pos[idx[i] * 3 + 1], mesh.pos[idx[i] * 3 + 2]);
    }
    out[i] = r;
  }
  return { pos: new Float32Array(pos), idx: out };
}

function merge(meshes) {
  const nv = meshes.reduce((s, m) => s + m.pos.length, 0);
  const ni = meshes.reduce((s, m) => s + m.idx.length, 0);
  const pos = new Float32Array(nv);
  const idx = new Uint32Array(ni);
  let vo = 0;
  let io = 0;
  for (const m of meshes) {
    pos.set(m.pos, vo);
    for (let i = 0; i < m.idx.length; i++) idx[io + i] = m.idx[i] + vo / 3;
    vo += m.pos.length;
    io += m.idx.length;
  }
  return { pos, idx };
}

function normals(pos, idx) {
  const n = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) { n[i] += nx; n[i + 1] += ny; n[i + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
  }
  return n;
}

// ---------------------------------------------------------------- build structures
const built = {};
const report = {};
for (const [key, s] of Object.entries(manifest)) {
  const parts = [];
  const missing = [];
  for (const id of s.ids) {
    const f = path.join(cache, `${id}.stl`);
    if (fs.existsSync(f) && fs.statSync(f).size === sizes[id]) parts.push(weld(readStl(f)));
    else missing.push(id);
  }
  report[key] = { have: parts.length, of: s.ids.length };
  if (!parts.length) continue;
  const total = parts.reduce((x, p) => x + p.idx.length / 3, 0);
  const budget = BUDGET[key] ?? 4000;
  const simplified = parts.map((p) => simplify(p, Math.max(40, (budget * (p.idx.length / 3)) / total)));
  built[key] = merge(simplified);
  report[key].tris = built[key].idx.length / 3;
  console.log(`${key.padEnd(11)} ${parts.length}/${s.ids.length} parts  ${Math.round(total)} → ${report[key].tris} tris`);
}
if (!Object.keys(built).length) throw new Error('No source meshes found. Run scripts/anatomy/fetch.mjs first.');

// ---------------------------------------------------------------- orient + scale
// BodyParts3D: millimetres, Z up (feet → head), −Y anterior. Target: metres, Y up, +Z anterior.
let min = [Infinity, Infinity, Infinity];
let max = [-Infinity, -Infinity, -Infinity];
const ref = built.skin ? ['skin'] : built.skeleton ? ['skeleton'] : Object.keys(built);
for (const k of ref) {
  const p = built[k].pos;
  for (let i = 0; i < p.length; i += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], p[i + a]); max[a] = Math.max(max[a], p[i + a]); }
}
const cx = (min[0] + max[0]) / 2;
const cy = (min[1] + max[1]) / 2;
// Skin/skeleton reach the soles; otherwise fall back to the BP3D origin (≈ floor level).
const floor = built.skin || built.skeleton ? min[2] : 0;
for (const m of Object.values(built)) {
  const p = m.pos;
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], y = p[i + 1], z = p[i + 2];
    p[i] = (x - cx) / 1000;
    p[i + 1] = (z - floor) / 1000;
    p[i + 2] = -(y - cy) / 1000;
  }
}

// ---------------------------------------------------------------- write GLB
const keys = Object.keys(built);
const chunks = [];
let offset = 0;
const bufferViews = [];
const accessors = [];
const meshes = [];
const nodes = [];
const materials = [];
function addView(arr, target) {
  const bytes = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  const pad = (4 - (bytes.length % 4)) % 4;
  bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target });
  chunks.push(bytes, Buffer.alloc(pad));
  offset += bytes.length + pad;
  return bufferViews.length - 1;
}
for (const k of keys) {
  const { pos, idx } = built[k];
  const nrm = normals(pos, idx);
  const bmin = [Infinity, Infinity, Infinity];
  const bmax = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { bmin[a] = Math.min(bmin[a], pos[i + a]); bmax[a] = Math.max(bmax[a], pos[i + a]); }
  const pa = accessors.push({ bufferView: addView(pos, 34962), componentType: 5126, count: pos.length / 3, type: 'VEC3', min: bmin, max: bmax }) - 1;
  const na = accessors.push({ bufferView: addView(nrm, 34962), componentType: 5126, count: nrm.length / 3, type: 'VEC3' }) - 1;
  const ia = accessors.push({ bufferView: addView(idx, 34963), componentType: 5125, count: idx.length, type: 'SCALAR' }) - 1;
  materials.push({ name: k, pbrMetallicRoughness: { baseColorFactor: [0.8, 0.8, 0.8, 1], metallicFactor: 0, roughnessFactor: 0.6 } });
  meshes.push({ name: k, primitives: [{ attributes: { POSITION: pa, NORMAL: na }, indices: ia, material: materials.length - 1 }] });
  nodes.push({ name: k, mesh: meshes.length - 1, extras: { system: manifest[k].system, layer: manifest[k].layer, label: manifest[k].label } });
}
const bin = Buffer.concat(chunks);
const gltf = {
  asset: { version: '2.0', generator: 'cosmicpulse scripts/anatomy/build.mjs', copyright: 'BodyParts3D, © 2008 DBCLS, CC BY-SA 2.1 JP' },
  scene: 0,
  scenes: [{ nodes: nodes.map((_, i) => i) }],
  nodes, meshes, materials, accessors, bufferViews,
  buffers: [{ byteLength: bin.length }],
};
let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
const jh = Buffer.alloc(8);
jh.writeUInt32LE(json.length, 0);
jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8);
bh.writeUInt32LE(bin.length, 0);
bh.writeUInt32LE(0x004e4942, 4);
const raw = path.join(root, '.anatomy-cache/anatomy.raw.glb');
fs.writeFileSync(raw, Buffer.concat([header, jh, json, bh, bin]));

// meshopt compression; keep named nodes/materials/extras so the app can address structures.
const out = path.join(outDir, 'anatomy.glb');
execFileSync(process.execPath, [path.join(root, 'node_modules/gltfpack/cli.js'), '-i', raw, '-o', out, '-cc', '-kn', '-km', '-ke', '-vp', '14'], { stdio: 'inherit' });

const meta = {
  source: 'BodyParts3D, © 2008 Database Center for Life Science (DBCLS), licensed CC BY-SA 2.1 JP — https://dbarchive.biosciencedbc.jp/en/bodyparts3d/',
  builtAt: new Date().toISOString(),
  structures: Object.fromEntries(Object.entries(manifest).map(([k, s]) => [k, { system: s.system, layer: s.layer, label: s.label, parts: report[k].have, of: report[k].of, tris: report[k].tris ?? 0 }])),
  heightM: Number(((max[2] - floor) / 1000).toFixed(3)),
};
fs.writeFileSync(path.join(outDir, 'anatomy.json'), JSON.stringify(meta, null, 1));
console.log(`\n${out}: ${(fs.statSync(out).size / 1e6).toFixed(2)} MB`);
console.log('missing structures:', Object.entries(report).filter(([, r]) => !r.have).map(([k]) => k).join(', ') || 'none');

#!/usr/bin/env node
/**
 * Builds src/research/data/inspiration4.json from NASA OSDR public files.
 *
 * Sources (public, no authentication; verified 2026-11-14):
 *   OSD-575  LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv
 *   OSD-569  LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv
 * File listing: GET https://osdr.nasa.gov/osdr/data/osd/files/{id}
 * Download:     https://osdr.nasa.gov + study_files[].remote_url
 *
 * The snapshot is bundled so the Evidence section works offline. Values are
 * copied as published (crew are de-identified as C001–C004 by OSDR); the
 * script only reshapes columns and records provenance.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const BASE = process.env.OSDR_API_BASE ?? 'https://osdr.nasa.gov';
const out = resolve(dirname(new URL(import.meta.url).pathname), '../src/research/data/inspiration4.json');

const STUDIES = [
  {
    osd: 'OSD-575',
    file: 'LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv',
    panel: 'Comprehensive metabolic panel (serum)',
    analytes: {
      glucose: ['glucose_value_milligram_per_deciliter', 'Glucose', 'mg/dL'],
      calcium: ['calcium_value_milligram_per_deciliter', 'Calcium', 'mg/dL'],
      sodium: ['sodium_value_millimol_per_liter', 'Sodium', 'mmol/L'],
      potassium: ['potassium_value_millimol_per_liter', 'Potassium', 'mmol/L'],
      creatinine: ['creatinine_value_milligram_per_deciliter', 'Creatinine', 'mg/dL'],
      bun: ['urea_nitrogen_bun_value_milligram_per_deciliter', 'Urea nitrogen (BUN)', 'mg/dL'],
      albumin: ['albumin_value_gram_per_deciliter', 'Albumin', 'g/dL'],
      alkaline_phosphatase: ['alkaline_phosphatase_value_units_per_liter', 'Alkaline phosphatase', 'U/L'],
      total_protein: ['total_protein_value_gram_per_deciliter', 'Total protein', 'g/dL'],
    },
  },
  {
    osd: 'OSD-569',
    file: 'LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv',
    panel: 'Complete blood count (whole blood)',
    analytes: {
      wbc: ['white_blood_cell_count_value_thousand_per_microliter', 'White blood cells', '10³/µL'],
      lymphocytes_abs: ['absolute_lymphocytes_value_cells_per_microliter', 'Lymphocytes (absolute)', 'cells/µL'],
      neutrophils_abs: ['absolute_neutrophils_value_cells_per_microliter', 'Neutrophils (absolute)', 'cells/µL'],
      hematocrit: ['hematocrit_value_percent', 'Haematocrit', '%'],
      platelets: ['platelet_count_value_thousand_per_microliter', 'Platelets', '10³/µL'],
    },
  },
];

function parseCsv(text) {
  const rows = text.replace(/^﻿/, '').trim().split(/\r?\n/).map((l) => l.split(','));
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i]?.trim()])));
}

const DAY_ORDER = ['L-92', 'L-44', 'L-3', 'R+1', 'R+45', 'R+82', 'R+194'];

async function main() {
  const panels = [];
  for (const s of STUDIES) {
    const listing = await (await fetch(`${BASE}/osdr/data/osd/files/${s.osd.replace('OSD-', '')}`, { headers: { Accept: 'application/json' } })).json();
    const files = Object.values(listing.studies)[0].study_files;
    const f = files.find((x) => x.file_name === s.file);
    if (!f) throw new Error(`${s.file} not listed for ${s.osd}`);
    const url = BASE + f.remote_url;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    const rows = parseCsv(await res.text());
    const headers = Object.keys(rows[0]);
    const analytes = [];
    for (const [key, [col, label, unit]] of Object.entries(s.analytes)) {
      if (!headers.includes(col)) {
        console.warn(`skip ${s.osd} ${col} (column not present)`);
        continue;
      }
      const base = col.replace(/_value(_|$)/, '_range_min$1');
      const minCol = headers.find((h) => h === base) ?? headers.find((h) => h.startsWith(col.split('_value')[0] + '_range_min'));
      const maxCol = headers.find((h) => h.startsWith(col.split('_value')[0] + '_range_max') || h.startsWith(col.split('_value')[0] + '_max'));
      const points = rows
        .map((r) => {
          const m = r['Sample Name'].match(/^(C00\d)_.*?_(L-\d+|R\+\d+)(?:_[a-z]+)?$/);
          const v = Number(r[col]);
          return m && Number.isFinite(v) && r[col] !== '' ? { crew: m[1], day: m[2], value: v } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.crew.localeCompare(b.crew) || DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));
      const r0 = rows.find((r) => r[minCol] && r[maxCol]);
      analytes.push({ key, label, unit, refLow: r0 ? Number(r0[minCol]) : undefined, refHigh: r0 ? Number(r0[maxCol]) : undefined, points });
    }
    panels.push({ osd: s.osd, panel: s.panel, file: s.file, fileUrl: url, fileDateCreated: new Date(f.date_created * 1000).toISOString(), analytes });
  }
  const snapshot = {
    title: 'SpaceX Inspiration4 crew clinical blood panels',
    mission: { name: 'SpaceX Inspiration4', start: '2021-09-16', end: '2021-09-18', durationDays: 3, orbit: 'Low Earth orbit', crewSize: 4 },
    timepoints: DAY_ORDER,
    timepointNote: 'L-n = days before launch; R+n = days after return. OSD-575 lists L-92, L-44, L-3, R+1, R+45, R+82 (some files also include R+194).',
    retrievedAt: new Date().toISOString(),
    license: 'NASA OSDR open-access processed data. Acknowledge: "Data are courtesy of the NASA Open Science Data Repository."',
    citations: [
      'Collection of Biospecimens from the Inspiration4 Mission Establishes the Standards for the Space Omics and Medical Atlas (SOMA). Nature Communications (2024). doi:10.1038/s41467-024-48806-z',
      'The Space Omics and Medical Atlas (SOMA) and international astronaut biobank. Nature (2024). doi:10.1038/s41586-024-07639-y',
      'Gebre SG, Scott RT, Saravia-Butler AM, Lopez DK, Sanders LM, Costes SV (2024). NASA Open Science Data Repository: open science for life in space. Nucleic Acids Research 53(D1):D1697–D1710. doi:10.1093/nar/gkae1116',
    ],
    panels,
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(snapshot, null, 1) + '\n');
  console.log(`wrote ${out}: ${panels.map((p) => `${p.osd} ${p.analytes.length} analytes`).join(', ')}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

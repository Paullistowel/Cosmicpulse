import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: ['.next/**', 'node_modules/**', 'public/sw.js', 'next-env.d.ts', 'test-results/**', '.netlify/**', '.anatomy-cache/**'] },
  // Files copied verbatim from the mobile app are linted there (see scripts/sync-mobile-core.mjs).
  { ignores: ['src/data/**', 'src/engine/**', 'src/shared/**', 'src/lib/format.ts', 'src/lib/analysis.ts', 'src/lib/interactions.ts', 'src/features/**', 'src/services/health-integrations/**'] },
];

export default config;

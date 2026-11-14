# Digital twin anatomy

The Digital Twin renders a realistic, layered human model built from **BodyParts3D** (DBCLS,
CC BY-SA 2.1 JP) — anatomical meshes derived from a real human dataset — not a stylised figure.

## Structures and systems

| Layer | Structures (GLB node names) | Twin system |
|---|---|---|
| Skin | `skin` | Temperature & immunity |
| Muscles | `muscles` (110 superficial muscles) | Muscles & bones |
| Skeleton | `skeleton` (317 bones, cartilage, teeth) | Muscles & bones |
| Organs | `heart`, `lungs`, `airway`, `diaphragm`, `brain` (89 parts), `eyes`, `liver`, `stomach`, `intestines`, `pancreas`, `kidneys`, `spleen`, `thymus` | per `src/twin/anatomy.ts` |
| Vessels | `arteries`, `veins` | Heart & circulation |

Status colours (green / amber / red / grey) still come only from `src/twin/systems.ts`
(engine findings + 7-day data availability). The model never invents a status. The heart scales
only at the latest recorded heart rate and the lungs only at the latest breathing rate (≤24 h old).
Reduced motion stops both.

## Rebuilding

```bash
node scripts/anatomy/fetch.mjs        # ~855 MB of STL into .anatomy-cache/ (resumable, gitignored)
node scripts/anatomy/build.mjs        # → public/models/anatomy.glb (~1.5 MB) + anatomy.json
CHROME_PATH=... node scripts/anatomy/preview.mjs   # Home-screen still (dev server running)
```

- `classify.py` maps BodyParts3D FMA parts → structures (`manifest.json`). Edit the regexes or the
  superficial-muscle list there, then re-run fetch + build.
- `build.mjs` → triangle budgets per structure in `BUDGET`. Raising them adds detail and size.
- Missing parts are skipped and reported; the app disables layer toggles for absent structures.

## Runtime

`src/components/twin/anatomy-scene.tsx` (React Three Fiber, lazy-loaded): drei `useGLTF` with the
inline meshopt decoder (no CDN, works offline), physical materials per tissue, Fresnel x-ray skin,
layer toggles, system focus framing, Anatomy / Health-status views, hover labels. If the model
fails to load, the page falls back to the original procedural twin, and without WebGL to the
accessible 2D body map.

## Limitations

- One reference body (BodyParts3D is a single adult male dataset). It is not personalised to the
  astronaut's body shape.
- Muscles are the superficial set only; nerves, lymphatics and small vessels are not included.
- Selection works per body system and structure group, not per individual bone or muscle.

# 3D anatomy credits

`anatomy.glb` is derived from **BodyParts3D**, © 2008 Database Center for Life Science (DBCLS),
licensed under **Creative Commons Attribution-ShareAlike 2.1 Japan (CC BY-SA 2.1 JP)** —
https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en · https://dbarchive.biosciencedbc.jp/en/bodyparts3d/

Source meshes were obtained from the BodyParts3D mirror at
https://github.com/Kevin-Mattheus-Moerman/BodyParts3D (`assets/BodyParts3D_data/stl`).

Changes made by CosmicPulse (`scripts/anatomy/`): 614 of the 934 parts selected and grouped into 18
structures; vertices welded; meshes simplified with meshoptimizer (≈17.1 M → ≈0.37 M triangles);
re-oriented to metres / Y-up; compressed with gltfpack (meshopt). Per the licence, this derived
model is shared under the same CC BY-SA 2.1 JP terms. `anatomy.json` lists every structure and
how many source parts it contains.

`../images/twin/body-preview.png` is a render of this model (same licence).

## International Space Station

`iss.glb` is derived from NASA 3D Resources — "International Space Station (ISS) (D) (IGOAL)"
(https://github.com/nasa/NASA-3D-Resources, https://science.nasa.gov/3d-resources/). NASA 3D
resources are free to use; NASA does not endorse CosmicPulse. CosmicPulse decoded the Draco mesh,
removed textures, merged parts into material groups (solar arrays, iROSA, radiators, truss,
modules, Russian segment, payloads, details), simplified with meshoptimizer (~2.7 M → ~0.2 M
triangles) and compressed with gltfpack (meshopt). Module positions for the station tour are
taken from the model's named nodes.

# Sakura office — independent review

**Result: PASS after visual corrections, 2026-10-07.** The preliminary office
export was held for actual visible assembly defects; the final file below was
independently reimported and rerendered after correction.

Input: `public/models/external-v080/sakura-midrise/sakura-office.glb`

SHA256: `39ffc13b5843e8ffe9d535bb954ab41f4841b8a8bbe6f8833a93e964fad3ca08`

## Measured from final GLB bytes

- 261,248 bytes; 3,599 triangles; 7,218 exported vertices.
- 8 meshes/instances/nodes; 8 materials and 8 primitives.
- No images, textures or external image/buffer dependencies.
- Envelope 11.900000 × 18.879999 × 10.600000 m (X/Y/Z), exact Y=0 ground,
  centered X/Z, +Z front.
- Finite positions/transforms, unit normals, no degenerate triangles and no
  vertex-normal/triangle-winding disagreements.
- Optional `KHR_materials_clearcoat`; no required extensions. Texture UV maps
  are not needed for the scalar-material model.

## Defect found and verified fixed

The prior hash `d7a82f12ceb3cea7f9e1f6f9f8f5dcbe8a6135a55f7d9f35e2b1b9cd384a3bfd`
rendered a very dark horizontal gap below the upper terrace. Source inspection
confirmed a missing supporting slab: the previous lintel ended at height13.22 m
and the thin terrace paving began at13.44 m, with no full-depth slab beneath.
Ground glazing also had an unclosed head gap and an incomplete corner connection.

The author supplied a full terrace support slab spanning height13.21–13.43 m,
recessed lobby head-closure panels, and connected corner/side glazing. The new
final GLB was independently imported and rendered again. The former terrace
gap is visibly closed; the lobby head and corner now read as a continuous
architectural assembly. Counts above belong only to this corrected file.

## Actual Blender and visual check

Fresh Blender 4.3.2 import returned `FINISHED`, preserved 7,218 vertices /
3,599 triangles and exactly matched byte-level world bounds. No geometry,
normal or degeneracy warnings. Input hash was stable throughout the final run.

Independent [front](front.png), [three-quarter](three-quarter.png) and
[roof](roof.png) images were all inspected. Continuous office glazing,
chamfered corner, recessed shared lobby, a single top common terrace and
rooftop access/HVAC distinguish it from the residential model. No obvious
remaining missing/inside-out faces, floating parts or z-fighting were observed.

## Remaining limitations

Opaque glazing, simplified common-space/roof details and inferred dimensions;
no interior simulation, collision mesh or alternate LOD. Eight primitives are
potential material draw submissions per copy. Browser performance, map-scale
fit and actual city placement remain integrating-maintainer checks. No full
project tests, production build, deployment or source changes were performed.

Evidence: [GLB report](glb-report.json),
[Blender import/render report](blender-report.json).

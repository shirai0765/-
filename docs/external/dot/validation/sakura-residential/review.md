> Revision notice — 2026-10-07: SUPERSEDED for architectural fidelity. A later close architectural review found repeated unintended seams at balcony end-wall/slab and end-wall/sidewall junctions. The historical geometry/import pass remains valid, but the original three-view visual review missed these details. Final hash-specific verification targets 8d42f9f83c3a15a2c2df5b5824e62337945ef335abde6c843d647659e07b31a0; intermediate D01.2 evidence is retained separately. The original report and images are preserved in the external QA snapshot; the historic measurements below are unchanged.

# Sakura residential — independent review

**Result: PASS for staged standalone-asset review, 2026-10-07.** The checked
file is the final transform-baked version, not the superseded preliminary export.

Input: `public/models/external-v080/sakura-midrise/sakura-residential.glb`

SHA256: `efe9c02f15c840f69c930153edc2165fddeadba1ce5efd98d9aa4e258899912b`

## Measured from actual GLB bytes

- 489,440 bytes; 6,844 triangles; 13,740 exported vertices.
- 8 meshes/instances/nodes, 8 materials and 8 primitives.
- No images, textures, or external image/buffer dependencies.
- Full envelope 13.800000 × 23.785000 × 11.400000 m (X/Y/Z), centered on
  X=0/Z=0. The lowest Y≈−0.000000059 m is floating-point export precision,
  well within the 1 mm ground tolerance. Declared front +Z is correct.
- Finite positions/transforms and unit normals; no degenerate triangles.
- Optional `KHR_materials_clearcoat` is used, with no required extension.
  This texture-free asset does not need image UV maps.

## Actual Blender and visual check

Fresh Blender 4.3.2 import returned `FINISHED`; 13,740 vertices / 6,844
triangles and world bounds agree with the independent byte inspector. No
invalid normals or degeneracy warnings. Final source hash was unchanged
throughout the completed import-and-render run.

All three independent renders of this exact final GLB were inspected:

- [Front](front.png): balcony rail panels and dividers, repeating apartment
  windows, separate vertical circulation bay, entrance sign and mailbox area.
- [Three-quarter](three-quarter.png): recessed balconies have clear depth;
  side windows, ground-level columns, lobby and timber-toned screening support
  a residential identity distinct from a storefront-only generic box.
- [Roof](roof.png): parapet, roof-access headhouse and small HVAC units are
  readable and seated on the roof.

No obvious missing/inside-out faces, floating parts or z-fighting were seen.
The low-rise entry zone and upper-floor balcony layout remain readable at the
review scale; no texture-dependent detail is needed to distinguish the use.

## Limitations / integration checks

- Opaque glazing, simplified apartment/common-space details and inferred
  dimensions. No interiors, collision mesh or alternate LOD in this file.
- The rooftop's simple planar access/service areas are intentionally sparse.
- Eight primitives are potential draw submissions per copy. Repeated-scene
  frame time and placement still require browser/in-city checks.
- No application source or street data was changed; no full-project tests,
  production build or deployment was performed.

Evidence: [GLB report](glb-report.json),
[Blender import/render report](blender-report.json).

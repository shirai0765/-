> Revision notice — 2026-10-07: SUPERSEDED for architectural fidelity. A later close architectural review found rear AC fan facing, a roof-bound stair/slab conflict and missing tenant access doors. The historical geometry/import pass remains valid, but the original three-view visual review missed these details. New hash-specific verification targets 4b0dabe359f0005f91e35192263ea03bca9a820bb32b6270081d4e14770a4835. The original report and images are preserved in the external QA snapshot; the historic measurements below are unchanged.

# Dogenzaka Sakamichi A — independent review

**Result: PASS for staged standalone-asset review, 2026-10-07.** Browser
performance and in-city placement are not covered.

Input: `public/models/external-v080/dogenzaka-mixed/dogenzaka-sakamichi-a.glb`

SHA256: `0af2d0da21b9868e7017a3625eaf152f3c565f43baad1ac84637b597e1078a20`

## Measured from actual GLB bytes

- 802,896 bytes; 10,894 triangles; 20,348 exported vertices.
- 1 mesh / 1 instance / 1 node; 11 materials and 11 primitives.
- One embedded PNG sign atlas, 1024 × 1024 pixels. No external image/buffer
  dependencies; Blender also reports the texture packed at 1024 × 1024.
- World dimensions: 8.340000 × 22.740000 × 10.855000 m (X/Y/Z).
  Ground Y=0, footprint envelope exactly centered at X=0/Z=0, front +Z.
- Finite positions and transforms; unit normals; zero degenerate triangles.
  UVs are present for the sign atlas. No glTF extensions required or used.

## Actual Blender and visual check

Fresh Blender 4.3.2 import returned `FINISHED`, preserved 20,348 vertices /
10,894 triangles, and exactly reproduced the world-space bounds. No import,
normal or degeneracy errors. Input hash remained unchanged during review.

The exact imported GLB was rendered and all independent images were inspected:

- [Front](front.png): narrow mixed-use proportions, floor-specific tenant
  bands, shop entry and separate stair entrance read clearly.
- [Three-quarter](three-quarter.png): stairs, guardrails, recessed balconies,
  air-conditioner units and a consistent slab rhythm give real facade depth.
- [Roof](roof.png): roof access volume, ventilation/HVAC units, parapet and
  service routing are visible and connected to the building.

No obvious missing/inside-out faces, floating components or z-fighting were
observed. Sign texture orientation and assignment appear correct. The small
Japanese/Latin tenant lettering naturally becomes unreadable at distant scales;
colored sign bands and silhouette remain legible.

## Limitations / integration checks

- Stairs are illustrative scenery, not a navigable or code-compliant stair
  simulation. Glass is opaque; no interiors or collision/interaction system.
- The largely plain party walls suit attached urban frontage; the rear and
  roof details, dimensions and fictional signage are illustrative.
- This is the full-detail mesh, with 11 potential material draw submissions
  per copy. No alternate LOD is included in this checked file.
- No application source, full-project tests/build, city layout or deployment
  was changed or run by this review.

Evidence: [GLB byte report](glb-report.json),
[Blender import/render report](blender-report.json).

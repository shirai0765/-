# D01 standalone-asset QA summary

**2026-10-07: all six building designs and the terraced alternate LOD pass
independent standalone GLB, Blender import, and three-view visual review.**

This is explicitly **not** a full-project test pass, Windows/WebGL benchmark,
city-placement approval, production build, or deployment. No author asset,
application source, game data or street placement was edited by this reviewer.

## Final measured files

| Asset | Bytes | Triangles | Export vertices | Materials / primitives | Images | Review |
|---|---:|---:|---:|---:|---|---|
| Crossing retail | 506,364 | 5,425 | 11,494 | 13 / 13 | 0 | [Pass](crossing-retail/review.md) |
| Dogenzaka Sakamichi A | 802,896 | 10,894 | 20,348 | 11 / 11 | 1 embedded 1024² PNG | [Pass](dogenzaka-sakamichi-a/review.md) |
| Dogenzaka Akari B | 543,524 | 6,868 | 12,996 | 11 / 11 | 1 embedded 1024² PNG | [Pass](dogenzaka-akari-b/review.md) |
| Sakura residential | 489,440 | 6,844 | 13,740 | 8 / 8 | 0 | [Pass](sakura-residential/review.md) |
| Sakura office | 261,248 | 3,599 | 7,218 | 8 / 8 | 0 | [Pass after correction](sakura-office/review.md) |
| Terraced retail | 2,035,052 | 27,446 | 58,018 | 13 / 13 | 0 | [Pass after correction](terraced-retail/review.md) |
| Terraced retail LOD1 | 736,132 | 10,306 | 20,744 | 10 / 10 | 0 | [Pass](terraced-retail-lod1/review.md) |

The six full-detail models total **4,638,524 bytes**, **61,076 triangles**,
**123,814 exported vertices**, and **64 material primitives** for one of each.
Including the optional LOD file, download size is **5,374,656 bytes**. Do not
count full and LOD1 as simultaneously rendered copies of the same building.
Material primitive counts are potential draw submissions, not a frame-rate
measurement or a guarantee of renderer batching/instancing.

## What was actually checked

- Final writer handoffs pinned by SHA256; all seven current GLB hashes were
  rechecked against independent reports after final corrections.
- GLB headers/chunks, embedded buffer/image data, accessor counts, positions,
  indices, finite values, unit normals, normal/winding agreement, UV presence
  for textured primitives, node transforms and actual world bounds.
- All GLBs use +Y up, documented +Z frontage and bottom-centered placement.
  Ground matches Y=0 within 1 mm; the only nonzero final ground is negligible
  floating-point noise on Sakura residential. Crossing's decorative envelope
  differs slightly from its declared main-footprint center, as documented.
- Zero reported invalid geometry/normals/indices, zero degenerate triangles,
  zero normal/winding disagreements and no external image/buffer dependencies.
- Actual fresh-scene imports in **Blender 4.3.2**, followed by **21 final
  independent renders**: front, three-quarter and roof for each GLB. Every
  final image was inspected; rendering success alone was not acceptance.
- Dogenzaka texture images are genuinely embedded and packed on import.
  Each is 1024 × 1024 pixels / 75,485 encoded PNG bytes. Other files use no
  textures. Optional clearcoat occurs on Sakura assets; no required extensions.
- Author manifest hashes/bytes/triangles/vertices/materials/primitives/meshes
  agree with separately measured reports and current files. See
  [manifest consistency](manifest-consistency.json).
- The validator itself has **11 passing focused self-tests** plus an actual
  cube export/import/render smoke test. These are not application tests.

## Quality corrections before acceptance

- Independent review identified a missing terrace support slab and unclosed
  lobby glazing head/corner on the initial Sakura office. The author corrected
  them; the exact replacement GLB was imported, rendered and visually checked.
- Dogenzaka's author added missing side service doors at Akari B stair landings
  and corrected rear AC facing before final acceptance. Revised bytes received
  a fresh independent import/render check.
- Terraced retail's author corrected an incomplete upper stair landing and
  added supported landings/recessed entries. Both replacement full/LOD files
  received new independent import/render checks.
- The final accepted models preserve distinct massing, entrances, balcony or
  terrace depth, floor rhythm, roof plant and material identity. Acceptance was
  not based only on minimizing polygons.

## Integration work intentionally left open

1. Place each original asset in a test city and check meters/lot footprint,
   daylight/material appearance, orientation and street clearance.
2. Measure Windows browser frame time and memory with the intended number of
   repeated buildings; choose LOD thresholds from the actual camera/display.
3. Check terraced LOD transitions for popping. It retains the large silhouette
   and terrace/stair arrangement while removing fine seams/roof/foliage details.
4. Treat glass as intentionally opaque and stairs as illustrative scenery.
   No navigable interiors, collision/egress certification or animations are
   supplied. Dimensions and unseen surfaces are inferred, not surveyed.
5. Perform maintainer-owned application tests, build and any separately approved
   release steps. No such execution is represented by this QA result.

Machine-readable final hash/metrics inventory: [summary-D01.json](summary-D01.json).

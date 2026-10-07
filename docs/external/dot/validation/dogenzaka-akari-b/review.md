# Dogenzaka Akari B — independent review

**Result: PASS for staged standalone-asset review, 2026-10-07.** This is the
revised export with service doors at exterior stair landings.

Input: `public/models/external-v080/dogenzaka-mixed/dogenzaka-akari-b.glb`

SHA256: `484c926c4cfb1a5de45c1826e7f46ccb655a7fb609342a9eead6e7b854550888`

## Measured from final GLB bytes

- 543,524 bytes; 6,868 triangles; 12,996 exported vertices.
- 1 mesh / 1 instance / 1 node; 11 materials and 11 primitives.
- One embedded PNG sign atlas, 1024 × 1024 pixels; imported image is packed.
  No external image/buffer dependency. UVs are present for its material.
- Envelope 8.432516 × 21.360001 × 11.325000 m, exactly grounded at Y=0,
  centered X/Z and +Z front.
- Finite geometry/transforms and unit normals; zero degenerate triangles and
  zero normal/winding disagreements. No glTF extensions required or used.

## Actual Blender and visual check

The author caught that the preliminary side stair landings lacked visible
service doors and revised the file before final acceptance. The final GLB
above was independently imported and rendered after that change.

Fresh Blender 4.3.2 import returned `FINISHED`; its 12,996 vertices / 6,868
triangles, world-space bounds, 11 materials and packed 1024² image match the
byte-level check. No geometry warnings. Hash was unchanged during validation.

All three independent final-GLB images were inspected:

- [Front](front.png): brown vertical frame, differentiated tenant signs,
  striped bakery awning, separate access door and upper setback are legible.
- [Three-quarter](three-quarter.png): steel stairs now meet visible service
  doors; landings, guardrails and support posts form a coherent scenery assembly.
- [Roof](roof.png): setback room, rooftop water tank, HVAC and planting are
  visible. Side stairs and upper doors remain readable from this angle.

No obvious missing/inside-out faces, floating parts, flipped sign textures or
z-fighting were observed. This is visibly distinct from Sakamichi A in color,
street entrance/awning, floor rhythm, stair placement and roof silhouette.

## Remaining limitations

Stairs are visual scenery, not a navigable/code-compliant egress simulation.
Glass is opaque and dimensions/rear/roof details are inferred. Small sign
lettering disappears at distance, leaving colored tenant bands. This file has
no alternate LOD or collision mesh; 11 material primitives remain potential
draw submissions. Browser performance and placement are not tested. No full
project tests/build, street data changes or deployment were performed.

Evidence: [GLB report](glb-report.json),
[Blender import/render report](blender-report.json).

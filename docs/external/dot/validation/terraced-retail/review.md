# Terraced retail — independent review

**Result: PASS for staged standalone-asset review, 2026-10-07.** The full-detail
asset below is checked independently; its LOD1 has a separate report.

Input: `public/models/external-v080/terraced-retail/terraced-retail.glb`

SHA256: `2e46e672f10eaecdf42fd18c1f82dc90174cc6162d6f4772617843cd80eb0d31`

## Measured from actual GLB bytes

- 2,035,052 bytes; 27,446 triangles; 58,018 exported vertices.
- 13 meshes/instances/nodes; 13 materials and 13 primitives.
- No images, textures or external buffer/image dependencies.
- Envelope 60.038002 × 89.800003 × 50.071999 m (X/Y/Z), X/Z centered,
  exact Y=0 ground and documented +Z frontage.
- Finite positions/transforms; unit vertex normals; no zero-area triangles
  and no vertex-normal/triangle-winding disagreements.
- No glTF extensions. No image UV mapping is needed for scalar PBR materials.

## Pre-final correction

The author identified an upper stair flight without a complete landing during
review. The final bytes above add supported facade landings and recessed entry
openings. This corrected full/LOD pair was independently imported and rendered
again; all new views were pixel-inspected before final acceptance. The stair
assembly remains illustrative scenery, not a navigable/egress-certified model.

## Actual Blender and visual check

Fresh Blender 4.3.2 import returned `FINISHED`, preserving 58,018 vertices /
27,446 triangles and matching world bounds. No normal or degeneracy warnings.
The input SHA256 remained unchanged throughout import and rendering.

All three independent final-GLB renders were inspected:

- [Front](front.png): staggered solid volumes, narrow glazed recesses and
  planted terrace bands form an identifiable retail podium below the tower.
  Street-level entries, door divisions, signs and external stairs remain visible.
- [Three-quarter](three-quarter.png): terrace depth and connected level
  changes are legible; the tower sits convincingly on the shared upper deck.
- [Roof](roof.png): tower plant enclosure, HVAC arrays, parapets, terrace
  planters and upper-deck furnishing are visible without obvious broken joins.

No obvious missing/inside-out faces, floating parts or z-fighting were seen.
The massing and setbacks are retained by geometry rather than a flat facade
texture. Fine foliage and guardrails are small at district-view scale, as expected.

## Limitations / integration checks

- This is an illustrative reconstruction, not a measured replica. The 89.8 m
  full height and inferred footprint must be checked against intended map scale.
- Opaque glass, non-navigable exterior stairs, simplified roofs/back walls,
  and no interiors/collision/animation system.
- Thirteen material primitives are potential draw submissions. LOD1 is
  supplied for distance use but its activation/threshold is not integrated.
- Repeated-scene frame time, material daylight match and city placement are
  still integrating-maintainer checks. No full-project test/build/deploy ran.

Evidence: [GLB report](glb-report.json),
[Blender import/render report](blender-report.json),
[LOD1 review](../terraced-retail-lod1/review.md).

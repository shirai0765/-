# Terraced retail LOD1 — independent review

**Result: PASS as a staged distance-LOD candidate, 2026-10-07.** Automatic
LOD switching is not part of this independent asset handoff.

Input: `public/models/external-v080/terraced-retail/terraced-retail-lod1.glb`

SHA256: `aa3af99201e0d0f2e4f44a29ccab0d3feb78c766e9ec47c5d25c53781852b93d`

## Measured from actual bytes and Blender import

- 736,132 bytes; 10,306 triangles; 20,744 exported vertices.
- 10 meshes/instances/nodes; 10 materials and 10 primitives.
- No images, textures, external dependencies or glTF extensions.
- Envelope 60.000000 × 89.800003 × 50.071999 m, centered X/Z,
  exact ground Y=0 and front +Z. Compared with full detail, omitted facade
  strips remove only 0.038002 m of total X width; height and depth match.
- Finite positions/transforms and unit normals; no degenerate triangles or
  normal/winding disagreements. No texture UV map is needed.
- Actual fresh Blender 4.3.2 import returned `FINISHED`; 20,744 vertices /
  10,306 triangles and world-space bounds match the binary inspector. No
  geometry warnings. Source SHA256 remained unchanged during rendering.

## Pre-final correction

The author identified an upper stair flight without a complete landing during
review. The final bytes above add supported facade landings and recessed entry
openings. This corrected full/LOD pair was independently imported and rendered
again; all new views were pixel-inspected before final acceptance. The stair
assembly remains illustrative scenery, not a navigable/egress-certified model.

## Visual comparison

Independent [front](front.png), [three-quarter](three-quarter.png), and
[roof](roof.png) renders were inspected alongside the
[full-detail review](../terraced-retail/review.md).

The staggered podium/tower silhouette, terrace depths, planted bands, storefront
openings and exterior stair routes remain recognizable. Small facade seams,
sign lettering, fine rails and rooftop fan details are intentionally reduced.
The main massing and roof volumes do not collapse into a featureless box.
No obvious missing surfaces, inverted faces or floating pieces were seen.

Relative to full detail, LOD1 reduces triangles by **62.45%**, GLB bytes by
**63.83%**, and material primitives from **13 to 10**. These measured reductions
do not establish a particular browser frame-rate improvement.

## Integration checks still needed

Choose the LOD switching distance based on the actual camera and display size.
Check whether the slight edge/detail difference causes visible popping. Glass
remains opaque, stair geometry remains non-navigable, and inferred dimensions
need the same map-scale review as full detail. No application source, scene
placement, full-project tests/build or deployment was changed or performed.

Evidence: [GLB report](glb-report.json),
[Blender import/render report](blender-report.json).

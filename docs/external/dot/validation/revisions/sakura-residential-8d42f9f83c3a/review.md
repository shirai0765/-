# Sakura residential D01.3 — independent roof and seam verification

**2026-10-07: PASS for the authorized roof-interface correction and retained
balcony end-wall closures.** Standalone geometry/import checks also pass.

Final GLB SHA256:
`8d42f9f83c3a15a2c2df5b5824e62337945ef335abde6c843d647659e07b31a0`

D01.2 predecessor SHA256:
`1b2c14220e485a19177f19184c4a221fddd81446dff8ac968d08d390673b69e6`

The [D01.2 review](../sakura-residential-1b2c14220e48/review.md) remains historical:
it verified the end-wall closures and identified the separate roof-edge black
line. Root then authorized the smallest roof-interface correction. The author
preserved D01.2 before changing the two side parapets. Nothing in this report
silently replaces the earlier evidence or expands the acceptance scope.

## Exact scope, independently checked in exported bytes

The side parapet bottoms moved from Y=21.160 m to the roof-slab top at
Y=21.235 m. Their tops remain Y=21.960 m, and X/Z extents are unchanged.
The removed 75 mm overlap volume was already inside the roof slab, so the
intended solid union and outer silhouette are preserved.

A separate old/new accessor comparison found only **16 POSITION records and
16 generated UV records** changed. Every changed position keeps its X/Z and
raises only its Y from 21.160 to 21.235 m. glTF JSON metadata, materials,
indices, topology and normals are identical. See
[independent scope diff](independent-scope-diff.json).

## Technical result on the final hash

- 489,440 bytes; 6,844 triangles; 13,740 vertices; 8 materials/primitives.
- Envelope unchanged: 13.800000 × 23.785000 × 11.400000 m.
- +Y up, +Z front, centered X/Z; minimum ground Y≈−0.000000059 m is float noise.
- No textures or external dependencies; finite positions/transforms, unit
  normals, valid indices, zero degenerate triangles and winding disagreements.
- Fresh Blender 4.3.2 import returned `FINISHED` and matches measured counts
  and bounds. The final hash remained stable through checks and rendering.

Evidence: [GLB report](glb-report.json), [Blender import report](blender-report.json).

## Roof overlap proof and visual A/B

An independent triangle-clipping check selected outward X-side roof triangles
around |X|=6.6–6.8 m and Y=21.0–22.1 m. It computed positive-area intersections
only for coplanar triangle pairs, rather than inferring an overlap from pixels.

- D01.2: 6 overlapping triangle pairs; summed overlap area **1.605016 m²**,
  approximately 0.802508 m² per side.
- D01.3: **0 overlapping pairs and 0 m²** in the same sampled roof-side region.

The clipping helper's identity, shared-edge-only, and reversed-winding cases
were checked before use. These are focused geometric helper checks, not an
application test suite. Reports:
[predecessor](predecessor-roof-coplanarity.json), [final](roof-coplanarity.json).

The final GLB was then imported and rendered with the exact camera, lighting,
orthographic scale, resolution and sample count used for the earlier roof closeup.
Pixel inspection of [D01.3 roof interface](roof-interface.png) against
[D01.2 same-camera view](../sakura-residential-1b2c14220e48/upper-balcony-roof-junction.png)
confirms that the black outer roof-edge line is gone. The parapet top and balcony
silhouette remain in the same positions. This A/B supports the targeted visual
correction; it does not diagnose every potential artifact in the building.

## Prior seam fix retained

All **24 of 24** isolated actual-mesh end-wall probes still pass on D01.3:
six levels × two outer ends × upper/back junction samples. The probes specifically
require the intended mineral-plaster surface and avoid the neighboring common
spine. See [repeated seam probes](architecture-probes.json). Their original
pre-seam negative control, retained with D01.2, met 0 of 24 expectations.

The D01.2 full-model and three balcony closeup images remain that version's
evidence. D01.3's additional rendered proof is the targeted roof closeup; its
unchanged envelope and narrowly restricted edits are separately verified above.

## Reproduction and limitations

Run the unchanged `inspect_glb.py` and `validate_blender.py` on the final hash.
Run `validate_architectural_revision.py --kind residential --revision corrected
--no-render` to repeat the 24 seam probes. Run
`scripts/external-v080/validation/check_roof_coplanarity.py` with this GLB,
`--sha256`, and `--output`; under Blender add `--render-roof` for the same-camera
closeup. Scripts require explicit paths and never rewrite the input GLB.

Opaque glazing, inferred dimensions, simplified non-navigable interiors and
intersecting details elsewhere remain documented asset limitations. No whole
building watertightness, collision/egress compliance, runtime FPS, browser
integration, full-project tests, build or deployment is certified here. Office
and other buildings were not edited by this reviewer.

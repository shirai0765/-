# Sakura residential seam correction — independent versioned review

**2026-10-07: PASS for the targeted12end-wall seam closures and standalone
GLB import, with a separate pre-existing roof-edge observation below.**

Corrected GLB SHA256:
`1b2c14220e485a19177f19184c4a221fddd81446dff8ac968d08d390673b69e6`

Predecessor SHA256:
`efe9c02f15c840f69c930153edc2165fddeadba1ce5efd98d9aa4e258899912b`

## Why the previous visual acceptance is superseded

The predecessor passed real geometry/import checks, but its three-view visual
review missed repeated unintended seams between balcony end walls and the
next slab/side wall. The new close review treats those as actual assembly
defects, not merely an artistic difference. Historical measurements/images
remain available with an explicit notice and an exact external QA archive.

Only12outer end-wall boxes were authorized to change. Their X ranges remain
−4.48…−4.32m and6.16…6.32m. Rear edges extend fromZ3.55 to3.42m, overlapping
the backing wall that ends at3.46m; front edges remainZ5.47m. The upper edges
reach5mm into the next slab underside, including the last roof underside at
Y21.005m. Internal dividers and open balcony fronts are retained.

## Independent technical result

- 489,440bytes,6,844triangles,13,740vertices;8materials/primitives, no textures.
- Cost/envelope unchanged:13.800000×23.785000×11.400000m; +Zfront, centeredX/Z.
  MinimumY≈−0.000000059m is floating-point noise within the1mm tolerance.
- Finite positions/transforms, unit normals, valid indices, zero degenerate
  triangles and zero normal/winding disagreements. No external dependencies.
- Fresh Blender4.3.2 import returned `FINISHED`; counts and world bounds match
  the independent byte parser. Source hash remained stable throughout review.

## Targeted actual-mesh proof

The reviewer raycast the final imported GLB at the former upper and rear gap
positions on each of the12end walls:6levels×2ends×2junction locations=24probes.
Every corrected ray hits the intended mineral-plaster end-wall surface. Identical
probes on the archived predecessor return **0/24** corrected expectations; the
newGLB returns **24/24**.

Left-end rays start after the neighboring charcoal common-spine face and require
the expected plaster material. This isolates the end wall instead of accidentally
counting the adjacent circulation wall as a successful closure. The lower/rear
and upper sample coordinates are recorded in the machine report. These samples
establish the targeted continuity, not whole-building watertightness.

Evidence: [corrected probes](architecture-probes.json),
[predecessor negative control](predecessor-probes/architecture-probes.json).

## Pixel inspection and residual observation

All six new images from the corrected GLB were inspected:

- Full [front](front.png), [three-quarter](three-quarter.png), [roof](roof.png).
- [Right junctions](right-balcony-junctions.png) and
  [left junctions](left-balcony-junctions.png): outer end walls meet slabs and
  rear walls continuously. Open balcony fronts and intentionally shorter internal
  dividers remain visible.
- [Top-floor roof junction](upper-balcony-roof-junction.png): corrected end wall
  meets the roof soffit. This closeup also shows a separate black line at the outer
  roof parapet/slab interface. Source dimensions suggest coplanar outer faces with
  a75mm overlap, rather than the requested end-wall gap. It is a pre-existing
  rendering/assembly observation outside this narrowly authorized correction;
  author confirmed the geometric overlap and verified that this region was unchanged
  between versions. The exact shading mechanism would require a separate A/B
  cleanup test. No additional roof edit was made or approved here.

Accordingly this report approves the specified end-wall closure, **not a claim
of flawless architecture at every scale**. The residual roof-edge appearance
should be reviewed in the intended renderer before a broader fidelity sign-off.

## Reproduction and scope

Use unchanged `inspect_glb.py` and `validate_blender.py` with the corrected hash.
Then run `scripts/external-v080/validation/validate_architectural_revision.py`
with `--kind residential --revision corrected`, explicit input/output paths.
Use the archived oldGLB and `--revision previous --no-render` for the negative
control. All probe coordinates are glTF metres, converted by the script for the
actual Blender import.

Original author and QA files are preserved outside the repository with hash
ledgers; the historical QA now carries an explicit supersession notice. No
office geometry/materials or other models were changed by this reviewer. No
navigation/collision certification, game/browser benchmark, global tests,
application source modification, remote write, build or deployment took place.

Machine evidence: [GLB report](glb-report.json),
[Blender report](blender-report.json).

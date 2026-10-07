# Crossing retail — independent review

**Result: PASS for staged standalone-asset review, 2026-10-07.** This is not
approval to merge/place the asset or a browser/application regression result.

Input: `public/models/external-v080/crossing-retail/crossing-retail.glb`

SHA256: `abcc001472351218f4f2903dc6d839eea003c63b0f8ed7a9665c0e477f171467`

## Measured from actual GLB bytes

- 506,364 bytes; 5,425 triangles; 11,494 exported vertices.
- 1 mesh / 1 instance / 1 node, 13 materials and 13 primitives.
- 0 images and 0 textures; no external image/buffer dependency.
- World bounds, metres: X −15.185000…15.185000; Y 0…40.790001;
  Z −12.900000…12.875299. Full envelope 30.370001 × 40.790001 × 25.775299 m.
- The footprint center is X=0 and Z≈−0.01235 m. This small envelope asymmetry
  comes from facade/canopy details; the declared main-footprint bottom-center
  origin is sensible. Ground is exactly Y=0.
- Finite positions/transforms and unit normals; zero degenerate triangles.
- No required or optional glTF extensions. UVs are not required by this
  texture-free scalar-material asset.

## Actual Blender check

Imported the final GLB into a fresh Blender 4.3.2 scene. Import returned
`FINISHED`; geometry remained 11,494 vertices / 5,425 triangles. World bounds
converted back from Blender Z-up exactly match the byte-level glTF Y-up bounds.
Material count remains 13. No import errors, invalid normals, or degeneracy
warnings. Source SHA256 remained unchanged throughout validation.

Independent CPU Cycles renders use original imported materials, neutral daylight,
and an added review-only ground plane. All three images were inspected:

- [Front](front.png): +Z frontage faces the camera. Screen/sign geometry,
  curtain-wall divisions, low-floor bracing, doors and canopies are readable.
- [Three-quarter](three-quarter.png): curved/chamfered frontage has visible
  depth; side panels and roofline join without obvious gaps or floating parts.
- [Roof](roof.png): parapets, ventilation plant and roof volumes are legible.

No visibly missing/inside-out faces or obvious z-fighting were observed at the
review scale. This goes beyond a triangle-count-only acceptance: the facade,
entrances, billboard composition, corner shaping and roof plant all remain
recognizable.

## Limitations / integration checks

- Glass is deliberately opaque. There is no visible interior, actual video
  screen, emission-based night design, collision mesh, or alternate LOD.
- Side/rear walls are materially simpler than the primary frontage; roof
  equipment and dimensions are inferred rather than survey-accurate.
- Some fine facade strips are open surfaces; watertight solid geometry is not
  an acceptance condition for these visual scenery assets.
- Thirteen material primitives are potential draw submissions per copy.
  Browser frame rate, repeated-building cost, lighting match and city placement
  must be checked by the integrating maintainer. No full build/test/deploy ran.

Machine evidence: [GLB report](glb-report.json),
[Blender import and render report](blender-report.json).

# AXIS Culture House — D01 crossing-retail draft

An original, independent corner-commercial exterior inspired by the architectural
rhythm of QFRONT at Shibuya Crossing. It is **not a measured reconstruction** and
contains no real tenant names, logos, photo textures or third-party mesh data.

## Review

- [Front](previews/front.png)
- [Oblique, showing the long glazed flank](previews/oblique.png)
- [Roof and service details](previews/roof.png)
- [Actual exported-file measurements](metrics.json)
- [Source observations and rights](references.md)
- [Machine-readable handoff](manifest.json)

The broad, shallow convex front, slender continuous aluminium grid, integrated
large screen, double-height retail plinth, projecting corner awning, glass crown,
side floodlight brackets and setback rooftop plant establish the building's
identity. The screen's fictional `CITY / IN MOTION` artwork is original geometry.

## Files

- `public/models/external-v080/crossing-retail/crossing-retail.glb`: browser asset,
  a single mesh batched by material.
- `public/models/external-v080/crossing-retail/crossing-retail-author.blend`:
  full-size editable source, organised in semantic mesh groups, with review
  lighting and camera. The preview floor/lights/camera are excluded from GLB.
- `scripts/external-v080/crossing-retail/generate.py`: deterministic geometry,
  materials, typography, export, actual-file metric extraction and Blender
  re-import check. Uses Blender's bundled font; no downloaded dependencies.

Regenerate from repository root:

```sh
blender -b -t 2 --python scripts/external-v080/crossing-retail/generate.py
```

For an export/source rebuild without the three previews:

```sh
blender -b -t 2 --python scripts/external-v080/crossing-retail/generate.py -- --skip-render
```

## Verification

Independent import, binary audit and three render inspections passed for staged
review: [independent report](../validation/crossing-retail/review.md). The GLB
was regenerated twice with the same SHA256. The author audit found finite
positions/normals/UVs, unit normals, zero degenerate triangles and no external
URIs. All three author preview PNGs were visually inspected. This is core glTF
without Draco or texture extensions; no runtime decompressor is required.

## Coordinate contract

The GLB uses metres, **+Y up**, **+Z front**, ground **Y=0**. The origin is the
centre of the main 28 m × 25 m footprint at ground level. The upper light
brackets, curtain-wall caps and door hardware extend slightly past that
footprint. The native Blender source uses Blender's usual +Z up / -Y front;
Blender's standard glTF Y-up conversion is enabled. Bounds are checked again
after reading the exported GLB back into a clean Blender scene.

## Scope and limitations

- All asset lengths, heights, roof details and the commercial programme are
  inferred for game use; site area in the owner source is not a measured plan.
- Eight above-ground retail levels are suggested. No basement, navigable
  interior, collision mesh, functional doors, animated signs or night lighting.
- Glass is opaque metallic blue-grey PBR. This avoids transparent-surface sort
  artifacts across many buildings; it does not provide through-window views.
- The glass curtain wall uses a simplified silhouette and facade grid rather
  than surveying every mullion. Roof service layout is original/inferred.
- LOD0 only for this first review. The single-mesh/material batching is intended
  for browser use; an additional distant LOD may be useful after placement
  distance and renderer targets are set.
- Render PNGs are Cycles studio/daylight views of the same asset geometry.
  They are not screenshots of the game renderer. Windows/browser performance,
  city placement, shadow integration and game lighting remain integration work.
- No changes to existing GLBs, PLATEAU/photo city data, street layout, economics,
  `src`, main branch, build pipeline or deployment are part of this asset.

# D01 Sakuragaoka independent building assets

Two original, texture-free, metric models for independent review. No scene placement, game data, existing asset, renderer, application source, build or deployment is changed.

## Current HANA COURT residential: D01.3

- GLB: `public/models/external-v080/sakura-midrise/sakura-residential.glb`
- Manifest: same basename plus `.manifest.json`
- Front, oblique and roof PNGs: same basename plus `-front.png`, `-oblique.png`, `-roof.png`
- Dimensions (X / Y / Z in glTF): **13.800 / 23.785 / 11.400 m**
- **489,440 bytes; 6,844 triangles; 13,740 exported vertices; 8 materials; 8 primitives; 0 image textures**
- SHA256: `8d42f9f83c3a15a2c2df5b5824e62337945ef335abde6c843d647659e07b31a0`
- Seven storeys: recessed communal entrance with parcel/mailbox panel, screened bicycle bay and planters; six divided balcony floors; pale/slate privacy variation; separate common stair spine; small side/rear service windows; roof headhouse and equipment.

## Second handoff: KOHANA WORKS office

- GLB: `public/models/external-v080/sakura-midrise/sakura-office.glb`
- Manifest and three preview names follow the same convention.
- Dimensions (X / Y / Z in glTF): **11.900 / 18.880 / 10.600 m**
- **261,248 bytes; 3,599 triangles; 7,218 exported vertices; 8 materials; 8 primitives; 0 image textures**
- SHA256: `39ffc13b5843e8ffe9d535bb954ab41f4841b8a8bbe6f8833a93e964fad3ca08`
- Five storeys: shaded common lobby with fictional canopy sign; distinct ribbon windows and chamfered street corner; fifth-floor common terrace; side masonry fins; compact roof access and equipment.

## D01.3 roof-contact cleanup and final acceptance

The current residential model retains the D01.2 balcony-junction correction and also removes the duplicate coplanar strip at the two side parapet/slab contacts. Only the side-parapet bottoms moved, from Y=21.160 m to the existing slab top at Y=21.235 m. Their tops remain Y=21.960 m, and the removed volume was entirely inside the roof slab. The visible silhouette and full model envelope are unchanged.

Actual exported triangles show the positive coplanar overlap reduced from approximately 0.802509 m² per side to zero. Compared with D01.2, only 16 position and 16 generated UV records changed; topology, normals, materials and byte count are identical. The former dark outer roof-edge line is absent in regenerated author and independent same-camera previews. All 24 independent balcony-junction probes still pass.

Current evidence: `roof-scope-D01.3.json`, `reproducibility-D01.3.json`, `correction-D01.3.json` and `residential-D01.3-*.log`. Independent hash-specific QA is under `docs/external/dot/validation/revisions/sakura-residential-8d42f9f83c3a/`. The exact patch against the original submission is in `changed-files-D01.3.txt`; the complete current author file list is `submission-files-D01.3.txt`.

D01.2 hash `1b2c14220e485a19177f19184c4a221fddd81446dff8ac968d08d390673b69e6` and all its evidence remain historical. Both prior submitted snapshots were preserved outside the repository before revision. No office artifact, runtime source, city placement or deployment changed.

## D01.2 residential junction correction (historical)

Only the twelve outer balcony-end walls changed. Their backs now overlap the main facade by 40 mm, and their tops overlap the next slab/roof underside by 5 mm, closing the unintended 90 mm rear and 185 mm typical / 245 mm roof-level upper seams. Balcony fronts and internal apartment-separator clearances remain open. The dimensions, bytes, vertices, triangles, materials and draw primitives are unchanged.

The previous residential hash was `efe9c02f15c840f69c930153edc2165fddeadba1ce5efd98d9aa4e258899912b`. Its original author logs, `final-checks.json`, original reproduction records and prior independent QA remain historical evidence. The current correction uses `residential-D01.2-*.log`, `reproducibility-D01.2.json`, `seam-scope-D01.2.json` and `correction-D01.2.json`. New independent evidence is under `docs/external/dot/validation/revisions/sakura-residential-1b2c14220e48/`; review its status for this exact hash.

Byte comparison confirms identical glTF structure, indices, normals and materials; only 144 position and 120 generated UV records in the plaster primitive changed. Every original office deliverable remains byte-identical. The office proportion/entry/roof suggestions remain unimplemented proposals.

## Coordinate and integration contract

Both GLBs use metres, **+Y up, front +Z, Y=0 ground**, with all mesh node transforms identity and mesh origins at the bottom-centre of the complete footprint. The included thin pad is part of the model. The building facade faces the positive Z street side. Numerical ground error below 0.000001 m is normal single-precision export noise.

The two assets are separate files and can be placed independently. No collision, walkable interior, street grade or lot assignment is included. Each is LOD0; do not assume automatic LOD switching. Material grouping produces eight base draw primitives per building before renderer-specific shadow/depth passes. These are measured topology counts, not FPS claims.

Glazing is deliberately opaque dark/frosted PBR, without transparency sorting or hidden interiors. Walls, balcony floors, individual dividers, rails, window frames and services are actual geometry. Material colour and roughness are scalar PBR values. Box UVs are supplied for future authoring, with no present texture dependency or baked lightmap.

## Source, reproducibility and authoring scale

Source: `scripts/external-v080/sakura-midrise/generate_sakura.py`.

From repository root:

```sh
blender --background --factory-startup --python-exit-code 1 -t 2 \
  --python scripts/external-v080/sakura-midrise/generate_sakura.py \
  -- --asset residential --samples 64
```

Use `--asset office` or `--asset all` for the other building/both. `--no-render` regenerates GLB and manifest without expensive preview work. `--render-only --asset residential` imports the existing GLB and recreates the three PNGs without changing GLB bytes. `--save-blend` optionally writes a full-scale editable Blender file before export; no `.blend` is required to use or reproduce the assets.

The authoring source is a parametric full-scale metric design, rather than a separate sculpted high-poly model. The browser output is its material-batched, triangulated lightweight LOD0. Metric geometry is authored in Blender Z-up/front -Y and converted by the glTF exporter. Object transforms are baked before export. Generated UVs do not require any external files.

Verified tool: **Blender 4.3.2**. The available Blender build has no OpenImageDenoise support, so previews use 64-sample Cycles CPU rendering without denoising; visible fine grain is a preview limitation. Preview lights, camera and broad studio floor are excluded from GLB. The previews render the actual imported GLB, not a different high-detail source model.

## Validation

Each final GLB was read back by Blender, its geometry bounds calculated, and its mesh faces checked. A fresh combined `--asset all --no-render` run reproduced both standalone GLBs byte-for-byte; see `reproducibility-D01.3.json` for the current revision (the original and D01.2 reproduction records are retained as historical evidence). Each `.previews.json` records the exact GLB and PNG hashes, camera settings and render settings, and all six delivered 1056 × 1056 PNGs were opened and verified against those ledgers. Both own imports succeeded, with finite vertices and zero zero-area triangles. Actual export counts, SHA256, texture absence and import results are recorded in each JSON manifest. Independent validation lives under the shared quality worker's reports; review the report matching the current SHA256, not an earlier candidate hash.

The office review caught an unsupported terrace edge and unclosed lobby head; the final hash above includes a continuous structural terrace slab and explicit ground-level envelope closures.

No application-wide tests, production build, live deployment, Windows GPU test or final game integration was run by this asset author. All browser performance and in-scene material/lighting choices remain the integrator's check.

## Photographs, rights and limitations

See [references.md](references.md) for each original photo URL, named publisher, what was visibly inspected and what is inferred. All reference photos used for geometry observation are **reference-only**; no photo or photo-derived texture is included. The downloadable GLBs and previews contain only original generated geometry and scalar materials. No existing game model, scanned geometry, PLATEAU mesh or real logo was reused.

These are fictional, photo-informed designs. Floor counts, metric dimensions, ground-floor planning and roof equipment are estimates/inventions, not measurements of the real properties. Rear elevations and unseen service routing are plausible artistic interpretation. Structural pieces may intersect; this is an exterior visual asset, not a manifold fabrication or architectural compliance model.

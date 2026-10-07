# Dot model PR3–6 maintainer static review

2026-10-07. **ACCEPT PR #3, #4, #5 and #6 for staged original asset delivery.** No blocking defect found in final GLB bytes, manifests or the 21 supplied final-preview images. This decision does not authorize placement into the frozen v0.9.0 game or establish WebGL/Windows performance.

## Reviewed heads and namespace boundary

- PR #3: `aa7683d6bb8997672465e57c46e43ce078b5308c`; 27 added files. Exact extraction/file-list match, dedicated `public/models/external-v080`, `scripts/external-v080` and `docs/external/dot` paths only; no overlap with the other three PRs.
- PR #4: `e435e38c6adbd2ffe3aebb6169d7f1becf3e06bf`; 27 added files. Exact extraction/file-list match, dedicated `public/models/external-v080`, `scripts/external-v080` and `docs/external/dot` paths only; no overlap with the other three PRs.
- PR #5: `bd642866a5ccf3d2a23e4d4403f12f49787ad327`; 35 added files. Exact extraction/file-list match, dedicated `public/models/external-v080`, `scripts/external-v080` and `docs/external/dot` paths only; no overlap with the other three PRs.
- PR #6: `1be1e4fa983c43834b0ab6919527ba39c8ac429a`; 24 added files. Exact extraction/file-list match, dedicated `public/models/external-v080`, `scripts/external-v080` and `docs/external/dot` paths only; no overlap with the other three PRs.

No src, economics, save ID/order, existing 109/108, authored cafe, PLATEAU/photo, main or deployment path is changed. PR3 supplies common validation support used by later deliveries.

## Actual bytes independently inspected

| PR / model | Bytes | Triangles / vertices | Material primitives | Full measured X × Y × Z, metres | Images | Decision |
|---|---:|---:|---:|---|---|---|
| #3 / crossing-retail | 506,364 | 5,425 / 11,494 | 13 | 30.370001 × 40.790001 × 25.775299 | 0 | ACCEPT |
| #4 / dogenzaka-akari-b | 543,524 | 6,868 / 12,996 | 11 | 8.432516 × 21.360001 × 11.325000 | 1 embedded 1024² PNG | ACCEPT |
| #4 / dogenzaka-sakamichi-a | 802,896 | 10,894 / 20,348 | 11 | 8.340000 × 22.740000 × 10.855000 | 1 embedded 1024² PNG | ACCEPT |
| #5 / sakura-office | 261,248 | 3,599 / 7,218 | 8 | 11.900000 × 18.879999 × 10.600000 | 0 | ACCEPT |
| #5 / sakura-residential | 489,440 | 6,844 / 13,740 | 8 | 13.800000 × 23.785000 × 11.400000 | 0 | ACCEPT |
| #6 / terraced-retail-lod1 | 736,132 | 10,306 / 20,744 | 10 | 60.000000 × 89.800003 × 50.071999 | 0 | ACCEPT |
| #6 / terraced-retail | 2,035,052 | 27,446 / 58,018 | 13 | 60.038002 × 89.800003 × 50.071999 | 0 | ACCEPT |

All seven SHA256/bytes/triangle/vertex/material/primitive/mesh/node fields present in the author manifests agree with remeasured files; bounds agree within 0.00001 m (PR4 manifests round to five decimal places). Exact hashes are in `model-qa/static-review.json` and individual `*-glb-report.json` files.

The full six designs total 4,638,524 bytes, 61,076 triangles, 123,814 vertices and 64 material primitives for one copy of each. Including the optional LOD file gives 5,374,656 GLB bytes. Choosing the terrace LOD instead of full reduces that six-model set to 43,936 triangles and 61 primitives. Those are geometry/material counts, not actual frame draw calls or FPS.

The complete added public files total 19,833,759 bytes (PR3 701,156; PR4 1,421,905; PR5 9,921,396; PR6 7,789,302), including author blend / atlas / preview PNGs and public manifests, as delivered. Only GLBs loaded by a future runtime integration would be requested during play; this review does not change current loading.

GLB headers/chunks, default-scene transforms, accessor/index ranges, finite values, unit normals, winding and world bounds passed. Zero geometry errors, warnings, degenerate triangles or normal/winding disagreements. No external image/buffer URI; all material alpha modes OPAQUE; metallic/roughness/base-color factors finite and in range. Sakura assets use optional `KHR_materials_clearcoat`; no model requires extensions or compression decoder.

The two Dogenzaka GLBs each embed the same original 75,485-byte 1024 × 1024 PNG (hash `2a394ba10ba575cbf1a58e194d409084a853bb98a29e2584435dfc1040758284`). Their texture-bearing primitives have UVs. Identical encoded image bytes do not prove shared runtime GPU textures across separate loads.

## Coordinates and source contract

+Y is vertical, front is +Z, units are metres. Actual ground is 0 for six files and −0.000000058915 m floating-point noise for Sakura residential, within the 1 mm tolerance. X/Z bounds are bottom-centred except crossing: its documented main footprint origin gives a −0.012350 m full-envelope Z centre due to decorative projection. Do not recenter using the decorative envelope or rotate front again on load.

Key generator transformations and GLB export calls match the coordinate contract. The supplied independent preview renderer views the glTF +Z front from Blender −Y after import; front images show the intended entrances/signage. Full and LOD terrace share the same ground and main front/back envelope; full X is 0.038002 m wider due to seams. PR4 source generation requires Pillow plus a Japanese system font to reproduce its original signs; the shipped GLBs embed the texture, so runtime has no font/Pillow dependency. PR3 has an editable author blend; other generators are their editable source. No generator or Blender was executed here.

## Actual visual review

I opened the existing independent front, three-quarter and roof PNG for each of seven GLBs through view_image (21 images). Their accompanying Blender reports pin the same current GLB hashes; PNG dimensions/hash inventory is recorded in static-review.json. These are supplied studio images, not fresh render output from this reviewer and not screenshots of the game.

- **crossing-retail:** Readable convex media facade and ground entrances; fictional mesh lettering, coherent mullions, broad roof HVAC/crown. Blank party wall is intentional. Small text will vanish at overview distance.

- **dogenzaka-akari-b:** Distinct brick/two-bay frontage, striped bakery awning, common access and rooftop tank; side stairs meet visible service doors/landings. Roof differs from Sakamichi.

- **dogenzaka-sakamichi-a:** Narrow six-storey frontage, separate shop/common entry, repeated tenant bands and dimensional front stair bay. Roof and side are coherent. Fine stair rails/signs are close-view detail.

- **sakura-office:** Chamfered lobby/corner ribbon glazing and supported terrace slab are visible; lobby closure and terrace connection appear complete in the final views. Deliberate opaque glass.

- **sakura-residential:** Deep divided balconies, consistent floor rhythm, communal entrance and bicycle bay distinguish it from office. Roof services and side windows are coherent.

- **terraced-retail-lod1:** Large silhouette/terrace and stair arrangement retained; foliage becomes simple clusters and HVAC loses fine grilles, deck seams/text removed. Static visual pairing acceptable; transition popping remains untested.

- **terraced-retail:** Terrace recesses, vegetation, stairs/landings and office tower preserve depth/silhouette. Full studio views show no obvious missing or reversed surfaces; very large footprint.

No obvious floating major part, missing/inside-out face, flipped signage or gross z-fighting was seen. Fine Cycles grain and dark muted glazing are studio-preview limitations; bright game daylight/ACES/PBR appearance remains untested. All dimensions and unseen rear/roof designs are inferred original art, not measured PLATEAU/GIS replicas. Fictional lettering remains fictional; reference photographs are link-only according to the delivery docs, and no copied photo bitmap appears in GLB images.

## Small future placement recommendation

Begin with four individual ordinary background replacements: Sakamichi/Akari west, office/residential south. Match complete measured width/depth/height to existing OUTER_SCENERY envelopes, ground at Y=0, face an adjacent road by explicit rotation, and remove the corresponding procedural background rather than draw both. Preserve all existing lot IDs, economic values, markers and old model/photo coordinates. Current reserved envelopes include front wings and storefront access; use actual model front/stair projections, not only a declared main slab.

Crossing needs at least 30.370 × 25.775 m clear footprint and 40.790 m vertical reserve: one wide background slot, not a 14–18 m retail parcel. Its media face should be visible toward the authored crossing neighbourhood without replacing or concealing the accepted 109/108.

MORI needs at least 60.038 × 50.072 m (89.800 m high), beyond any existing single outer-scene building width (maximum 36 m). **HOLD automatic placement** until one explicit background area passes roads/rail/landmark/shop-front clearance and camera sightline checks. Use one LOD file at a time; full-to-LOD reduces triangles 62.45% and bytes 63.83%, but it has no automatic LOD extension and still has 10 material primitives. Do not tile it or shrink it into the old 109/PLATEAU footprint.

Use the existing LoadedAssetPool for a small explicit load/replace experiment with procedural fallback and correct resource release; no new generic asset framework is needed. A few repeated meshes may share template resources but are not automatically instanced: 8–13 material primitives per copy can add shadow/depth work. Run one native city acceptance later, after an approved placement change, to measure daylight materials, camera/marker/clearance and render cost. Current v0.9.0 UI/model freeze remains intact.

## Execution evidence and limits

Read the entire dependency-free `inspect_glb.py`, including its CLI, before reusing inspect(). It only reads the passed GLB, decodes bytes, computes values and writes an explicitly chosen report; no network/subprocess/Blender call. Reused it in one sequential CPU process with bytecode writes disabled. Execution completed in about 0.66 s. No GPU, browser, Blender, full tests, rebuild, merge, source or source-asset edit. Author/Astra Blender QA remains labelled supplied evidence; only byte/manifest checks and image observations above were independently repeated.

Evidence: `/workspace/shared/shibuya-artifacts/coordination/review-20261007-wave1/model-qa/static-review.json`, seven `*-glb-report.json`, and the narrow reproducible `review_models.py`.

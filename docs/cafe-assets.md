# Reusable café frontage

`createCafeExterior({ width: 8, terrace: true, wordmark: true })` returns a self-contained Three.js Group. Origin is at pavement height; front faces +Z. Interior extends to z = −3 m; furniture extends to about z = 1.3 m. Height is 4.04 m. Width defaults to 8 m (overall canopy is 8.14 m); width parameter scales frontage horizontally, with a minimum of 4 m. Attach to the front of a larger building with the wall behind the room at z = −3 m, not through the glazing.

HOSHI / 星 COFFEE is an original fictional café identity. Its restrained gray fascia, slim bronze glazing, timber soffit, recessed entry, visible coffee counter, menu, cup shelf, pendant shades and opal globe lights, outdoor furniture and planters use common contemporary café architecture. The shape has an actual interior; transparent panes do not hide a flat black wall. All lettering and wood grain are generated locally. No downloaded brand artwork or photographic texture is included. This is an authored reusable architectural asset, not a measured reconstruction of a particular Starbucks branch. It combines specific observed details from the documented Ginza and Reserve street branches into an original reusable design, rather than claiming to reproduce one historical branch.

The entire geometry is merged by material into 17 opaque/transparent material batches (16 when the optional static wordmark is disabled in the game) (rather than a draw call per chair leg). Geometry and materials are owned by each returned Group, so edits to one shop do not affect others. The function has no global cache. Remove the Group, then use `disposeCafeExterior(group)` once, or allow an existing scene-wide disposer to release its geometries, materials and maps. Do not do both. For city-scale repetition, clone a single asset and share its immutable resources; dispose shared resources only after all clones have been removed.

Warm elements use emissive materials, not per-store point lights, keeping repeated cafés inexpensive. The asset does not promise photographic realism: the foliage is simplified, panes use inexpensive transparency instead of physical refraction, and interior depth is intentionally 3 metres. Its detailing is designed to stay readable from a street or medium-distance city camera. Dimensions are architectural estimates.

## Inspected street references

The first source images supplied by the photo-reference workflow are credited there to RuinDig / Yuki Uchida (CC BY 4.0); retain its source manifest and attribution with any redistribution of those photographs. They are reference-only and are not embedded in the model.

- `Shibuya-Tokyo---2024-08-28_014.JPG`: inspected actual Katoriya shopfront. The photograph shows a visibly deep entry, aluminium vertical jambs and a transom, a sheltered ceiling with round recessed lamps, and a distinct pavement-to-interior threshold. These observations support the physical entry depth and transom already used in this asset; three inset canopy lamps were added after inspection. Katoriya is a tobacco/liquor shop, not a café. Its signage and vending machines are not copied into the fictional café.
- `Shibuya-Tokyo---2024-10-11_005.JPG`: inspected actual scramble-crossing view toward MAGNET. The visible coffee frontage is a dark glazed band below the major advertising façades, with thin pale frame edges and legible small-scale lettering. This supports keeping the reusable storefront below the building façade hierarchy. This distant view cannot establish interior furniture, wood species, entry widths or exact café construction. Those remain authored design choices.

The café should therefore be described as an original repeatable café asset informed by real street details, not as a photo-derived Starbucks reconstruction.

## Latest close-up study

`docs/cafe-photo-study.md` records 25 licensed photographs, 16 personally inspected, with dates and evidence-to-geometry comparisons. The 2023 and 2024 Shibuya TSUTAYA interiors differ and are not treated as one historical design. The final asset adds a folded black fabric awning, recessed warm wood entrance, opal globe lights, rounded furniture and metal tube legs, slim bronze mullions, clearer single glazing planes, and more natural wood grain and foliage. The green fictional medallion remains; the broad green fascia was removed. Dimensions remain 8.14 × 4.04 × 4.31 m, 7,856 triangles. The default standalone model includes its static wordmark; `CityGrowth` disables that wordmark and displays the player’s business name in its place.

## Game integration

`CityGrowth` uses this asset for premium stores, except the special `center-03` media retail landmark, which retains its shallow treatment. The asset is positioned at the lot's local front (`depth / 2 + 0.35`) with width `min(lot.width - 0.8, 12)`. `CityView` supplies the ground-floor recess. Business names retain the existing memoized dynamic canvas texture; the sign is scaled onto the gray fascia beside the original round café emblem. The static HOSHI wordmark is disabled for game placement, preserving dynamic owner-name replacement at y = 3.47 m. Level-two legacy furniture is hidden for these façades because the detailed café already supplies seating. All café resources are cleaned up by the owning scene's disposer. The model is created once for each owned lot, and weekly state updates only change visibility and sign text when necessary.

## Verification scope after the café revision

The latest `ARCH_CAPTURE_ONLY=1 python3 scripts/smoke-architecture.py` run passed the **16-batch** premium-store assertion, verified one transparent glazing batch and the hidden original storefront, collected no browser errors, and updated `city-integrated.png` and `cafe-integrated-closeup.png`. Manual inspection confirms the revised gray fascia, globe lamps, timber entry and visible interior. An adjacent plinth and column remain in the foreground. Its limited result is recorded in `architecture-capture-qa.json` from the completed command output; no additional GPU run was performed to create that record.

`architecture-qa.json` is the **earlier full suite for the 13-batch asset**. Its picking, rename, high-quality reconstruction, closure/restoration results and renderer metrics are historical. Those scenarios were not rerun in the latest capture-only check and must not be presented as fresh validation of the revised asset.


## Detailed photographic study and source revision

[Photo study](cafe-photo-study.md) records 25 licensed real photographs, 16 personally viewed images, ten concrete photo-to-geometry findings, and the source revision. The original Three.js variant has 7,856 triangles, 17 batches, and a 596,160-byte GLB export. Rounded furniture, deeper entry, layered metal frames, globe lighting, wood-grain direction, smoother foliage, and clear single-plane glazing were checked in actual GLB/Blender previews. These statistics describe that authored source version, not the subsequent Blender polish.

## Reproducible Blender polish

Run `blender -b -t 2 --python scripts/polish-cafe.py`. It reads the existing standalone `architecture/cafe.glb`, edits real mesh components and PBR materials in Blender, and writes a separate `blender-polish/cafe/` directory. It never overwrites the TypeScript source or the original GLB.

- `cafe-polished.blend`: editable master with dielectric glass and removable `SIGN_REPLACEABLE_WORDMARK`.
- `cafe.glb`: display version with static HOSHI lettering and `KHR_materials_transmission` / `KHR_materials_ior` glass.
- `cafe-polished.glb`: game version with the static wordmark omitted and inexpensive core-PBR transparent glazing, avoiding the transmission framebuffer pass when shops repeat.
- `cafe-game.blend`: corresponding editable game scene.
- `info.json`: source/output checksums, measured bounds, material/triangle counts, and changed-component counts.

Both retain the pavement origin, glTF +Z frontage and approximately 8.14 × 4.04 × 4.31 m exterior envelope. Glass has 6 mm geometry; metal and timber edges have small applied bevels; seats are widened to about 0.42 m; the service countertop is lowered to about 1.08 m. These furniture dimensions are authored ergonomic adjustments, not measurements extracted from the photos. Existing packed wood and sign image textures remain present in the exports. No unsupported procedural-only shader is required.

A small actual Three.js test with an opaque background and environment reflections loads both exports, verifies wordmark exclusion in the game variant, measures unchanged bounds, and inspects exported glass material values. It records about 36 render calls for the transmissive display fixture versus 18 for the lightweight game fixture (including the same test ground); these are isolated asset counts, not a whole-game FPS benchmark. Heavy final comparison rendering is handled separately with identical lighting/cameras for before and after.

For optical-only updates, `blender -b -t 2 --python scripts/polish-cafe.py -- --showcase-only` preserves the game GLB and game blend byte-for-byte. The display/master glass roughness is now 0.01. An 800 × 600 Three.js comparison still showed interior blur from screen-space transmission; a narrow experiment bypassing the renderer's 0.0525 minimum roughness for transmission sampling did not give a sufficient visual improvement. That shader experiment is not part of the game or exported model. The Blender master retains physical dielectric glass; any lightweight HTML transparency approximation must be described separately from the physical render.

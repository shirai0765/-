# MORI TERRACE

Independent D01 asset, inspired by the rebuilt Shibuya PARCO's white interlocking commercial blocks, deep landscaped terrace slots and glass office tower.

## Files

- `public/models/external-v080/terraced-retail/terraced-retail.glb`: full-detail standalone browser asset
- `public/models/external-v080/terraced-retail/terraced-retail-lod1.glb`: optional reduced-detail asset
- `public/models/external-v080/terraced-retail/front.png`, `oblique.png`, `roof.png`: renders of the actually exported and re-imported full GLB
- `scripts/external-v080/terraced-retail/generate.py`: self-contained Blender generator, original geometry only
- `manifest.json`: measured export statistics, SHA-256 hashes, dimensions and actual Blender import checks
- `references.md`: source photographs, observed features, rights and inference boundaries

## Reproduce

From repository root, using Blender 4.3.2 or a compatible newer release:

```sh
blender -b -t 2 --python scripts/external-v080/terraced-retail/generate.py -- --render
```

Omit `--render` to export and import-check both GLBs without generating previews. No packages, external textures, network access or source `.blend` file are needed. The generator is the editable full-scale authoring source; both exports use original metre-scale geometry. LOD1 removes fine panel seams, deck joints, small text/hardware and secondary foliage. It is a separate GLB, not an automatic LOD extension. The full version is already the browser-oriented model; no heavy surveyed master is claimed.

Coordinates: metres, +Y up, +Z front, bottom-centred origin at Y=0. Blender's native Z-up coordinates are converted during export and checked by re-import. Glass is opaque tinted PBR for stable inexpensive rendering. All signage is fictional.

Ground storefronts have recessed doors, slim frames, a pedestrian passage and pale structural piers. Upper terraces have columns, edge rails, benches, planters, trees and illustrative stairs. A roof crown, mechanical enclosure and AC units distinguish the roof from a flat slab.

## Review limits

No application code, city placement, economy data, existing model, integration test, global test, production build or deployment was changed or run. This model needs the main project's visual placement/performance review before integration. Exact PARCO dimensions, tenant layout, transparent interiors and navigable stairs are outside this independently authored asset's scope. See manifest for detailed known limitations and measured workload.

Preview colour management uses Blender AgX and soft daytime light. GPU rendering is unnecessary. This environment's Blender build lacks OpenImageDenoise, so the generator deliberately uses CPU samples without denoising.

For independent binary structure checks, run:

```sh
python3 scripts/external-v080/terraced-retail/verify.py
```

The report is saved to `structural-check.json` and checks actual GLB buffers for invalid indices, degenerate triangles, non-finite UVs, non-unit normals, valid opaque PBR parameters and external resource dependencies. To regenerate only PNG previews from the existing final GLB, use `blender -b -t 2 --python scripts/external-v080/terraced-retail/generate.py -- --preview-only`.

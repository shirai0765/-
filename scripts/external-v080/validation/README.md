# Independent D01 model validation

These scripts inspect final authored files without rewriting them. Reports belong in
`docs/external/dot/validation/<asset-id>/`. Wait for an author handoff and pin the
SHA256 before running; changing output files are not reliable validation inputs.

```sh
python3 scripts/external-v080/validation/inspect_glb.py \
  public/models/external-v080/FAMILY/ASSET.glb \
  --sha256 AUTHOR_HANDOFF_HASH \
  --output docs/external/dot/validation/ASSET/glb-report.json
blender -b -t 2 --python-exit-code 1 --python scripts/external-v080/validation/validate_blender.py -- \
  public/models/external-v080/FAMILY/ASSET.glb \
  docs/external/dot/validation/ASSET --sha256 AUTHOR_HANDOFF_HASH
```

The first command measures bytes, primitive/accessor vertices and triangles,
materials, UV presence, normals, degenerate triangles, scene transforms and
world-space bounds directly from GLB bytes, and checks external dependencies.
It supports standard packed accessors and sparse overrides; matrix vertex
attributes and compressed geometry are outside this asset-focused checker.

The second command performs a real Blender import in a fresh scene, independently
checks resulting geometry, normals, transforms, image sizes and ground alignment,
and produces front, three-quarter and roof renders with original materials.
Only the review scene gets a neutral ground and lights. No asset is re-exported.
The default camera front is glTF +Z; use `--front=-Z` if documented otherwise.

Counts can legitimately differ: glTF splits vertices at material/normal/UV seams,
while Blender can merge them on import. Stored primitive counts are distinct from
scene-instanced draw counts. Ground tolerance is 1 mm. Minimum ground alone does
not prove a sensible bottom-center origin; verify bounds against intended footprint.
The imported scene is converted back from Blender Z-up to glTF Y-up for reporting.

Render success is not visual approval. Inspect all three PNGs for silhouette,
street entrance readability, scale, depth, materials, missing/inside-out faces,
z-fighting, facade/rear differences and rooftop assembly. Record limitations.
Review results are asset-specific, never a full-project or browser regression pass.

Focused validator self-tests (standard library only):

```sh
python3 -m unittest discover -s scripts/external-v080/validation -p 'test_*.py' -v
```

Eleven fixtures cover counts/bounds, repeated mesh instances, displaced ground,
external image URLs, non-finite/non-unit normals, invalid indices, degenerate
triangles, singular transforms, cyclic node trees, normal/winding disagreement,
and missing UVs on a textured material. A separately generated
2 m cube was actually exported, reimported, and rendered in Blender 4.3.2 during
validator setup. That smoke test is not evidence about any D01 building.

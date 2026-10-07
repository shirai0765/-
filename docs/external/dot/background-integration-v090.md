# Four small background buildings in v0.9.0

The game city uses four delivered GLBs in existing outer scenery slots. These
are original fictional buildings with estimated dimensions, not measured
PLATEAU reconstructions or new purchasable sites. Existing lots, roads, reserved
envelopes, 109/108, real-city assets and camera controls are unchanged.

| Stable scene node | Original reservation | Position (metres) | Y yaw | GLB under `public/models/external-v080/` |
| --- | --- | --- | --- | --- |
| `dot_scenery_sakura-office` | `outer-scenery-165` | −125, 0, 322 | +90° | `sakura-midrise/sakura-office.glb` |
| `dot_scenery_sakura-residential` | `outer-scenery-163` | 64, 0, 257 | −90° | `sakura-midrise/sakura-residential.glb` |
| `dot_scenery_dogenzaka-akari-b` | `outer-scenery-195` | −419, 0, 27.5 | 180° | `dogenzaka-mixed/dogenzaka-akari-b.glb` |
| `dot_scenery_dogenzaka-sakamichi-a` | `outer-scenery-242` | −386, 0, −53 | 0° | `dogenzaka-mixed/dogenzaka-sakamichi-a.glb` |

All scales are one. The complete rotated model bounds, including pads, roofs
and stairs, fit the existing obstacle reservations. The original coordinate,
size, height, seed and index must still match before a slot is replaced. The
large crossing retail and terrace assets are not used here.

`dotScenery.ts` mounts each file once through the existing scene-owned
`LoadedAssetPool`. URLs use Vite's base path. Each mount owns a private
procedural fallback, with an inverse transform that preserves the old
building's world pose during loading or after fetch/parse failure. Successful
loading removes that fallback rather than drawing both buildings. Fallback
disposal cannot dispose the main city's shared box geometry or materials.
Pool teardown still precedes scene disposal, aborts requests and rejects late
attachments. Loaded clone resources stay with the pool until final disposal.

The four files total 2,097,108 bytes, 28,205 triangles and 38 primitives. Two
GLBs each embed a 1024×1024 sign atlas; identical atlases in separate files do
not imply one GPU texture. These are asset counts, not measured frame rates
or a promise of lower draw calls.

CPU acceptance checks the exact slot guards, measured complete envelopes,
transport/lot/approach clearance, original fallback pose, exclusive fallback
resources, successful replacement and late-response teardown. Existing asset
pool lifecycle tests also run. The independent merged-file SHA/binary-bounds
inspection confirms the reviewed files. Native acceptance must additionally
confirm all four real HTTP loads and `assetStatus === 'loaded'`, default-camera
appearance at 1280 and 390, manually inspected south/west views, one deliberate
load-failure fallback and a quality remount. Node `userData` exposes
`dotSceneryAssetId`, `sourceSceneryId`, `authoredAssetURL` and `assetStatus` for
that check; no lot or storefront ownership identifier is assigned.

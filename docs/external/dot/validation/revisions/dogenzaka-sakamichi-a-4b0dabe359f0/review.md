# Dogenzaka A correction — independent versioned review

**2026-10-07: PASS for the targeted correction and standalone GLB import.**
This is not a navigation, building-code, complete architectural, browser or
application acceptance test.

Corrected GLB SHA256:
`4b0dabe359f0005f91e35192263ea03bca9a820bb32b6270081d4e14770a4835`

Predecessor SHA256:
`0af2d0da21b9868e7017a3625eaf152f3c565f43baad1ac84637b597e1078a20`

## Why a second review was needed

The original GLB/Blender geometry checks were valid, but the broad three-view
visual review missed inward-facing rear AC fans, an exterior stair flight ending
at an unbroken roof slab, and absent tenant doors from the circulation balconies.
The previous visual acceptance is superseded for these details. Its measurements
and images are retained with an explicit revision notice; an exact copy of the
original QA evidence was archived before adding that notice.

The author made the authorized targeted correction: five tenant doors, outward
rear fan faces, and removal of the final roof-bound switchback flight/midlanding.
The sixth-floor landing and guards remain. Roof access is inferred through the
existing roof headhouse; a traversable internal route is not modeled or certified.

## Independent technical result

- 772,808 bytes,10,422 triangles,19,496 exported vertices;11materials/primitives.
- One embedded/packed1024×1024PNG atlas; no external image/buffer dependency.
- Dimensions unchanged:8.340000×22.740000×10.855000m; centeredX/Z,+Zfront,Y=0ground.
- Finite data, unit normals, valid indices, zero degenerate triangles and zero
  normal/winding disagreements.
- Fresh Blender4.3.2 import returned `FINISHED`; geometry and transformed bounds
  agree with the byte-level inspector. Hash unchanged throughout validation.
- Relative to predecessor:−30,088bytes,−472triangles,−852vertices. Materials,
  texture dimensions and full envelope are unchanged.

## Targeted actual-mesh proof

The supplemental script raycasts actual imported GLB triangles in glTF metre
coordinates. It does not inspect the author's source scene or rely on component
names. All probes were run on both final bytes and the separately archived oldGLB.

| Target | Corrected expectations | Corrected result | Old negative control |
|---|---|---:|---:|
| Five tenant doors | Hit lower metal door panel below former window sill |5/5|0/5|
| Five rear AC fans | Rear-facing ray hits charcoal fan face, not cream case |5/5|0/5|
| Removed roof-bound flight | Six downward sample paths above sixth-floor landing are clear |6/6|0/6|
| Total | Isolated targeted samples |16/16|0/16|

The door rays deliberately use the lower panel rather than a glass patch, because
a former window could also return glass. This negative control prevents a false
positive based only on material similarity. Space samples prove the removed
flight no longer occupies the sampled roof-bound path; they do not certify all
headroom or collision clearances.

Evidence: [corrected probes](architecture-probes.json),
[predecessor probes](predecessor-probes/architecture-probes.json).

## Pixel inspection

All six new images were rendered from the exact corrected GLB and inspected:

- Full [front](front.png), [three-quarter](three-quarter.png), [roof](roof.png).
- [Rear AC faces](rear-ac-outward.png): fans clearly face outward.
- [Stair termination](roof-stair-termination.png): sixth-floor landing remains;
  the final flight no longer climbs into the unbroken roof slab.
- [Tenant access](tenant-door-circulation.png): framed floor-height doors are
  visible from the circulation balconies at each upper floor.

The narrow frontage, tenant signs, lower cafe entry and roof equipment remain
legible. No new obvious surface defect was observed in these views. These are
sampled scenery checks, not a guarantee that every hidden joint is correct.

## Reproduction and remaining limits

Use the unchanged `inspect_glb.py` and `validate_blender.py` with the corrected
hash, followed by
`scripts/external-v080/validation/validate_architectural_revision.py`
with `--kind dogenzaka-a --revision corrected`. Pass the GLB and this output
directory explicitly. For the negative control, use the archived predecessor
with `--revision previous --no-render`.

Original author files were archived separately before author edits. Original QA
files were likewise copied outside the repository and hash-ledgered before the
revision notices. No old PNG or numeric report was silently replaced with a new
hash. Frozen B/other models were not edited by this reviewer. No remote writes,
full-project tests, game placement, build or deployment were performed.

Machine evidence: [GLB report](glb-report.json),
[Blender report](blender-report.json).

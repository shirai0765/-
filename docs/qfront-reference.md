# QFRONT / crossing-side coffee facade references

Retrieved 2026-10-07 (Asia/Tokyo) directly from Wikimedia Commons after the environment network configuration became unrestricted. Full-resolution originals are unaltered in `/workspace/shared/shibuya-artifacts/references/qfront/`. Exact download URLs, author names, photo dates, licenses and SHA-256 hashes are recorded in that directory's `manifest.json`; Commons metadata is preserved alongside each `.jpg` as `.jpg.json`.

## Actual photographs inspected

| Photograph | Photographer / date | License | Evidence |
|---|---|---|---|
| [QFront-Shibuya-01.jpg](https://commons.wikimedia.org/wiki/File:QFront-Shibuya-01.jpg) | Rs1421, September 2011 | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Clear daytime close view of the continuous convex curtain wall, thin vertical mullions, open crown, side lamps and retail braces. |
| [QFront-Shibuya-03.jpg](https://commons.wikimedia.org/wiki/File:QFront-Shibuya-03.jpg) | Rs1421, September 2011 | CC BY-SA 3.0 | Night close view confirms illuminated rooms behind the lower transparent facade, rather than an opaque office block. |
| [Tokyo Shibuya Starbucks 1.jpg](https://commons.wikimedia.org/wiki/File:Tokyo_Shibuya_Starbucks_1.jpg) | Zairon, 2018-04-05 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | High-resolution view of the tall LED/glazing field, broad side elevation, lower diagonal braces and roof lattice. |
| [Tokyo Shibuya Starbucks 2.jpg](https://commons.wikimedia.org/wiki/File:Tokyo_Shibuya_Starbucks_2.jpg) | Zairon, 2018-04-05 | CC BY-SA 4.0 | Alternate close angle: ground entrance recess, structural supports, second-floor seating behind glazing and crown construction. |
| [2025 Shibuya Crossing.jpg](https://commons.wikimedia.org/wiki/File:2025_Shibuya_Crossing.jpg) | Kakidai, August 2025 | CC BY-SA 4.0 | More recent overall view confirms the retained facade structure, updated lower coffee/retail frontage and changeable screen advertisements. |
| `Shibuya-Tokyo---2024-08-28_038.JPG` (existing reference) | RuinDig / Yuki Uchida, 2024-08-28 | CC BY 4.0 | Current street-level framing, white coffee wordmarks, ground corner coffee entrance and side shoulder. See `photo-references.md` for exact source. |

The downloaded set also includes `QFront-Shibuya-02.jpg`, `QFront-Shibuya-04.jpg` and `Q-Front 2018.jpg` as additional unmodified references; observations above are restricted to images actually inspected individually.

## Geometry changes justified by the photographs

- Replace the almost-flat stepped bay approximation with continuous, convex curtain-wall panes and curved transoms. The authored front is divided into 20 narrow bays; this is a compact game-scale interpretation of the dense real grid, not a claim to survey the real bay count.
- Keep the large upper screen behind the retained exterior grid and curve the screen surface along the facade. Original advertising replaces the photographed campaigns.
- Remove the opaque core from the two lower retail levels. Model clear glass, floor slabs, a recessed interior wall, timber counter and stools so the second-floor coffee use is legible through the facade. Exact furniture placement remains inferred.
- Add the characteristic paired diagonal white structural braces behind the lower glass, real entrance portals, sliding-door seams and handles.
- Replace the opaque rooftop billboard box with an open structural crown, curved perimeter framing, depth braces, side panels and a smaller original campaign surface.
- Add the short rows of projecting screen lights visible at the front side edges and upper side wall.
- Keep a lower rear roof shoulder behind the crown.

## Scope and limits

`createMediaRetail(width, depth, height)` retains its existing API. For the current 18 × 14 × 26 m game lot, the authored geometry stays within those dimensions. The real building's overall scale and its depth cannot be recovered faithfully inside this compressed lot, so the asset is explicitly a photo-guided compact interpretation.

The in-game cafe remains **HOSHI COFFEE**, and the cultural tenant remains **TOKYO FRAME**. All runtime signage and screen graphics are original canvas artwork; none of the downloaded photographs is used as a runtime facade texture. The references span several dates, so changing advertisements, tenant graphics and furniture are not presented as a single current as-built survey. Hidden rear rooms and exact mullion sizes remain interpreted.

# City Burst — v0.9.0 foundation

The user selected concept B, approved in [city-burst-approved.png](concepts/city-burst-approved.png): bold Japanese headings, condensed italic figures, cyan and navy chrome, white information cards and gold action buttons. This is the shared visual foundation for the existing game pages; simulation, saved history and financial actions remain owned by their existing modules.

## Shared interface

`src/ui/GameIcon.tsx` exports named `GameIcon`, `GameIconName` and `GameIconTone`. Props are `name`, optional numeric `size` (24px default), `className`, and optional `tone` (`blue`, `gold`, `green`, `red`, `navy`, `muted`). Icons inherit text color unless a tone is supplied. They are decorative and `aria-hidden`; the surrounding text or button label supplies their accessible meaning. CSS masks retain the duotone opacity in the original SVG. Static asset URLs combine `import.meta.env.BASE_URL` with the page's `document.baseURI` to produce an absolute same-origin URL, including deployment under `/-/`. SSR and non-navigation test documents retain a safe relative fallback.

The 25 names are `wallet`, `trend-up`, `users`, `shop`, `coffee`, `bank`, `chart`, `news`, `check`, `arrow-right`, `arrow-left`, `pin`, `coins`, `settings`, `building`, `train`, `briefcase`, `close`, `search`, `warning`, `celebrate`, `volume`, `play`, `pause`, and `lightning`. Earlier coordination messages counted these as 27; the actual union contains these 25 names.

`city-burst-theme.css`, imported after the existing global styles in `main.tsx`, supplies:

| Token | Value / use |
| --- | --- |
| `--game-display` | Dela Gothic One, Japanese display headings; normal 400 |
| `--game-numeric` | Barlow Condensed Black Italic, large figures; italic 900 |
| `--game-ink` | `#082348`, navy chrome / gold-button text |
| `--game-blue` / `--game-cyan` | `#1265dc` / `#37dcff` |
| `--game-gold` | `#ffcd3f` |
| `--game-green` / `--game-red` | `#087951` / `#bb2f47`; brighter semantic variants in night mode |
| `--game-city-art` | CSS `url(...)` value for the generated city hero |
| `--game-cafe-art` | CSS `url(...)` value for the generated café hero |
| `--game-opening-cards-art` | CSS `url(...)` value for the three equal-width standard/premium/takeaway panels |

Art tokens now reference the actual files supplied by the parent: `public/ui/city-burst/city-hero.webp`, `cafe-hero.webp` and `cafe-options.webp`. Relative CSS URLs are rewritten by Vite against the deployment base; no runtime CDN or absolute-root asset paths. Their source images and generated-art hashes are recorded in `public/ui/city-burst/manifest.json`. The card strip is exactly three equal panels (2,172 × 724 pixels).

The existing `daylight`, `metro` and `night` preference IDs remain valid. Both light palettes use the B typography and blue/gold language; slate has darker dividers, and night retains dark readable surfaces and bright semantic text. Noto Sans JP and Manrope remain the body fonts for news, forms and explanatory text. Display styles are not applied to long articles or all small labels. No font-size setting, browser zoom, user stylesheet or reduced-motion preference is disabled.

`GameDialog` retains its native top-layer dialog, focus behavior, commit-on-blur, Escape and nested-confirmation handling, backdrop gesture threshold, scrolling and close guards. Its close glyph now uses the shared icon. The visible shell receives navy/cyan header chrome, a readable white title, a 44px close control and an explicit focus ring. No transformed ancestor is added, preserving fixed confirmation shades. `[open]` header selectors outrank the previous immersive header colors without changing its sticky position.

## Actual local sources and costs

| Asset | Pinned source | License | Delivered bytes |
| --- | --- | --- | --- |
| 25 Phosphor duotone SVGs | `phosphor-icons/core` commit `2b75f3ad12b420c9504ef05df8d2564a28f8500e` | MIT, Copyright 2023 Phosphor Icons | 15,219 total SVG bytes |
| Dela Gothic One Regular | `google/fonts` commit `7085eb89a950e85db5b166b7a58d414544b4140c`, `ofl/delagothicone` | SIL OFL 1.1, Copyright 2020 The Dela Gothic Project Authors | 1,577,964 WOFF bytes |
| Barlow Condensed Black Italic | same Google Fonts commit, `ofl/barlowcondensed` | SIL OFL 1.1, Copyright 2017 The Barlow Project Authors | 53,804 WOFF bytes |

The icon source files are unmodified. Fonts were converted from pinned TTF files to lossless WOFF containers with fontTools; no glyph subset or outline change. Dela retains 9,030 Unicode mappings, Barlow 525. Dela's complete Japanese repertoire deliberately costs more than a small Latin-only display face. `font-display: swap` keeps the screen usable during loading. There is no new npm dependency.

`public/icons/phosphor/manifest.json` and `public/fonts/game/manifest.json` record exact source URLs, commits, byte sizes, license sources and SHA-256 hashes; font entries record original TTF and delivered WOFF hashes separately. License notices are distributed beside the files.

## Verification state

Local source checks confirmed all 25 SVGs have the expected view box, no scripts/external embedded images/foreign objects, and exact manifest SHA-256 hashes. Both delivered fonts match their recorded hashes. Whitespace checks passed. Component API consumers were notified directly.

The parent owns the complete TypeScript/test/build check and packaging. Native QA must still verify deployed prefix paths, actual loaded display faces, light/night contrast, 390px wrapping, focus/keyboard and scroll behavior. No browser, GPU run, FPS measurement or performance claim is made by this foundation work.

The first production native run found an actual defect: decorative icons were invisible because relative URLs in the inline custom property were consumed by the mask rule in `/assets/…css`, producing `/assets/icons/…` requests and 404s. The component now resolves its path against `document.baseURI` before passing it to CSS. This changes no interaction or font behavior. Root build and the next native run must confirm the corrected visible icons and successful requests; the initial screenshots are evidence of the defect, not a passing icon check.

## Native follow-up, 2026-10-07

The final build-03 production-CSP run (native02) loaded both real display fonts and corrected icon paths, with actual visible wallet/customer/check glyphs. The 390px weekly screen fits the settled profit, cash, visitors and main next action in one viewport. Property names, three real prices, shortage behavior and selected checks were checked at 360/390px. Root inspected actual screenshots against concept B. Native04 confirmed real loss presentation and bank contract/repayment, but root visual review found two bank night-theme text contrast defects (receipt and loan-list heading); those are not accepted yet. Historical failed runs remain preserved; a focused correction and recheck are pending.

Final build04 follow-up: native07 confirmed bank/group/market/deals bare night text, settled receipt opacity1 and deep green. Root independently viewed the four final images and accepts the scoped correction. Earlier pending checks and failed runs above are historical evidence.

# Browser playtest

Run the development server (`npm run dev -- --host 0.0.0.0`) and then:

```sh
python3 scripts/smoke-browser.py
```

Requires Python Playwright and Chromium at `/usr/bin/chromium`. Set `PLAYTEST_URL` to override localhost:5173 or `PLAYTEST_OUT` to override `/tmp/shibuya-playtest`. The test uses fresh browser contexts and never changes existing player saves.

The test operates visible controls to create a company, find a profitable café site, open it, change price/staff/manager settings, compare week forecasts with actual results, reload and continue, buy and sell one affordable stock, borrow and repay a loan, export a save, and import it in a separate fresh context. It checks all 100 market rows, Growth and budget filters, saved-state equality, cash conservation, and document overflow at 1260px and 900px. Browser console errors and uncaught page errors fail the test.

Before management actions, the test checks a visible 3D canvas, nonzero render triangles, and diversity of framebuffer pixel samples. Scene renderer globals and the persistence module are inspected read-only; no simulation state is injected. After recording the standard-quality city, the UI switches to lightweight rendering to limit software GPU load.

Artifacts include `city.png`, `market.png`, `market-900.png`, `save.json`, and `results.json`. The JSON result records actual completed scenarios. This suite does not cover later sales-event screens, all investment failure cases, or production-browser GPU performance.

Verified 2026-10-06: **8 scenarios passed**, with zero page errors or console errors after removing the unavailable remote font import. Standard-quality startup rendered 283,808 triangles across 547 draw calls and 2,336 distinct sampled framebuffer colors. Growth filter showed 25 of 100 stocks. Both tested viewport widths had no document-level horizontal overflow. These are development software-rendering observations, not production GPU benchmarks.

## Sales and damaged-save recovery

```sh
python3 scripts/smoke-sales.py
```

Verified 2026-10-06: **8 additional scenarios passed**, zero console/page errors. This targeted suite creates a fresh café fixture through genuine `createGame`/`applyAction` engine operations, exports its validated envelope and imports it using the UI; subsequent sales, payments, weekly progression and recovery use visible controls. This fixture setup deliberately avoids repeating the core suite's café startup coverage.

Verified two incoming proposals; ¥8,000 paid research and visible report; rejecting the costly advertising proposal without debit; ¥80,000 system contract with ¥4,000 recurring weekly expense; three weekly cash settlements with results hidden until the introduction period passes; persisted measured benefit after reload; and ¥10,000 cancellation with recurring fees removed. `sales.png`, `sales-fixture.json`, and `sales-results.json` are saved in the same artifact directory.

The recovery test deliberately corrupts only the primary IndexedDB envelope checksum in its isolated browser context, preserving backups. Reload displays the corruption error; the welcome screen's “保存履歴から復元” then restores the fourth-week backup, comparing the entire company/contract state with the original. This verifies that specific corruption-and-recovery path; it does not claim proof against all possible storage failures or a 1,000-hour endurance run.

## Theme, typography and growth strategy regression

```sh
python3 scripts/smoke-design.py
```

Verified again on 2026-10-06 after the interface redesign: the full core browser suite **8/8**, sales/recovery suite **8/8**, and new design suite **6/6** all passed with zero console/page errors. The core suite now selects profitable sites using the company-wide incremental-profit label, “全社の増分利益 / 週”.

The design suite creates a real company through the welcome UI and selects all three themes using the header's “デザインを選ぶ” dialog. Tokyo Daylight, Metro Editorial and After Hours each switch immediately, persist after reload, and show no document overflow at 1260px or 900px. Actual loaded font faces include Manrope Variable and Noto Sans JP Variable, with WOFF requests served from the application origin. The growth-strategy roadmap is visible and its next-action button opens an actual management screen.

Screenshots use lightweight 3D selected through Settings after verifying initial rendering; the core suite separately verifies standard-quality 3D. Artifacts are `/workspace/shared/shibuya-artifacts/design/{daylight,metro,night,chooser,progression,comparison}.png` and `results.json`. `comparison.png` is a side-by-side assembly of the three real screenshots, not a UI mockup. `DESIGN_OUT` and `PLAYTEST_URL` can override the artifact directory and server URL.

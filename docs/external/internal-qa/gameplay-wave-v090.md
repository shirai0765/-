# External gameplay PRs 14–16: independent assessment

Reviewed 2026-10-07. Repository files were read only; all retrieval and verification output is under `/tmp/shibuya-external-traces-review`. No checkout, merge, source/public/dist/docs edit, browser, GPU, build, or full test suite. The 1,400-week campaign was **not** re-simulated independently.

## Decision

Accept these submissions as useful, reproducible **single-seed public-engine API evidence**, with their existing limitations retained. They are neither completed native UI playtests nor measured 30-hour playtests. The apparent final credit barrier is a policy limitation, **not a campaign deadlock**: a bounded independent branch from the submitted natural final save completes all 108 companies and four districts using ordinary actions and six actual weekly settlements. The absent achievement in the original trace is correct because one of the eight direct acquisition targets is still missing.

No release-blocking economic or achievement defect was demonstrated by these PRs. The failed UI click remains unclassified; this review does not dismiss it or establish a product bug. A small explanation of the relationship between store satisfaction, delegation, and brand evaluation could help players who wait for cash while the actual unmet condition is operating quality. Current UI already displays the current and required brand evaluation, so an additional opaque numeric index is unnecessary.

## Provenance and integrity

| PR | Exact reviewed head | Scope |
|---|---|---|
| [14](https://github.com/shirai0765/-/pull/14) | `a4fb807cb8584983b21240f4f0d0ffe40bde8ef8` | Creation, first settlement, separate manager/loan comparisons |
| [15](https://github.com/shirai0765/-/pull/15) | `bba8124d7bb7b4190ae471f9eb66c8da8119c69a` | Weeks 2–103, IPO, first direct and market-company acquisitions |
| [16](https://github.com/shirai0765/-/pull/16) | `7056da58e0ce15225505c92167a1c9ca4136f914` | Weeks 104–1400, all market companies, final unmet brand condition |

All three PR bases are `87915c2f09f1889662825e90965ea9def9f627ca`. The recorded campaign itself used `0f20987d5e9961b8efe16c5f6aa5c6322120ec0b` / package v0.8.0; the author distinguishes that source from the later v0.9.0 limited replay base. All changed files are under `docs/external/gameplay-review/` or `scripts/external/gameplay-review/`; there are no runtime, dependency, save-format, or economic changes in these PRs.

Ordinary GitHub HTTPS/API retrieval preserved bodies, metadata, diffs, and 92 submitted file entries / 67 unique blobs. Each downloaded raw blob was checked against GitHub's git-blob SHA-1 and additionally recorded with byte length and SHA-256 in `download-manifest.json`. No callable PR artifact tool was available in the tool inventory; the normal API fallback was used.

Independent static checks (`static-integrity.json`) found one continuous 1,741-row chain: one `createGame`, 340 `applyAction`, and 1,400 `advanceWeek` records. Indices are consecutive and each recorded before-state SHA equals the previous after-state SHA. Actual report weeks agree with their before/after weekly boundary. This is internal record consistency, not an independent replay of every transition.

| Raw trace | Rows | Independently checked SHA-256 |
|---|---:|---|
| `trace-01-founder.jsonl` | 6 | `97f7bf87b49c6f974329a47455e8025d33a36593c2328fff5c44c4aa426080ec` |
| `trace-02-ipo-investment.jsonl` | 211 | `1a9efd0cfbffeb6dcca46dc4358d24aef819bea2991c674fb18e650bc3e48c21` |
| Decompressed `trace-03-late-growth.jsonl.gz` | 1,524 | `612b3ce6536677e3fce40c91c40703c52c98192583519daa32c8177381e4d5ed` |

The late trace is 1,080,443 compressed bytes and 39,117,707 decompressed bytes; its compressed SHA-256 is `54ecec0a4a63c4e7e7eefc935c1b2f3005c900e2c8cbba61013712dd7c7b04bf`. All 34 main-campaign milestone saves match their submitted payload checksums and metadata; all 34 also pass the **current** `decodeEnvelope` validation and exact encode/decode round trip (`save-integrity.json`). The initial save exactly matches current `createGame('Campaign 1', 1)` with ¥12,000,000. The final saved state checksum is `7bcf9924eb4c44aec3027b69a0c870f6ace62e65b682407a603fa19b6042618d`.

The submitted list of 28 core API source hashes matches the current checkout. In the independent bounded branch, all 18 actually loaded runtime TypeScript modules separately matched the historical source hashes and remained unchanged afterward. This establishes applicability of the recorded economic logic; it does not validate the changed v0.9.0 UI/audio. The author's full and per-phase replay results are preserved as **submitted evidence**, rather than presented as a new independent 1,400-week run.

## What the recorded route actually does

The inspected `policy.ts` creates one seed-1 company, advances canonical state only through `applyAction` and `advanceWeek`, and records executed actions. Candidate planning uses speculative `applyAction` plus the public **expected** `previewWeek`, then applies only the chosen action to the canonical state. It does not advance candidates to inspect future settled outcomes. Market company selection uses paid research and displayed profit ranges; system offers use paid investigation and conservative disclosed values. No cash/reputation setter, synthetic campaign fixture, hidden realized-benefit selector, or future-price lookup was found in the executed policy. The two founder manager/loan comparisons are separate branches and do not merge their funding into the main campaign.

This is the same authoritative action validation and settlement code used by the product, but a script can cheaply compare many settings and exact expected previews. It is not evidence that an ordinary player can execute the same choices, discover the strategy, or navigate the current interface at the same pace.

The native UI probe reached a normal new-company screen with ¥12,000,000. It then timed out while waiting for the `経営` button to be visible/enabled/stable; it did not execute the campaign through UI. The submitted failure log, screenshot, and earlier Node type-transform failure were retained rather than hidden. No page exception was recorded in that probe, but a click timeout alone cannot establish whether the cause was the test locator, layout/animation, or product behavior. No native/browser follow-up was allowed in this review.

Recorded milestones are credible under the reviewed API route:

- IPO action occurs at state week 17, after 16 profitable settlements and six stores. Cash goes from ¥13,131,256 to ¥95,948,948; share issuance and founder share counts are recorded.
- First direct acquisition occurs at week 29; first market-company acquisition at week 41.
- The **last acquisition action** for the 100 market companies occurs at week 901; all market companies are operating by state week 907. A summary milestone after the next settlement must not be described as the actual purchase week.
- After 1,400 settlements the saved state is week 1401, cash ¥15,309,512,260, actual report-1400 net profit ¥30,395,728, and brand evaluation 86.796618. All 100 market companies and four districts are operating, but only 7/8 direct targets are owned: 107/108 businesses overall. `metropolitan-rail` still requires evaluation 88 and ¥980,000,000.

All 1,400 recorded actual net profits are positive for this one route. This does not prove guaranteed returns, all-strategy reachability, stock trading skill, or robustness to other seeds and poor decisions. The main trace contains company research/acquisitions and equity financing, **no stock buy/sell actions**. Predicted `events.profit`, checkpoint profit, or `campaign.weeklyProfit` must not be relabeled as settled results; the actual report fields are distinct.

The author's 17.061 seconds are automated script runtime. `humanPlaySeconds` is null and `humanThirtyHours` is explicitly unmeasured. There is no supported conversion from 1,400 simulated weeks to 30 human hours, nor evidence here about comprehension, boredom, pacing, or UI friction over that period. The three PRs are three phases of the **same** run, not three independent playtests.

## Credit plateau and bounded escape

`src/sim/engine.ts:125` selects a profitable delegated plan under its staff/advertising envelope, with candidate satisfaction at least 65; it does not maximize brand evaluation. In the submitted policy, `policy.ts:55` delegates all stores once the third exists, while `policy.ts:59` only improves quality on stores with no manager. That latter loop stops applying after full delegation. The final settled store satisfactions are 100, 100, 95, 67, 72, and 65, average 83.166667.

`src/sim/engine.ts:329` derives the weekly brand target from actual average store satisfaction: `clamp((average − 35) × 1.7 + (netProfit > 0 ? 5 : −15), 0, 100)`, then moves evaluation 3.5% of the remaining distance. The final average therefore targets 86.883333, below the remaining acquisition gate of 88 (`src/data/district.ts`, `metropolitan-rail`). More cash or indefinitely waiting with the same operating settings does not fix this mismatch. Positive profit alone is not enough.

The only independent simulation was a bounded normal-action branch, recorded in `bounded-credit-branch.mjs` and `bounded-credit-branch.json`. It starts from the external final save after current validation, not a freshly injected fixture or an independent reproduction from week 1. The submitted original save is untouched.

1. Apply one legal `updateStore` to `store-miyashita-11-17`: manager off, quality 100, price ¥850, staff 6, advertising ¥0. Cash and reputation are identical before and immediately after this action. The expected preview is separately labeled; no future settlement is used to select the action.
2. Advance five actual weeks. Changed-store settled satisfaction is 90–92, total average 87.333–87.667, and actual group net profit remains positive (¥30,140,313–¥30,997,245). At state week 1406 brand evaluation is 88.003192 and cash ¥15,461,950,859.
3. Execute ordinary `acquire` for `metropolitan-rail`, paying exactly ¥980,000,000. The achievement remains absent immediately after acquisition.
4. Advance one actual week. Report week 1406 has net profit ¥33,174,000; state week 1407 records the first achievement with 8 direct subsidiaries, 100 market businesses, four districts, and cash ¥14,515,124,859. Final state SHA-256: `54a5145a915932c4cc6727462bdc92a970114f73671edb92532dbddab1237dcc`.

`src/sim/campaign.ts:7` correctly requires all eight direct targets, all 100 market companies operating, all four completed active districts, listing, and a continuing solvent company. `src/sim/campaignAchievement.ts:21` records completion only during an actual profitable settlement. The branch confirms both the ordinary escape and the settlement-only achievement boundary. It proves these points for this saved seed and path, not every possible campaign.

## Smallest follow-up

No economic rebalance, free reputation, lower final gate, altered achievement requirement, broad simulation, or new framework is justified by this evidence. `src/ui/DirectAcquisitionCard.tsx:27` already shows current/required brand evaluation. If a later UI change is desired, add a short explanation beside the unmet condition—brand evaluation responds to **settled store satisfaction**, and delegated profit-first plans may need a quality/price review—with a link to existing store management. This addresses the recorded confusion without adding another unexplained metric. This review implements no product change.

For later human acceptance, the remaining work is actual current UI play and timed usability/pacing observation, especially first financial decisions and the final unmet-condition recovery. Preserve the API evidence and its disclaimers; do not substitute it for that work or claim a successful 30-hour campaign.

Reproduce only the bounded check, with Node 24 and the preserved downloads:

```sh
node --experimental-transform-types /tmp/shibuya-external-traces-review/bounded-credit-branch.mjs
```

It reads current source modules, checks all 34 saved payloads and round trips, performs one settings action, six actual weekly settlements and one acquisition, writes only `/tmp` verification JSON, and checks the external final save and loaded source files remain unchanged.

# D01 independent validation

Asset-specific subdirectories contain measured GLB reports, real Blender import
reports, and independent front/three-quarter/roof renders. Each report is pinned
to the authored GLB's SHA256. A PNG render is supporting evidence, not a substitute
for a recorded visual review.

The scope is standalone assets only. No application source, street placement,
save data, full-project tests, production build, or deployment is changed or
validated here. Browser loading/performance and in-city composition remain the
integrating maintainer's checks.

Validation scripts and reproduction instructions:
[`scripts/external-v080/validation`](../../../../scripts/external-v080/validation/).

## Setup verification — 2026-10-07

- Blender 4.3.2 is available and real GLB import works.
- CPU Cycles rendering works; this build has no OpenImageDenoise support, so the
  independent render script disables denoising.
- A generated 2 m cube smoke test passed exact bounds, ground, counts, import,
  and all three review camera renders. The smoke-test files remain outside the
  deliverable and are not counted as a completed building.
- The byte inspector's eleven focused tests passed. These are validator tests,
  not the application's full-project test suite.

Building acceptance is recorded below only after stable author handoff and
pixel inspection of the actual final GLB's render.

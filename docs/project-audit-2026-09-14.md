# Project audit — 2026-09-14

The audit covered the existing working tree, including the unfinished bevel-pair stock-bore changes. All reproduced defects found during this audit were fixed. Verification establishes the results below; it does not prove every possible custom parameter combination is error-free.

## Structure reviewed

ProtoLab is a static React/TypeScript application with Three.js previews and generated FreeCAD recipes. Its 80 independent part packages own their geometry, configuration and catalog data. Private copies of mechanical helpers are intentional package isolation. Shared application code handles validation, preset search, storage and exports; Python scripts prepare offline supplier data.

## Fixes

- `tests/reference-gears.test.ts` imported the raw bevel definition without its catalog selectors. The stock-bore assertion therefore could not find the wheel selector. It now tests the package entry point used by the application.
- `tests/gear-bores.test.ts` assumed every sourced gear bore was round. It now checks the newly sourced wheel keyways explicitly, including verified width and unverified prototype depth, while retaining the round-bore checks for other presets.
- `src/App.tsx` called `crypto.randomUUID()` outside its save error handler. That API is unavailable on ordinary HTTP LAN origins. Preset IDs now use `crypto.getRandomValues()` through `src/core/storage.ts`, and ID creation is inside the save handler. A regression test uses a crypto object without `randomUUID`.
- `scripts/cache-promtehimport-web.py` skipped an assigned dimension on the last input line and failed when the destination cache directory did not exist. Both cases now have regression tests. The Python tests also run in the GitHub Pages build workflow.
- Gear documentation now describes the six mounting references and 25 additional stock-bore configurations, with a saved native validation report.

## Verification

| Check | Result |
| --- | --- |
| Complete initial `npm test` run | 649 tests: 647 passed, 2 failed; no cancellations; 477.8 seconds |
| Both affected gear test files after correction | 14/14 passed |
| New storage regression plus CI fingerprint tests | 6/6 passed |
| Python importer tests | 6/6 passed |
| Final application build | Passed |
| Final test TypeScript check | Passed |
| Final package validation | All 80 packages and 12,763 presets passed |
| Whitespace/error check | `git diff --check` passed |

The two failures in the initial complete run are the two gear tests listed above. Their complete test files were rerun after correction; the expensive full suite was not repeated. The newly added storage test was run separately.

Browser verification covered development and final production builds at desktop and 390×844 mobile sizes. The 3D previews rendered, both stock-bore selectors worked independently, the separated assembly state updated, and a temporary preset survived a page reload. The temporary preset was removed after checking. Final browser warning/error logs were empty.

An initial development tab displayed an old Vite `Missing required package file: README.md` overlay. Reloading cleared it. All required package files were present, and package validation passed; no current missing-file defect was reproduced.

The native stock-bore audit (generated local report) passed all five pairs in FreeCAD 1.0.2: 150 bore/keyway probes, valid closed solids, independent component movement, and STEP/FCStd round trips. All measured pair intersections were zero. Maximum preview/native differences were 0.0475% in volume and 0.000409 mm in bounds.

## Remaining limits

Vite reports a large application chunk: approximately 11.25 MB minified, 0.91 MB compressed with gzip, plus the Three.js chunk. This is a loading/performance concern; the production build and browser checks passed. No bundle-splitting refactor was made during the audit.

Native FreeCAD validation in this audit covered the changed stock-bore pairs. The full JavaScript suite covered catalog validation, sampled geometry, STL and generated macros across the library. Arbitrary custom parameter combinations and continuous manufactured gear contact were not exhaustively checked.

# Library script verification

The complete audit of the 14 October 2026 library snapshot (Europe/Kyiv) finished with no failures or timeouts. It covered 203 physical library packages, all 418 authored family/state pairs and all 18,819 catalog presets in both Simple and Full modes. Native execution covered every default/state and the listed valid numeric boundaries. Every preset macro was generated and syntax compiled in its first authored state. Native execution of all 18,819 catalog presets was outside this finite scope.

| Check                                       |     Simple |       Full |      Total | Failed or timed out |
| ------------------------------------------- | ---------: | ---------: | ---------: | ------------------: |
| Native execution: authored-state defaults   |        418 |        418 |        836 |                   0 |
| Native execution: valid numeric boundaries  |        320 |        320 |        640 |                   0 |
| **Native execution total**                  |    **738** |    **738** |  **1,476** |               **0** |
| Syntax compilation: authored-state defaults |        418 |        418 |        836 |                   0 |
| Syntax compilation: catalog presets         |     18,819 |     18,819 |     37,638 |                   0 |
| **Syntax compilation total**                | **19,237** | **19,237** | **38,474** |               **0** |

Native execution used FreeCAD 1.1.4, build 2026-09-28, commit `4fd3bf320d9566a27e60069fc8387448aaa3a094`. The current resume regenerated every planned macro and compared its SHA-256 with existing evidence before reusing a pass. Native reuse also required the same installed runtime signature. It reused 1,192 native passes and performed 284 fresh native executions; it reused 21,602 syntax passes and freshly compiled 16,872 macros. Changed macros and previous failures were checked again. No generator or topology defect remained in the completed scope, and no checks or timeouts were weakened.

Both audit processes exited successfully. Their reports contain exactly the freshly planned current-source case keys, cover every one of the 203 package identities and have empty `active` and `resumeCache` records. Completion times are `2026-10-13T22:42:54.730Z` for native execution and `2026-10-13T23:12:21.404Z` for syntax compilation, both 14 October in Europe/Kyiv.

Local evidence is preserved in ignored `test-results/library-script-audit/`: [native results](../test-results/library-script-audit/native-2026-10-14.json), [syntax results](../test-results/library-script-audit/catalog-syntax-2026-10-14.json), [runtime identity](../test-results/library-script-audit/runtime-2026-10-14.json) and [coverage summary](../test-results/library-script-audit/summary-2026-10-14.json). Each case identifies its package, configuration variant, state, mode, exact macro SHA-256 and outcome.

The separate [standoff catalog verification](standoff-catalogs.md) includes native supplier-interface specimens and authored per-end fixtures for female/female, female/male, male/male, metric/UNC and self-tapping interfaces. The [current standoff hash comparison](../test-results/library-script-audit/standoff-source-hash-proof-2026-10-14.json) confirms that all 20 existing source-associated native macros exactly match their current generated catalog scripts. This comparison performed no additional native executions and does not revalidate unrecorded hashes of the separate 38 authored interface fixtures.

Historical evidence remains available: the 12 October snapshot contained 200 packages, 415 authored states and 14,371 presets, with [1,466 native passes](../test-results/library-script-audit/native-modes.json) and [29,572 syntax passes](../test-results/library-script-audit/catalog-syntax.json), also without failures or timeouts. The [preview thread correction proof](../test-results/library-script-audit/preview-thread-macro-hash-proof.json) preserves 74 equal before/after macro hashes from that earlier correction. Historical totals are not the current-library totals above.

Run `npm run audit:library` with a FreeCAD Python runtime installed. The runner executes complete product macros rather than treating successful string generation as a geometry check.

The default scope checks every family default in every authored state, in Simple and Full modes. It also executes up to two valid numeric boundaries per editable family. Every catalog preset is syntax checked in its first authored state in both modes. Native execution of every catalog preset is outside this finite scope; the report lists every actual case so coverage can be reviewed.

Each native case runs in an isolated FreeCAD process and verifies the product identity, configuration, state, mode, document root, valid closed components, positive solid volume and finite bounds. The production macro also checks configured dimensions and annotation counts. This validates script execution and topology; it does not establish supplier dimensions, mechanical fits or manufacturing approval.

The JSON report is saved atomically as progress arrives and every 15 seconds during long checks. Its `active` entries list the current case, elapsed time and generation/execution stage. `--resume` reuses passed cases only when the generated macro has the same SHA-256; native results also require the same installed FreeCAD runtime signature. Failures and timeouts are rerun, with their exact family, mode, state, input and error retained.

An interrupted recheck retains unvisited previous results in `resumeCache`. They do not count toward the current run until their hashes are checked again, so repeated interruptions preserve useful work without reporting stale passes.

Workers load only the current product and its declared dependency closure. They restart after 100 completed cases to bound retained module and geometry caches; `--worker-cases` controls that limit. Each native macro still runs in a fresh FreeCAD process. Lower `--jobs` when large assemblies compete for memory; concurrent cases share the same per-case timeout budget.

```sh
# Complete default scope, including catalog syntax.
npm run audit:library -- --report /tmp/library-audit.json --jobs 2

# Native defaults/states only while diagnosing an existing failure.
npm run audit:library -- --phase native --modes simple --extrema 0 --report /tmp/library-native.json

# Resume an interrupted run or verify corrected generators.
npm run audit:library -- --resume --report /tmp/library-audit.json

# Focus a repeat without generating large intermediate macro fixtures.
npm run audit:library -- --phase native --parts bolt-screw,hex-nut --modes simple,full --report /tmp/fastener-audit.json

# Separate expensive native execution from catalog compilation.
npm run audit:library -- --phase native --jobs 2 --report /tmp/library-native.json --resume
npm run audit:library -- --phase syntax --jobs 1 --report /tmp/library-syntax.json --resume
```

Set `FREECAD_PYTHON` and `FREECAD_LIB` for a different installed runtime, or pass `--native-python` and `--python-lib`. Syntax checks use `python3` unless `--syntax-python` is supplied. On this macOS workspace the configured default is the FreeCAD application runtime.

Per-case generation and execution timeouts default to 180 seconds for Simple and 600 seconds for Full. Override them with `--timeout-ms` and `--full-timeout-ms`. A timeout is an incomplete check and remains a failing report result; it is never counted as a successful geometry check.

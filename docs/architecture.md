# Application architecture

ProtoLab is a static application with three execution contexts: the React interface, isolated geometry/export workers, and Node.js package tooling. Product IDs, parameter keys and the package API are shared across these contexts. Geometry algorithms and source data stay inside their existing part packages.

## Catalog and selection

`src/parts/index.ts` is the generated complete registry used by the application and Node tooling. `src/core/lazy-parts.ts` loads only requested products and their declared dependency closure inside a worker. Package discovery and boundary checks live in `scripts/part-modules/`.

Each package consumes its complete local `presets.json`. Frame source metadata is projected into those snapshots only by the explicit `scripts/sync-frame-presets.ts` refresh; `--check` reports stale snapshots without writing. Configurator objects and option lists belong to their own package, including fields derived from another declared dependency.

Catalog responsibilities are divided by purpose:

- `core/preset-search.ts` builds the search index, applies constraints and computes facets.
- `core/preset-browser.ts` defines scope changes, field presentation, selected-preview review and pagination as pure functions.
- `components/usePresetBrowser.ts` memoizes browsing data; `PresetBrowser.tsx` renders the controls and owns local presentation state.
- `core/catalog-models.ts` defines physical model identity and catalog attribute matching.
- `core/preset-resolution.ts` resolves a matching preset and preserves an explicitly selected matching supplier. Project procurement uses an explicit matching selection rather than inferring a supplier for a custom configuration.
- `core/part-selection.ts` reconciles selection after a package changes, retaining compatible edits and valid text values.

Fixed catalog products keep their source identity when independent pose or accessory controls change. Editable geometry requires a complete parameter match before retaining source evidence. Separate configurations retain their own geometry and placements even when they share the same purchased article.

Files, configuration links and saved presets use the same configuration parser. Optional explicit preset IDs preserve the selected supplier when several products share dimensions; an invalid explicit ID fails validation. Documented inspection controls can use `catalogIdentityParameters` for nominal source matching while retaining their actual geometry parameters and distinct physical configuration keys.

## Background jobs

`components/requestWorkerOutput.ts` owns worker creation, response-kind checks, cancellation, timeouts and cleanup for preview, library export and project export. Each request gets an isolated worker, and every completion path releases its worker and listeners. Preview input is coalesced in `useAssemblyPreview.ts`; stale results cannot replace the current selection.

`core/library-output.ts` distinguishes a builder result, including transferable buffer references, from the actual worker response. Transfer lists are passed to `postMessage` separately from the response payload.

`core/file-import.ts` gives parameter and project imports one revision-based read lifecycle. Both ignore results and errors from older reads; parameter imports also cancel after a selection or manual edit. `components/viewer/model-resources.ts` restores the source appearance and visibility before a cached model is reused, removes viewer-added edges and disposes shared resources once per cleanup.

Package discovery caches completed dependency inspections within one operation. Shared dependencies are inspected once, cycles still fail while traversing unfinished branches, and each new operation reads changed files again. Project validation and supply lists index occurrences by parent instead of repeatedly scanning the complete assembly.

Affected CI package checks use the same batch command as local checks. The
checker preflights the selected packages and their shared dependency graph once,
then validates and reports presets for the requested package IDs. A local run
over the twelve workshop jig packages and 74 presets took 1.31 seconds with the
batch command, compared with 9.42 seconds across separate processes.

## Production build

`scripts/build/native-cad-data.ts` emits the supported source CAD JSON payloads as content-addressed JavaScript modules. Their data values remain unchanged. Product metadata, presets and fabrication settings stay on the ordinary JSON path. The application and worker builds use the same asset policy, and source changes are registered with the build watcher.

`scripts/build/bundle-report.ts` writes `dist/bundle-report.json` during a production build. The report follows static dependencies from the entry point and the immediately imported application module, including emitted CAD modules. It also lists total JavaScript size and the largest files. Sizes are uncompressed emitted bytes; they exclude CSS, fonts, HTML, HTTP compression and later runtime requests.

The main interface still loads the complete catalog at startup. Moving CAD payloads out of a large code chunk does not reduce their total download by itself. A future asynchronous catalog must introduce an explicit metadata/runtime boundary and wait for real definitions before validating projects or saved presets; placeholder geometry or validation functions would violate the package contract.

## Verification

`npm test` checks the test graph and runs the suite. `npm run build` checks the application graph and creates the production output. `npm run parts:check` verifies package boundaries, while `npm run check:language` checks the repository's English source requirement.

Focused tests cover catalog scope transitions, source identity across pose changes, selected supplier retention, text reconciliation, worker cancellation and cleanup, CAD asset emission and startup dependency accounting. Browser verification covers the actual search controls, model preview and exports after a production build.

### Full catalog cost review, 2026-11-03

The five contracts in `tests/helpers/part-contract.ts` execute a finite matrix.
The dimensions contract builds a preview and separately calls `part.dimensions`;
these three assembly families implement dimensions by constructing another model.
The macro contract calls `generateScript`, whose expected-dimensions check also
constructs a model, and independently calls `part.python` again to verify the
complete embedded source. The STL contract builds every default inspection state.
Invalid-input checks reject parameters before geometry construction.

| Family                | Geometry samples, including default | States per sample | Sample/state cases | Full render evaluations across the five contracts |
| --------------------- | ----------------------------------: | ----------------: | -----------------: | ------------------------------------------------: |
| `automatic-tube-saw`  |                                   8 |                16 |                128 |                                               400 |
| `automatic-band-saw`  |                                   7 |                14 |                 98 |                                               308 |
| `cnc-milling-machine` |                                   2 |                11 |                 22 |                                                77 |

The render totals are three times the sample/state matrix, plus the default
state count. Python-source generation runs twice per sample/state case: 256,
196 and 44 calls respectively. Each matrix includes the default and an equal
first preset under separate labels; parameter comparison must ignore object-key
order to recognize that equality. This review did not change that coverage.

At the observation point, the owned workers had accumulated roughly 34, 36 and
21 CPU minutes respectively. One-second process samples showed active
JavaScript execution, allocation and string conversion rather than a blocking
wait. Optimized JavaScript frames were not symbolized, so these samples do not
identify the current test/configuration or prove a completion time. Long CPU
time and sparse buffered TAP output alone do not establish an infinite loop.
The earlier band-saw geometry test took 341 seconds for 19 configurations with
two render evaluations each; the full catalog matrix performs substantially more
work. The running verification was left intact.

This test cost is separate from interactive worker preview.
`core/library-output.ts` measures the already prepared preview model directly;
it does not call `part.dimensions` and rebuild that model for the displayed size.

A possible future optimization is reuse within one assembly render and within
one Python-source generation call. A metadata-only assembled-state audit found
987 tube-saw occurrences but 351 distinct geometry definitions, and 1,017
band-saw occurrences but 252 distinct definitions. The CNC renderer already
uses a local template cache. Extending that approach could preserve occurrence
placements, names, independent materials and correct resource disposal while
avoiding repeated evaluation of identical definitions. A source cache would
reuse only an identical native body; occurrence identities and metadata must
still be generated separately. Such a change needs measured before/after
performance, independent dimensions coverage and retained model/state, native
geometry, source-identity and export checks. Deriving declared dimensions solely
from the same prepared preview would remove their independent contract and is
not this optimization. No production code, geometry, test scope or tolerances
were changed by this review. Raw process snapshots and samples are local output
under ignored `test-results/refactor-parallel/`.

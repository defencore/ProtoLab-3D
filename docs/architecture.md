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

## Background jobs

`components/requestWorkerOutput.ts` owns worker creation, response-kind checks, cancellation, timeouts and cleanup for preview, library export and project export. Each request gets an isolated worker, and every completion path releases its worker and listeners. Preview input is coalesced in `useAssemblyPreview.ts`; stale results cannot replace the current selection.

`core/library-output.ts` distinguishes a builder result, including transferable buffer references, from the actual worker response. Transfer lists are passed to `postMessage` separately from the response payload.

## Production build

`scripts/build/native-cad-data.ts` emits the supported source CAD JSON payloads as content-addressed JavaScript modules. Their data values remain unchanged. Product metadata, presets and fabrication settings stay on the ordinary JSON path. The application and worker builds use the same asset policy, and source changes are registered with the build watcher.

`scripts/build/bundle-report.ts` writes `dist/bundle-report.json` during a production build. The report follows static dependencies from the entry point and the immediately imported application module, including emitted CAD modules. It also lists total JavaScript size and the largest files. Sizes are uncompressed emitted bytes; they exclude CSS, fonts, HTML, HTTP compression and later runtime requests.

The main interface still loads the complete catalog at startup. Moving CAD payloads out of a large code chunk does not reduce their total download by itself. A future asynchronous catalog must introduce an explicit metadata/runtime boundary and wait for real definitions before validating projects or saved presets; placeholder geometry or validation functions would violate the package contract.

## Verification

`npm test` checks the test graph and runs the suite. `npm run build` checks the application graph and creates the production output. `npm run parts:check` verifies package boundaries, while `npm run check:language` checks the repository's English source requirement.

Focused tests cover catalog scope transitions, source identity across pose changes, selected supplier retention, text reconciliation, worker cancellation and cleanup, CAD asset emission and startup dependency accounting. Browser verification covers the actual search controls, model preview and exports after a production build.

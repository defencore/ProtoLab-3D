# Independent part packages

The development unit is `src/parts/<part-id>/`. Keep the part's controls, defaults, presets, geometry, FreeCAD recipe and validation in that folder. A package may expose editable geometry or select fixed manufactured models. The application discovers packages and renders their schemas; adding a part does not require editing the UI or a list of imports.

## Files to edit

| File              | Responsibility                                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.ts`        | Package descriptor: API version, literal ID, display order and optional initial-selection preference.                                                                                            |
| `part.ts`         | Part metadata, parameter definition, validation, model states, preview geometry, FreeCAD recipe, dimensions and update callbacks. Factory-based parts delegate some of these to private helpers. |
| `configurator.ts` | The migrated packages' ordered catalog selectors. In newly generated packages, this file also owns the full parameter schema and defaults.                                                       |
| `presets.json`    | Complete preset configurations, stable IDs, labels and source evidence. It includes both catalog records and prototype examples.                                                                 |
| `lib/`            | Private domain helpers and reference values. Editing these affects this package only.                                                                                                            |
| `README.md`       | Instructions for this particular package.                                                                                                                                                        |

For example, `hex-nut/part.ts` uses its own nut factory under `hex-nut/lib/`; its thread implementation is private to that folder. An assembly can include private implementations of its components. Editing the standalone component does not silently change the assembly. To make the same improvement in several packages, update and verify those packages explicitly.

The full numeric and conditional schema has not been artificially moved out of every existing definition. Follow the imports from `part.ts` to find a factory-owned field. The folder remains the complete handoff boundary regardless of how its files are organized internally.

## Edit an existing part

1. Start the application with `npm run dev` and select the part.
2. Edit its `part.ts`, local configurator or private helper. Keep preview geometry, FreeCAD geometry and reported dimensions consistent.
3. Save the file. Vite updates the selected definition and preview. Compatible user edits remain; new untouched defaults and schema changes are reconciled.
4. Run the focused package check and TypeScript check:

```sh
npm run parts:check -- hex-nut
npm run typecheck
```

The package check validates the import boundary, IDs, API version, configurator defaults and preset parameters. It executes the part's validation function; it does not run the FreeCAD kernel or establish that geometry is mechanically correct. Run relevant geometry tests, inspect the preview and execute the generated macro when changing shape construction. Use `npm run build` before returning a handoff.

### Application checks and implementation tests

`npm run typecheck` and `npm run build` compile the application from its browser and Vite entry points. They follow the generated public registry and the current package imports. Historical test files, offline catalog tools and unreferenced private files are not application entry points. Reorganizing a package's private helpers, or removing a complete package folder, therefore does not break the application because an old test still imports a previous file path.

The existing geometry tests remain available. Some deliberately inspect a particular part's private algorithms or fixtures; those are implementation tests maintained alongside that implementation, not part of the portable module contract. After reorganizing private code or removing a part, update the affected tests and dedicated verification scripts before running the complete project checks. Public application code and other part packages must not depend on those private paths.

```sh
npm run typecheck:tests
npm test
```

`typecheck:tests` uses `tsconfig.tests.json` to check the full test graph and part-package CLI tooling. `npm test` includes that type check before executing the tests, so CI retains both checks. Passing an application build establishes that a returned package integrates with the application; it does not imply that historical private implementation tests are current or that its geometry has been verified.

Keep IDs and parameter keys stable when their meaning stays the same, so saved configurations remain identifiable. When changing a field's type, options or allowed range, update the defaults and all affected presets in the same package.

## Add a part

```sh
npm run parts:create -- mounting-pad --name "Mounting pad"
npm run parts:check -- mounting-pad
npm run dev
```

This creates a complete working spacer template at `src/parts/mounting-pad/`. Replace its shape and labels with the intended component. The starter's `configurator.ts` exports `parameters` and `defaults`; `part.ts` imports them. Add catalog selectors there or use another package-local file, then include them in the final part definition.

The generated registry at `src/parts/index.ts` is not hand-maintained. Vite watches package folders for additions and removals. The development/build hooks and `npm run parts:sync` generate the same registry for browser and Node consumers. Build, typecheck and test commands also synchronize it. Each folder under `src/parts` is inspected as a package; the required `index.ts` and other files, IDs and import boundaries are checked before registration.

Every `index.ts` has this form:

```ts
import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';

const part = {
  ...definition,
  id: 'mounting-pad',
  catalogSelection,
};

export default { apiVersion: 1, order: 800, part } satisfies PartModule;
```

The folder name must match the literal lowercase, hyphen-separated ID. IDs must be unique. `order` is a finite numeric display order, with ID used to break ties. Optional `part.defaultSelection: true` selects the initial part; only one package in the library may declare it. New packages should normally omit that preference. The API version identifies the supported package contract.

## Configurator contract

The final `PartDefinition` owns its parameter schema and defaults. The generic configurator supports numeric, select and boolean fields. `category` and `subgroup` locate the component in the library; each field's `group` arranges its controls.

Use `visibleWhen(parameters)` for variant-dependent fields. Hidden fields remain part of the configuration and must retain valid types and finite numeric values. Use `updateParameters(parameters, changedKey)` when changing a variant needs to initialize related dimensions; preserve other user values. A number with no physical unit uses `unit: ''`.

Use `catalogSelection` to choose the ordered inline size filters. These definitions belong to the part, including labels and metric-thread formatting:

```ts
import type { PartDefinition } from '../../core/types';

export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [
  { key: 'diameter', label: 'Metric thread', format: 'metric-thread' },
  { key: 'length', label: 'Length' },
  { key: 'head', label: 'Head type' },
  { key: 'drive', label: 'Drive type' },
];
```

Each key must exist in the schema. Only source-verified, filterable parameters produce catalog choices. Setting `catalogSelection: []` disables inline catalog selectors. If omitted, the generic selector can use the first four `presetMatchKeys`. There are no hardcoded part IDs or category tests in this selection behavior.

`presetMatchKeys` also selects the initial conditions for **Find matching**. Choose useful fitting dimensions and shape choices. Other schema parameters remain available to advanced search unless marked `filterable: false`; use that flag for internal metadata that should not be searched as a part size.

### Fixed manufactured models

Set `catalogSelectionOnly: true` when the user should select an existing manufactured model rather than edit its dimensions. The configurator then shows a model catalog and the remaining pose/accessory controls, without a custom-dimensions mode. For example, `servo-motor` has one `model` select parameter and three pose/accessory parameters; its case dimensions and electrical ratings are read-only catalog attributes.

Declare the searchable characteristics in `catalogFilterFields`, using `ParameterDefinition` labels, types, units, groups and select options. These fields have their own keys and do not belong in `defaults` or a preset's `parameters`. Their values come from `preset.catalog.attributes`. Keep catalog field keys distinct from editable parameter keys. Optional `catalogSummary: true` displays a characteristic on a model card; `catalogCondition: true` displays a contextual value, such as the reference voltage, below the card's summary.

```ts
import type { ParameterDefinition } from '../../core/types';

const catalogFilterFields: ParameterDefinition[] = [
  {
    key: 'caseWidth',
    label: 'Case width',
    type: 'number',
    unit: 'mm',
    group: 'Dimensions',
    catalogSummary: true,
  },
  {
    key: 'referenceVoltage',
    label: 'Torque / speed test voltage',
    type: 'number',
    unit: 'V',
    group: 'Electrical performance',
    catalogCondition: true,
  },
];
```

Catalog numeric filters have inclusive minimum and maximum bounds; empty bounds are unrestricted. Select and boolean filters require the selected published value. Missing attributes mean unknown: a model remains eligible without that filter and is excluded when that characteristic is required. Invalid or reversed numeric bounds produce an error rather than matching models. Filtering does not change the current model; selecting a result applies its stored configuration.

The `model` value must select a fixed package-owned geometry record. Validation should reject unsupported model IDs and obsolete dimension parameters; geometry should not derive physical sizes from filter inputs. `updateParameters` can adapt pose limits when a different model is chosen. The existing `catalogSelection` parameter selectors remain a separate contract for packages that expose catalog sizes of editable geometry.

Relational validation belongs to `validate(parameters, state)`: check that bores fit, walls remain positive, coils have clearance and other dependent dimensions agree. Schema min/max limits cannot express those relationships. If states are provided, geometry, validation, Python and dimensions must interpret the same state IDs.

## Presets and source evidence

`presets.json` is the package's runtime snapshot. Every preset needs a unique stable `id`, English `name` and `description`, and complete `parameters`, including hidden fields. Examples omit `catalog` and are shown as prototype examples.

A sourced record includes `catalog.designation`, `sourceName`, `sourceUrl` and `verifiedParameters`. Optional metadata includes manufacturer, standard, product codes, alternative source URLs and reference specifications. `verifiedParameters` names only values established by that source; a standard name alone does not establish unspecified internal dimensions.

For a supplied drawing, use `catalog.sourceKind: 'attachment'` and an app-relative `references/<unique-name>.png` backed by `public/references/`. Optional `specifications` is an array of read-only `{ label, value }` source details, such as a load rating. It does not certify edited geometry.

`catalog.parameterRanges` may record explicitly published numeric intervals, such as `bore: { min: 6, max: 8 }`. Advanced search uses inclusive interval overlap. Applying the result uses its stored parameters; an interval does not make every possible edited value an independently verified measurement.

`catalog.attributes` records published fixed-model characteristics as a dictionary of numeric, string or boolean values. Every key must have a corresponding `catalogFilterFields` definition, numeric values must be finite, and select values must match declared options. These are source facts used for search and display; they are not passed into geometry as editable parameters. Omit unknown values instead of storing zero, an empty string or a guessed rating.

`catalog.attributeConditions` maps characteristic keys to readable measurement conditions or reasons a value is unavailable. It may explain an omitted attribute, such as an unreported current. Keep conditions specific: a torque/speed reference voltage does not establish the voltage for a current measurement unless the source says so. Preserve source URLs and human-readable specifications alongside numeric attributes so a result remains reviewable.

For a fixed catalog model, `verifiedParameters` identifies the source-owned model identity, for example `['model']`. Shared source matching compares those identity parameters, allowing pose, optional accessories and state to change without losing the manufacturer's identity in the UI or FreeCAD metadata. That identity does not claim every modeled detail or illustrative accessory is source-dimensioned. Record verified dimensions, approximations and conflicts in package-local evidence and notes. Packages with editable geometry retain exact full-configuration source matching.

## Geometry and FreeCAD

Use millimetres and native Z-up coordinates. Define a useful part origin and keep `dimensions` consistent with both representations. The viewer handles display orientation.

The Python recipe can use `App`, `Part` and `math` supplied by the application wrapper. It must assign a valid `shape`. Use the SDK's `num(...)` for numeric literals. A single manufactured body should be fused into a single solid where appropriate.

For an assembly, return `Part.makeCompound` with direct children representing independently movable physical components. A nested compound can preserve a multi-solid component as one logical unit. Optional `component_labels` and `component_colors` must match the direct-child order; colors are RGB triples from 0 to 1. The wrapper creates an `App::Part` parent and component features, preserves placements and attaches configuration/source metadata. See [the assembly export guide](freecad-assemblies.md).

## Shared SDK and independence

The supported outside-package imports are the generic SDK modules `types.ts`, `geometry.ts`, `mechanical.ts`, `solid-union.ts` and `part-modules.ts` under `src/core`, plus the installed Three.js and JSCAD packages. The SDK provides contracts and generic primitives; application export and validation wrappers are supplied to the workbench by its host. Fixed-model packages declare catalog data through these contracts, without importing application UI components.

The generic `catalog-models.ts` helper belongs to the host. It centralizes attribute lookup, inclusive model filters and source-identity matching for the application catalog and export wrappers. Runnable handoffs must carry this helper with the host files that import it, so fixed-model source metadata behaves consistently outside the main app. A standalone workbench can select the same model through its schema controls without reproducing the full library's filter UI; the package's fixed geometry and published attributes remain intact.

Domain-specific algorithms belong under the part's own `lib/`. Imports from another part, `src/catalog`, UI components or arbitrary dependencies are rejected by package inspection. Copy a needed domain helper into the package instead of linking across that boundary. The deliberate duplication allows a developer to improve one part without altering its siblings. A change to the shared SDK is an application-wide change and needs broader verification.

## Export a runnable handoff

Choose a new destination outside `src/parts`:

```sh
npm run parts:export -- hex-nut /tmp/hex-nut-handoff
```

The handoff includes:

- The complete selected package at `src/parts/hex-nut/`.
- The SDK and host wrappers needed to run it.
- A small standalone configurator, Three.js preview and FreeCAD script workbench.
- Referenced local drawings, dependency declarations and a `part-module.json` manifest.

The recipient runs these commands inside the handoff:

```sh
npm install
npm run dev
npm run build
```

Edit the package folder and return the complete handoff with its manifest intact. The workbench uses the same module code as the main application. Its UI is a development harness, so it does not reproduce every application feature or the full library browser. Keep application-wide SDK changes separate: import does not apply them.

## Import the result

From the main project:

```sh
npm run parts:import -- /tmp/hex-nut-handoff --replace
npm run parts:check -- hex-nut
npm run typecheck
npm run build
```

Omit `--replace` when importing a new ID. Import statically checks the package boundary and manifest before installing it, replaces only `src/parts/<id>/` and keeps an existing package under `.part-module-backups/<id>/`. Backups remain outside the registry. Import does not run the handed-off part's code as its preflight; `parts:check`, the development app and build subsequently evaluate the module.

Referenced drawings are copied with the package. An existing shared reference file with different contents is rejected; give an edited image a new unique filename and update the package's reference URL. SDK files and the workbench are not copied back into the application. The registry updates automatically.

## Refreshing catalog snapshots

Offline import/build scripts still prepare supplier data under `src/catalog`. They do not change a package merely because the application starts or rebuilds. The explicit final sync transfers refreshed records into the selected package:

```sh
node --import tsx scripts/sync-package-catalogs.ts bolt-screw --check
node --import tsx scripts/sync-package-catalogs.ts bolt-screw
npm run parts:check -- bolt-screw
```

Use `--all` instead of the part ID to inspect or update the complete library. `--check` performs validation and reports pending changes without writing; it exits with status 1 when a refresh is available. No mode of this command requests catalog pages or repeats a crawl.

The sync uses Gvyntok bolt/set-screw, special fastener, hand-nut, hardware and cotter adapters, plus generated Promtehimport records. It updates matching generated IDs or supplier records, adds new records and retains examples and other sources. It does not remove a last-known record merely because it is absent from a later input. Product availability remains outside the snapshot's purpose. Manually transcribed reference tables without a refresh adapter remain local to their packages.

Every resulting preset is validated against the package's current schema before any file is written. If an independent part change makes an upstream row incompatible, sync stops with the part/preset ID; adapt the offline mapping or the local data explicitly. Applying a refresh replaces source-owned fields in matching records, so review deliberate local changes before opting in. Previous `presets.json` contents are saved under a `.catalog-snapshot-backup-*` directory outside `src/parts`.

This explicit synchronization keeps catalog maintenance available while preserving the package as the independent unit of development and handoff.

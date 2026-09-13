# ProtoLab 3D

A browser-based library of configurable mechanical parts for quick FreeCAD prototyping. Find a component in the category tree, adjust its dimensions, inspect its 3D preview, and bring the generated solid geometry into an existing FreeCAD document.

The application is a static React / TypeScript / Three.js site built with Vite. It runs without a backend and is suitable for GitHub Pages. The interface, generated Python, and source comments are in English.

## Run locally

Use Node.js 22 or later.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The default development port is `8080`, with the application at `http://localhost:8080/`.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

The production output is `dist/`. Vite uses `/` as the base for the custom domain `https://protolab.defencore.com/`, including JavaScript, styles and reference images. The GitHub Actions Pages workflow builds and uploads this directory; enable **Settings → Pages → Source → GitHub Actions** and set the custom domain in the repository. Deploying instead to a repository URL such as `https://defencore.github.io/ProtoLab-3D/` requires changing the Vite base to `/ProtoLab-3D/` before rebuilding.

## Working with parts

- Browse category → subgroup → component, or press `/` to search names, descriptions, keywords, and preset sizes.
- Use **Catalog sizes** in the configurator for everyday selection. For bolts and screws, choose thread → length → head → drive. Each choice narrows the remaining catalog options and automatically selects a matching part in the 3D preview. Matching product cards, counts and supplier links remain beside the model; clicking a card applies it immediately.
- Switch to **Custom dimensions** to enter precise numeric dimensions and fine-tune the geometry.
- Open **Browse presets** for advanced searches by designation, standard, manufacturer, supplier SKU or source. Its sidebar keeps the model visible while you filter by category, part type, numeric ranges and shape choices. Clicking a result immediately updates the model and its parameter review.
- **Find matching** turns the current part's main dimensions and choices into editable search conditions. Remove individual conditions or widen their From/To ranges. Blank endpoints are unbounded, and both ends of a range are included. Browse all bearing types to compare available bore/outside diameter/width combinations.
- Choose a sourced catalog preset, a prototype example, or enter your own dimensions. Invalid configurations display an explanation and disable export.
- Orbit, pan, and zoom the preview. Use the camera and rendering controls to inspect the model.
- Where available, select an assembled/exploded bearing state or a free/loaded spring state. The selected state is used by every export.
- Save named presets in this browser. Presets use local storage and are not synced to another device.

**Copy Python** puts a one-line `exec(...)` command on the clipboard. In FreeCAD, open **View → Panels → Python console**, paste the command, and press Enter. The macro adds a single solid as a `Part::Feature`, or an assembly as an `App::Part` containing independently selectable component features. Expand the assembly in the model tree to hide components or change their **Placement**; moving the parent moves the complete assembly. The macro uses the active document, creates a document if necessary, and wraps creation in a transaction.

The download menu provides:

| Format                     | Result                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| FreeCAD macro (`.FCMacro`) | Standalone Python that constructs OpenCASCADE solid geometry in FreeCAD.                                  |
| STL (`.stl`)               | Binary triangle mesh of the current preview, with coordinates in millimetres.                             |
| Parameters (`.json`)       | Part ID, dimensions, model state, format version, and units. This is configuration data, not a CAD model. |

For STEP, run the macro in FreeCAD, select the created object, and use **File → Export**. Use **File → Save** for an FCStd document. The browser does not run the FreeCAD geometry kernel.

## Included library

The library uses independent part modules, including the requested bearing families, fasteners, springs, guides and transmissions. The live library displays the current module count.

| Category                | Components and variants                                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bearings                | Deep groove, self-aligning, single/double-row angular contact and double-row radial ball bearings                                                                     |
| Bearings                | Cylindrical, spherical, tapered and drawn-cup needle roller bearings                                                                                                  |
| Bearings                | Rod ends, LM/LMK/LMF ball bushings, ball/cylindrical/spherical thrust bearings, combined needle/ball and needle/axial roller bearings                                 |
| Bearing accessories     | Pillow blocks, two/four-bolt flange units, UC inserts, drawn-cup and CSK one-way clutches, spherical plain bearings, adapter sleeves and radial oil seals             |
| Fasteners               | Bolt & screw: hexagonal, countersunk, pan, button, socket cap and custom polygon heads                                                                                |
| Fasteners               | Independent drive: none, hex, slot, cross, six-lobe, square and custom polygon                                                                                        |
| Fasteners               | Wing screws, swing-eye bolts and lifting-eye bolts; set / grub screw, including an M2.5 × 8 cone-point preset; flat, chamfered, cone, dog and cup points              |
| Fasteners               | Hex, thin, high, coupling, square, flange, nylon-lock, all-metal-lock and domed nuts; wing/eye nuts; washers; circlips and E-rings; spring/cotter pins; threaded rods |
| Springs                 | Compression: cylindrical, conical, barrel and hourglass, with open or reduced-pitch ends                                                                              |
| Springs                 | Extension: independent full eyes, open hooks, side eyes or straight tails, with end-plane rotation                                                                    |
| Springs                 | Torsion with independent legs and bends; double torsion; flat spiral strip                                                                                            |
| Motion                  | Spur, helical/herringbone and approximate bevel gears; worm drive; straight rack; utility wheel                                                                       |
| Linear motion           | Profile rail and round-shaft guide with moving carriages, recirculating balls and cutaway views                                                                       |
| Linear motion           | Ball screw assemblies and standalone nuts: SFK, SFU, SFS, SFE, DFU, SFI, DFI, SFH and SFY; machined ends and helical ball raceways                                    |
| Linear motion           | Ball screw linear axis: six prototype presets with dual profile rails, moving table, fixed/floating bearing supports and cutaway view                                 |
| Motion                  | D25 L30 jaw coupling with independent bores, clamp screws and elastomer spider; six dimensioned bevel gear pairs; miniature m0.5 pinions                              |
| Enclosures & structural | Open enclosure, L bracket and round spacer                                                                                                                            |

Standard fastener selection starts with the available catalog thread and length sizes. **Custom dimensions** exposes thread pitch, handedness, coverage, start offset from the tip, length and smooth shoulder diameter. Choose a modeled helical thread, a smooth thread envelope or no thread. Countersunk nominal length includes the head; other headed fasteners use length under the head. Irrelevant fields disappear when a variant changes. Switching head or point type initializes sensible editable dimensions.

All eleven nut families include modeled internal 60° metric threads by default, with coarse pitch selected from the metric diameter, editable fine pitch and handedness, and a smooth-envelope option. Source presets use the pitch for their own size. Nylon inserts retain an undeformed smooth bore and remain separate from the threaded metal body. See [nut thread geometry and verification](docs/nut-threads.md).

Gear shaft connections offer seven bore shapes: round, hexagon, D-shaft, double D, square, custom polygon and round with keyway. Relevant controls expose bore rotation, flat depth, polygon sides and keyway dimensions. Hexagon and square bore sizes are measured across flats; round, D and keyed holes use the shaft diameter. The preview and FreeCAD export use the selected profile.

Spring and guide states affect the generated geometry and every export. Profile guide presets cover MGN7, MGN9, MGN12 and MGN15 in C and H lengths. Bearing construction choices include cylindrical and K/K30 tapered bores where applicable, along with supported closure variants. Guides can export their assembled arrangement or individual components, and carriage position is editable. Spring pin free and installed states have separate outside and slit envelopes.

Size presets are reference geometry. The preset browser separates **Sourced catalog dimensions** from **Prototype examples**. Each catalog result links to its supplier product, listing or dimensional drawing and identifies the parameters recorded from that source. Numeric catalog filters only match these recorded parameters; illustrative internal dimensions cannot accidentally qualify a catalog part. Other dimensions remain editable prototype settings. The catalog is an offline snapshot. Product availability and prices are not tracked. Identical geometry across finishes is grouped into one preset, preserving each original product code for search.

Supplier import scripts enumerate every public category page and retain the original SKU, product URL and size text. Geometry adapters then admit only supported, validated configurations. Gvyntok bolt/screw inventory covers 55 categories, 148 pages and 5,901 visible products; the other supplied Gvyntok sections contain 958 nuts, 606 washers/rings, 186 threaded rods and 272 pins/cotters/clamps. Sidebar totals sometimes differ from actual visible result counts; coverage reports distinguish those discrepancies from extraction errors. Promtehimport enumeration covers 510 pages and 11,977 distinct product URLs. Its product-table import resumes from a saved cache; the current completed and pending counts are in the coverage report. Discovered URLs are not counted as usable presets until dimensions have been retrieved and validated.

[CATALOG_COVERAGE.md](CATALOG_COVERAGE.md), `src/catalog/data/*coverage.json` and the supplier mapping reports record admitted presets, unavailable dimensions, unsupported geometry and conflicting rows. Full supplier inventories are audit inputs. The browser uses local per-package preset snapshots, without raw product descriptions and crawl metadata. The UI and generated model descriptions remain English. Source dimensions were reviewed on 2026-09-13; chamfers, thread clearances, cages and unspecified internal details remain prototype settings.

Additional source links remain under **Reference dimensions & sources** in each configurator. Gvyntok also supplies DIN 1481 pin references, HIWIN supplies MGN envelopes and mounting dimensions, and KHK supplies gear formula references. Presets with cross-referenced dimensions identify the additional source: examples include Norelem DIN 6796, WasherKing DIN 1440, and HepcoMotion LMK/LMF mounting dimensions. Supplier interchangeability and unlisted tolerances are not inferred from a matching nominal size. GrabCAD links supplied as examples identify shape families; their downloadable models were not imported or redistributed.

An exact sourced configuration also embeds its designation, source URL and recorded dimensions as FreeCAD object properties. Editing a dimension removes that source attribution unless the complete configuration matches a catalog preset again.

The eight supplied reference images are available from the relevant presets. The extension includes all 27 SFU table rows, 38 unique jaw-coupling bore pairs, four miniature spur pinions and all 12 bevel table rows arranged into six pairs. Ball screws have 131 nut configurations and 230 assembly presets, including 100–550 mm miniature shaft lengths. Two listing codes without a matching drawing, `SFK602` and `SFE3210`, remain explicitly unverified examples. See [ball screw coverage](docs/ball-screw-catalog.md) and [gear reference mapping](docs/reference-gears.md). Reference load ratings are read-only source specifications and do not certify edited models.

The [native validation report](data/reference-expansion-native-validation.json) records FreeCAD solid checks, STEP round trips, sampled clearances and preview comparisons for the reference expansion. Repeatable ball-screw checks are documented in the [validation guide](docs/ball-screw-catalog.md#repeating-native-validation).

The [assembly export guide](docs/freecad-assemblies.md) explains component editing and the guided ball screw axis. Its [native audit](data/freecad-assembly-validation.json) covers 39 complete macros, independent component movement, STEP/FCStd reload and rollback cleanup.

Worm drives include one to four worm starts, linked shaft rotation and separate-component exports. Their wheel profile is a clearance-adjusted layout approximation, not a conjugate manufacturing tooth surface. Wing and eye nuts include modeled internal threads; forged details remain simplified.

## Independent part packages

Each part lives in one folder under `src/parts/<part-id>/`. That folder contains its configurator, presets, preview, FreeCAD recipe, validation and private helpers. Editing a nut's private thread code affects that nut only. You can hand a complete package to another developer, run it in an isolated workbench, and import it back without changing the application UI or registering imports by hand.

```text
src/
  App.tsx                       Application state and commands
  components/                   Generic library, configurator, viewer and preset browser
  core/
    types.ts                    Parameter and PartDefinition contracts
    part-modules.ts             Versioned package contract and validation
    geometry.ts                 Generic mesh primitives
    mechanical.ts               Generic boundary meshes and section construction
    solid-union.ts              Generic mesh boolean operations
    freecad.ts                  Application export wrapper
  parts/
    index.ts                    Generated registry; do not edit manually
    <part-id>/
      index.ts                  Package API version, stable ID and display order
      part.ts                   Definition, geometry, FreeCAD recipe and validation
      configurator.ts           Local configuration metadata
      presets.json              Complete local preset snapshot and source evidence
      lib/                      Private domain helpers, when needed
      README.md                 Instructions for this package
  catalog/                      Offline supplier inputs and refresh adapters
scripts/
  parts.ts                      Create, check, export, import and registry tools
  sync-package-catalogs.ts       Explicit offline supplier-to-package refresh
```

The migrated packages define their numeric and conditional parameter schema in `part.ts` or a private factory under `lib/`; their `configurator.ts` defines ordered **Catalog sizes** selectors. The new-part template separates its parameter schema and defaults into `configurator.ts`. Both layouts keep all editable part behavior in the same package. Its local README explains where to edit it.

Part-specific thread, bearing, spring and gear helpers are intentionally private copies. Packages may share only the small geometry/type SDK and the installed Three.js/JSCAD dependencies. The boundary checker rejects imports into another part or the application catalog. `src/catalog` remains an offline data preparation layer; the browser uses each package's `presets.json`.

Vite discovers added or removed package folders and regenerates the registry. Existing-file edits update the live preview and configurator through hot reload. The application resolves the selected module by ID, applies updated untouched defaults and preserves compatible edits. Removed fields, unsupported values and removed states are reconciled against the new definition. A part's `defaultSelection: true` metadata chooses the initial selection; only one package may declare it.

See [the part package guide](docs/part-modules.md) for the contract, editing workflow, examples, source metadata and handoff details.

## Refreshing supplier presets

Run the import scripts explicitly when a new offline snapshot is needed. They read public catalog pages and do not interact with carts or accounts. Cached pages allow interrupted imports to resume.

```sh
python3 scripts/import-gvyntok-fasteners.py
python3 scripts/import-gvyntok-hardware.py gajki
python3 scripts/import-gvyntok-hardware.py shajby-koltsa
python3 scripts/import-gvyntok-hardware.py shpilki
python3 scripts/import-gvyntok-hardware.py shplinty-i-strubtsiny
python3 scripts/build-hardware-presets.py
python3 scripts/build-cotter-presets.py
python3 scripts/import-promtehimport.py --workers 2
node --import tsx scripts/build-promtehimport-presets.ts
node --import tsx scripts/sync-package-catalogs.ts bolt-screw --check
node --import tsx scripts/sync-package-catalogs.ts bolt-screw
node --import tsx scripts/report-catalog.ts
```

The final sync is explicit and scoped to one part. Use `--all --check` to review every package, then `--all` to refresh all supported supplier snapshots. `--check` makes no changes and exits with status 1 when updates are pending. The sync reads existing offline adapter outputs; it never crawls websites. It validates the resulting presets before writing, preserves examples and unrelated sources, and backs up changed snapshots outside `src/parts`. Refreshing upstream catalog inputs alone does not overwrite an independently edited part package. See [catalog refresh behavior](docs/part-modules.md#refreshing-catalog-snapshots).

Review coverage and any source conflicts before accepting refreshed data. The hardware builder transcribes the linked supplier drawings and preserves nominal versus clearance diameters. Models do not infer missing envelope dimensions from price, names or nearby products.

## Adding a part

Create a complete starter package:

```sh
npm run parts:create -- mounting-pad --name "Mounting pad"
npm run parts:check -- mounting-pad
npm run dev
```

The template starts with a working spacer, so its preview and FreeCAD export can be tested immediately. Change its schema, geometry, labels and categories in `src/parts/mounting-pad/`. The package ID stays stable; folder discovery updates the generated registry automatically.

Export an existing part, including the local code, SDK and referenced drawings, to a new folder outside `src/parts`:

```sh
npm run parts:export -- hex-nut /tmp/hex-nut-handoff
```

The recipient runs `npm install`, `npm run dev` and `npm run build` in that handoff folder. Its workbench shows the part's own controls, presets, states, 3D geometry and generated FreeCAD macro. Return the complete handoff folder with `part-module.json` intact, then import it into the main project:

```sh
npm run parts:import -- /tmp/hex-nut-handoff --replace
npm run parts:check -- hex-nut
npm run typecheck
npm run build
```

Import replaces only the selected package and keeps its previous version under `.part-module-backups/`. SDK and workbench edits are not imported into the application. Omit `--replace` for a new part ID. Shared reference assets are never silently overwritten: an edited drawing needs a unique filename. No UI changes or manual registry edits are needed.

## Geometry scope

These components are prototype references. The detailed notes beside each configurator describe the simplifications.

- Bearing preset numbers identify nominal external envelopes. Raceways, seals, cages and mounting forms are represented where supported; unspecified internals and load ratings remain simplified or omitted; the geometry is not a certified catalog replacement.
- Bolts and set screws can generate real helical geometry with a truncated single-start 60° reference profile. Fit tolerances and thread runout are omitted. Cross and six-lobe drives approximate their shape families and are not certified tooling profiles. Slotted drives are closed pockets. Nut bores use modeled internal 60° metric profiles by default, with a smooth-envelope option. Nylon inserts remain undeformed smooth-bore components.
- Round-wire springs use continuous capped wire paths in both exports. Extension and double torsion CAD bodies use ruled circular-section lofts; other round-wire springs use sweeps. Compression ends can use reduced pitch but are not ground. The flat spiral uses rectangular strip sections. Loaded states do not predict force, torque, stress, fatigue, or buckling. Validation rejects coil and sampled wire interference; it is not a structural analysis.
- Gear flanks use sampled involutes with radial root relief instead of cutter fillets. Helices use ruled section segments. Bevel gears are explicitly approximate layout models. Seven selectable shaft-bore profiles support round, flattened, polygonal and keyed connections; they do not establish a fit tolerance. Profile and round-shaft guides include closed ball return circuits and cutaway states. LM/LMK/LMF bushings include ball circuits, cages and end wipers. Raceway sections, return chambers and internal mounting threads remain simplified.
- Ball screws model helical raceways, loaded balls, mounting flanges, return features and configurable end journals. Return routing, preload, clearances and contact profiles are prototype details; C5/C7 records a requested class without certifying lead accuracy. The ball screw linear axis combines a screw, two rails, a moving table and bearing supports; its six presets are prototype layouts, and the plates, journals and support bearings are custom geometry. Jaw coupling clearances, spider stiffness and clamp threads are not established by the listing.
- The enclosure is open at the top. Brackets have square corners. Add application-specific holes, fillets, supports, and clearances in FreeCAD.
- A macro creates static solid features with configuration metadata on their part or assembly parent. Assembly components remain independently movable. Metadata is not a live FreeCAD parametric feature; change dimensions in ProtoLab and generate another part.
- STL follows the preview tessellation and can contain multiple contacting or intersecting shells for assemblies. It is intended for interchange and inspection; use the FreeCAD solids for further CAD operations and prepare meshes for the intended printing workflow.
- JSON configurations can be exported and restored with **My presets → Import parameters**. Browser presets can be lost if site storage is cleared.

## Verification

`npm run parts:check -- <part-id>` checks a single package boundary, API, schema, defaults and preset parameters. `npm run parts:check` checks the complete library. `npm test` runs offline catalog, geometry, export, and validation checks, without requiring a FreeCAD installation. `npm run typecheck` and `npm run build` verify the TypeScript application and production bundle.

The generated recipes are also checked with a local FreeCAD runtime during development. Checks include validity, positive solid volume and agreement with preview dimensions. Gear checks include all defaults/presets; fastener checks exercise head, drive, thread and point variants; spring checks exercise presets, states and end profiles. Runtime checks establish that the recipes execute and produce the intended geometry; they do not establish engineering suitability or exact manufacturer internals. In-memory shape checks do not add objects to user documents. Full macro checks use a temporary document and restore the previously active document.

GitHub Pages deployment follows the [official custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). Push to `main` after enabling the GitHub Actions Pages source to publish. Pull requests run tests and builds without deploying.

### Reusing successful CI verification

Every workflow run installs locked dependencies, checks TypeScript and test contracts, validates all part packages and presets, and builds the production site. The npm download cache speeds up installation; the geometry tests themselves are CPU work.

The full suite is reused only when an exact successful result exists for the same test inputs and Node runtime. `scripts/ci-test-key.mjs` hashes tracked file paths and contents under `src/`, `tests/`, `scripts/`, `data/`, `public/` and `.github/workflows/`, plus the package manifests and root TypeScript configurations. The key also includes the exact Node version, operating system and architecture. Changes, additions, removals and renames invalidate the result. Add any future test inputs outside these paths to the fingerprint contract.

Deployment-only files (`vite.config.ts`, `index.html`, `CNAME`) and documentation outside those directories do not invalidate geometry results; their build and TypeScript checks still run. UI source changes conservatively invalidate the full suite too. A cache miss or eviction runs `npm test` normally. There are no partial-key matches, failed runs never write a success marker, and pull requests can consume the main branch cache but cannot publish one.

The first run after introducing this cache must finish the full suite once. Later deploys with unchanged inputs skip that expensive step. A newer push queues behind a running workflow instead of cancelling its tests and starting from zero; GitHub retains only the newest pending run for that branch. Local `npm test` always runs the complete suite. To force fresh verification in GitHub, choose **Actions → Build and deploy GitHub Pages → Run workflow → full_tests**. The workflow summary says whether tests executed or an exact successful result was reused.

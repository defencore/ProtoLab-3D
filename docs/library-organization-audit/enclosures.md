# Enclosures & devices section audit

Historical section review, 2026-11-03, before curator integration. Some recommendations below were implemented in the same organization pass; use the [integrated review](../library-organization-audit.md) for completed changes and remaining work. Runtime counts describe that review snapshot. Raw snapshots and logs are optional local evidence under ignored `test-results/`; this document preserves the section findings in the repository.

Scope: current worktree, 13 physical packages, 532 runtime presets, two navigation entries. Source code was not changed. Root acts as library curator.

## Inventory and organization

Path: Enclosures & devices → Enclosures & devices → General-purpose enclosures → **Enclosures** shared catalog:

- `catalog-enclosure` (489 fixed supplier presets; model selector, supplier/type/dimension/material/mounting/IP/lid filters).
- `enclosure` (3 editable open-top box examples; Envelope and Construction groups).
- `printed-rim-enclosure` (6 examples; `model` already parameterizes stepped/groove/labyrinth seam construction).
- `printed-self-centering-enclosure` (3 examples; independent tapered-pilot architecture and locating controls).
- `printed-screw-enclosure` (3 examples; `headStyle` already selects compatible recessed/countersunk hardware).
- `printed-bayonet-enclosure` (3 examples; lug count, turn angle and fit are parameters).
- `printed-threaded-enclosure` (2 complete can/cap assemblies; diameter/lead/engagement/envelope/fit parameters).
- `printed-threaded-shell` (4 reusable individual can/cap definitions; `model` selects body/cap; conditional controls and identity parameters implemented).
- `field-daq-enclosure` (4 fitted DAQ executions; enclosure/connector/board-retention/manufacturing/inspection controls).
- `grandado-tube-mount` (2 tube cassette/template examples; shared tube datums and independent interfaces/inspection controls).
- `jcg108-tube-fairing` (4 orientation/cable examples; antenna model and airflow direction remain parameters).
- `underwater-pressure-enclosure` (2 source-native kit portions generated from `lib/catalog.json`; its on-disk empty `presets.json` is not the runtime preset source).

Separate path: same collection/category → Handheld controllers → `handheld-lora-controller` (7 presets). Body model, antenna type and conditional external antenna installation are already independent axes.

## Immediate, source-preserving corrections

1. **Update stale navigation documentation:** `docs/enclosure-catalog.md` still advertises a Catalog enclosures subgroup, `Enclosures & devices → Catalog enclosures`, and one package per library entry. Current code and `docs/library-structure.md` use one 12-member Enclosures catalog under General-purpose enclosures. Its current-structure table omits most templates, Field DAQ, the fairing and pressure kit. Replace those statements/table with current catalog/member semantics; preserve package IDs.
2. **Normalize authored preset typography:** `printed-rim-enclosure/presets.json` and `printed-self-centering-enclosure/presets.json` use `x` and `/`; use `×` and `·`. `printed-screw-enclosure/presets.json` uses `/`; use `·`. `printed-threaded-shell`, `printed-threaded-enclosure` and `printed-bayonet-enclosure` titles identify diameters as bare `36 mm`/`54 mm`; use `Ø36 mm`/`Ø54 mm`. For shell presets, e.g. `Printed can · Ø36 mm · 3 mm lead`; retain IDs/parameters/catalog evidence. This is a presentation correction, not a geometry change.
3. `catalog-enclosure` is plural despite the singular part-name convention. Its shared navigation name is already Enclosures; a safe physical-package title would be **Supplier enclosure**. Coordinate test expectations in `tests/enclosure-navigation.test.ts` and any other direct name assertions. Source preset labels remain independent; do not mass-prefix supplier designations without checking the canonical catalog names.
4. **Repair stale test inventory:** `tests/enclosure-navigation.test.ts:46` asserts an obsolete five-member Enclosures list, omitting `jcg108-tube-fairing` and six printed packages. Align it with all 12 members, preferably maintaining an explicit reviewed inventory. Current behavior agrees with `tests/printed-enclosure-library.test.ts` and current structure docs.

## Grouping and identity decisions

- Do not merge the five closure architectures into one geometry definition merely because they are all enclosures. They already occupy one navigation entry, while their distinct native geometry, fit controls, composition and service states remain independently testable.
- Do not merge `printed-threaded-shell` with its complete assembly: one defines separately reusable manufactured parts; the other is an assembly using those definitions. This is appropriate definition reuse, not a duplicate product.
- Keep fitted Field DAQ, tube mounting kit and Heltec platform identities separate. Size/closure variants within these platforms are already parameters/presets. A generic super-package would mix unrelated layouts and interfaces.
- Keep current `handheld-lora-controller` IDs and values, including stored `original`, `contoured`, `web-grip`, `top`, `compact-top`. Visible names already describe physical forms. Top and Compact top now share geometry according to the field description; treat this as a saved-selection compatibility question, not grounds to delete IDs during organization work.
- No package-ID or preset-ID rename is justified by the reviewed inventory. Qualified IDs retain source and project identity. Static JSON inspection found no duplicate preset IDs or visible names in any section package. Runtime-generated pressure-kit IDs are `tube-flange` and `dome-pressure-plate`.

## Parameters and states

Groups are generally coherent: product/model first where applicable; geometry/envelope; interfaces/fit; manufacturing; inspection. Purchased catalog models reject dimensional overrides. Meaningful alternative states are implemented explicitly (assembled/open/exploded/print; bayonet unlocked; fitted service/component/coupon states). `printed-threaded-shell` and simple `enclosure` omit artificial state choices. The catalog limits cover and replacement-cover states through `availableWhen`; Grandado body selections are deliberately physical states. No shape/state changes are proposed by this audit.

Optional later work: standardize authored envelope group titles (`Envelope` versus `Enclosure`) after cross-section curator review; any shared enclosure configurator refactor must preserve local parameter IDs, inactive-field normalization, composition identities and actual preview/native geometry. No new engineering verification is needed for documentation/typography changes, but geometry consolidation would require it.

## Executed checks

`node --import tsx --test tests/enclosure-navigation.test.ts tests/printed-enclosure-library.test.ts`: 7 tests, 6 passed, 1 failed. Only failure is the pre-existing stale five-member expected inventory described above. Passing checks cover alternate classification views, localized/family search, all four DAQ executions in the common chooser, exact-ID resolution, and inspection-state identity through project JSON.

Not performed: full application build, package checks, native CAD execution or source-dimension validation. No geometry was modified.

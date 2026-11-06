# Electronics mounts organization audit

Historical section review, 2026-11-03, before curator integration. Some recommendations below were implemented in the same organization pass; use the [integrated review](../library-organization-audit.md) for completed changes and remaining work. Runtime counts describe that review snapshot. Raw snapshots and logs are optional local evidence under ignored `test-results/`; this document preserves the section findings in the repository.

Scope: all four current ELECTRONICS MOUNTS packages, 20 presets and four browse entries. Source/metadata inspection only. Root is the library curator. No source edits, package checks, geometry execution or export verification were performed by this analyst.

## Complete coverage

| Physical package ID             | Presets | Function and decision                                                                                                                                                                                                             |
| ------------------------------- | ------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `electronics-module-adapter`    |       9 | One manufactured insulating adapter: two editable universal horizontal/upright designs and seven fixed case-fit executions. Keep geometry choices inside the existing model selector.                                             |
| `pcb-retention-mount`           |       5 | One-to-four-board carrier with optional removable sliding locks and support modes. Dimensions, board count, seat height, locks and anti-flex modes are already parameters. Distinct retention mechanism from strap/grid adapters. |
| `recovery-electronics-mount`    |       5 | Separate fixed lower platform, upper disc and three source retainer designs. Model selector correctly identifies real physical details; plain retainer is reused for two occurrences.                                             |
| `recovery-electronics-platform` |       1 | Source seating-study assembly composed of the two plates, three electronic modules and four retainer occurrences. Keep separate from the detail family and generic carriers.                                                      |

All packages share Electronics → Electronics mounts → Module adapters. Their package/folder identities agree; all 20 local preset IDs and visible titles are unique within their packages (JSON scan). No package/preset ID rename or new shared catalog is justified. Assemblies and physical details are intentionally distinct, rather than duplicate configurations of one item. A common Electronics mounts umbrella already exists in navigation; another merged chooser would obscure the difference between one adapter, a configurable carrier, a fixed source detail and its assembled layout.

## Immediate safe metadata improvements

- Add concise optional browse labels while preserving physical names: `electronics-module-adapter` → **Electronic module adapter**; `pcb-retention-mount` → **PCB retention mount**; `recovery-electronics-mount` → **Recovery electronics mounting detail**. `recovery-electronics-platform` is already clear.
- Root has aligned `recovery-electronics-mount` model selector options with canonical preset titles. Retain that single source of visible names.
- Add `mm` to recovery detail dimensions (`Ø81 × 5 mm`, `3 × 1 × 8.7 mm`) without rewriting source designations or inferred sizes. The plain and two relieved retainer models must remain separate identified selections.
- Normalize PCB carrier title separators from `/` to `·`: **Single PCB · 80 × 60 mm**, **Four PCBs · underside support**. Slash-separated actual module designations such as ADS1220 / CJMCU-1220 describe related identity names and should not receive blind global replacement.
- Replace the platform's chronological visible preset title **Current ZX908 / JHE42B / USB seating layout** with **ZX908 · project JHE42B · SpeedyBee USB seating layout**. Keep `pem-current`, the source revision record and fixed geometry unchanged. The project JHE42B reference is not the standard manufacturer JHE42B.
- The subgroup name Module adapters is narrower than the current platform/retention contents; a later display-only label such as **PCB & module mounts** could be clearer. Do not silently move/rename stored taxonomy keys or add extra navigation levels solely for four entries.

## Parameters and model states

`electronics-module-adapter` correctly hides universal dimensions for fixed fitted adapters, resets incompatible dimensions when switching to a fitted model, and omits generic states for its single body. Do not make the source-fitted HAT/Heltec/BEC adapter into an arbitrary resized purchased-board fit.

`pcb-retention-mount` correctly groups PCB layout, per-board dimensions, seating, retention, anti-flex support, host integration and inspection. Service/Exploded availability is conditional on locks. Assembled and print states are meaningful; identity excludes hidden extra-board fields, inactive support/mounting controls and visual reference toggles. The mount uses configured manufactured-detail occurrences, while PCB installation references remain excluded from physical composition and fabrication exports.

`recovery-electronics-mount` correctly exposes a sole Component group and one default state per physical model. Do not reinterpret plate versus pad selection as inspection state. `recovery-electronics-platform` has real multi-occurrence inspection offsets and a composition that always returns canonical source positions. Its nine occurrences reuse one plain-pad definition twice. Keep the documented excluded posts, ties, fasteners and cable requirements unresolved instead of inventing components to make the assembly look complete.

## Evidence and remaining work

Reviewed all four `part.ts`, `configurator.ts`, `presets.json` and `GUIDE.md` files; `electronics-module-adapter/lib/model.ts`, `recovery-electronics-platform/lib/model.ts` and the runtime inventory. Existing guides contain earlier physical verification records; those were read, not rerun. This organization audit does not newly certify their geometry or fit. No deeper consolidation is required to make variant selection logical. Any future retention or adapter architecture change requires the engineering review workflow, qualified source identities and actual native export validation.

# Transmission and linkages organization audit

Historical section review, 2026-11-03, before curator integration. Some recommendations below were implemented in the same organization pass; use the [integrated review](../library-organization-audit.md) for completed changes and remaining work. Runtime counts describe that review snapshot. Raw snapshots and logs are optional local evidence under ignored `test-results/`; this document preserves the section findings in the repository.

Scope: all 28 current `TRANSMISSION & LINKAGES` packages, 917 presets and 25 initial browse entries. Root is the library curator. This is read-only source/organization review; no geometry, package or native-CAD checks were run.

## Complete coverage and grouping decisions

| Subgroup                  | Package IDs                                                | Decision                                                                                                                                                                |
| ------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shafts & keys             | `shaft-key`, `shaft`, `shaft-collar`                       | Different functions; keep separate. Key form, shaft construction and collar fixing already belong in their configurators.                                               |
| Gears & gear drives       | `spur-gear`, `helical-gear`, `bevel-gear`                  | Add shared **Gears** navigation catalog. Individual gear type is selected inside; retain three physical definitions, controls and IDs.                                  |
| Gears & gear drives       | `bevel-gear-pair`, `worm-drive`                            | Keep paired drives separate from individual gears. Their axis arrangements, motion relations and physical compositions differ.                                          |
| Reducers & differentials  | `gearbox`, `bevel-gearbox-42`, `faulhaber-planetary`       | A shared **Gear reducers** catalog is safe and useful: generic prototype constructions, 42 mm bevel executions and sourced FAULHABER models remain distinct selections. |
| Reducers & differentials  | `differential`                                             | Keep distinct: it distributes motion between outputs rather than selecting a simple reducer ratio.                                                                      |
| Belts chains & cables     | `belt-drive`, `chain-drive`, `cable-hardware`              | Belt type/pitch already parameterized; keep chain separate. Cable sheave/turnbuckle already one form-selector family.                                                   |
| Shaft couplings           | `shaft-coupling`, `jaw-coupling`, `cnc-precision-coupling` | Existing shared catalog correctly groups these sources; retain it. Coupling form, bore pair and fastening remain real configuration axes.                               |
| One-way clutches          | `one-way-clutch`, `csk-clutch`                             | Existing shared catalog correctly groups drawn-cup and ball-bearing/sprag executions; source IDs stay distinct.                                                         |
| Joints & rod ends         | `rod-end-bearing`, `clevis`, `universal-joint`             | Keep functional types separate. Universal versus ball-and-socket is already a form selector; clevis construction/thread/hand are already parameters.                    |
| Pistons & connecting rods | `piston`, `connecting-rod`                                 | Different load-path functions, not variants of one part. Crown, rings, bore and bearing-cap options already configurable.                                               |
| Motion mechanisms         | `mpr-10-demonstrator`, `linkage-mechanism`                 | Keep source demonstrator separate from generic topology examples. Generic four-bar/slider/yoke/scissor/pantograph/cam/ratchet/Geneva examples already share a selector. |
| Brakes                    | `brake`                                                    | Disc/drum forms already inside one family.                                                                                                                              |

The two proposed shared catalogs reduce this section from 25 to 21 browse entries without deleting physical definitions or changing geometry.

## Immediate safe metadata improvements

1. Add `gears` with members `spur-gear`, `helical-gear`, `bevel-gear`, primary `spur-gear`. Add `gear-reducers` with `gearbox`, `bevel-gearbox-42`, `faulhaber-planetary`, primary `gearbox`. All members already share their intended category/subgroup. Keep differential and drive pairs outside these catalogs.
2. Give individual gear presets an explicit type prefix, since generic titles become ambiguous inside a shared chooser: **Spur pinion · m1 · 20 teeth**, **Helical gear · right hand · mn1.5 · 24 teeth**, **Bevel gear · 45° · large-end m2 · 24 teeth**. Preserve the distinction between normal and large-end module; do not rewrite those quantities into one unqualified number.
3. Rename `shaft-collar` titles to **Set-screw collar · Ø12 mm bore** and **Split collar · Ø12 mm bore**. Normalize `cnc-precision-coupling` spacing and dimension separators: **R+W BK2/15/59 · Ø19 / Ø15 mm bores** (preserve original supplier designation in catalog records).
4. Use **Gear reducer** or shared **Gear reducers** in navigation instead of a supplier-only plural label. FAULHABER series/ratio/output characteristics remain selectable fixed source models, rather than resized geometry.
5. Standardize visible canonical state labels to **Assembled** and **Exploded** later, preserving existing IDs such as `jaw-coupling:assembly`; labels must not be confused with stable IDs. Group continuous `linkage-mechanism.phase` under **Operation** rather than **Dimensions** if parameter grouping is revised.

## Parameter and state findings requiring separate validation

- Do not immediately merge the three gear APIs. Spur uses an unshifted involute/profile-mode decision; helical uses normal module and a helix-angle constraint; bevel is explicitly a tapered layout approximation using large-end module and cone angle. A shared model chooser achieves simpler navigation while preserving those important differences. A common conditional type schema requires geometry, preset, identity and export review.
- `shaft-key` and `shaft` always generate one piece; their **Exploded** state is a no-op because shared `finish()` leaves singletons unchanged. `shaft-collar` has a separate screw only in detailed mode; `cable-hardware` has multiple pieces only for turnbuckle. Those state choices need conditional availability or deliberate reconciliation, not just new labels.
- `worm-drive`, `bevel-gear-pair`, `jaw-coupling`, `clevis`, `piston` and `connecting-rod` expose component-only states. Explicit `physicalStates` declarations were not found in these definitions; determine whether each means an inspection/export subset or a genuine physical product selection before changing project behavior. Do not infer separately purchased internals from visible solids.
- `linkage-mechanism` already has nine topologies and conditional fields; a prescribed `phase` is an operating pose, not a new library product. Its current geometry does not establish force capacity or a workable constrained mechanism. Do not consolidate the source demonstrator into it.

## IDs and evidence

All 28 package IDs in the runtime snapshot are unique, valid and stable. No semantic ID rename is justified. Existing `<part.id>:<preset.id>` references distinguish source executions; new browse catalog IDs must remain navigation-only. Keep supplier order codes, catalog designations and original source evidence unchanged.

Evidence reviewed: runtime `before.json`; `part.ts`, schemas and preset JSON for all listed families; individual gear source files and shared gear helpers; singleton state behavior in `shaft-key/lib/model.ts`, `shaft/lib/model.ts`, `shaft-collar/lib/model.ts`, `cable-hardware/lib/model.ts`; `library.ts`/browse-family contracts. The root must run the affected package checks, catalog/identity/navigation tests and project round trips after implementation. This audit does not certify tooth contact, tolerances, drive ratings, native geometry or production readiness.

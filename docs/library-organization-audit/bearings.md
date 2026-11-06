# Bearings and seals section audit

Historical section review, 2026-11-03, before curator integration. Some recommendations below were implemented in the same organization pass; use the [integrated review](../library-organization-audit.md) for completed changes and remaining work. Runtime counts describe that review snapshot. Raw snapshots and logs are optional local evidence under ignored `test-results/`; this document preserves the section findings in the repository.

Scope: current worktree, source inspection only. No package, geometry or export tests were run by this analyst. Root is the library curator.

## Complete inventory

All 32 packages (7,876 presets) belong under Motion → Bearings & seals. Current grouping yields 17 navigation entries. Package IDs match their directories; the inventory provides no reason to rename a physical ID.

| Subgroup               | Physical package IDs                                                                                                                                   | Presets |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------: |
| BALL BEARINGS          | `ball-bearing`, `flanged-ball-bearing`, `self-aligning-bearing`, `angular-contact-bearing`, `double-row-bearing`, `double-row-angular-contact-bearing` |    3978 |
| ROLLER BEARINGS        | `roller-bearing`, `spherical-roller-bearing`, `tapered-roller-bearing`, `needle-bearing`                                                               |    2889 |
| THRUST BEARINGS        | `thrust-bearing`, `thrust-roller-bearing`, `spherical-thrust-bearing`                                                                                  |     393 |
| MOUNTED BEARINGS       | `flange-2-bolt-bearing`, `flange-4-bolt-bearing`, `pillow-block-bearing`, `insert-bearing`                                                             |     329 |
| COMBINED BEARINGS      | `combined-bearing`, `zarn-bearing`                                                                                                                     |       8 |
| PLAIN BEARINGS         | `plain-bearing`, `plain-bushing`                                                                                                                       |     119 |
| BEARING MOUNTING       | `adapter-sleeve`, `bearing-locknut`                                                                                                                    |      58 |
| SHAFT SEALS            | `radial-oil-seal`                                                                                                                                      |      68 |
| STATIC SEALS           | `o-ring`, `seal-profile`                                                                                                                               |       6 |
| DAMPERS & ISOLATORS    | `vibration-mount`, `strut`                                                                                                                             |       3 |
| SLEWING BEARINGS       | `slewing-bearing`                                                                                                                                      |       2 |
| ECCENTRICS & FOLLOWERS | `eccentric-bearing`, `eccentric-bushing`, `eccentric-cam-follower`                                                                                     |      23 |

## Grouping and identity decisions

- Retain the existing Ball bearings, Roller bearings, Thrust bearings, Combined bearings, Mounted bearings and Plain bearings & bushings shared catalogs. Size, closure, taper and construction choices already reside in schemas/presets, rather than separate sidebar items. Stable physical IDs and qualified `<part.id>:<preset.id>` references remain essential for source and project identity.
- Do not collapse ball, cylindrical roller, tapered roller, needle, thrust and spherical constructions into one geometry family merely because bore/outside diameter/width match. Their geometry, contacts and valid construction controls differ. Existing shared catalogs achieve the useful navigation reduction without changing purchased executions.
- Preserve `plain-bearing` (spherical plain bearing) versus `plain-bushing` (editable sleeve/flange prototype). The common catalog is appropriate; their products are not interchangeable.
- Preserve the three eccentric packages: eccentric bearing, cam follower and eccentric bushing have different interfaces. Eccentricity and orientation are already parameters.
- Keep adapter sleeve and bearing locknut separately identified. A sleeve kit includes a locknut-shaped component, but this does not establish the same physical product as a separately configured locknut/washer pair. No sourced duplicate product was demonstrated.
- Do not merge generic static seal profiles with source-identified radial shaft oil seals. `o-ring` also supplies CAD cutting tools; seal output and tool output have distinct uses and should be clearly described.

## Immediate safe metadata improvements

1. Harmonize visible diameter labels to **Bore diameter**, **Outside diameter** and **Overall width** only where meanings truly agree; retain source symbols and special housing/seat labels. The current mix of Outer/Outside, Dimensions/Envelope, and generic vs qualified width makes adjacent catalog members harder to compare. Preserve all parameter keys and unit values. Evidence: package `part.ts`, `configurator.ts`, and `src/core/hardware/motion-bearing-utils.ts`.
2. Use **Closure** under **Bearing construction** consistently for closure controls. `double-row-bearing` currently labels the field **Seals** under **Rolling elements**, while `ball-bearing`, `flanged-ball-bearing` and `self-aligning-bearing` use Closure. Preserve `seals`/`closure` keys because saved configurations depend on them.
3. Change state display label **Assembly** to **Assembled** where appropriate, preserving `assembled` IDs. `double-row-angular-contact-bearing`, `zarn-bearing` and eccentric families currently differ from nearby rolling-bearing families. This is label consistency only; keep implemented internal inspection states.
4. `bearing-locknut/presets.json` titles **Ø25 thread**/**Ø40 thread** are ambiguous and omit units. Prefer **25 mm nominal thread diameter**/**40 mm nominal thread diameter** until pitch/profile is defined. Do not infer M25/M40 or a DIN KM size: the guide explicitly claims only a manually dimensioned KM/MB-style prototype.
5. Add mm consistently to nominal dimension tuples where source dimensions are shown (e.g. `radial-oil-seal` titles CX 14 × 28 × 7, some bearing dimensional suffixes). Keep original `catalog.name` and `catalog.designation` unchanged. These are typography changes, not new source evidence.

## Deeper parameter/state corrections

- **No-op exploded options:** `plain-bushing`, `o-ring` and `seal-profile` declare assembled/exploded, but each `lib/model.ts` creates exactly one Piece for every supported form/mode; `finish()` in `src/core/assembly/mechanical/helpers.ts` returns unchanged when fewer than two pieces exist. These options do not implement an alternate inspection state. Remove or make them unavailable in a separate state-contract correction, reconciling saved state selection and checking default/project behavior; do not merely rename them.
- **Conditional fields:** flange diameter/thickness in `plain-bushing` should be relevant only to flange form; groove width/depth in `o-ring` belong to groove-tool modes. Use existing visibleWhen/updateParameters semantics and validation to avoid apparently active controls that do not change the selected geometry. Check `plain-bushing` validation currently enforces flange constraints even in sleeve form before changing any behavior.
- Fixed purchased records must keep source dimensions. Several rolling-bearing families intentionally expose editable reconstruction dimensions/internal illustrative counts; that is not authority to promote edited geometry into a supplier execution. Source matching and guide limitations must remain intact.
- `detail` controls in generic families are Model detail, not Model states; preserve their existing place and do not multiply navigation entries for them.

## Evidence reviewed and limits

Reviewed runtime inventory; section declarations/shared catalogs in `src/core/library.ts`; all section package metadata/schema/preset names via snapshot and preset files; representative bearing source rules and state construction in the listed package files; one-piece model recipes and shared finish helper. Existing `library-catalog-families`, `library-identity`, `library-names` and bearing package tests are relevant for curator verification. This organization audit does not establish source fidelity, loading, fit, native analytic topology or procurement readiness.

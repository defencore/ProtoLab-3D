# Linear motion organization audit

Historical section review, 2026-11-03, before curator integration. Some recommendations below were implemented in the same organization pass; use the [integrated review](../library-organization-audit.md) for completed changes and remaining work. Runtime counts describe that review snapshot. Raw snapshots and logs are optional local evidence under ignored `test-results/`; this document preserves the section findings in the repository.

Scope: all 22 current packages, 725 presets and 20 navigation families in LINEAR MOTION. Source and runtime-metadata inspection only. No package, geometry, macro or export checks were run. Root is the library curator.

## Complete coverage

| Physical package ID           | Presets | Current subgroup       |
| ----------------------------- | ------: | ---------------------- |
| `linear-bearing`              |      41 | LINEAR BUSHINGS        |
| `flanged-linear-bearing`      |      19 | LINEAR BUSHINGS        |
| `round-flange-linear-bearing` |      14 | LINEAR BUSHINGS        |
| `gear-rack`                   |       3 | GEAR RACKS             |
| `hiwin-profile-guide`         |      30 | PROFILE RAILS          |
| `linear-guide`                |       8 | PROFILE RAILS          |
| `cnc-guide-rail`              |       1 | PROFILE RAILS          |
| `cnc-guide-carriage`          |       1 | PROFILE RAILS          |
| `cnc-screw-support`           |       2 | SHAFT & SCREW SUPPORTS |
| `cnc-drive-screw`             |       3 | BALL SCREWS            |
| `cnc-precision-nut`           |       2 | BALL SCREWS            |
| `cnc-precision-support`       |       4 | SHAFT & SCREW SUPPORTS |
| `cnc-precision-screw`         |       3 | BALL SCREWS            |
| `cnc-precision-axis`          |       3 | BALL SCREWS            |
| `round-linear-guide`          |       2 | ROUND SHAFT GUIDES     |
| `tbi-ball-screw`              |      19 | BALL SCREWS            |
| `ball-screw`                  |     410 | BALL SCREWS            |
| `ball-nut`                    |     146 | BALL SCREWS            |
| `ball-screw-axis`             |       6 | BALL SCREWS            |
| `shaft-support`               |       3 | SHAFT & SCREW SUPPORTS |
| `lead-screw-axis`             |       2 | LEAD SCREWS & STAGES   |
| `linear-stage`                |       3 | LEAD SCREWS & STAGES   |

All package IDs match their folders and local preset IDs are unique (JSON scan). No semantic rename of a physical ID is justified. Keep exact qualified references and physical-state identities.

## Navigation consolidation

Recommended shared catalogs retain each existing physical definition, parameters, evidence and geometry:

| Shared family          | Physical members                                              | Reason                                                                                                         |
| ---------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Profile linear guides  | `hiwin-profile-guide`, `linear-guide`                         | Both select a rail/carriage assembly; source-fixed interfaces and editable references remain explicit.         |
| Ball screw sets        | `ball-screw`, `tbi-ball-screw`, `cnc-precision-axis`          | Screw/nut combinations; preserve the actual factory-matched purchase boundary of the HIWIN set.                |
| Ball screw shafts      | `cnc-drive-screw`, `cnc-precision-screw`                      | Independently reusable shafts with different sourced end execution.                                            |
| Ball screw nuts        | `ball-nut`, `cnc-precision-nut`                               | Standalone nuts with construction/model selection in the chooser.                                              |
| Shaft & screw supports | `shaft-support`, `cnc-screw-support`, `cnc-precision-support` | Support construction/execution choice; do not treat generic editable geometry as an identified BK/BF purchase. |

Keep `cnc-guide-rail` and `cnc-guide-carriage` directly selectable because these are individual procurement units rather than another complete guide. Keep `ball-screw-axis` separate: its base, worktable and two guides form a complete axis beyond a screw/nut set. Keep round shaft guides, lead screws, generic slide architectures and gear racks separate. Existing Linear bushings catalog is correctly grouped.

A single global Ball screws catalog would mix bare shafts, nuts, pairs and complete axes without expressing the installation/procurement boundary. Prefer the four functional choices above inside the existing subgroup rather than adding navigation folders for brands or sizes.

## Actual overlap and deferred identity work

The eight MGN7C/H, MGN9C/H, MGN12C/H and MGN15C/H presets in `linear-guide` repeat nominal HIWIN designations and visible titles from `hiwin-profile-guide`. Both cite manufacturer mounting dimensions, but the former exposes every dimension and prototype circuits while the latter fixes model interfaces and offers configurable carriage count. This is overlapping source coverage, not evidence that two manufacturers/products exist. Shared browsing can retain both APIs. Deleting or redirecting either physical ID requires comparing published dimensions, origins, source revisions, state behavior, saved configurations and assembly consumers; the present metadata audit does not establish interchangeable geometry. Source/definition labels and copyable IDs should distinguish the rows while this remains unresolved.

`ball-screw` and `ball-nut` correctly reuse the same construction/size semantics while exporting different physical scope. They must not be collapsed into a single family identity. Their physical screw/nut states and `tbi-ball-screw` states are deliberately separate installed selections. The matched HIWIN factory order remains one purchase even though its source models have independently reusable child definitions.

## Immediate naming and control improvements

- Prefer consistent **Ball screw** spelling in browse labels; current physical names mix `Ballscrew` and `ball screw`.
- Normalize dimensional preset typography: `round-linear-guide` uses `Ø8 shaft` instead of `Ø8 mm shaft`; `shaft-support` uses `Ø12` without `mm`; three `cnc-precision-axis` titles omit the space after `·`. Do not rewrite supplier designations.
- Model option labels in precision supports currently compress manufacturer and model (`HIWINBK20-C3` etc.); restore the space. Support and screw options may show extra execution context, but must retain the full original SKU.
- `hiwin-profile-guide.position` uses group Placement, while generic guide `position` uses Carriage and stages use Dimensions. Move operating controls to a consistent **Motion** group in a dedicated metadata cleanup, preserving keys and units.
- `ball-nut` correctly hides screw-only fields instead of presenting controls that do not affect the nut.
- `lead-screw-axis.pitch` is labeled **Lead per revolution** and used as lead. Preserve the saved key; a future public schema revision should clarify this historical internal name without claiming an unverified thread profile/start count.

## State review

`shaft-support` exposes `assembled`/`exploded`, but its `pieces()` adds exactly one physical item for every form and shared `finish()` has nothing to separate. Its exploded state is ineffective. Resolve state availability/reconciliation in a dedicated pass; do not remove a saved state casually. Other states inspected are real rail/carriage/screw/nut selections or implemented cutaways. This audit did not execute those geometries.

## Evidence

`src/core/library.ts`, the runtime snapshot, all 22 `part.ts` and preset files; `hiwin-profile-guide/configurator.ts`, `linear-guide/part.ts`, `cnc-guide-rail/GUIDE.md`, `cnc-guide-carriage/part.ts`, `cnc-precision-axis/part.ts`, `ball-nut/GUIDE.md`, `shaft-support/lib/model.ts` and `lead-screw-axis/GUIDE.md`. No load capacity, source-fidelity certification or native topology verification is implied.

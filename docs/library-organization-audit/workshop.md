# Workshop tools organization audit

Historical section review, 2026-11-03, before curator integration. Some recommendations below were implemented in the same organization pass; use the [integrated review](../library-organization-audit.md) for completed changes and remaining work. Runtime counts describe that review snapshot. Raw snapshots and logs are optional local evidence under ignored `test-results/`; this document preserves the section findings in the repository.

Scope: all 17 current `WORKSHOP TOOLS` packages, 134 presets. Source inspection only; no geometry execution or package checks performed. Root owns curator approval and integration.

## Coverage and intended grouping

| Package ID                 | Presets | Current subgroup            | Assessment                                                                                                                    |
| -------------------------- | ------: | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `circular-saw-blade`       |       2 | SAW BLADES                  | Correct fixed-model family; retain each Freud bore execution.                                                                 |
| `angle-drill-jig`          |       6 | DRILLING JIGS               | Angle, foot dimensions and drill/bushing options already parameterized.                                                       |
| `drill-pattern-jig`        |       6 | DRILLING JIGS               | Circle/grid/line correctly share one parameterized family.                                                                    |
| `edge-dowel-jig`           |       6 | DRILLING JIGS               | Board thickness, count, pitch and drill already parameters.                                                                   |
| `shaft-end-drill-jig`      |       5 | DRILLING JIGS               | Axial shaft-end location is distinct from transverse drilling.                                                                |
| `tube-drill-jig`           |      52 | DRILLING JIGS               | Tube OD, belt count, pilot thread and guide construction already parameterized; presets are examples, not duplicate packages. |
| `v-block-drill-jig`        |       6 | DRILLING JIGS               | V-datum transverse drilling is a distinct architecture.                                                                       |
| `modular-tube-marking-kit` |       1 | DRILLING JIGS               | Source-project window/hole marking kit; retains its shared tube interface and independent identity.                           |
| `chain-drill-slot-jig`     |       5 | ROUTING & PROFILE TEMPLATES | Chain-drilling and finish-layout kit; distinct from router compensation.                                                      |
| `corner-radius-template`   |       8 | ROUTING & PROFILE TEMPLATES | Radii already parameters. One physical detail; redundant exploded state.                                                      |
| `router-template`          |       7 | ROUTING & PROFILE TEMPLATES | Slots, pockets and circles already grouped by `opening`; follower compensation is functionally distinct.                      |
| `tube-coping-template`     |       6 | ROUTING & PROFILE TEMPLATES | Tube/mate OD and angle already parameters. One physical detail; redundant exploded state.                                     |
| `indexing-disc-jig`        |       7 | BENDING & ASSEMBLY JIGS     | Misplaced: indexing drill fixture belongs in DRILLING JIGS.                                                                   |
| `wire-bending-jig`         |       6 | BENDING & ASSEMBLY JIGS     | Loop/U forms already one parameterized family.                                                                                |
| `manual-miter-guide`       |       6 | CUTTING & SAWING GUIDES     | Angle and stock dimensions already parameters.                                                                                |
| `cnc-toolsetter-part`      |       2 | TOOL SETTING & PROBES       | Contact/base are actual component selections, not inspection states.                                                          |
| `cnc-process-accessory`    |       3 | COOLING & COOLANT           | Shared fixed-model chooser correctly retains purchased cooling units.                                                         |

## Immediate changes recommended

1. Move `indexing-disc-jig` from `BENDING & ASSEMBLY JIGS` to `DRILLING JIGS` in its `part.ts` and the structure map. Preserve ID, presets, keys and geometry.
2. Use concise singular browse labels without changing physical product identities: `cnc-toolsetter-part` → **Toolsetter detail**; `cnc-process-accessory` → **Cooling equipment**; optionally `angle-drill-jig` → **Angled drilling jig** (angle is configurable before fabrication, although each printed shoe is fixed).
3. Normalize authored preset titles across jig families. Examples: `angle-drill-jig:a15` **15° drilling shoe**; `edge-dowel-jig:board18` **18 mm board · Ø8 mm dowel**; `shaft-end-drill-jig:od12-d3` **Ø12 mm shaft · Ø3 mm drill**; `router-template:slot12x60` **12 × 60 mm slot**; `wire-bending-jig:loop-r3` **Loop · R3 mm · Ø1 mm wire**; `manual-miter-guide:a45` **45° miter**. Existing IDs remain correct stable handles. `circular-saw-blade` titles need `mm` in both presets and selector options: **Freud LU5H50001 · 500 × 4 × 30 mm · Z120**. `cnc-toolsetter-part` options and preset titles currently differ; use the same complete names (e.g. **Aluminium contact plate · Ø40 × 10 mm**).
4. `drill-pattern-jig/configurator.ts`: hide `count` for `pattern === 'grid'`; `lib/model.ts` uses rows×columns instead. This is a relevance fix, not a parameter rename.
5. Treat `indexing-disc-jig`'s `position` as an operating control (group **Setup** or **Operation**) rather than a physical dimension. Maintain the key and existing zero-based range unless a separate identity change is deliberately reviewed.
6. `corner-radius-template`, `tube-coping-template`, `router-template` and `manual-miter-guide` each return one physical piece in `lib/model.ts`; shared `configured()` only moves items with index > 0 in exploded state. Their **Separate components** state therefore has no implemented alternate geometry. Review disabling/removing this choice using state reconciliation and saved-state tests. Similar single-piece configurations of other jigs need `availableWhen` rather than a generic always-visible exploded choice.

## Consolidation decision

No package is solely a different length or thread copy of another workshop package: those differences are already parameters/presets. Do not merge axial, V-block, board-edge and inclined drill guides into one geometry API; their locating datums, component composition and installation paths differ. A future shared **Drilling fixtures** browse catalog could combine them while retaining physical IDs, but it adds a model selector above already meaningful types; the current seven direct drilling family choices remain understandable. Keep chain drilling separate from compensated router templates and source-specific tube marking tools.

## Identity and evidence

All package folders correspond to their declared part IDs on inspection. All 134 preset IDs and names are unique within their own packages (checked by JSON scan). `modular-tube-marking-kit` declares states before the actual part: a naive first-`id` regex incorrectly reads `assembled`; use its real part declaration. No new ID or ID migration is justified by this audit.

Evidence: each package's `part.ts`, `configurator.ts`, `presets.json`, `GUIDE.md`; singleton state behavior in `corner-radius-template/lib/common.ts:configured` and the four singleton `lib/model.ts` files; subgroup map in `src/core/library.ts`; naming policy in `docs/library-naming.md`. This audit does not certify machining, print fit, purchased dimensions, native topology, or product readiness.

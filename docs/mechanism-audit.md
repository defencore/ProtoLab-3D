# Mechanism and parameter audit — 2026-09-16

This audit covers all 165 registered part packages and 13,268 presets. The parameter sweep exercised 5,923 valid input changes with zero generation exceptions; 68 unchanged-recipe cases were reviewed as metadata, equal-envelope alternatives or declared representation limits. It checks whether visible controls affect the native construction, then verifies changed mechanisms as actual FreeCAD solids. It does not certify every library item as a complete manufacturer model.

## Catalog-first configuration

The configurator exposes the preset browser before dimension editing. Small families without dedicated catalog filters also have a direct starting-configuration selector. Existing sourced catalog presets retain their source links and evidence. Generic mechanism presets remain explicitly marked parametric prototypes; they are not invented purchasable SKUs.

Changing belt, duct, industrial motor, pump, ball-screw or ball-nut family loads the matching dimensional preset instead of merely changing a name. Ball-screw and nut selection preserves the selected nominal diameter and lead when that combination exists in the target family.

## Corrected mechanical construction

| Module            | Change                                                                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gear reducer      | Spur pair and shafts; right-angle miter pair; staged planetary sun, planets, fixed ring and carrier pins. Separate covers and an internal inspection state.                                           |
| Differential      | Side gears, spider pinions, cross pin, carrier and half-shafts. Internal inspection state; detailed starting preset.                                                                                  |
| Shaft coupling    | Oldham tongues and crossed disc grooves; continuous slotted beam; connected bellows; flanges with independent bolts.                                                                                  |
| Shaft collar      | Radial set screw versus tangential split-clamp screw, including screw clearances.                                                                                                                     |
| Belt drive        | Distinct timing, V and multi-rib belt sections with matching pulleys; a continuous backing connects the poly-V ribs. Friction sheaves have their own diameter control.                                |
| Linkage mechanism | Separate joint pins and pedestals, slider/yoke guides, scissor centre joint, solved linkage poses and Geneva engagement. Misleading pantograph/clamp labels corrected to parallelogram/eccentric cam. |
| Fluid cylinder    | Hollow barrel, end caps, piston/rod, ports, tie rods or hydraulic gland; rodless carriage bridge and slot.                                                                                            |
| Robot wheel       | Pneumatic bead seats; distinct omni/mecanum roller axes with bores, fixed axles and supporting forks.                                                                                                 |
| Brake             | Disc caliper cavity with separate pads/piston; drum cavity with separate shoes, anchors and backing plate.                                                                                            |
| Cable carrier     | Articulated hollow links with mating hinge geometry, distinct from a closed duct.                                                                                                                     |
| Threaded insert   | Heat-set, press-fit, rivnut and clinch constructions differ even in envelope mode.                                                                                                                    |
| Shaft / propeller | Splined/keyed shaft shapes and axial/marine blade planforms remain distinct in the lightweight view.                                                                                                  |
| Lead-screw axis   | Input turns, lead and nut travel are coupled; the shaft remains a declared smooth thread envelope.                                                                                                    |

Rigid subcomponents are combined where appropriate, while mechanically separate parts remain separate. Cosmetic micro-detail is not the goal.

## Controls that previously appeared ineffective

Control visibility now receives the current inspection state. Controls for omitted components are hidden in body-only, shaft-only, nut-only, hub-only and section views. Deformation controls appear only in the corresponding spring/pin state. Family-specific flange, groove, spline, roller, lip, fin, tooth and hinge settings appear only where that geometry exists.

Stroke limits and reference dimensions can legitimately leave the current shape unchanged. Same-envelope catalog alternatives can also produce identical shapes. These are distinguished from a broken geometry selector. An unchanged native recipe is a review candidate, not by itself proof of a defect.

The shared planar outline union now handles partially coincident edges. This fixes servo horns that failed when their arm width was increased.

## Reproducible checks

- `npm run parts:check`: package boundaries, required SDK files, IDs and all default/preset parameter sets.
- `npm test`: repository tests (at most two concurrent test files to limit memory pressure), including actual preview-geometry changes, state visibility, family preset application and lead/travel coupling.
- `npm run audit:parameters -- /tmp/parameter-audit.json`: all modules, representative construction families, detail levels and non-exploded states; mutate visible inputs through the actual parameter-update function. `PART_FILTER=id,id` limits a follow-up.
- `scripts/verify-library-expansion.ts` plus FreeCAD `scripts/verify-electronics.py`: closed valid positive solids, component intersections, preview/native bounds and volumes, independent transforms, STEP and FCStd round trips. Added extreme roller/link counts, three planetary stages, cylinder travel endpoints and linkage poses.
- `npm run build`: production build.

Generated audit logs and CAD test outputs stay outside the repository.

The full regression run executed 1,996 tests: 1,989 passed initially, with seven outdated assertions failing. Five expected archived source files or pre-normalization catalog names; two assumed a parameter was always visible. Those assertions now check retained source provenance, canonical product identity and state-aware controls. A focused repeat passed all 171 selected tests, including the seven failures and invalid-input checks for every module. No full-suite failures remain unresolved; the entire 43-minute suite was not repeated after these test-only corrections. Production build and test TypeScript checks also passed.

## Limits that remain explicit

The generic mechanisms are editable assembly prototypes. Sampled involute/conical teeth and approximate timing-belt profiles do not establish production meshing accuracy, backlash, tooth strength or a commercial belt length. Bearing raceways, screw recirculation and many electronics interiors still follow the existing [model fidelity inventory](model-fidelity-audit.md).

The Geneva model omits its locking disc; ratchet return springs/dynamics and drum-brake actuation are not modeled. The linkage module gives geometric poses, not a constraint or contact simulation. Hydraulic seals, thread fits, manufacturing tolerances, lubrication, loads and service-life calculations are not certified by geometry validity. Supplier CAD or dimensioned sections are still required to claim a faithful purchasable mechanism internally.

## Reviewed unchanged controls

The parameter audit also records intentionally equal native recipes: smooth-thread metadata; bore/accuracy limits; free-ring groove references; equal-envelope cell variants; material-only bearing closure choices; unit conversion that preserves physical pitch; and preview tessellation settings. The generic vane-pump and hydraulic-motor entries currently share an external housing envelope; internal fluid machinery remains unmodeled. These should not be interpreted as verified complete purchasable mechanisms.

## CAD verification result

134 configurations passed native FreeCAD checks, including STEP and FCStd round trips. Exact previously passed native scripts and preview component data were reused within this audit; changed cases were executed again. The thin planetary inspection ring needed finer preview tessellation, and the poly-V belt needed a continuous backing to avoid zero-thickness connections between ribs. Both corrections passed their repeated native checks.

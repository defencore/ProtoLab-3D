# Suspended tracked chassis

Complete Hiwonder-style suspended robot chassis, distinct from the single `track-drive` module. Standard single-deck and advanced two-deck presets use the published 270 × 194 mm chassis and 270 × 143 × 2 mm mounting plates. Eight trailing-arm stations, formed-wire tension springs, selected miniature ball bearings, slotted idler adjustment and two JGB3865-520R45-12 motor units are individually exportable FreeCAD components.

Source: https://www.hiwonder.com/products/suspended-shock-absorbing-tracked-chassis

The public page supplies overall/deck dimensions and a motor drawing, but no open manufacturing CAD. Wheel sizes, spring geometry, arm pivots, bearing choices, deck separation, bracket layout and mounting coordinates are reconstruction. Selected MR104 ZZ and MR126 ZZ bearings now reuse complete ball-bearing library models and source records. They are proposed components for the custom reconstruction, not a verified Hiwonder bearing list. Each motor is one purchased library unit; its housing, can and output shaft are installation-reference solids. Screw thread specifications and motor internals remain unresolved. No source PDF, STEP or image archive is included.

The exact Hiwonder presets carry an explicit purchased supply policy and are imported into projects as opaque complete products. Changing their configuration removes that preset purchasing identity. A custom chassis has an explicit library composition: manufactured-detail recipes, formed-wire spring paths, selected bearings and purchased JGB3865 motor units. Materials, manufacturing routes, tolerances, belt construction, motor installation, free spring geometry and load capability remain engineering requirements.

Left and right suspension angles rotate the arms and relocate wheels, spring eyes, axles and springs. The taut belt outline is recomputed from the wheel envelope. Idler travel also changes its axle and belt outline. The continuous belts have integral tread ribs; individual articulated links, sprocket pitch engagement and elastic tension are not simulated. Lightweight mode replaces helical coils with their central envelopes and uses smooth belts, while retaining mechanical layout.

Inspect the assembly without tracks, separate it along assembly axes, or export just the frame/decks. Invalid width and wheel-spacing combinations are rejected before generation.

## Verification

The targeted tests cover both presets, every visible geometry control, independent left/right poses, inspection states, invalid combinations, STL records and FreeCAD macro generation. Production build and package/type checks pass.

The revised default assembly was checked in native FreeCAD: 94 library components, 258 valid closed solids, no intersections between physical units, independent component movement, STEP and FCStd round trips. Preview bounds differ by at most 0.006 mm and preview volumes by at most 0.42%. The check preserves purchased units containing multiple OEM reference solids. Run `scripts/verify-tracked-chassis.ts` and `scripts/verify-tracked-chassis.py` again after changing geometry; `FULL=1` prepares both deck presets, inspection states and dimension/travel variants. This check does not establish manufacturing tolerances, fatigue or load capacity.

Reproduce with `FULL=1 node --import tsx scripts/verify-tracked-chassis.ts`, then run `scripts/verify-electronics.py /tmp/protolab-tracked-chassis-cases.json` with a FreeCAD-enabled Python.

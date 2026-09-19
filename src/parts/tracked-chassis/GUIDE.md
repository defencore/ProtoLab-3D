# Suspended tracked chassis

Complete Hiwonder-style suspended robot chassis, distinct from the single `track-drive` module. Standard single-deck and advanced two-deck presets use the published 270 × 194 mm chassis and 270 × 143 × 2 mm mounting plates. Eight trailing-arm stations, tension springs, wheel-bearing cartridges, slotted idler adjustment and two JGB3865-520R45-12 motor envelopes are individually exportable FreeCAD components.

Source: https://www.hiwonder.com/products/suspended-shock-absorbing-tracked-chassis

The public page supplies overall/deck dimensions and a motor drawing, but no open manufacturing CAD. Wheel sizes, spring geometry, arm pivots, bearing choices, deck separation, bracket layout and mounting coordinates are reconstruction. Bearings are simplified cartridges; motor internals and screw threads are omitted. This is a configurable layout model, not a manufacturing-ready copy or a verified Hiwonder parts list. No source PDF, STEP or image archive is included.

Left and right suspension angles rotate the arms and relocate wheels, spring eyes, axles and springs. The taut belt outline is recomputed from the wheel envelope. Idler travel also changes its axle and belt outline. The continuous belts have integral tread ribs; individual articulated links, sprocket pitch engagement and elastic tension are not simulated. Lightweight mode replaces helical coils with their central envelopes and uses smooth belts, while retaining mechanical layout.

Inspect the assembly without tracks, separate it along assembly axes, or export just the frame/decks. Invalid width and wheel-spacing combinations are rejected before generation.

## Verification

The targeted tests cover both presets, every visible geometry control, independent left/right poses, inspection states, invalid combinations, STL records and FreeCAD macro generation. Production build and package/type checks pass.

Eleven native FreeCAD configurations cover both decks, all inspection states, ±8° suspension travel, full idler adjustment, six wheels per side, lightweight detail, larger/thicker chassis dimensions and minimum wheel sizes. Every physical component is one valid closed solid, without volumetric intersections. Preview/native bounds agree within 0.003 mm and volumes within 0.65%. Independent movement and STEP/FCStd roundtrips pass. These checks validate geometry and export, not manufacturing tolerances, fatigue or load capacity.

Reproduce with `FULL=1 node --import tsx scripts/verify-tracked-chassis.ts`, then run `scripts/verify-electronics.py /tmp/protolab-tracked-chassis-cases.json` with a FreeCAD-enabled Python.

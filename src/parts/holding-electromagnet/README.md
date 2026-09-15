# Holding electromagnet

This independent package models a round pot electromagnet as separate steel cup, potted winding and optional armature and lead components. All dimensions are millimetres. Its five presets are geometric prototype examples, without manufacturer or electrical/holding-force claims.

## Datum and states

The cup axis is +Z. The flat rear mounting surface is Z=0, and the working pole faces are Z=`bodyHeight`. Optional straight leads extend to Z=-`leadLength` through two real clearance ports in the back plate. The smooth, central mounting bore opens at the rear and stops at `mountingBoreDepth` inside the pole.

- `magnet-only` (default): steel cup and potted coil, plus the selected leads.
- `assembled`: add an armature plate above the working face with the selected `airGap`.
- `exploded`: move only that plate by another 0.8 × `bodyHeight`; the actual air gap remains separately defined.

The annular winding has `coilClearance` around both radial surfaces and beneath it, and `coilRecess` at the working face. It represents a potted winding envelope rather than individual turns. The single-piece cup, central pole and blind bore are generated from one revolved profile. Shared private shape data drives both preview and FreeCAD; lead ports are subtracted from that same cup.

## Parameters and export

Cup: `bodyDiameter`, `bodyHeight`, `wallThickness`, `backThickness`, `poleDiameter`.

Coil and mounting: `coilClearance`, `coilRecess`, `mountingBoreDiameter`, `mountingBoreDepth`.

Armature: `armatureDiameter`, `armatureThickness`, `airGap`.

Leads: `showLeads`, `leadDiameter`, `leadLength`. Lead dimensions are hidden when leads are disabled. Port centers lie halfway across the cup's annular cavity; port diameter is lead diameter plus coil clearance. Wire ends meet the coil's underside.

Validation keeps the annular coil and axial cavity positive, preserves steel around and above the blind bore, checks lead clearance, and requires the armature to cover the pole faces. Numeric limits and types remain valid for hidden fields.

Direct FreeCAD compound children and preview groups are ordered: **Steel cup**, **Potted coil**, optional **Armature plate**, optional **Positive lead**, **Negative lead**. Labels and colors follow the same order. Positive/negative colors distinguish leads only; the model does not prescribe an electrical supply. The exported mounting bore is unthreaded.

Run `npm run parts:check -- holding-electromagnet`, `npm run typecheck`, relevant geometry/native checks, and `npm run build` after changes. No external part-package imports are used.

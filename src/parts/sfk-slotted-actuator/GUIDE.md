# SFK0825 slotted-crank actuator — previous version

This separate library item preserves the mechanism that preceded the clocked nut-cover attachment. It contains the original 76 configured occurrences, their native geometry recipes, procurement records and colors. The current fixed-drive U-fork actuator remains a separate product.

A GMP16T-TEC1636 gearmotor drives a 100 mm SFK0825 ball screw through the LF D14 L22 Clamp 3×4 coupling. Two opposed bronze rollers on the ball-nut yoke engage two slotted crank plates. The output shaft is perpendicular to the fixed screw axis. Four F686-2RS bearings support the screw and output shaft; the prior flanged bearing pockets, retaining rings, clamped output hubs and fastening arrangement are preserved.

## Layout and motion

The screw axis remains global X at Y=0, Z=28 mm. The output axis remains global Y at X=14.5, Z=15.8 mm, giving 12.2 mm centre separation. The yoke pins move along the screw axis at `(14.5+x, ±17.5, 28)`.

For output angle θ, nut displacement is `x = 12.2 tan(θ)` and screw turns are `x/2.5`. The bronze rollers move radially within the slots at `12.2/cos(θ)` from the output axis. The ±20° range gives ±4.440437 mm nut travel and 8.880874 mm total stroke. The twin roller engagements restrain nut roll without linear guides or rocking the drive.

The output-angle control moves all related parts continuously. Presets select 107:1 or 361:1 and 12 V or 24 V. The supplier motor, screw, coupling and bearing colors remain identical in the preview and FreeCAD recipe.

## Preserved source boundary

`lib/neutral-occurrences.json` owns the prior neutral configuration and appearances recovered from the validated flanged-bearing release. Runtime geometry does not read generated test results or another actuator package. Only the explicitly declared supplier packages are dependencies. Changing output angle changes placements and supplier pose parameters; it does not rebuild the previous custom parts from the newer nut-cover design.

The nut dimensions use the supplied KAIYADE SFK table. Applying the supplied 0802 EK6/EF6 end-machining reference to SFK0825 remains provisional; inspect the delivered screw before making supports. The M6 source journal and its two mating nuts remain nominal envelopes in both detail modes. Other thread details follow the selected Simple/Full mode.

This is the original mechanical prototype, retained for comparison and reuse. Its integral output shaft shoulders and original assembly arrangement are preserved. Verify the installation sequence, load, fits, locking method and toleranced drawings before manufacture. Motor reversal, position sensing and travel limits are external to the geometry.

# SFK0825 three-disc rotary actuator

This is a separate version of the fixed SFK0825 ±20° mechanism. Its frame uses three circular steel discs connected by standard metal standoffs, plus two flat output-bearing cheeks. The existing machined-support and previous slotted-crank families remain independent.

## Sheet parts

All five frame pieces use 4 mm flat steel. Three main discs are exactly Ø68 mm. Every feature is a through-cut profile: no counterbores, blind holes, tapped sheet holes, bends or welded bosses are needed. The two output cheeks have locating tabs and wider shoulders. The three-disc stack captures those shoulders; no extra cheek screws are required.

Each cheek carries its bearing in a symmetric 18×18 mm square spanning Z=19..37 mm about the shaft axis at Z=28 mm. Its connecting rail and end tabs span Z=25..31 mm, centred on that same axis. Support loads enter the middle and end discs at shaft height. The 8 mm shoulders span Z=24..32 mm; the disc slots span Z=24.95..31.05 mm, giving 0.05 mm nominal vertical clearance at each tab edge.

The F686-2RS body is 6×13×5 mm with a Ø15×1.1 mm flange. Its non-flanged seating length is 3.9 mm, so a 4 mm sheet supports it fully while the flange remains outside. The inner bearing face is recessed by 0.1 mm inside a straight through bore; the shaft and thrust spacers clear that bore. Outward flanges and the retained shaft stacks capture the bearings in both axial directions.

Laser files leave the four bearing holes at Ø12.8 mm for finishing. The assembled CAD uses a Ø13.02 mm clearance envelope. Select and specify the actual bearing fit and finishing tolerance before production; do not treat the laser pilot or a nominal CAD diameter as a certified fit. Deburr the profiles and verify sheet flatness.

| Piece                 | Axial station / thickness |
| --------------------- | ------------------------- |
| Motor disc            | X=−72.1..−68.1 mm         |
| Fixed-bearing disc    | X=−18.1..−14.1 mm         |
| End-bearing disc      | X=40.9..44.9 mm           |
| Negative output cheek | Y=−20.4..−16.4 mm         |
| Positive output cheek | Y=16.4..20.4 mm           |

Disc centres remain at Y=0, Z=28 mm. The perpendicular output shaft crosses their common centreline at `(X,Y,Z)=(13.4,0,28)` mm. Its bearing holes are centred along the cheeks: X=13.4 is the midpoint between the fixed and end disc inside faces at X=−14.1 and X=40.9, giving 27.5 mm to either face. The motor and screw axis is offset upward to Z=41 mm, 13 mm above the disc centres. The disc circles and three column lines at `(Y,Z)=(−20,48),(20,48),(0,6)` mm stay fixed. This pattern clears the nut, forks, output bearings and perpendicular shaft. The cheeks locate in 4.10×6.10 mm slots; wider 8 mm end shoulders resist withdrawal.

## Standard columns and fasteners

Three DREMEC **115x50** female/female M3 standoffs span the 50 mm front gap. Three **215x55** female/male M3 extensions span the 55 mm rear gap. Both are catalog brass parts with 6 mm across flats and published 10 mm female depths. Their selected supplier parameters and procurement identities remain unchanged.

Each 8 mm male projection passes through the 4 mm middle disc and engages its front standoff by 4 mm. Six outer M3×10 screws pass through 4 mm sheet and engage the outer female ends by 6 mm, leaving 4 mm to their blind bottoms. Column threads carry the connections; the discs have only clearance holes.

Two M2×6 button screws secure the motor through its disc with 2 mm nominal engagement. The button heads clear the coupling. The gearmotor front lies at X=−72.1 mm and the coupling centre at X=−55.3 mm, giving approximately 5.8/5.7 mm shaft insertion at its 3/4 mm ends.

The fixed screw bearing centre moves to X=−16.7 mm while the floating centre remains X=43.5 mm. A 12.8 mm outer sleeve and 2.2 mm shoulder sleeve retain the original stock screw shoulders and M6 lock/jam nut positions. The floating spacer and original shaft retaining ring remain unchanged.

## Output and motion

The screw remains fixed on global X at Y=0, Z=41 mm. The stock SFK0825 nut is clocked 90° and carries the existing machined cover with two short Ø4 pins. Four screws pass through the stock flange into the cover's blind threads. Closed slotted forks capture its flats and drive a perpendicular Ø6 shaft on two F686 bearings.

The output axis is global Y at X=13.4, Z=28 mm, centred both between the two supporting discs and on their radial centreline. The nut centre at zero output angle is X=8.5 mm. Its integral cover pins lie 4.9 mm farther along X, aligning with the output bearing centres at neutral. Nut travel is `13*tan(angle)` mm, so the absolute nut centre is `8.5+13*tan(angle)` mm, with ±20° output and 9.463226 mm total stroke. The pin centre radius is `13/cos(angle)` mm inside the closed slots. The near shaft end has a small M6 blind cap; the opposite end projects farther. No whole-frame rocking or guide rods are used.

The source drive, nut cover, output shaft, forks and cap still include machined or purchased components. The laser files describe the five flat frame parts, not a claim that the entire actuator can be produced by laser cutting alone.

## Assembly

Keep the three main discs loose initially. Fit the 2.2 mm shoulder sleeve on the stock screw journal before the fixed bearing. Fit the nut cover and bring the fork slots over its pins. Install the output shaft, inner clips and spacers, then slide the empty cheeks over the shaft from its ends.

Slide the middle disc from the left along X, simultaneously over the bare screw journal and both left cheek tabs until its inside face meets the shoulders. Do this before inserting the fixed bearing; the closed tab slots cannot accept sideways insertion through the solid disc. Insert the fixed bearing from the left, then fit its 12.8 mm outer sleeve and the M6 lock/jam nuts. Join each 215x55 extension through the middle disc into its 115x50 front standoff.

Slide the end disc from the right over the support journal and both right cheek tabs. Close it against the three rear extensions and both cheek shoulders. Insert the output bearings from the outside, followed by their outer spacers and shaft retaining rings. Fit the floating screw bearing from outside the end disc, followed by its spacer and ring. Fasten the motor to its disc with the two M2 screws before the coupling obstructs their heads. Stage the coupling on the screw's drive end, then close the front gap with the motor and motor disc. Fit the shaft-end cap, then tighten the column screws and fork clamps after confirming free movement.

## Files and verification

ProtoLab exposes individual 1:1 millimetre DXFs/SVGs for all five blanks, a five-piece cutting layout, a cut/finished manufacturing manifest and a native blank macro. Bearing pilot holes and finished bores are recorded separately. Kerf compensation belongs to the cutter's CAM setup; cut files contain no automatic offset.

The motion FCStd uses **Angle control → AngleCommand**; persisted expressions limit output to ±20° after reopening. No installed Python document proxy is needed. The component list retains each standard standoff as a separate bought occurrence.

Native evidence for the inline-support revision is stored under `test-results/sfk-disc-actuator/inline-supports/`. Checks cover closed solids, inter-occurrence clearances, thread engagement and phase, 1:1 DXF reimport and blank equivalence, sheet-only feature construction, saved motion and supplier colors. Simple STEP and Simple/Full FCStd are separate deliverables.

The stock SFK0825 uses the supplied 0802 EK6/EF6 machining reference provisionally. Inspect the purchased screw before finishing supports. Its bought M6 journal retains nominal thread envelopes; the custom output cap has actual thread flanks in Full. Specify load, steel grade, fits, tolerances, locking and motor control for the intended application.

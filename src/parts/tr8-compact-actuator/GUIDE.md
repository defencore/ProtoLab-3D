# TR8 compact three-disc rotary actuator

A separate compact version of the three-disc ±20° mechanism. Previous SFK assemblies remain independent. The fixed drive uses the supplied brass H-flange nut and four-start TR8×8(P2) rod, purchased as 250 mm stock and shortened by cutting and turning.

## Main dimensions

| Item | Nominal geometry |
| --- | --- |
| Overall, 361:1 motor | 131 × 60.2 × 56 mm |
| Main discs | Three Ø56 × 3 mm steel plates |
| Output bearing cheeks | Two 4 mm steel plates; square centre and horizontal tabs |
| Column gaps | 30 mm / 30 mm |
| Output axis | Global Y through X=0, Z=0, exactly through the common disc centreline |
| Screw axis | Global X at Y=0, Z=10 mm |
| Screw after machining | 50 mm overall, X=−29..21 mm |
| Retained thread | 26 mm, X=−13..13 mm |
| Screw bearings | Two F695-2RS, 5×13×4; flange Ø15×1 mm |
| Output bearings | Two F686-2RS, 6×13×5; flange Ø15×1.1 mm |
| Output shaft | Ø6 mm, X/Z centre 0/0; short capped negative end, longer D-flat positive end |

The 131 mm envelope is approximately 28% shorter than the previous 181.1 mm SFK disc version. This is a compact arrangement using the retained motor, 22 mm jaw coupling, complete purchased nut and standard 30 mm columns. It is not a proof of a global geometric optimum or a load rating.

## Nut and motion

The supplied H-flange nut drawing, which has no verified public URL, specifies a 22×11 mm flange, R11 ends, two Ø3.5 mounting holes on 16 mm centres, Ø10 body and 15 mm overall axial length. The axial stack is a 1.5 mm nose, 3.5 mm flange and 10 mm rear body. The 22 mm flange direction lies along Y, keeping its 11 mm height clear of the nearby output shaft. Two M3×8 button screws pass through the stock flange into the machined cover's blind M3 taps; no separate nuts are used there.

Two integral Ø4 side pins and closed slotted forks capture the cover flats. All main discs, motor and screw supports remain fixed. No guide rods or rocking platform are used. The output shaft stays centred between the two bearing discs, whose inside faces are at X=−15 and +15 mm. Both cheek rails and their disc slots lie at output-shaft height.

TR8×8(P2) has 2 mm axial pitch and four starts, giving 8 mm nut travel per screw revolution. The source explanation of lead versus pitch is [IGUS, multi-start threads](https://blog.igus.eu/multi-start-thread/). The right-hand thread model includes actual four-start 30° helical flanks in Full mode; Simple uses its nominal cylindrical envelope.

The motion law is `nut displacement = 10*tan(output angle)` mm. Output ±20° requires ±3.639702 mm nut displacement, 7.279405 mm total stroke and approximately 0.909926 screw revolutions between the endpoints. Each extreme retains 1.860298 mm of thread beyond the 15 mm nut envelope. Screw rotation is `−360*displacement/8` degrees for the model's right-hand phase convention. The pin radius changes from 10 to 10.641778 mm within the closed radial slots.

The cover flats have 0.05 mm nominal sliding clearance to each fork face. This permits approximately 0.73° of cover roll before face contact; the capture is not a zero-play constraint. Assign the running clearance and lubrication to the intended manufacturing process.

## Turning the purchased screw

Use the supplied `TR8-compact-screw-turning.svg` and JSON schedule. The drawing gives nominal geometry; assign actual fits and tolerances before machining.

| X station, mm | Operation |
| --- | --- |
| −29..−21 | Turn Ø4 coupling stub |
| −21..−13 | Turn clean Ø5 fixed-bearing journal |
| −13..13 | Retain the original TR8×8(P2) thread |
| 13..21 | Turn clean Ø5 floating-bearing journal |

Cut with facing allowance, then face to 50 mm. Indicate the existing thread axis and machine both journals coaxially. The nominal TR8 P2 external root is approximately Ø5.5 mm, so Ø6 journals would retain grooves. Verify the actual rolled stock first; Ø5 is the selected clean journal size.

Four Ø5 DIN 471 rings retain the bearing inner races independently of the interrupted thread end faces. Groove centres are X=−19.8, −14.2, +14.2 and +19.8 mm. Groove bottoms are Ø4.8 mm and widths 0.7 H13 for 0.6 mm rings. This distinction matters: the uninstalled ring bore is Ø4.7, while the shaft groove bottom is Ø4.8. The outer grooves have 0.85 mm nominal end land, above the 0.3 mm minimum in the [MÄDLER DIN 471 table](https://smarthost.maedler.de/datenblaetter/K43_726_EN.pdf). Inspect groove and land tolerances against the ring supplier drawing before turning.

Four 5.05×7.6×0.5 mm thrust spacers sit at −19.5..−19, −15..−14.5, 14.5..15 and 19..19.5 mm. Bearing flanges face outward. Groove allowance leaves nominal axial play; no bearing preload or thrust-load rating is claimed.

Keep tool runout and edge breaks within the spare thread margin. Deburr all ends and verify full nut travel by hand before applying motor power.

## Laser parts and standard hardware

Three main discs use 3 mm steel to support the 3 mm non-flanged body length of F695 bearings. Output cheeks use 4 mm steel for the 3.9 mm non-flanged length of F686. Files separate the 3 and 4 mm cutting layouts. All plate features are through cuts: no pockets, bends, tapped sheet holes or added bearing housings are required.

All four bearing bores are laser pilots Ø12.8 mm; CAD uses a finished Ø13.02 clearance envelope. Assign the actual bearing fit and finishing tolerance to the delivered bearings and sheet before production. Deburr and verify sheet thickness and flatness. Apply kerf compensation in CAM, not by rescaling the DXFs.

Three DREMEC 115×30 female/female M3 columns and three 215×30 female/male extensions set the gaps. Each 8 mm male stud crosses the 3 mm middle disc and engages the female end by 5 mm. Six M3×8 outer screws pass through 3 mm sheet and engage by 5 mm. Two M2×5 motor screws pass through its disc with 2 mm motor engagement. The clamp coupling retains its original 3/4 mm bores.

## Assembly

Preassemble the nut cover, forks, output shaft and empty cheeks while the frame is open. Slide the middle disc from the motor side over the bare screw journal and both left cheek tabs before fitting its bearing. Slide the end disc from the opposite side over the support journal and right cheek tabs. The clamped disc stack captures the wider cheek shoulders without extra cheek screws.

Fit inner screw rings and spacers before the two screw bearings; insert bearings from outside the discs, followed by outer spacers and retaining rings. Fit output bearings from outside the cheeks, then the shaft spacers, rings and short blind cap. Mount the motor to its own disc before the coupling blocks the M2 screw heads. Stage the coupling on the screw stub, close the front column stack and tighten after checking alignment and free movement.

## Files and verification

The library offers separate Simple/Full native macros, the complete component list, motion table, five individual DXFs/SVGs, separate 3/4 mm layouts, native blank macro and the screw turning schedule. Native verification evidence is stored under `test-results/tr8-compact-actuator/`.

The motion FCStd uses **Angle control → AngleCommand** and stores its ±20° limit and motion expressions without requiring a Python document proxy. Saved components retain their source colors.

Select material grades, loads, lubrication, bearing fits, clearances, locking and position sensing for the intended application. The single brass nut is not an anti-backlash nut; the model does not remove its actual purchased clearance. The higher 8 mm lead changes speed and mechanical advantage relative to the SFK screw. No self-locking claim is made.

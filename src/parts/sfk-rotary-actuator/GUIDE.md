# SFK0825 rotary actuator with closed slotted forks

A fixed GMP16T-TEC1636 gearmotor drives a 100 mm SFK0825 screw through the LF D14 L22 Clamp 3×4 coupling. The stock nut is clocked 90° about the screw axis. A matching cover continues its flange profile and nut body; two short integral pins project from its flat sides into closed radial slots in the output forks.

The fork faces capture the cover flats against roll while the pins slide radially. Rounded bridges close both slot ends without obstructing the required pin travel. Four M3 screws pass through the bought nut flange directly into blind threads in the cover. The motor, screw axis and bearing supports remain fixed.

## Layout and motion

| Item                               | Nominal value                                               |
| ---------------------------------- | ----------------------------------------------------------- |
| Base                               | 192×56×6 mm                                                 |
| Screw axis                         | Global X, Y=0, Z=28 mm                                      |
| Nut clocking                       | +90° about the screw axis                                   |
| Output axis                        | Global Y, X=19.5, Z=15 mm                                   |
| Crank radius / axis spacing        | 13 mm                                                       |
| Nut centre at neutral              | X=14.5 mm                                                   |
| Pin station relative to nut centre | +5 mm along X                                               |
| Pin diameter and projection        | Ø4 mm, 3.2 mm beyond each Y=±10 flat                        |
| Fork plate planes                  | Y=10.05..13.05 and −13.05..−10.05 mm                        |
| Closed radial slot                 | 4.10 mm wide; rounded-end centres at radii 12.6 and 14.2 mm |
| Pin centre radius during motion    | 13..13.834311 mm                                            |
| Output range / nut stroke          | ±20° / 9.463226 mm                                          |
| Output bearing centres             | Y=±19 mm                                                    |
| Exposed output flat                | Y=24.8..46 mm                                               |

For output angle θ, nut travel is `x = 13 tan(θ)`. The pin axes stay at `(19.5+x, ±11.55, 28)`, parallel to the output shaft. Their radial coordinate in each fork is `13/cos(θ)`. The closed slots retain 0.05 mm nominal side clearance and more than 0.4 mm radial clearance at either rounded end. The bridges have 2.45 mm nominal thickness beyond the slot ends.

The stock ball-screw occurrence is rigidly clocked +90°, retaining its internal raceway registration. The motor output and coupling receive the same neutral shaft phase. Subsequent physical screw rotation is `−360° × x / 2.5`; wrapped supplier parameters do not interrupt continuous motion.

## Cover and shaft clearance

The cover collar repeats the nut's D29 / W20 profile and spans nut-centre X−9..X−4. A Ø18 sleeve with Ø16.6 bore continues to X+8.5. The bore clears the stock barrel and detailed return caps. Flat side pads at Y=±10 carry the pins and provide broad contact against the fork faces.

The output axis lies 13 mm below the screw axis. The Ø18 sleeve above the Ø6 output shaft therefore has 1 mm nominal clearance. At +20°, the full-depth front collar ends at X=15.231613 while the shaft's leftmost surface lies at X=16.5, leaving 1.268387 mm lateral clearance. The stock Ø16 nut barrel has 2 mm nominal vertical clearance. A native BRep distance sweep checks the actual solids, including both end positions, and bounds clearance between samples.

Four M3×8 button screws pass through the stock 4 mm flange and engage the cover. Each blind M3 hole is 4.5 mm deep, leaving 0.5 mm tip clearance and a 0.5 mm end wall. Rotated PCD23 centres are Y=±5.75 and Z=28±9.959292 mm. No drilling or tapping of the bought nut is required.

The 0.05 mm clearance at each cover flat is a running fit. The finite fork faces restrain roll; the ideal pin/slot centre lines alone do not establish this constraint at neutral. Native verification tests the actual cover flats independently of the pins, as well as the complete cover, against both forks.

## Compact bearing seats and retention

All four bearings remain F686-2RS, with a 6×13×5 mm body and a referenced Ø15×1.1 mm flange. Each seat is a 3.9 mm plate with a straight Ø13.02 bore, an 18 mm pedestal and a rounded D18 top. There are no flange counterbores, oversized housing bosses or DIN472 housing retainers. The assembly has 54 physical BOM occurrences instead of 60. Base and support material volume is 12.94% lower than the preserved U-fork revision.

The bearing flanges face outward on each axis and bear on the outside faces of the plates. The opposed flanges stop the paired shaft-and-bearing assembly in both axial directions. The inner rings are captured on the shaft by shoulders, spacers and removable retaining rings. The rolling elements transmit the axial retention load between inner and outer rings; the dust cap is outside this load path. Select bearing load capacity and fits for the real application rather than treating the nominal 0.02 mm diametral clearance as a production fit specification.

The fixed screw plate occupies X=−15.9..−12; its flange lies outside at −17..−15.9. The floating plate occupies X=41..44.9; its flange lies at 44.9..46. The fixed inner sleeve and M6 lock/jam nuts retain one end of the shaft stack. A spacer and DIN471 Ø6 ring at X=48.2 retain the other. The floating support has a 3 mm foot secured by two M3×8 screws.

The output plates occupy Y=16.5..20.4 and −20.4..−16.5. The two bearing bodies span 16.5..21.5 and −21.5..−16.5. Inner DIN471 Ø6 rings at Y=±15.8 and 0.3 mm spacers locate their inner faces; outer 0.8 mm spacers and rings at Y=±22.7 capture the outer faces. A rotating Ø9.5 blind cap screws onto the short shaft end with M6×0.75 thread. Its cavity bottom clears the Y=−26 shaft tip by 0.4 mm, and its shallow driver leaves 0.5 mm of closed wall. The opposite Ø6 end projects to Y=46 mm.

## Assembly and operation

Stage the coupling before fixing both shafts. With the floating support removed, insert the screw from the right, arranging the fixed bearing, inner sleeve and M6 lock/jam nuts during insertion. Offer the motor shaft into the coupling before securing the motor. Slide the empty floating support over the shaft and secure it, then insert its bearing from the outside and fit the spacer and shaft ring. Fit the cover with the four screws through the stock nut flange.

Bring the closed fork slots onto the cover pins from the sides. Slide the output shaft through both clamp hubs, fitting the inner rings and spacers before the bearing plates. Install the bearings with their flanges outward, then the outer spacers and rings. Secure the two plate feet and fit the shaft-end cap. Confirm free movement before tightening the fork clamps.

In ProtoLab choose **SFK0825 rotary actuator ±20°** and change the output angle. In the motion FCStd select **Angle control · −20° to +20°** and edit **AngleCommand**. Persisted expressions clamp the range after reopening without an installed Python proxy. Presets select 107:1 or 361:1 and 12 V or 24 V. The previous slotted-crank family and earlier U-fork delivery remain preserved separately.

## Verification and source limits

All seven static cases pass the native audit: 125 closed solids in Simple and 188 in Full, with no inter-occurrence material intersections. Twenty-one targeted tests cover the motion law, interfaces, bearing load paths and preservation of the previous library family.

Evidence for this revision is saved under `test-results/sfk-rotary-actuator/closed-fork/`. Checks cover native solid validity, inter-occurrence intersections, quantitative shaft clearance throughout the angular range, closed-slot travel, actual face-based roll restraint, threaded interfaces, paired-flange retention, source identity, colors and saved motion. Native geometry uses analytic solids and Boolean cuts rather than converted preview triangles.

Both Simple and Full FCStd are supported; STEP certification is limited to Simple. The SFK0825 reuses the supplied EK6/EF6 0802 end-machining reference provisionally. Inspect the delivered screw before making supports. Its purchased M6 journal and mating nuts retain nominal thread envelopes in both detail modes; the custom output-cap M6 thread has actual flanks in Full. Specify load, materials, fits, tolerances, locking and lubrication before manufacture; powered reversal and sensing are external to this mechanical model.

# MPR.10 demonstration stand

Find **Transmission & linkages → Motion mechanisms → MPR.10 mechanism demonstrator**. The four-channel stationary stand adapts the supplied `/Users/x/Downloads/MPR.10.step` and the later reference images. [Source provenance](lib/source-reference.json) records the original file's fingerprint and header. Attached-file text is reference data, not redesign instructions.

## Structure and tube

Three printed discs carry the motors, forward screw bearings and output bearings. Four peripheral M5 standoff columns connect the discs, leaving the centre open. Each output shaft passes through a pair of bearing lugs formed directly on the upper disc. The structure has no separate central output carrier or linear guide assembly.

The reference tube is **Ø90 outside / Ø86 inside**. At the default 0.6 mm radial installation clearance the printed disc diameter is **Ø84.8 mm**. The fit control changes the printed envelope; purchased motor, screw, bearing and fastener sizes stay fixed.

The frame uses four M5 × 20 mm and four M5 × 30 mm female/female standoffs. Four headless M5 joining studs pass through the middle disc and engage both adjacent standoffs. Top and bottom screws secure the end discs. Keep the disc seating faces flat, check the actual thread engagements and tighten progressively.

| Frame item              | Position                                               |
| ----------------------- | ------------------------------------------------------ |
| Motor disc              | Z=0–3 mm                                               |
| Forward screw disc      | Z=23–26 mm; bearing bosses extend to Z=32 mm           |
| Upper disc              | Z=56–60 mm                                             |
| Output lugs             | Z=34.8–60 mm; local X=16–22 and 33.5–39 mm, Y=±10.2 mm |
| Lower / upper standoffs | Z=3–23 / 26–56 mm                                      |

The four post axes lie on a **38 mm radius**, at 24°, 114°, 204° and 294°. The output axes remain at Z=45 mm. Each output's bearings occupy local X=16–21 and 34–39 mm.

The assembled mechanism is approximately **93.3 mm high along Z**, from the motor backs at Z=−28.3 mm to the upper screw heads at Z=65 mm. Opposed output tips span **96 mm across the tube**, projecting 3 mm beyond its Ø90 outside surface; that transverse span is separate from the axial height and the internal Ø86 fit.

The designed sleeve has four **12 mm wide end-open axial slots**, extending from its upper end at Z=76 mm to rounded bottoms at Z=39 mm. Shaft centres are at Z=45 mm. These slots let the projecting tips enter as the finished mechanism is inserted axially from the slotted end. Prepare matching slots in the host tube, or verify a different installation arrangement before fabrication. The displayed half-section sleeve is an inspection reference, excluded from the mechanism specification and CAD export. The slot geometry does not by itself establish hand, tool or E-clip service access; qualify those operations on the actual tube.

## Purchased motion components

| Item                    | Quantity | Configuration                                                                   |
| ----------------------- | -------: | ------------------------------------------------------------------------------- |
| STEPPERONLINE motor     |        4 | NEMA 8 8HS12-0506S; Ø4 shaft, 20.3 mm frame, 15.4 mm square M2 mounting pattern |
| Screw and purchased nut |   4 sets | SFK0601, Ø6 screw and 1 mm lead; custom Ø4 journals                             |
| Output bearing          |        8 | 688ZZ, 8 × 16 × 5 mm                                                            |
| Screw bearing           |       12 | 684ZZ, 4 × 9 × 4 mm                                                             |
| Rocker follower bearing |        4 | 683ZZ, 3 × 7 × 3 mm                                                             |
| Output shaft E-clip     |        8 | Metal DIN 6799 nominal groove size 6                                            |
| Screw shaft E-clip      |        8 | Metal DIN 6799 nominal groove size 3.2                                          |

Check bearing dimensions as well as names: some open 688 variants are 4 mm wide. Screws, ball nuts, raceways, recirculation paths, bearings, E-clips, pins and standard fasteners remain metal. The printed details provide the frame, couplings, nut forks and rockers. Use the generated component and printed-part CSV files for the complete current quantities.

Each motor/screw axis is at local X=23, Y=−17.5 mm, repeated at 90° intervals. The first motor is clocked radially by approximately −37.27°. The SFK0601 designation establishes the nut family, shaft diameter and lead. It does not specify the custom journals or E-clip grooves. Prepare and inspect a toleranced shaft drawing before machining.

The custom 52 mm screw occupies Z=12–64 mm: drive journal 12–20, fixed journal 20–32, thread 32–58 and rear journal 58–64 mm. The adjacent forward bearings occupy 24–28 and 28–32 mm; the rear bearing occupies 58–62 mm. The neutral nut and output axis share the working-thread midplane at Z=45 mm. This is also midway between the nearest forward and rear bearing centres at Z=30 and 60 mm.

## Bearings and metal E-clips

Each output shaft runs in two 688ZZ bearings with centres 18 mm apart. The outer bearing is the axial datum; the inner bearing provides radial support and allows the shaft to slide axially. Keep the paired bores coaxial.

Two metal size-6 E-clips and inner-ring washers locate the outer bearing's inner ring. These are size-6 rings for a Ø6 groove on a Ø8 shaft, rather than size-8 rings. Groove width is nominally 0.74 mm. The forward screw-bearing pair uses adjacent 684ZZ bearings and a size-3.2 E-clip with an inner-ring washer. The rear screw bearing has a separate washer and size-3.2 E-clip. Its Ø3.2 grooves are nominally 0.64 mm wide. Confirm the delivered rings, shaft end lands and manufacturer's groove tolerances before machining.

Fixed outer-race seats use the bearing interference control. The default **0.04 mm diametral interference** gives nominal Ø15.96 mm output seats and Ø8.96 mm forward screw seats. This is a print-fit trial value. Qualify coupons, measured bore finish, insertion force, retention, creep and repeated use on the actual printer and material. Support only the ring being pressed; assembly force must not pass through the balls.

The rear screw bearing slides in an unshouldered Ø9.10 mm through bore. Preserve its axial float. Shaft E-clips retain inner rings and washers; they do not retain outer rings in the printed housings. Fixed outer-ring retention depends on the qualified seat and shoulder contact. No preload, thrust rating or service life is assigned.

The E-ring library's installed envelope represents an expanded ring centred on the shaft groove. The purchased free-ring dimensions remain recorded separately. No machining of the purchased E-clip is prescribed.

## Captured fork and rocker motion

The purchased SFK nut moves a printed fork with a recessed transverse U-slot. A follower bearing on one rocker pin contacts the opposing slot faces to transmit motion along Z. The follower and output shaft axes follow X; the slot's free sliding direction is Y. The rocker is keyed and clamped to the output shaft.

The shaft's rocker flats occupy X=22.2–27.2 mm; the split hub begins at X=22.4 mm and its clamp screws are at X=24.4 mm. Each split face has a closing relief of `printClearance + 0.1` mm: 0.3 mm per half, or 0.6 mm total at the default setting. This gives the halves room to close before their faces meet. Finish and fit the bore and flats, then verify that the actual clamp grips the shaft without slipping or damaging the print. The displayed unloaded pose does not establish clamp grip.

A separate T-recess captures a flange on the pin's steel inner-ring sleeve along X. This two-sided capture prevents the fork and nut from turning with the screw while leaving the follower free to slide along Y. It retains the sleeve flange without pinching the bearing's shields or outer ring. Top and bottom slot walls alone do not provide the required antirotation constraint. Do not substitute an open groove or omit the recessed keeper.

The sleeve is Ø3.1 inside / Ø4 outside, spanning X=26.7–29.3 mm, with a Ø5 × 0.6 mm capture flange at X=27.8–28.4 mm. Its pocket at X=27.7–28.5 mm gives 0.1 mm nominal clearance at each X face and spans Y=−14.9 to −5.3 mm. The pocket height is 5.6 mm and its mouth is 4.4 mm high: the mouth clears the Ø4 sleeve but retains the Ø5 flange. Slide the keeper over the flange from its open negative-Y end before securing it to the fork. The capture pocket's Z clearance exceeds the roller's drive clearance, so the roller is intended to contact the drive wall first.

The Ø3 mm metal follower pin spans X=23.0–33.3 mm and engages the rocker by 3.7 mm in a nominal Ø2.9 mm printed pilot. Qualify its insertion and axial retention on the actual print; no press-fit holding force is assigned. Check pin clearance from the purchased nut throughout the sweep.

The Ø7 roller occupies X=29.3–32.3 mm in a pocket at X=29.0–32.6 mm. Its side faces therefore remain nominally clear of the pocket. The drive slot spans Y=−14.8 to −4.3 mm and is 7.2 mm high. The purchased nut's flange has 0.1 mm total axial capture endplay and a lateral fit allowance set by the print-clearance control. Two external lid screws seat on printed hard stops. Preserve the shaped flange pocket that transmits nut clocking to the fork.

At an 8.5 mm rocker arm, the nominal joint equations are:

- Fork travel: `−8.5 sin(angle)` mm.
- Follower Y: `−8.5 cos(angle)` mm.
- Follower Z: output-axis height plus fork travel.
- Screw turns: fork travel divided by the 1 mm lead.

The prescribed −18° to +18° poses span **36° total** and correspond to **±2.626644 mm nominal joint travel**. Follower Y changes from −8.5 to approximately −8.084 mm. In those nominal poses the 15 mm nut remains at least **2.873356 mm** inside either end of the 26 mm working thread. The follower's transverse offset from the screw axis remains 9.00–9.42 mm, so the nominal X-capture constraint has a nonzero antirotation lever throughout the range, including neutral.

The source STEP uses a different contact chain: one Ø4 nut pin engages a fixed axial slot and a radial slot in the rocker. Its ideal travel law is `17 tan(angle)`. This adaptation implements the subsequently requested moving nut U-slot and captured rocker follower. Its sine travel law and retention details must be assessed as the current design.

Automated tests check the selected component interfaces, screw lead relation, rocker/follower/nut closure, and the nominal antiyaw constraint across the demonstration sweep. The preview displays prescribed nominal poses. Neither those tests nor collision-free CAD establish loaded freedom from binding. Clearances produce reversal take-up; measure it on the assembled stand.

The screw/nut also receives the prototype fork's antirotation reaction. Manufacturer mounting guidance favours axial ball-nut loading and avoids side loading; see [Thomson's installation guidance](https://www.thomsonlinear.com/en/training/ball_screws/assembly). The guide-free joint has no assigned load rating.

## Printing and bench assembly

Use qualified PETG or PA. Export individual manufactured details for slicing; the installed-position print view is not a prepared build plate. Print the broad disc faces flat where practical. Inspect lug bores, bearing shoulders, fork recesses, hard stops and motion clearances in the slicer. Select accessible supports and finish paired bearing seats together. Print fit coupons before precision hardware is installed.

The current stand uses 27 printed occurrences: three common discs and six details per channel—coupling, nut fork, nut lid, recessed keeper, rocker and removable rocker half. Repeated channel details share local fabrication recipes.

1. Prepare and inspect metal shafts, journals, grooves, inner-ring washers and follower pins. Deburr edges and verify delivered bearing and E-clip dimensions. Qualify fixed seats and the loose rear bore.
2. Keep each purchased screw/nut set assembled or use its manufacturer's transfer sleeve. Fit each nut to its printed fork and assemble the lid against its hard stops. Check that retention does not distort the purchased nut or clamp its moving screw.
3. Build the lower pair of discs first. Fit motors to the motor disc, prepare the couplings and adjacent forward screw-bearing pairs, then join the motor and forward discs around the couplings with the four 20 mm peripheral standoffs. Fit the joining studs through the forward disc. Seat the forward bearings and install their washers and E-clips, checking groove engagement. Keep coupling clamps adjustable during alignment.
4. Fit the four 30 mm upper standoffs onto the exposed joining studs. Prepare the rear bearings, washers and E-clips, then lower the upper disc onto the rear supports and upper standoffs. Preserve the rear bearing's sliding fit. Tighten the frame progressively and align motor/coupling/screw axes without using the coupling to force them together. See [THK's mounting procedure](https://www.thk.com/sg/en/products/ball_screw/maintenance/0001/) and [Thomson's assembly guidance](https://www.thomsonlinear.com/en/training/ball_screws/assembly).
5. Fit the output bearings, shafts, inner-ring washers and metal E-clips. Assemble the keyed split rockers and followers while accessible. Slide the recessed keeper over the stepped sleeve flange and secure it to the fork. Confirm that its X faces retain that flange, the outer ring remains free, and Y sliding is unobstructed.
6. Turn each screw slowly by hand throughout the range and through reversal while completing alignment. Check that the nut stays clocked, the fork follows the screw, the follower slides across the recess and the shaft rotates with the rocker. Recheck motion after tightening the frame and couplings, and verify that each rear screw bearing can still float.
7. Insert the bench-assembled unit axially from the tube's slotted upper end, keeping all four output tips aligned with the 12 mm slots. Check passage, final seating and access to the E-clips and rocker hardware with the actual host tube. Define any slot closure and service procedure before powered demonstration; the half-section view does not establish that access.
8. Calibrate slow demonstration endpoints only after free movement has been verified. Qualify fork retention, antirotation, bearing fits, coupling grip, reversal take-up, wear and printed-material creep on the assembled stand.

Native STEP/FreeCAD and component STL exports retain the physical component separation; STL dimensions are millimetres. Use the current native report for the actual solid and clearance results. The demonstration stand has no assigned load, speed or fatigue rating.

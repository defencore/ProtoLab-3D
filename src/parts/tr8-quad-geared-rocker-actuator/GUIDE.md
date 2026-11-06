# TR8x4 compact four-output geared actuator

The metal support housing uses **four laser-cut and bent 3 mm 5052-O panels**, with two panels bent in each direction. Bearing holes are plain Ø10.02 without recesses or chamfers, while each finished execution has motor countersinks only on its actual installed motor side; the physical BOM records the resulting configurations and quantities. A separate central bearing cross links the inward shaft tips as a functional shaft joint. Four external M3×10 low-head screws and four M3 nuts clamp the interlocking wall tabs. Two metal end discs matching the selected Ø76/86 enclosure diameter receive the projecting panel tongues through slots and are welded to the bare 5052-O shell. Each disc also has four chamfered cable holes.

The original single-output package remains unchanged. It supplies the public TR8 thread geometry, prepared motor bodies, screw-bearing definitions, retainers and shaft-pin interfaces. The quad screws have locally revised bearing journals and retaining grooves. This quad has its own 22-tooth gears, inward motor placement and catalog countersunk motor screws, alongside the shared walls, bearing connector, compact source-thread nuts, CNC forks and radial shafts.

## Inspection states

- **Assembled:** 115 physical occurrences, including four pocketed PETG cover quadrants and four cover screws.
- **Uncovered:** the 107-part metal mechanism without the four cover quadrants or their four screws.
- **Covers:** the four printed quadrants and their four countersunk attachment screws.
- **Interlocking housing:** the four panels with plain bearing holes and actual one-sided motor seats and opposite bend pairs, two identical end discs, four waist clamps and four nuts. Colors distinguish the four panel occurrences.
- **Single housing panel:** one canonical formed-sheet panel, shown without drives or hardware.
- **Central node:** the bearing connector, inward shaft tips, small bearings and retaining hardware.
- **Drive inspection:** the configured quad gears, screw journals, bearings and motor mounts.

## Layout and size

Four coplanar output axes point along +X, +Y, −X and −Y and meet at the virtual origin. Source drive axes sit at radius 14.1 mm, giving 28.2 mm between opposite Ø28 motor centers and a nominal 0.2 mm can gap. Motor axes remain at their existing positions, 22 mm from the screw axes. The smaller cover envelope is obtained with intentional clearance windows, not motor movement. Outer MF106 bearings sit at radius 17.6 mm; CNC fork hubs sit at radius 11.1 mm. The output head faces reach radius 24.35 mm and screw heads reach radius 26 mm. The metal end discs match the Ø76/86 enclosure diameter. The main formed-panel tangent width is 61 mm; bearing and motor interface centers remain unchanged.

The metal end discs match the selected enclosure: Ø76 mm for 2838 or Ø86 mm for 2845 motors. The metal mechanism and completed assembly both follow that diameter; the panel tongues set the nominal total height at 125.212 mm. The PETG sections fit between the metal discs. Actual dimensions are computed from the selected assembly state.

The nominal motor-can envelopes are listed below. Measure the complete formed-panel assembly before specifying a cylindrical enclosure; bends, clamp heads and other hardware can extend beyond the motor cans:

| Motor family | Nominal can length | Can cylinder about the common axis |
| ------------ | ------------------ | ---------------------------------- |
| Surpass 2838 | 40 mm              | Ø74.56 mm                          |
| Surpass 2845 | 47 mm              | Ø84.42 mm                          |

These motor-only values are 2√(28.1²+24.5²) and 2√(28.1²+31.5²), respectively. These are motor-only envelopes; they do not define the selected Ø76/86 cover and end-disc diameter. Full-assembly envelope checks and load qualification are separate.

The approved drive arrangement is retained: lower A/C drive units have been exchanged between opposite positions while preserving their global orientations. Upper B/D drives retain their positions. Source screw directions are +Y, −X, −Y and +X. Source input angles are the negative output command on A/C and the positive command on B/D.

| Channel | Output axis | Output reference frame | Source angle |
| ------- | ----------- | ---------------------- | ------------ |
| A       | +X          | I                      | −command     |
| B       | +Y          | Rz90·Rx180             | +command     |
| C       | −X          | Rz180                  | −command     |
| D       | −Y          | Rz270·Rx180            | +command     |

The wall panels use independent placement frames. Their bearing seats and tabs serve the shared crossed-drive arrangement:

| Panel | Position      | Placement frame         |
| ----- | ------------- | ----------------------- |
| A     | Upper +X wall | I                       |
| B     | Lower +Y wall | T(0,+34, 0)·Rz270·Rx180 |
| C     | Upper −X wall | Rz180                   |
| D     | Lower −Y wall | T(0,−34, 0)·Rz90·Rx180  |

## Formed panels with component-specific seat faces

Laser-cut the four panels from 3 mm 5052-O sheet. The main tangent contour spans T=−30.5…30.5 mm; all functional hole centers and core placements retain their existing datums. Form two with 90° bends toward the blank face and two with the opposite bends. Actual bend directions and motor-seat faces determine how many finished executions are needed. The formed models retain constant sheet thickness through the bend arcs, with integral flanges. Additional reverse-side pockets are not used to make the parts identical.

Use each execution’s DXF for its cutting outline, holes and bend reliefs, and its SVG and schedule for forming and finishing. A cutting file may serve several executions only when their actual cutting contours and holes coincide. View the blank from its +N face, with u=T to the right and v=developed Z upward. `CUT` entities are cutting paths. `BEND_UP` marks folds toward +N; `BEND_DOWN` marks folds away from that face. Bend marks are not cuts. The bend schedule records angles, inside radii and the neutral-axis allowance. Qualify the allowance and springback against the selected tooling before production cutting.

The chosen material is annealed **5052-O**, with a nominal 1.5 mm inside bend radius in 3 mm sheet. The Yieh 5052 table and Atlas temper-dependent bend table support the softer O temper for the tight bends. H32 has a larger recommended radius and is not a direct substitute. Orient the bend lines relative to the rolling direction and confirm the actual formed sample.

After forming, finish the plain Ø10.02 bearing holes without chamfers or flange recesses. MF106 flanges remain outside the 3 mm sheet. Machine each motor countersink only from the side used by its installed screw: A/C from N=18.5, B/D from N=15.5. Retain the bearing and motor interface datums in the native model. Through-cut waist slots, formed flanges and the external M3 clamps join the upper X and lower Y panels; the case manifest records the actual clamp length, stack and locations. No integral milled tabs or additional brackets are included.

The central output-bearing foot is circular, Ø17.4 mm, reaching Z=−8.7 mm. Its plain Ø10.02 mm bearing hole leaves **3.69 mm nominal metal to the free edge**. The DXF uses an exact circular arc for this reinforced contour; both opposite-bend variants retain it. This margin describes the central foot and does not establish a load rating.

## Two identical welded end discs and cable holes

Laser-cut two 5052-O discs, 3 mm thick, matching the selected enclosure diameter: Ø76 mm for 2838 or Ø86 mm for 2845. Each has two **through** capsule slots, 50×3.15 mm. Each main panel ends in a rectangular 46.6×3 mm tongue cut from the same sheet. Its 3.5 mm insertion length projects 0.5 mm past the disc face for welding. The top disc spans Z=59.106…62.106 mm; the bottom is indexed 90° without flipping the blank to receive the lower wall pair. Both ends retain the same global positive 15.5° cable-port clock; use the shared world inner/outer port stations for routing. The tongues end at Z=±62.606 mm.

Each disc has four technical cable holes, Ø10 on radius 28.5 mm, starting at 15.5° and repeating every 90°. Their actual centers come from the shared end-disc API. Chamfer both faces of every cable hole by 0.5 mm. These ports are separate from the lightening holes.

Weld the projecting tongues to the discs while the shell is bare, before installing the separate bearing connector, bearings, shafts, nuts, forks, motors or gears. Main panels and end discs use the same specified 5052-O material. Assign welding fixtures, sequence, distortion control and post-weld bearing-seat inspection in production preparation.

## Sheet-metal lightening

Each main panel has four circular relief holes and three rounded slots. Each end disc has eight separate circular relief holes. Use the actual cutting patterns, which preserve rounded contours and the modeled lands around functional bores, threads, bend tangencies, welding slots and outer edges. The minimum-ligament value in the schedule is a design target; it does not establish an application load rating.

The fabrication schedule reports the exact dedicated through-relief volume and its nominal mass reduction using an explicitly assumed 5052-O density of 2.68 g/cm³. The reference retains the current cable ports and all other geometry, suppressing only the dedicated relief cuts. It is not a finished assembly weight; cable-port enlargement is outside this comparison.

| Motor family | Dedicated relief volume, four panels + two discs | Nominal mass reduction at the assumed density |
| ------------ | -----------------------------------------------: | --------------------------------------------: |
| 2838         |                                     5369.482 mm³ |                                      14.390 g |
| 2845         |                                     6217.712 mm³ |                                      16.663 g |

## Motor leads and reserve cable grooves

Four motor routes connect inboard rear collectors to their assigned end ports: A/C leave through the lower end and B/D through the upper end. The rear collectors have a nominal Ø15 envelope; the motor grooves have a nominal Ø8 envelope. The purchased motor model omits free leads, the rear boot and its exit clock. Clock the real motor so its leads enter the collector, and confirm the actual boot before printing.

Eight separate reserve routes, four per end, start at removable-cover inner service entries near local N=21, T=13 and Z=±5 mm. A Ø4.4 entry neck transitions around the output hub to the main trunk at T=5 mm. The widened trunk starts at |Z|=13.5 mm, with a maximum nominal section of 4.4×8.037 mm for 2838 or 4.4×9.683 mm for 2845, expanding toward the end-port collectors. The routes remain split above and below the waist; they do not cross the Z=0 stand-shank barrier. Motor routes and reserve routes can share an end port. The Ø4.4 entry neck, 4.4 mm reserve minor dimension, Ø8 motor groove and shared Ø10 metal port are geometric restrictions, not certified cable-bundle sizes.

The schedule records actual world port mouths, route centerlines, segment lengths, collector geometry and nominal probe/blend values. Motor routes cross transversely in stages at |Z|=47.5 and 54 mm, then reach the port XY coordinates at |Z|=57 mm to avoid the output hub. The virtual clearance controls have radii 3.5 mm for motor routes and 2.0 mm for reserve routes; these are raw CAD probes pending native checks, not certified bundle sizes or cable minimum-bend-radius specifications. Check the chosen harness, shared-port packing, edge protection, strain relief and covered travel. Cables and connectors are external to the mechanism BOM; no wire count or connector-passage capacity is assigned.

## Central shaft connector and outputs

The central bearing cross is a separate functional joint captured by the shafts. Its nominal 13×13×8 mm envelope is clipped by a Ø16 contour. Four EZO MR52 ZZ bearings, 2×5×2.5 mm, have radial centers at 4.75 mm; the source preset is `ball-bearing/promteh-7439`. Arm ends stop at radius 6.5 mm. Fork hubs begin at radius 8.1 mm, leaving a nominal 1.6 mm node margin. The central retaining-clip access opening is Ø7.9 mm.

Each radial shaft has a short Ø2 inner tip and a Ø6 torque journal. Small inner retaining grooves remain outside the torque path. The outer SMB MF106 2Z bearing is 6×10×3 mm, centered at radius 17.6 mm with body faces at radii 16.1 and 19.1 mm. Its flange stands outside the plain panel hole. The output head begins at radius 19.35 mm, leaving a nominal 0.25 mm bearing gap. Its Ø19 back runs to radius 23.65 mm; the Ø20 front rim then runs to the face at radius 24.35 mm. The rim begins 0.85 mm beyond the outer fork cheek. The head remains 5 mm thick and keeps four ST3215 PCD14 M3 locations, with the head threads beginning at radius 20.85 mm.

Each fork has **2.6 mm cheeks**, 8.4 mm cheek and web widths, and a Ø11 eye at radius 11.1 mm. The hub and straight eye arm share the same 6 mm thickness, spanning R=8.1…14.1 mm. This leaves a nominal 2 mm gap to the outer bearing body. Neutral cheek spans are R=5.4…8.0 mm and R=20.2…22.8 mm, corresponding to local follower-axis stations w=±6.1…±8.7 mm. Nut follower pins project 0.5 mm beyond the cheek faces. The separate Ø2×10 shaft-fixation pin is centered at radius 11.1 mm. Its Ø2 guide bore runs along local arm Y from −6.1 to 13.3 mm, through the eye and arm to the opposite web face. The installed pin is recessed 0.5 mm at the rounded eye entry and 8.2 mm at the web face.

The slot width remains 4.1 mm. Its closed-end arc center is L−0.15=20.45608065 mm, giving 0.2 mm nominal neutral pin/end clearance. The straight mouth begins at 24.2 mm; the rounded lip ends at 27.86571957 mm. At ±20°, the maximum pin center is 21.92853300 mm and its outer edge is 23.92853300 mm. The nominal straight-mouth margin is 0.271467 mm and lip capture margin 3.937187 mm.

The straight eye arm joins the clevis web from inside the gap, in the full-thickness eye plane. Its tangent sides taper smoothly from the Ø11 eye to the 8.4 mm web at lever-plane station 9.8 mm. Both cheeks terminate flush with the shaft-facing web plane at that station, with R1 rear corners. The 8.4×3.4 mm R1 cross-web spans lever-plane stations 9.8…13.2 mm. Machine the eye, straight arm, cheeks and cross-web as one connected detail. These distances describe the nominal geometry and kinematics; they are not load or fatigue ratings.

## Compact nut and source drives

The new bronze nut body is **16×12×12 mm**. It uses the exact public source two-start female thread and end reliefs, retaining **15.2 mm effective engagement**. The original source lever is 7.5/tan(20°), approximately 20.6060806459 mm. A 31 mm working thread and 16 mm nut give 15 mm travel, with nut centers at source axial coordinates 8 and 23 mm at the ±20° limits.

The thread is right-handed TR8x4(P2), with 4 mm lead, 2 mm pitch and two starts. This compact nut is its own physical component definition; the single-output source nut remains unchanged. The public source package remains unchanged. The quad reuses the source thread, prepared motor-body geometry, bearings, retainers and shaft-pin stations, with local screw journals and grooves; its gears and motor screws are local configurations.

Choose one common motor for all channels: Surpass Hobby 2845 3100KV or 2838 3200, 3500, 3700, 4400, 4700, 5100 or 5700KV. The default is 2838 3700KV. The motor shaft retains the source secondary Ø1 cross-drill at 13 mm from its mounting face. Gear pins remain outside the tooth faces.

## Local gears and countersunk motor mounts

Source-axis screw-bearing centers are X=−2.1 and 33.1 mm. Front and rear retaining clips are centered at X=−3.9 and 34.9 mm, with groove centers −3.92 and 34.92 mm. The bare screw keeps its 0…31 mm working thread; the revised gear face leaves a nominal 0.2 mm gap to the front clip.

Each local 1:1 gear pair has 22 teeth, module 1, 20° pressure angle and a 5 mm face. Its pitch diameter is 22 mm and outside diameter 24 mm. The tooth face is shifted 1.6 mm toward the screw bearing, occupying source axial coordinates X=−9.4…−4.4 mm. The Ø12 hub extends from X=−15 to −9.35 mm. Source pin holes remain at X=−13 mm, outside the tooth faces. The pinion mesh phase is 180/22°, approximately 8.181818°; its pin and motor-shaft clocking follow that phase.

All eight motor mounts use the sourced DIN7991 M3×5 hex countersunk configuration `bolt-screw/gvyntok-040-070-001`: Ø6×1.7 mm head, 90° cone, 0.2 mm cylindrical head rim, AF2 socket and0.5 mm pitch. Countersunk nominal length includes the head. Source-local center X=−0.5 places the head face at X=−3 and screw tip at X=+2, preserving 2 mm nominal motor insertion through the 3 mm wall. Match the seat to the selected head's rim and cone. Final motor-bolt Y follows the 22 mm motor spacing.

## External stand mounting

Each metal panel has five additional M3×0.5 through threads for an external stand, 20 in total. These are separate from the four existing cover threads, giving 24 metal-panel M3 threads. The PETG details provide shank clearance to all 20 stand interfaces.

The output-shaft axis defines local T=0/Z=0. The five-point sketch has two lateral holes at Z=0 and three holes on the centerline above the output:

| T (mm) | Z (mm) |
| ------ | ------ |
| −12.7  | 0      |
| +12.7  | 0      |
| 0      | +12.5  |
| 0      | +30    |
| 0      | +55    |

Laser-cut Ø2.5 pilots and finish M3×0.5 through the 3 mm sheet. PETG passages are Ø3.4 for M3 shanks only; stand-bolt heads remain outside the PETG. The stand and its fastening hardware are external. Each panel flat pattern retains the five stand pilots and adds the dedicated circular and rounded-slot lightening contours.

Connected shallow ears remain part of the same 3 mm sheet, with outer T=±15.2 mm, bottom Z=−3.5 mm, top Z=4.5 mm and R1 outer corners. The original R8.7 bearing foot remains. No separate brackets or extra mechanism parts are added.

The external stand and its screws are not modeled or included in the BOM. Adding these interfaces does not add mechanism hardware or change the 115/107/8 inspection-state counts.

## Pocketed PETG covers

Four dark-gray PETG quadrants form the external Ø76 mm enclosure for 2838 motors or Ø86 mm for 2845. Each quadrant retains solid PETG around local motor, gear and swept-motion clearance pockets. The model defines the remaining solid regions, service space, output collars and overlapping acoustic seams. Use each actual printed execution in its indexed position.

The PETG spans Z=−58.90608065…58.90608065 mm, height 117.8121613 mm, leaving 0.20 mm nominal gap to each metal disc inside face at Z=±59.10608065 mm. The full assembly reaches 125.2121613 mm at the panel tongue tips; the disc outside faces span 124.2121613 mm. There are no outer polymer end lips.

The nominal central service opening is a 37.6 mm square. Closed PETG lands have a nominal 1.2 mm minimum target. Motor/gear zones that would leave thin films are intentionally open windows; no continuous minimum skin is claimed across those openings. Stepped joints have 0.4 mm overlap and 0.2 mm nominal clearance with radial release. Output collars have Ø21 bores, leaving 0.5 mm nominal radial gap around the Ø20 heads; their inner ends start at radius 24.65 mm, 0.30 mm beyond the head faces.

Use dense PETG perimeters and 100% infill in the modeled solid regions around the pockets. Preserve the modeled clearance voids. Preserve the nominal running gaps, overlap fits and fastener clearances. The cover sections sit between the metal end discs; the panel tongues set the full assembly height. Four DIN7991 M3×6 screws attach the indexed quadrants to their metal panels, one per quadrant. The countersunk head planes lie 21.6 mm from the common center along the outward panel normals; the actual BOM and API retain each supplied configuration and placement. The panel pilot locations are canonical Z=54.8 mm, T=+27.5 mm on A/C and T=−27.5 mm on B/D. Motors retain their existing geometry and positions.

The dense material and overlapping joints are nominal CAD noise-control geometry. Required motor/gear windows, stand access passages, running gaps and open ports interrupt the barrier and provide sound paths; maintaining close joints matters. PETG is not specified here as an effective sound absorber, and no measured attenuation or dB rating is assigned. [OSHA noise-control guidance](https://www.osha.gov/otm/section-3-health-hazards/chapter-5)

Rigid connections can also transmit vibration and radiate sound, so evaluate the complete mounted assembly rather than the covers alone. [NIOSH engineering-control guidance](https://www.cdc.gov/niosh/noise/prevent/engineering.html) Check motor and PETG temperatures under the intended duty cycle after enclosing the drives. Measure noise before and after at the same operating condition before making a performance claim.

Fit the indexed quadrants after internal assembly and travel checks. Preserve the overlapping seams and output running gaps, leave cable passages clear, then repeat travel, temperature and cable-clearance checks with all four sections installed.

## Fabrication files and assembly

The bundle contains the physical BOM with material and manufacturing-process columns, four-channel motion CSV, forming, machining and printing schedule, panel/functional-joint manifest, assembly instructions and execution-specific SVG drawings. Cutting DXFs are grouped only when their actual contours and holes coincide; a separate end-disc DXF and SVG contain the selected outside diameter, welding slots, cable ports and lightening holes. The BOM records the real finished panel configurations and quantities, two end discs, one bearing connector, external waist clamps, four pocketed PETG quadrants and four cover screws; the stand interface adds holes only, not hardware. Motion data includes output and signed source angles, source-axis directions, screw turns and global nut coordinates.

The following is a **proposed assembly route**. Native insertion checks and production weld qualification remain required.

1. Laser-cut the 3 mm 5052-O panel blanks and form the two opposite-bend pairs; cut the two matching-alloy end discs. Finish plain bearing holes without recesses or chamfers, and machine motor countersinks only on the actual installation faces. Machine the separate bearing connector, forks, radial shafts and compact source-thread nuts.
2. Interlock the bare panels and fit the M3×10 waist clamps first. Position both discs with 0.5 mm tongue projection and weld the bare 5052-O shell. Inspect alignment and bearing seats after welding.
3. Side-load each fork through a wall window: in the base output frame, offset it by Z=−15 mm, move its radial +X offset from 40 mm outside to 0, then lift to neutral Z=0. Transform this path with each output frame.
4. Feed each nut separately through a side window so its pins enter the open fork mouths. Fit the output bearings, fixture the central connector, insert shafts and install the vertical fork pins at neutral.
5. Helically feed each bare TR8 screw through its located nut using the 4 mm lead before fitting its screw bearings or gears. Then install screw bearings and retention.
6. Install motors and pinned gears after the internal hardware. Retain the approved A/C negative and B/D positive source-angle signs. Confirm the real rear boot and lead-exit clock, then lay each motor lead from its collector into the assigned end-port groove. Lay reserve leads from their separate upper/lower service entries without crossing the waist stand-shank barrier.
7. Check every output through −20…+20°, including stops, bearing end float, fork/connector clearance, gear clearance and controller limits.
8. Fit the four indexed pocketed PETG quadrants with their selected cover hardware from the BOM. Preserve the acoustic overlaps, running gaps and cable passages. Repeat travel and cable-clearance checks, and verify motor temperatures under the intended duty cycle.

## References and evidence

- [OSHA noise-control engineering guidance](https://www.osha.gov/otm/section-3-health-hazards/chapter-5): dense barriers, joint leakage and enclosure heat considerations.
- [NIOSH engineering controls](https://www.cdc.gov/niosh/noise/prevent/engineering.html): enclosure openings and vibration transmitted through rigid connections.

- [Yieh 5052 coil and sheet technical data](https://aluminum.yieh.com/Upfiles/EDUp/files/5000%20Series/TDS/AA5052/TDS-YIEH-5052-Coil%20%26%20Sheet.pdf): O-temper sheet, thickness-dependent bend radii and weldability.
- [Atlas 5052 data sheet](https://atlassteels.com.au/wp-content/uploads/2021/08/Aluminium-Alloy-5052-Data-Sheet-24-06-21.pdf): O/H32 bend-radius distinction, rolling direction and tooling qualifications.

- [EZO manufacturer dimension table](https://www.ezo-brg.co.jp/english/product/result.php?product_category=1): MR52ZZ is 2×5×2.5 mm. The separate 682ZZ entry is 2×5×2.3 mm and is not the selected bearing.
- [EZO MR52 ZZ supplier listing](https://promtehimport.com.ua/offer/pidshipnik-mr-52-zz-ezo-japan-o7439/): the selected source-library preset. Internal ball geometry is illustrative.
- [SMB MF106ZZ manufacturer drawing](https://www.smbbearings.com/firebrick/ckeditor/plugins/upload/Uploads/Documents/bearingpdfs/MF106ZZ-flanged-miniature-bearing-6x10x3mm.pdf): outer output and source screw bearing interface.
- [TR8x4(2P) specification](https://ooznest.co.uk/product/tr8x4-2p-lead-screw-cut-to-size/): screw lead and pitch reference. The modeled journals require an unthreaded machining blank.
- [Surpass Hobby 2845 reference drawing](https://images-na.ssl-images-amazon.com/images/I/51uWegAEAqL.jpg) and the selected 2838/2845 source packages: motor envelopes, winding choices and source-specific evidence limits.
- [Waveshare ST3215 resources](https://docs.waveshare.com/ST3215_Servo/Resources-And-Documents): output-head hole locations.

The main wall panels, end discs, central bearing connector, compact nuts, CNC forks and radial shafts are custom designs. Supplier interface evidence and valid native CAD do not establish an assembly load rating. Preserve repository and source-specific copyright notices; references do not grant redistribution rights to supplier drawings.

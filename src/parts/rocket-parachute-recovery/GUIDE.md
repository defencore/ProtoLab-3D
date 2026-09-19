# Parachute Recovery Assembly

The default is **AirBrakes linear spiral / three retracting hooks**, with **MG996R / tube 90–86 / 2x18650 2S1P / F405 WING-MINI** avionics. The eased spiral and geared release remain selectable alternatives. It imports the detailed Rocket Release geometry, including servo capture frame, cell seats, power contacts, dampers, PCB stack, modeled threads and manufacturing metadata. It does not substitute generic avionics boxes. Existing Rocket Release presets are unchanged.

## Assembly and load path

The nose carries the servo, battery pack and controller. A separate open-mouth machined PTFE cassette holds the packed drogue and bundled main parachute. Three matched compression springs at 120 degrees act on a common captive pusher beneath the cassette. Each spring surrounds one guide rod. Integral lower and upper locating collars center its ends; the pusher has reinforced D15 spring seats. The cassette rim bears on the four arms of the nose X-crossmember while locked. Unlocking releases the nose; the three springs push the cassette and nose forward. After the pusher reaches its stops, inertia carries the cassette clear. The pusher, guide rods, three guide springs, lower bulkhead and main tether anchor stay in the body. Four light, short cartridges in the nose assist initial seam separation; their energy is deliberately excluded from the three-spring budget.

Three D4 polished guide rods are supported at both ends: the lower bulkhead receives their M3 threads, and a 4 mm upper annulus locates their shoulders. Three radial countersunk M2 screws secure that annulus through the body ring and tube. M3 ISO 7092 reduced-diameter washers (D6/D3.2, nominal t0.5) and ISO 4032 nuts retain the rods. See the [washer supplier dimensions](https://www.accu.co.uk/metric-flat-washers/629058-HRDW-M3-6-0-A2); account for thickness tolerance in the nut stack. The D68 pusher stops on the underside of the annulus; the D56 cassette passes through its D57 opening (0.5 mm nominal radial clearance).

A separate Al6061 X-crossmember has four 8 mm wide, 3 mm thick arms and four ISO 10642 M2x8 screws. On the geared model these replace the four shorter retaining-disk screws and load the existing machined posts. Its central D8 eye has a 2 mm bearing radius. The tether follows the axis through the packed parachute, cassette floor, pusher and the free space between the three springs. D8 minimum-bore PTFE fairleads have rounded R1 entrances. A steel D24/D8 washer under the body bulkhead spreads a stopper-knot termination load; the modeled knot is only an envelope. Verify knot type, cord strength, bend radius and clearance with the actual harness. Do not infer an inflation-load rating from these dimensions.

The cassette is one machined PTFE cup with 2.5 mm walls and a 4 mm floor. Its uninterrupted rim has R0.5 edges and bears on the four X-crossmember arms; there are no side cord slots. The packed-fabric envelope leaves a central corridor for the tether and nose eye. Remove burrs and polish all cord-contact surfaces; PTFE creep and low-temperature impact behavior still need material-specific tests.

**Packing safety pin inserted** shows the nose removed with all three springs compressed. A removable steel D4 shoulder pin enters from the side through a body-mounted guide block into the pusher's integral boss. Two countersunk M2 screws secure the guide block. This is an assembly restraint, not the flight release. Positively verify engagement before packing and remove it before arming. The other states omit the pin. Its retention under handling and the bracket/tube bearing strength require bench testing.

**Without tubes** hides the continuous lower tube, nose tube and nose cone. **Mechanisms only** also hides fabric and cords. Both follow the sequence slider. The lower body is exported as one continuous, consistently colored tube.

Plastic cassette and liners are machined PTFE. The existing library battery insulation retains its documented material until a material-specific creep/retention check permits substitution. Flexible parachutes, bags and lines are installation/routing envelopes, not sewing patterns.

## Drive choices

| Drive               | Kinematics                                                                                                                                           | Load estimate                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Geared release      | 100T internal ring, 40T idlers, 20T input; module 0.6, 20 degree pressure angle; nose rotates 14 degrees, servo rotates -70 degrees relative to nose | Lock friction at R36.25 divided by 5 and efficiency, plus cassette-rim thrust friction |
| Linear spiral hooks | Three inward-moving hooks; 8 mm stroke over 90 degree default servo sweep                                                                            | Sum of body-eye and support-cheek friction times `dr/dtheta`, divided by efficiency                              |
| Eased spiral hooks  | Same guides and hooks; cosine velocity ramps over the first/last 10% of the sweep                                                                                                  | Peak slope is 1/0.9 = 1.111 times the linear cam slope                                           |

The AirBrakes latches now use a **double-shear blade joint**, replacing the thin annular retaining lip. At each of three 120-degree stations, two 3 mm thick cheeks are machined integrally with the nose disk. A 3 mm thick eye rises from the fixed body ring between those cheeks. One steel blade with an 8 x 4 mm section and R1 longitudinal corners passes radially through all three members. The cheeks occupy radial coordinates 32.5–35.5 and 39.3–42.3 mm; the body eye occupies 35.9–38.9 mm. There is 0.4 mm assembly clearance on either side of the eye. No small guide-cover screws carry the primary axial separation load.

Closed blades reach the outer cheek's outside face. Slots are 8.3 x 4.3 mm with R1 corners for a D2 end mill, giving 0.15 mm nominal clearance per face. The nose cheeks extend 3.05 mm below the slot and 3.65 mm above it; the body eye has 3.15 mm of material above its slot. After the 8 mm radial withdrawal, each blade tip ends at R34.3, 1.60 mm before the body eye. The blade remains located in the inner nose cheek. The force path is nose disk → two integral cheeks → steel blade → intermediate body eye → ring web/rim → tube screws. The cam and guide covers position the blade rather than acting as its primary axial support.

Four short captive spring cartridges remain in the nose. They retain their diagonal 45, 135, 225 and 315 degree positions on R36.25, which clear the battery cages. Cartridge receiving threads are cut through the complete fused nose disk and cheek roots so overlapping bosses cannot refill the bores. Integral D6.4 reaction posts on the body ring support their D6 buttons at z=8. Once the blades withdraw, the cartridges push the two members apart over their 8 mm captive stroke. The three long guide-rod springs separately eject the cassette; their force and energy remain in the calculation. Avoid interpreting this staged animation as a dynamic prediction of release time.

**Latch section** cuts the receiving ring and nose cheeks while keeping the gold steel blades intact. This view reveals both support walls and the intermediate body eye. It is inspection geometry: use an unsectioned state for manufacturing export.

Cam slots are 3.4 mm wide with D3 sleeves. Hook slides have 0.15 mm nominal axial clearance. The scalloped cam outside edge follows its slots to clear the retracting stems. Separate guide covers and a lower thrust plate are fastened to the nose disk. Endpoints are geometric references: actual PWM endpoints must be calibrated.

The **external axial retention load** parameter defaults to 1000 N as an explicit screening assumption, not a working-load rating or a measured flight load. Spring preload is added. For equal sharing among three latches, the report computes nominal blade double-shear stress `P/(2wt)`, blade bending `PL/(4Z)` using a conservative central point load and 6.8 mm support-center span, body-eye bearing `P/(3w)`, and cheek bearing `P/(2*3w)`. Here `P=total/3`, `w=6` (conservative inscribed width excluding both R1 edges), `t=4` and `Z=wt²/6`. These results do not check allowable stress, tear-out, stress concentrations, uneven sharing, bending of the ring web, tube attachment, fatigue or parachute opening shock. Steel grade/heat treatment and aluminum temper remain to be specified. The release torque calculation assumes the stated spring preload; the separate peak retention load is not an assertion that the servo can unlock under that peak load.

The cam thrust plate uses three DIN 7991 M3x8 screws with D6 heads, 1.7 mm head height and 2 mm hex drive: Bossard BN 4719, article 1019163, stainless A4 ([supplier drawing](https://www.tme.com/Document/66de287134764435c21ce37255cb401b/BN4719.pdf)). Do not substitute a larger-head ISO 10642 envelope without changing the seats. The output retaining screw is ISO 7380-1 M3x12; confirm the supplied servo's receiving thread and usable depth before installation.

## Calculation inputs and limits

The user's approximate nose mass is **1 kg**. Cassette plus parachutes defaults to **0.2 kg**, an assumption. Pack extraction force defaults to **5 N**, guide friction to **1 N**, adverse axial gravity to **1 g**, and required speed after clearing the ring to **1 m/s**. All are editable.

Each of the three springs defaults to mean diameter 12 mm, wire 1.3 mm, 24 active coils plus two end coils, stroke 60 mm and residual compression 10 mm. Guide centers lie on a D63 pitch circle. The spring outside diameter is 13.3 mm and inside diameter 10.7 mm; the D4 guide rod limits lateral bow, and end collars locate each spring. Use a matched set with equal force at both installed lengths: three springs do not compensate for unequal friction or misaligned rods. Estimated solid length is 33.8 mm; the closed installed length is 36.8 mm and free length is 106.8 mm. The nominal helix envelope includes 26 coils per spring. End closing/grinding geometry and the active-coil convention require a supplier drawing.

With assumed steel shear modulus G=79,000 N/mm²:

- `k = G d^4 / (8 D^3 Na)` in N/mm.
- `Fstart = 3 k (stroke + preload)`; `Fend = 3 k preload`; combined rate is `3 k`.
- `E = 3 k ((stroke + preload)^2 - preload^2) / 2000` in joules.
- `R = packPull + guideFriction + movingMass * 9.80665 * axialGravity`.
- `Erequired = energyFactor * (R * cassetteClearanceTravel / 1000 + movingMass * exitSpeed^2 / 2)`.
- Wahl-corrected shear uses `C=D/d`, `Kw=(4C-1)/(4C-4)+0.615/C`, `tau=Kw*8(Fstart/3)D/(pi*d^3)`.

The three springs together produce about **142.8 to 20.4 N** and **4.897 J**. Each spring has k=0.680 N/mm, peak force 47.6 N and approximately **767 MPa** calculated peak wire shear. These are preliminary analytical dimensions, not a catalog spring selection. The geared variant requires about **3.010 J** over 79.15 mm clearance travel with the stated assumptions. This is an energy-budget comparison, not a selected spring's strength approval. Spring stress, fatigue, guide friction, contact pressure, tube screw pullout, cassette creep and parachute opening shock still need material data and physical load tests.

Servo torque compares against an editable fraction of TowerPro's **4.8 V stall torque**, not a continuous-duty rating. Both lock preload and cassette thrust friction are included for the rotating-nose variant. The default 50% comparison limit is an engineering assumption; no continuous torque rating is invented. For the sliding hooks, both the body eye and nose support cheeks carry axial load. Their friction coefficients are separate editable assumptions, each initially 0.15. Their sum enters the cam torque calculation. The revised eased profile reduces peak slope relative to the former cubic law, without changing the 8 mm stroke or 90 degree sweep. At the default preload the calculated linear/eased torques are approximately 0.384/0.426 N m, against a 0.461 N m comparison budget: these are small margins, not a measured unlock guarantee. Measure the complete loaded unlock torque, including misalignment and wiring.

## Recovery sequence

0–30% unlocks the latch without axial travel. 30–55% shows the spring-powered stroke. 55–80% shows continued cassette extraction. Later states illustrate drogue deployment and main release; sequence percentage is not time, altitude or a dynamics solution. The user's main release target is 300 m, recorded as an editable external-controller target. Flight detection and chute-release firmware are not implemented by this CAD package.

Keep the loaded 2S voltage above the WING-MINI's documented minimum input of 7 V. Feed MG996R from regulated 5 V servo power, never raw 8.4 V cells. Cell current capability, low-voltage cutoff, fusing, charger, controller orientation and deployment logic must be selected for the real assembly.

## Verification and export

Use the configurator assessment to identify failed force, energy, drive or voltage budgets. Do not hide a failed budget by changing assumed loads. Validation also rejects a cassette that cannot fit, a pusher stroke entering the locking ring and a spring support extending beyond the body bay.

FreeCAD export retains separate labeled components, thread callouts and manufacturing metadata. No TechDraw sheets are generated. OEM-unverified MG996R spline/ear dimensions and individual PCB interfaces remain explicitly marked fit references; measure the purchased components before machining. The CAD is a bench prototype, not a flight-qualified design.

Regression checks live in `tests/parachute-recovery.test.ts`. They cover library component reuse, cam follower kinematics, staged motion, energy/torque failure cases, fit validation and finite preview geometry. Setting `FREECAD_PYTHON` to an interpreter with `FreeCAD` and `Part` available enables positive latch tests (closed blades engage the body eye and both nose cheeks; retracted blades and the lifting nose cheeks clear the receiver), intermediate cam/guide interference checks, and the native-solid test of countersinks and captive ejector interfaces at both stroke limits. These tests cover specific interfaces and checkpoints; they are not continuous collision detection, structural analysis or qualification of flexible line routing.

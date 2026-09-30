# CO2 recovery assembly

A CO2 recovery assembly for a 90/86 mm tube, with a turned aluminium bulkhead,
a metal gas unit in polymer holders, retained 18650 cells and a damped controller.
Choose F405 WING-MINI with 2S or 4S, or LCH7 v3.2 with 4S. Both 4S versions use
one battery pack and a replaceable, turned POM-C controller disk.

## FreeCAD visibility groups

New exports organize the model into expandable `App::Part` subassemblies:

- **Airframe**: Upper electronics tube, Lower parachute/payload tubes, Nose fairing and Motor interface.
- **External fasteners**: metal body/fairing screws and nylon shear screws.
- **Structure**: separating bulkhead, seals and the body bulkhead/tie-rod load path.
- **CO2 deployment**: cartridge, dispenser, printed adapters, gasket and flange screws.
- **Parachute**: packed drogue/main and the bridles/nose anchor.
- **Electronics**: battery pack and retention, flight controller and mounts, tracker/buzzer/PWM switch, and the lower payload envelope when present.

Select a group in FreeCAD's tree and press **Space** to show or hide it. Expand
the group to select an individual component. Grouping preserves each part's
coordinates and manufacturing properties. Only groups containing components in
the selected model state are created; the single-bulkhead state remains one
solid feature. Existing documents are not reorganized by generating a new one.

## Installation dimensions

| Interface                       | Nominal dimension                           |
| ------------------------------- | ------------------------------------------- |
| Airframe                        | 90 mm OD / 86 mm ID tube                    |
| Bulkhead                        | D90 x5 flange; 20 mm engagement each side   |
| Dispenser                       | D42 x5 flange; D25 body; six holes on PCD33 |
| Existing gas-unit cavity        | D17.5 x30; D10.1 throat; D13 nut access     |
| Dispenser/nut thread            | M24 x2                                      |
| Protective adapter outer thread | M18 x1                                      |
| Cartridge connection            | 3/8-24 UNF, pitch 25.4/24 mm                |
| Nut                             | 38.4 mm across flats; height 20 mm          |

The separating bulkhead has a central dispenser passage and two different tube
seats, each with 20 mm engagement and a 3 mm skirt wall before fitting:

- **O-ring / parachute side:** D85.60 by default. Only this seat uses the editable
  `O-ring release spigot diametral clearance` (default 0.40 mm relative to ID86).
  Keep the release clearance and seal groove during final fitting.
- **Electronics side:** nominal D86, with no release clearance subtracted.
- **Other fixed bulkhead skirts, the direct-motor collar and the nose cuff:**
  nominal D86, also independent of the release-clearance setting.

The D86 fixed seats are intended for final fitting to the actual tube: finish-turn
slightly as required after checking the bore at several angles and depths. They
are not a specified interference fit and do not guarantee zero play in an
oversized tube. Flanges remain D90; radial screw positions stay at their existing
datums. Final fitting reduces the nominal wall thickness by the removed stock.

A 0.5 mm flange gasket offsets the dispenser axially;
six flange screws attach it to the bulkhead. The actuator nut provides access to
the gas unit and does not clamp the bulkhead.

The user has an existing metal gas unit whose model is unavailable. Its mounting
cavity is retained; no invented valve, puncture pin or actuator is displayed.
Printed bodies surround that unit. They have no established pressure rating and
must not replace its metal pressure-containing parts or seals.

## Materials and plastic manufacturing

| Components                                | Material and process                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Bulkheads and turned metal spacers        | Al6061-T6 round stock; turn, drill and tap                                                          |
| Structural battery plates                 | Al6061-T6 plate/round stock, or S235JR steel sheet with drilled/tapped, deburred laser-cut holes    |
| Interchangeable controller disks          | POM-C solid stock, D62 x6; turn, drill and through-tap where specified                              |
| Finder tray and its posts                 | POM-C solid stock; flat round plate with drilled wire/tie holes, turned posts with machined M3 ends |
| Shaped battery seats and contact carriers | Unfilled PA12, preferably SLS; shoulders remain backed by metal                                     |
| Gas-unit body, nut and protective adapter | Unfilled PA12 holders around the existing metal gas path; printed fit allowances apply              |
| Series lamellas                           | Ni200 nickel; form and spot-weld, size for measured current                                         |
| Dampers / gaskets                         | Silicone elastomer / EPDM in the modeled geometry; verify compound and service conditions           |
| Cable ties / shear screws                 | Purchased PA66 hardware; do not substitute printed screws                                           |

PA12 is a starting material selection, not an impact or pressure qualification.
For battery seats, print a fit coupon before the complete set; the 0.30 mm
nominal diametral pilot clearance must suit the process. Keep shoulders, thin
contact floors, screw lands and thread roots solid. For FDM PA12, dry the filament,
use its supplier profile and check layer orientation against the actual load.
No conductive/ESD-filled polymer is permitted for contact insulation. PETG may
be used for non-load-bearing fit mockups; it is not a qualified replacement for
the battery retainers. Deburr wire exits and verify insulation after assembly.
The metal gas unit carries cartridge pressure; printed holders are not pressure
vessels. Silicone dampers are separate from rigid POM-C plates.

Material references: [Formlabs unfilled PA12](https://formlabs.com/products/nylon-12-powder-10/)
and [Prusa PETG guide](https://help.prusa3d.com/article/petg_2059). Material choice
and manufacturing allowances above are design recommendations for this assembly;
actual strength depends on stock grade, print quality and service conditions.

## Manufacturing routes

The separating bulkhead is one axisymmetric turned blank. Turn the outside
flange, two skirts, their inner bores, central opening and annular seal groove.
Then drill and tap the axial and radial holes using an indexing/drilling fixture.
There are no integral milled lugs, rectangular pockets or milled flats.

In the default F405 / 2S variant, the cells seat directly against the bulkhead through a one-piece PA12 cradle,
with their centres at X +/-29 mm and their near ends 2.25 mm below its face.
There is no intermediate foundation plate. The nut's outside hex is clocked
30 degrees to present its flats toward the cells; the gas-unit cavity
and six nut interfaces remain in place. The harness anchor is at Y29 and the
avionics radial screws are at 45+90n degrees to clear both cells.

The electronics use two round D83 plates. Choose aluminium for turning and
drilling, or steel sheet for laser cutting and deburring. All apertures are round.
Four columns each use a bulkhead-side female/female spacer and an outer male/female M4 spacer to transfer clamp load between plates;
the four outer M4 screws close the stack. The cell seats bear on metal at both
ends. Controller-board mounts do not carry the battery clamping load. With the
default P28A cells and 3 mm plates, bulkhead-to-clamp depth is 72.45 mm,
35.75 mm shorter than the former separate-foundation stack.

The battery interfaces follow the captured-seat arrangement in the library's
MG996R / 2x18650 2S recovery layout. Two D12.7 x1.45 locating pilots on the near
cradle enter D13 x1.5 flat-bottom blind sockets at X +/-29 in the bulkhead.
Its shoulders bear on the electronics face; 3.5 mm of the metal web remains
above each socket. These are secondary counterboring operations, with no
through-hole into the gas chamber.

The compression disk has two D13 through-bores. Each outer PA12 seat has a
D23 shoulder bearing on the continuous metal ring and a D12.7 pilot passing
through the disk. Its guard also fits through D13, so the part inserts from the
cell side without a second flange trapping it. The pilots resist sideways
movement; the shoulders transfer axial load to metal rather than contact tabs.
The 0.30 mm nominal diametral pilot clearance is a starting print fit to verify.

With the lower equipment bay installed, the main-body load path uses a central purchased Osculati 39.306.08 M8 eye nut with a smooth
D6.3 ring section, an 8 mm turned bulkhead web and a steel D84 x4 backing plate. Four D6
steel rods, with M6x1 threaded ends, connect this plate to a second 8 mm bulkhead
behind the computer/camera bay. Both bulkheads have integral 30 mm skirts and
two rows of six radial M4 fasteners. The payload equipment lies between the rods;
its circuit boards and battery fixtures do not transmit the parachute load.
These details are provisional geometry, not a verified shock-load capacity.
The tube is user-specified duralumin; its exact alloy and temper remain unknown.

The separate M6 nose eye carries the nose branch only. Connect the body and nose
branches independently at the parachute harness junction, rather than passing
the complete vehicle load through the nose eye. Use rated harness material and
sleeved soft eyes on rounded hardware. No bare line bears on a drilled plate edge.
The compact body eye nut has an outside eye diameter of 32.6 mm, a 20 mm
aperture, a 16 mm foot and an overall height of 33.3 mm. The catalogue's M=17 mm
is the eye-centre height, not a thread-depth specification. Its foot blend and
thread are represented by a simplified envelope. The two former anchor holes,
saddle and four nuts are replaced by a central D8.5 through-hole and one
ISO 4762 M8x20 A4-80 screw with an ISO 7089 M8 washer (D16/8.4 x1.6).
The screw enters from behind the steel backing plate. The 8+4+1.6 mm stack
leaves 6.4 mm nominal insertion in the eye nut (5.78 mm excluding the bolt-tip
chamfer, before the nut entry chamfer) and 0.6 mm to the bottom of the D20
aperture. Check the purchased nut's usable thread and required engagement
before assembly; the catalogue does not specify them. Do not substitute M8x25:
it would project into the rope aperture with this stack.

Seat the eye foot on the bulkhead's metal land; orient the eye and tighten the
screw from behind. Use medium-strength anaerobic threadlocker suitable for
stainless steel, following its preparation/cure instructions, and a witness
mark. Do not loosen the eye to align it. Fit a D12/8.2 x0.6 EPDM gasket into the
D12 x0.5 recess (modeled compressed to 0.5 mm), seal the four plate-fixing holes,
and leak-test the assembly. The sleeved body soft eye wraps the rounded crown,
with a central path to the parachute. Neither catalogue mass nor this geometry
is an opening-shock rating.

## Fasteners and assembly

| Joint               | Hardware / interface                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Electronics tube    | 4 x DIN 7991 M3x6 stainless steel                                                                                                         |
| Parachute tube      | 2–4 x DIN 965 M2.5x8 PA66 nylon, 90-degree countersunk, pitch0.45                                                                         |
| Dispenser flange    | 6 x DIN 7991 M3x8 stainless steel, PCD33                                                                                                  |
| Electronics spacers | M4x0.7; turn/drill/tap to exported dimensions                                                                                             |
| Module to bulkhead  | 4 x ISO 4762 M4x16 A2-70, 3 mm hex drive; 4 x ISO 7089 M4 A2 washers D9/4.3 x0.8                                                          |
| Outer battery clamp | 4 x ISO 4762 M4x8 stainless steel                                                                                                         |
| Body connections    | 24 x DIN 7991 M4x8 across two bulkheads, or both skirts of the compact bulkhead; verify strength class                                    |
| Harness anchors     | Body: Osculati 39.306.08 M8 eye nut + ISO 4762 M8x20 A4-80 + ISO 7089 M8 washer + steel backing plate; nose: M6 shoulder eye + D18 washer |
| F405 WING-MINI      | Library M2 stack and silicone dampers; M2x4 / x5 / x6 for 2S metal plates, M2x8 for the 4S POM-C disk                                     |
| Common 4S carrier   | 4 x ISO 4762 M2.5x25, D5/2.7 x0.5 washers and D6/D2.8 x10 metal spacers                                                                   |
| LCH7 on POM-C disk  | 4 x ISO 4762 M2.5x20 into M2.5x0.45 through-tapped holes; silicone grommets and metal compression limiters                                |

Form the nickel tabs and solder leads before spot-welding the tabs to the cells.
Place the cells in opposed polarity, with cell 1 positive and cell 2 negative
toward the bulkhead. Lay the tabs into the open insulating
slots of the one-piece insulating cradle. Its supported B1 bridge and two end tabs
form one continuous nickel strip. The outer formed tabs sit in open slots in the
PA12 seats and end in 5.2 x4 mm pads on the outside of the compression disk.
Each pad has a 0.8 mm insulating backing and is recessed 1.2 mm inside its guard.
Raised minus/plus marks identify B- and B+; the guard's inward notch provides an
open wire exit below the metal face.

Slide the compression disk over the two pilots from the outside, then fit the
four end screws. The formed tabs need not be pushed through a closed plastic
hole. The metal disk surrounds insulation, never a bare nickel strip. B1 remains
the accessible series midpoint for a compatible 2S balance connection. Provide
strain relief for the leads before the assembly enters its tube; tabs must not
carry cable loads. Charging, protection electronics and actuator wiring are not
modeled. Geometry checks do not establish printed-seat impact capacity.

The printed flange has M3 screw-clearance holes and countersinks.
The metal bulkhead has six M3x0.5 THROUGH threads on PCD33 for the dispenser
and four **D4.5 THROUGH clearance holes**, without threads, at R34 / 45+90n
degrees for the electronics module. Drill these after turning. Deburr the
clearance holes without removing the flat washer seats.

Four ISO 4762 M4x16 screws enter from the gas/parachute face through ISO 7089
M4 D9/4.3 x0.8 washers and the 5 mm web. They engage female M4x0.7 ends in
the first four D8 columns. Penetration is 10.20 mm; the heads project 4.80 mm
beyond the gas face. The columns have no studs entering the bulkhead.
The internal stack remains connected by the outer male/female tiers and the
four existing M4x8 end screws.

For service, unload and depressurize the gas system, expose the gas face,
remove the surrounding electronics tube, disconnect crossing wires, and support
the module. Undo the four gas-side screws with a straight 3 mm hex key, recover
the washers, and withdraw the electronics toward the nose. Do not dismantle the
controller, battery plates or column tiers. The 4S pack remains clamped between
its own foundation and outer disk. In 2S, the near cradle bears directly on the
bulkhead: support the cradle and cells during withdrawal, since releasing these
screws also releases their near-end preload. Do not carry that loose cradle by
the nickel tabs.

The module screws and washers are in their own FreeCAD visibility group:
`Electronics / Removable module mounting screws`.

Seal the M3 dispenser threads with a compatible removable pneumatic thread
sealant. For the four M4 clearance holes, apply compatible removable gas-rated
gasket compound to **both head/washer and washer/web faces**. A steel washer
alone is not a gas seal, and compound is not credited as fastener retention.
Renew the seals and leak-test the pressure boundary after each service.
The dispenser nut retains its six M3 interfaces and its existing gas-unit cavity.

Fastener dimensions: [ISO 4762 M4x16 supplier specification](https://www.accu.co.uk/metric-cap-head-screws/3996-SSCF-M4-16-A4)
(head/drive dimensions; this supplier example is A4) and
[ISO 7089 M4 stainless washer drawing](https://belmetric.com/content/A-PDF_Drawings/WFHV-ISO7089-4-SS.pdf).

## Machining access and thread ends

Manufactured metal threads must have tool access and a defined end condition.
Complete thread depth, screw penetration, incomplete lead, cylindrical drilling
depth and drill-tip depth are separate dimensions. Do not credit an entry
chamfer, runout or drill cone as load-bearing thread engagement.

The eight D8 M4 spacer tiers now include real blind-hole drilling volumes:

- At the plate-facing mouths, screw/stud penetration is `8 - plate thickness` mm.
- The four bulkhead-facing female ends have 10.20 mm screw penetration, 10.90 mm
  full-profile depth, 14.40 mm cylindrical drilling and 15.39 mm total drill-tip
  depth. At least 2 mm solid web remains between the opposed drill tips.
- Complete-profile depth extends one pitch beyond the mating tip.
- An additional 3P tapered incomplete-thread region admits a short-lead cutting tap.
- A further 2P cylindrical chip reserve precedes a 118-degree drill point.
- For 3 mm plates: penetration 5.00 mm; full-profile depth 5.70 mm; tap lead
  2.10 mm; chip reserve 1.40 mm; D3.3 cylindrical drill depth 9.20 mm and total
  drill-tip depth 10.19 mm. The 0.45 mm entry chamfer is excluded from engagement.
- Both M3 finder-post holes use the same separation of depths with D2.5 drilling;
  at least 2 mm solid web remains between their drill tips. Print with stock for
  finishing if these holes will be tapped. Printed-fit compensation is separate.

Only the four outer-tier M4 male spacer ends have D3.10 x1.40 mm relief necks beside their shoulders and
0.35 x45-degree tip chamfers. A finishing die must have a lead that fits within
the 2P neck; otherwise change the tool/process or revise the relief. These are
prototype allowances, not a claimed DIN 76 groove. Blend the groove corners and
specify their radius before machining. The four bulkhead-side columns instead
have female threads at both ends; no external stud or relief neck enters the
bulkhead. Credit actual full-profile engagement after mouth chamfers and the
purchased screw's tip lead, and verify thread stripping and column strength.

The bulkhead M3 and LCH7 plate M2.5 holes stay through-tapped, with 90-degree
entry/exit deburring. Pass the tap far enough out of the exit face to complete
the last turn. Chamfers reduce usable engagement, particularly in a 2 mm plate.
Use accessible clearance holes in adjacent parts for assembly; do not count a
modeled radial clearance as an ISO fit or substitute it for thread gauges.
Compact backing bolts use the M6x1 pitch and ISO 4762 D10 head / 5 mm hex envelope.

The 3P lead and 2P chip reserve are explicit starting process choices. They do
not apply to every tap, material or chip-control method. See
[Guehring's core-hole and chamfer guidance](https://guehring.com/de-en/products/threading-tools/)
and an [OSG M4x0.7 cutting tap with 2.5P lead](https://osgtool.com/1652001708/).
Check the actual tool drawing, reach and holder clearance before manufacture.
`BlindThread`, `MaleThread`, `Engagement` and `ResidualWeb` export properties
retain these distinctions with each affected solid.

## Printed thread fits

The female radial allowance and male radial relief are independent controls.
Defaults are +0.15 mm on female radii and -0.10 mm on printed male radii:
0.25 mm combined radial clearance on printed/printed pairs. Nominal pitch and
60-degree thread form remain unchanged. The printed adapter receives the female allowance at the steel cartridge interface; the cartridge uses its nominal UNF envelope with no print allowance.

These are initial fit values, not printer-independent tolerances. Print the parts
with thread axes vertical; remove brim/elephant-foot interference and test the
actual printed mating pieces before installation. Excessive relief weakens the
fine M18x1 interface; validation caps the combined adjustment at 0.35 mm.
The protective adapter includes a lead-in at its cartridge entrance.

## Electronics and recovery states

The two cells reuse the fixed Molicel library models. The controller reuses the
existing three-board F405 WING-MINI geometry, rotated 90 degrees to clear the
cells. Its mounting pitches remain editable fit references. Four elastomer
mounts isolate it from the carrier. PLS contacts face the open space above the
carrier, with the outer retention plate beyond their connection envelope.

`Cutaway assembly`, `Closed assembly`, `Without tubes or fabric`,
`Separated / extraction`, `Turned bulkhead`, `Electronics retention stack` and
`Nose tracker, buzzer and switch` and `Printed parts / fit inspection` are inspection states. The extraction state
does not simulate gas flow, shear fracture, cloth inflation or tether dynamics.
The avionics static port is separated from the parachute pressure chamber.

## Main-body parachutes and nose electronics

The public preview and FreeCAD export use nose +Z. Construction coordinates in
drilling metadata use the bulkhead datum and are rotated 180 degrees about X
at assembly placement. The default packed drogue/main envelope is D80 x300 mm.
It is stored in the main D86 bore, behind the CO2 cartridge and ahead of the
sealed recovery bulkhead. Nominal radial clearance is 3 mm, before fabric bulges,
seams and tube tolerances. The separating spigot leaves with the nose before the
bag reaches it; the pack is not expected to pass through its smaller bore.

The nose-facing mouth of the parachute tube has a continuous internal R1 mm
round, tangent to the D86 bore and the end face. The mouth opens to D88 at the
face and returns to D86 after 1 mm axially, leaving a nominal 1 mm flat end land
on the D90 tube. This is a turned circular radius, not a straight chamfer or an
added insert. In construction coordinates the radius spans Z5 to Z6; the public
nose-up export places it at the parachute extraction end. It is present in both
the preview and native FreeCAD geometry, including the cutaway and separated
states. The O-ring sealing band and the shear holes remain on the unchanged bore.
Deburr and polish the entire contact surface and the tangent transitions; leave
no burrs or sharp tool marks that could catch fabric or sleeved lines. Check the
finished mouth using the actual parachute fabric and harness.

Default parachute chamber length is 465 mm. The D80 x300 pack starts 10 mm
behind the cartridge tip, leaving 55.5 mm behind the pack for the compact body eye nut
and stowed harness. Both clearances are checked when changing the geometry.
The 180 mm adjustable equipment bay
follows the sealed load bulkhead; its D54 reserved volume leaves clearance to the
four ties. Actual computers, cameras and mounts are not supplied. The plane
behind the rear bulkhead is a motor-side interface, not a designed thrust mount.
The nominal harness route is an endpoint reference; actual drogue/main deployment,
reefing, inflation, line lengths and opening speed remain unspecified.

The selected hardware uses the user-supplied envelopes: ZX908 bare PCB
35 x20 x4.5 mm, JHE20B 20 x10 x8 mm (2.7 g), and PWM Switch 17 x13 x10 mm.
These replace the earlier generic supplier envelopes. Leads and connectors
outside these body dimensions are not included; verify the actual revision.

All three modules share a D64 x2 POM-C turned and drilled tray (D81 in either 4S variant): the tracker is in the middle,
with the buzzer and switch on opposite sides. Each body sits on double-sided
foam tape, retained by two PA66 2.5 x150 mm cable ties through the tray. Twelve
D3.4 drilled through-holes accept the bands; locking heads sit on the rear face
and the tails are trimmed. Nominal band thickness is 1 mm; the lock-head model
is only a fit envelope. Select and verify the actual ties before drilling the ports.

The adjustable heat-shrink wall allowance defaults to 0.3 mm (0 disables the
sleeve reference), and tape thickness defaults to 0.5 mm. The flat tray leaves
all module ends open for preattached wires; tape and ties prevent sliding. Nearby round ports pass the leads toward the controller.
The three tape footprints are inset 1 mm from the body edges. Tape supports and
locates the modules; the ties provide mechanical retention. There are no module
clamp fingers or M2 screws. The four structural M3 tray/post connections remain.

Deburr the drilled holes, protect the PCB and tighten only until the wrapped module is
seated. Check strap locations on the actual module: do not load the ceramic
antenna, switches or unsupported electronic components. Keep sound outlets,
buttons, SIM/USB and wire exits accessible; cut local openings in the actual
heat-shrink as needed. Installation uses open ties; servicing requires cutting
and replacing them. These envelopes do not establish impact capacity.

The enclosing nose fairing is unfilled dielectric polymer; the antenna face
remains uncovered. Keep the buzzer sound outlet, LED and reset button and the
tracker SIM/USB interfaces accessible with the fairing removed. The PWM module
is an installation envelope only: no switched load, pinout, voltage limit or
continuous-current rating is inferred from the product image's 30 A marking.

As requested, ZX908 power is taken from B- and B1, across one cell. This is a 1S
tap, not the 8.4 V fully charged 2S output. Its consumption creates cell imbalance;
verify the tracker input limits, protect and strain-relieve its branch, monitor
both cell voltages and use compatible balance charging. JHE20B connects to the
flight controller's buzzer interface per its own instructions. Pinouts, protection
circuitry and exact leads are not invented in this mechanical envelope.

Metal countersunk screws use DIN 7991 envelopes: M3 has a D6 x 1.7 head with
a 2 mm hex socket; M4 has a D8 x 2.3 head with a 2.5 mm hex socket. Do not
substitute the larger ISO 10642 head without checking the countersink. Cap screws
use ISO 4762 / DIN 912, with the fully threaded supplier variant. Purchased screws
are marked BUY in the model and export metadata; custom turned parts retain MAKE.

The shear fastener procurement reference is Nyfast `MS-M025-0045-CSKP008`, PA66
DIN 965 M2.5x8, head D4.7, nominal height1.5, cross drive. The 8 mm overall length
includes the countersunk head. The tube has D2.8 clearance and a 90-degree seat;
the spigot receives M2.5x0.45. There is no external washer under the flush head.
A removable compatible head-seat sealant must be tested without changing the
measured release behavior. Supplier dimensions and molding tolerances must be
checked on the actual lot.

## Calculation scope

The release screen uses gauge pressure on the D86 piston area:

`F = pinCount * measuredPinForce + sealDrag + separatingMass * g * axialGravity`

`pressure = F / area`

Break force starts as an explicitly editable assumption. The installed nylon
screw thread crosses the shear plane; nominal screw diameter alone cannot
establish its release force. Measure the actual screw lot and assembled joint.

Recovery load screening is separate from the nose-release calculation:

`effectiveRecoveredMass = recoveredMass - (directMotor ? omittedPayloadMass : 0)`

`peakHarnessLoad = effectiveRecoveredMass * 9.80665 * openingLoadFactor`

`designHarnessLoad = peakHarnessLoad * structuralFactor`

`tieAxialStress = designHarnessLoad / (4 * 20.1 mm2)`

The default total recovered mass is 10 kg, editable over the stated 8–10 kg range.
This input includes the optional lower equipment bay. Direct-motor layouts
subtract an independently editable 0.5 kg by default, giving 9.5 kg rather than
subtracting mass a second time from an already reduced input. This is the user's
mass estimate, not a computed bill-of-materials mass. The nose electronics and
separating-nose mass remain present in both layouts.
The provisional peak tension/weight factor20 and structural factor2 imply
1,961 N peak and 3,923 N design demand, or 48.8 MPa at the nominal M6 tensile area
assuming equal load sharing. These factors include the complete assumed harness
tension; they are not derived from parachute rating or predicted deceleration.
Changing total mass does not silently change the 1 kg separating-nose mass used
for the pressure calculation. The corresponding nose-branch design demand is
392 N, subject to the actual nose mass and branch dynamics.

This axial screen excludes bulkhead bending, eye/bolt bending, thread stripping,
unequal sharing, tube bearing/tear-out, fatigue and fabric dynamics. No allowable
stress or pass/fail strength verdict is inferred without actual alloy/temper,
hardware grades and deployment measurements. The parachute model, canopy loading,
opening speed and descent rate are still needed to establish recovery performance.

The ideal-gas comparison uses the added CO2 mass, free gas volume and temperature.
A 16 g charge can greatly exceed the small mass associated with the shear
threshold if the chamber fails to open. The screen is not a transient pressure
prediction or a pressure-vessel qualification. The existing metal gas unit must
provide the required actuation and discharge behavior. Verify sealing, cold-gas
behavior, repeatable release and harness opening loads on a restrained prototype.

## Export and references

FreeCAD export retains separate labeled components, material, process and part
numbers for manufactured pieces. It contains no TechDraw sheets. Printed parts
retain helical thread solids. Metal and machined-polymer threads use smooth nominal-diameter bores/shafts with `ThreadCallouts`, `ThreadFeaturesJSON` and depth notes on each part. These nominal envelopes are not tap-drill diameters. Fabric and missing-device
interfaces remain explicitly marked references.

- [Leland 82122Z cartridge](https://www.lelandgas.com/product-page/82122z-cartridge-small-20ml-16g-carbon-dioxide-3-8)
- [SpeedyBee F405 WING-MINI manual](https://www.speedybee.com/f405-wing-mini-download/)
- [Molicel P28A](https://www.molicel.com/product/inr-18650-p28a/)

- [NASA recovery systems: harnesses and through-ties](https://www.nasa.gov/wp-content/uploads/2023/09/nasa-sl-2024-arw-recovery-systems-508.pdf)
- [Osculati 39.306.08 M8 eye nut dimensions, catalogue p. 739](https://www.yachtshop.eu/PDF/OSCULATI/ENG_2026/741_OSCULATI_ENG_2026.pdf)
- [JHEMCU JHE20B manufacturer](https://jhemcu.com/e_productshow/?53-JHEMCU-JHE20B-Finder-BB-Ring-100dB-Buzzer-Alarm-with-LED-Light-Support-BF-CF-INAV-Flight-53.html=)
- [ZX908 manual mirror, verify actual PCB revision](https://manuals.plus/wapuno/zx908-4g-gps-car-tracker-manual)
- [Nyfast DIN 965 PA66 countersunk screws](https://nyfast.com/nylon-screws-metric-screws-and-bolts/10748-51315-countersunk-phillips-screw-nylon-metric-din-965)
- [Bossard metric tensile stress areas](https://www.bossard.com/global-en/-/media/bossard-group/website/documents/technical-resources/en/f-004-en.pdf)

## Shared 4S battery assembly

The F405 / 2S default remains available alongside both 4S controller options. Four matched library
18650 cells sit on a 24.6 x24.6 mm square pitch, symmetrically about the tube axis.
A D83 foundation face is 42 mm behind the bulkhead datum, leaving 15 mm
to the dispenser nut's rear face at Z-27. The gap is adjustable. The F405 / 2S carrier
also uses this nut-to-disk clearance; validation keeps at least 5 mm beyond its
header tips. Four pairs of turned M4 spacer tiers carry the
foundation and compression disk. D23 insulating shoulders bear on these disks;
D19.7 pilots locate them in D20 through-bores in both disks. The foundation
pilots protrude 0.8 mm beyond the plate, clear of the gas nut. D23
shoulders bear on continuous metal annuli. Four D10 peripheral relief ports and
a D8 central wiring port reduce plate material. The 4S bulkhead has no battery
sockets. The default 2S mounting arrangement remains unchanged.

The cells alternate polarity around the square. Three nickel lamellas form all
series connections: C1+ to C2- (B1), C2+ to C3- (B2), and C3+ to C4- (B3).
B1/B3 lie in open channels on foundation-backed printed bridges. B2 is one
formed nickel part with integral end tabs; its U-shaped middle section rests
on a separate PA12 carrier against the outside of the clamp. Two M2x8 through
screws and M2 nuts on separate ears hold this carrier without contacting the
nickel. Install the carrier after the seats and clamp so it does not trap the
single-flange inserts. Lay the formed tabs into the open terminal slots.
C1- is B- and C4+ is B+. All five balance nodes are named in the exported model.
Strip width4 and thickness0.2 mm are provisional: determine the required cross
section from measured operating current. Tabs do not retain the cells. Provide
compatible 4S protection, balance charging and strain relief for output leads.

## Interchangeable controller disks for 4S

The battery foundation, compression disk, four cells, all Ni200 lamellas, tube,
finder tray and main spacer columns are identical for F405 and LCH7. Change only
the D62 x6 controller disk and its controller-specific mounting hardware. Both
use four D2.8 mounting bores on the X/Y axes at R21.63747, four Al6061 D6/D2.8 x10
spacers, M2.5x25 ISO 4762 screws and D5/2.7 x0.5 washers. The screws enter the
same through-tapped metal clamp. The controller disk never carries cell loads.

Turn the disk from **POM-C (acetal copolymer) solid stock**, face to 6 mm and drill
all holes using a template or indexing fixture. Five D8 round ports admit wires
and remove material. Break sharp edges. There are no rectangular pockets,
integral posts or features requiring a mill. PTFE is not a direct substitute:
its creep and thread retention need a different joint design.

- **F405 disk:** four D2.2 bores for the library's bonded silicone dampers. M2x8
  socket screws secure their lower ends through the 6 mm disk. The three boards,
  connectors and headers face the nose, away from the cells and terminal tabs.
- **LCH7 disk:** four M2.5x0.45 through-tapped holes at X/Y +/-15.3. The LCH7 is
  aligned with the carrier axes; its rear PCB face is 8.5 mm off the disk.
  ISO 4762 M2.5x20 screws engage the disk from the board side. Silicone D6/D4
  grommets, metal compression limiters and washers support the PCB without nuts
  on it. Drill through before tapping; entry chamfers and screw protrusion are
  included. Confirm tightening torque, thread stripping and creep in POM-C.

The LCH7 PCB is 50 x44 x1.12268 mm, with four D4 holes on 30.6 mm square pitch.
Its component envelope is 50.97594 x44 x7.48268 mm. Both controllers retain their
separate boards, major components and connectors from the library. Verify actual
mounting pitches, damper stiffness and wire bends on purchased hardware.

The common nose tray is D81, on four R36 supports clocked 22.5 degrees. Its face
is 48 mm from the battery clamp and 1 mm beyond the metal tube lip. This keeps
the same nose structure for either controller and leaves room beyond the F405
header tips. Remove the controller carrier to service the cell terminals.

4S is nominally 14.4 V and reaches 16.8 V fully charged. The [SpeedyBee manual
V1.2](https://www.flyingtech.co.uk/wp-content/uploads/2024/03/speedybee_f405_wing_mini_en.pdf)
specifies a 7-26 V input: connect pack power to the **PDB BAT+/GND** input of the
complete F405 stack. Regulated 5 V pins are not pack inputs. A 2S Li-ion pack can
fall below 7 V; use an appropriate cutoff or supply regulator for that variant.
LCH7 input ratings are not specified here; verify its electrical documentation
and regulation before connecting 16.8 V. The ZX908 still uses only B-/B1.

## Shared electronics library entries

LCH7 v3.2 is under Electronics & Vision / Flight Controllers, ZX908 under
Radio Modules, JHE20B under Sensors & Switches, and the PWM electronic switch
under Power & Motor Control / Power Switches. Each has separate assembled and
exploded inspection states. This assembly places those same library models.

ZX908 includes its patch antenna, SIM holder, shield and service components.
JHE20B includes the backup cell, round sounder, connector, LED and reset button.
Their overall envelopes follow the supplied photographs; small details are
illustrative. The switch photograph shows a wrapped module, so its model shows
the shaped sleeve and terminal exits rather than an invented internal circuit.
Optional nose sleeves have front service windows to leave the antenna, sound
outlet and visible components accessible; match openings to physical hardware.

## Direct motor layout

`Behind the parachute bay` selects either the computer/camera bay or a direct
motor interface. Compact 2S and 4S presets expose the latter. They remove the
lower equipment volume, its tube, rear bulkhead and four long M6 ties. Nose
avionics, battery retention and finder modules stay installed.

The remaining recovery bulkhead is 60 mm long: a 26 mm front skirt, an 8 mm web
and an integral 26 mm aft collar. Both fixed seats are D86 with 5 mm walls and
straight D76 bores, accessible for turning from either end. A D74 x4 steel
backing plate fits inside the aft collar. Four ISO 4762 M6x25 through-bolts on
PCD62, ISO 7089 washers and ISO 4032 nuts retain this plate; small recessed seals
leave metal bearing lands. The plate and the D12 washer envelopes have 1 mm
radial clearance inside the collar. The compact central M8 eye nut is secured
by its own M8x20 through-bolt.

Two rows of six DIN 7991 M4x8 screws on each side connect the main body and the
motor-bay interface tube. Row centres lie 8 and 18 mm from each web face. Front
rows start at 30 and 0 degrees, respectively; rear rows at 30 and 0 degrees.
Each row repeats every 60 degrees, staggering adjacent rows by 30 degrees.
The outer rows retain 8 mm nominal centre-to-edge distance. Drill matching
tube holes in the assembled, indexed orientation; the shorter seats do not
reuse the old aligned hole pattern.

The motor-side datum is 50 mm behind the web's front face, with 28.4 mm axial
clearance beyond the central M8 bolt head. The interface tube extends past the
shorter aft collar to preserve that clearance. No motor dimensions, nozzle, propellant
or thrust mount are inferred. This direct interface is 138 mm shorter than the
180 mm equipment-bay arrangement because the anchor hardware still needs space.
The parachute chamber is separately 35 mm shorter than the previous 500 mm bay.
The new aft collar, plate and tube joint need strength verification against the
selected motor/body loads; the M6 axial screen alone does not verify this joint.
Thickening a skirt does not by itself compensate for reduced engagement length
or establish the thin tube's bearing and tear-out strength.

### Round stock and machining allowance

| Turned part                     | Finished envelope | Allocated round stock | Gross axial reserve |
| ------------------------------- | ----------------- | --------------------- | ------------------- |
| Compact lower recovery bulkhead | D90 x60           | D100 x80              | 20 mm               |
| Upper separating bulkhead       | D90 x45           | D100 x70              | 25 mm               |

Gross reserve includes facing, cut-off and workholding together; it is not a
guaranteed jaw engagement. Before machining, agree the two-setup sequence,
jaws, gripping diameter, clamping force and actual allowances with the lathe
operator. Avoid distorting the finished skirts while reversing the part.
Both bulkhead profiles are axisymmetric; drilling, countersinking and tapping
are separate operations. Finish-turn nominal D86 fixed seats to the measured
tube bore as needed, while preserving the independent D85.6 O-ring release seat.
An unspecified duralumin blank is not automatically verified Al6061-T6: identify
its alloy and temper before using strength assumptions.

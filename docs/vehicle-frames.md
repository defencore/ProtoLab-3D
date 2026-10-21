# Vehicle frames and hulls

Find these modules under **VEHICLE STRUCTURES**. Choose **Browse presets** for a popular-model reference or custom starting point. Authored parts have editable dimensions; imported supplier chassis and source multicopter frames retain their fixed geometry.

| Family        | References                                                                                   | Custom designs                                                           |
| ------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Aircraft      | Flite Test Simple Cub / Versa / Viggen V2 / Bronco, ATOMRC Dolphin, FMS ASW-17               | High/mid/low wing, glider, flying wing, delta, canard, twin boom, tandem |
| Model rockets | Estes Alpha III, Big Bertha                                                                  | Ø40 × 500 mm, Ø66 × 900 mm                                               |
| Boats         | Pro Boat Recoil 2 18/26 in, Joysway DragonForce 65 V8                                        | Six bottom sections; mono/catamaran/trimaran/central-pod hulls           |
| Multicopters  | Pinned upstream source; see the [fabrication guide](../src/parts/multicopter-frame/GUIDE.md) | Native quads, COMET Y6 and SOURCE ONE V4 X8; editable load cases         |
| Ground vehicles | Pololu Romi, DFRobot Pirate 4WD ROB0003, Waveshare UGV Rover PI4B AI Kit                    | Fixed supplier chassis for equipment integration; [mounting guide](../src/parts/rover-chassis/GUIDE.md) |

## Accuracy

Aircraft, boats and rockets include lightweight **approximate references**, not imported manufacturer CAD or interchangeable replacement parts. Each sourced preset declares exactly which dimensions were checked and links to the manufacturer/supplier. All remaining dimensions are design assumptions. Source dimensions checked on 2026-09-16:

- [Flite Test Simple Cub](https://www.flitetest.com/simplecub): wingspan only; fuselage length and contours are assumed.
- [ATOMRC Dolphin](https://atomrc.com/products/atomrc-dolphin-overseas-fpv-rc-plane-fixed-wing): length and wingspan; V-tail and forward-swept wing are simplified.
- Additional aircraft: [FMS ASW-17](https://www.fmshobby.com/products/fms-2500mm-asw-17-ep-glider-pnp) (2500 mm span, 1390 mm overall length), [Flite Test Versa Wing plans](https://s3.amazonaws.com/plans.flitetest.com/stonekap/FT-Versa-plans.pdf) (965 mm span), [Viggen V2 supplement](https://www.flitetest.com/articles/ft-viggen-v2-build-supplemental) (25.25 in span, 39 in overall length), and [Bronco](https://www.flitetest.com/articles/ft-bronco-build) (1086 mm span). Contours and other dimensions are approximate.
- [Estes Alpha III](https://estesrockets.com/products/alpha-iii) and [Big Bertha](https://estesrockets.com/products/big-bertha): overall length and rounded body diameter; tube wall, nose and fin geometry are assumed.
- [Pro Boat Recoil 2 18 in manual](https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/Manuals/PRB08053_Recoil_2_Brushless_RTR_Manual_EN.pdf) and [26 in manual](https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/dwbc2beabf/Manuals/PRB08041_Recoil_26_V2_BL_RTR_Manual%20Update_MULTI.pdf): length and beam. Published total height is not equated to modeled bare-hull depth.
- [Joysway DF65 V8](https://www.joysway-hobby.com/products/df65v7-rc-racing-class-sailboat): hull length and beam; keel, rig and rudder are excluded.

## Construction

Aircraft support seven body configurations, three wing positions and separate neutral control surfaces. Conventional, T and V-tail arrangements are available; flying wings have a centre equipment bay and twin-boom aircraft have a short pod. See the [aircraft guide](../src/parts/aircraft-airframe/GUIDE.md) for all 15 presets, control principles and source dimensions. Boats include 17 presets and six bottom sections, with configurable bow/transom setbacks, rocker, sheer, beam station and stern breadth. Catamarans support mirrored asymmetry and straight/curved crossbeams; trimarans have adjustable outriggers, and pod catamarans have a short centre hull. Boat shells have a section inset, not constant normal wall thickness. See the [boat guide](../src/parts/boat-hull/GUIDE.md) for all controls and limitations. Model rockets include tube, hollow nose and fins only. Multicopters retain six pinned open frame projects, with source hardware scope stated per frame. See the source-frame guide for the load calculation, drawing discrepancies and unresolved physical qualification.

All components are named independent FreeCAD solids, using the same dimensions in preview and export. Body-only isolates the primary shell(s) or lower frame plate. Exploded views separate major components. The model-rocket module contains no propulsion or deployment system. Flight, structural and hydrodynamic performance are outside these geometric models.

## Verification

The six added families now provide five authored fabrication families (22 presets) and three fixed supplier chassis configurations:

| Family                                                                                | Starting configurations                                                  | Fabrication and interfaces                                                                                                 |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| [Robot chassis](../src/parts/rover-chassis/GUIDE.md)                                  | Pololu Romi, DFRobot Pirate 4WD ROB0003, Waveshare UGV Rover PI4B AI Kit | Original supplier CAD, actual factory mounting surfaces and source-measured bores; fixed source revision and kit scope     |
| [Wing rib](../src/parts/wing-rib/GUIDE.md)                                            | Four NACA section/chord examples                                         | Sheet stock, enclosed main/rear spar slots, optional lightening holes, validated remaining webs and DXF                    |
| [Fuselage former](../src/parts/fuselage-bulkhead/GUIDE.md)                            | Four round, elliptical or box formers                                    | Sheet stock, service opening, locating notches, optional mounting bores and DXF                                            |
| [Boat hull frame kit](../src/parts/boat-hull-frame/GUIDE.md)                          | Four 650–1200 mm skeletons                                               | Plywood keel and transverse frames with matching half-laps, lightening webs, flat DXF layout and station CSV               |
| [Two-piece tube arm clamp](../src/parts/tube-arm-clamp/GUIDE.md)                      | Five examples for 10, 12, 16, 20 and 25 mm OD tubes                      | Two independent clamp halves, four catalog screws, eight washers and four nuts; adjustable fit, split gap and bolt pitches |
| [Vehicle payload and electronics plate](../src/parts/vehicle-mounting-plate/GUIDE.md) | Five electronics, battery and payload plates                             | Sheet outlines, mounting grids, exact strap slots, standard 20/30.5 mm or custom patterns and DXF                          |

The five authored fabrication families are independent of the approximate commercial airframe and boat references above. Inspection layouts reuse the same local component geometry as assembly poses. They define practical parts and interfaces; complete vehicle loads, material/process selection, purchased equipment fit and operational qualification remain build requirements. A boat skeleton needs designed skin and longitudinal reinforcement. The chassis family uses fixed original supplier CAD instead of authored generic decks. Source CAD can omit retail-kit parts or include optional accessories; each chassis states its exact scope and revision.

```sh
node --import tsx --test tests/vehicle-frames.test.ts
node --import tsx --test tests/airframe-structure.test.ts tests/rover-chassis.test.ts tests/vehicle-interfaces.test.ts tests/boat-hull-frame.test.ts
node --import tsx scripts/verify-vehicle-frames.ts
node --import tsx scripts/verify-vehicle-structures.ts
node --import tsx scripts/verify-rover-chassis.ts
# Run with a Python runtime that can import FreeCAD and Part:
python scripts/verify-electronics.py /tmp/protolab-vehicle-cases.json test-results/vehicle-frames-validation.json
python scripts/verify-electronics.py /tmp/protolab-vehicle-structures-cases.json test-results/vehicle-structures-validation.json
python scripts/verify-rover-chassis.py /tmp/protolab-rover-chassis-cases.json test-results/rover-chassis-validation.json
```

The five authored fabrication families pass 53 native configurations covering 314 component occurrences, with independent movement, no positive-volume component collisions and STEP/FCStd round trips. Maximum preview/native envelope difference is below 0.001 mm and relative volume difference below 0.075%. See the stored audit report (local output: `test-results/vehicle-structures-validation.json`). These checks cover geometry and export; material strength and assembled vehicle behaviour require physical qualification.

The fixed supplier chassis have a separate 12-view native audit (local output: `test-results/rover-chassis-validation.json`), covering 619 component occurrences. All Romi and Pirate views and the UGV structural frame pass the strict STEP/FCStd checks. The complete UGV assembly independently passes native FreeCAD save/reopen with 207 components and 1,302 valid solids. Its detailed assembly/separation STEP files fail re-import validation with the tested FreeCAD 1.1.4 / OCC 7.8.1 defaults, and drive-only STEP fails the strict volume-agreement check. These three failures remain visible in the report. Use the checked frame-only STEP for accessory integration and native FreeCAD for the full UGV equipment layout; see the [chassis guide](../src/parts/rover-chassis/GUIDE.md).

The original native vehicle audit covered 198 cases before the workshop-frame revision. The dedicated multicopter validator now covers all revised presets, additional construction variants and fabrication states: closed positive solids, independent components, reported source tab interferences, preview/CAD bounds and volume agreement, and STEP/FCStd round trips. Mesh tests also check closed, outward-oriented triangle boundaries. Passing these checks establishes geometric consistency, not physical fit with a purchased product.

## Multicopter source frame

The generic 21-frame generator has been removed after structural review. The current module contains six pinned source designs: SOURCE ONE V5, SOURCE TWO V0.1, SOURCE V V1 upgraded arms, SOURCE PODRACER V1 (5 inch), COMET Y6 hexacopter and SOURCE ONE V4 X8 octocopter, with 152 physical source occurrences. SOURCE ONE screw datums and the 2.5 mm lower-plate cutting label are aligned. Carbon frames have CAD-matched sheet layouts; COMET has 17 original printed occurrences in source print poses. Every frame states its hardware scope. Dimensions are not freely stretched and SOURCE carbon arms are not replaced with printed copies. COMET is an independent PC/CF design with its own source build process. Preliminary arm-load calculations and unresolved whole-frame/joint qualification are documented in the [frame guide](../src/parts/multicopter-frame/GUIDE.md).

# Rover chassis

Choose an identified supplier chassis using **Chassis model**. Each selection retains the manufacturer's fixed dimensions, mounting features and individual CAD components. Use it to arrange equipment around an identifiable purchased platform and to design matching accessories.

| Model                                             | Published size                                                           | Equipment layout                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Pololu Romi                                       | 163 × 149 × 70 mm assembled; nominal 165 mm base diameter                | General-purpose holes and slots on the circular base; integrated six-AA battery holder; optional expansion plates.                    |
| DFRobot Pirate 4WD ROB0003                        | Current product listing: 200 × 170 × 105 mm; check source revision below | Lower motor and battery compartment plus a separate upper electronics level; rectangular opening for a servo.                         |
| Waveshare UGV Rover, PI4B AI Kit without pan-tilt | 230.42 × 252.40 × 122.55 mm                                              | Aluminium body with a removable cover, internal battery and electronics space, and mounting features for equipment above the chassis. |

These published dimensions identify the product class. The imported CAD defines the actual shape and hole locations; its measured envelope can differ from rounded product specifications.

## Pololu Romi

The mechanical kit includes the base, two 120:1 mini plastic gearmotors, motor clips, two 70 × 8 mm wheels, one rear ball caster and battery contacts. Supply six AA batteries, motor-control electronics and the fasteners for your added equipment separately. Encoders, the Romi control board and expansion plates are optional accessories. The supplier STEP retains the base, cover, two wheels and a front caster. It does not identify all internal kit parts separately; some source shapes can combine physical internals. Do not treat the five source shapes as a retail parts list. The **front ball caster** shown in CAD is sold separately from the chassis kit.

The base offers holes and slots for M2, M3, #2-56 and #4-40 hardware. Place boards on suitable standoffs and retain access to the battery holder. For another equipment level, the supplier's half-circle expansion plates can form either a partial or full upper platform; they are separate accessories.

[Product and kit contents](https://www.pololu.com/product/3500) · [Published dimensions](https://www.pololu.com/product/3500/specs) · [Supplier STEP](https://www.pololu.com/file/0J1298/romi-chassis-kit.step) · [Mounting DXF](https://www.pololu.com/file/0J1199/romi-chassis.dxf) · [Full-size top drawing](https://www.pololu.com/file/0J1205/romi-scale-top-down.pdf)

## DFRobot Pirate 4WD

ROB0003 is a four-wheel platform with four geared motors, wheels, an aluminium chassis and mounting hardware. The original STEP omits the four geared motors and battery holder; it retains the factory structure, wheels, tyres and power connection parts. No unverified motor geometry is substituted. Its second level provides a mounting surface for the controller and sensors while leaving the lower compartment for the drive equipment and battery arrangement. The rectangular top opening accommodates a servo installation. The linked assembly manual lists a battery holder, four M3 × 50 mm upper-deck standoffs and M3 × 6 mm screws; five AA cells, the controller and motor driver are supplied separately.

Check the revision before ordering matching accessories: the current product page gives 200 × 170 × 105 mm, while its linked manual shows a 230 × 180 mm footprint, 104 mm deck height and 137 mm overall height with sensor brackets. The library uses the supplied ROB0003 STEP geometry, not a resized interpretation of either specification.

Use the supplied CAD holes when designing a carrier plate. Check that board standoffs, battery restraints and cable routing leave room for the motors and permit access to the lower compartment. The supplier identifies the STEP as ROB0003; it does not establish interchangeability with similarly shaped generic four-wheel kits.

[Product and contents](https://www.dfrobot.com/product-97.html) · [Supplier wiki](https://wiki.dfrobot.com/rob0003/) · [Official-linked STEP](https://raw.githubusercontent.com/CainZ/ROB003/master/ROB0003.STEP) · [Assembly manual](https://github.com/Arduinolibrary/DFRobot_Pirate_4WD_Mobile_Platform/raw/master/ROB0003%20Instruction%20Mannual%20V3.1.pdf)

## Waveshare UGV Rover

This selection follows the supplier's **PI4B AI Kit without pan-tilt** STEP. It has six wheels, four driven geared motors, an aluminium body and the source kit's electronics layout. The 3S battery system uses three 18650 cells, which the supplier sells separately from the kit. Host-board inclusion depends on the purchased variant: an **Acce** version requires a separately supplied Raspberry Pi.

Plan payload mounting around the actual cover holes and the occupied electronics space. Allow clearance for the camera, connectors, cooling, wheel movement and cover removal. A custom upper carrier needs its own mounting hardware and checked clearances. The current product range also offers Raspberry Pi 5 and other kit combinations; this PI4B source model does not substitute their board or connector geometry. It is distinct from the bare UGV02 chassis with extrusion rails.

[Product variants and contents](https://www.waveshare.com/product/robotics/ugv-rover.htm) · [Supplier documentation](https://www.waveshare.com/wiki/UGV-Rover) · [PI4B AI Kit STEP archive](https://files.waveshare.com/wiki/UGV-Rover/UGV_Rover_PI4B_AI_Kit.zip)

## Views and project use

- **Supplier assembly** shows the imported components in their working positions.
- **Frame and mounting surfaces** isolates the structural components and upper-deck supports so their mounting features can be inspected.
- **Wheels and drive** isolates the drive components for clearance inspection.
- **Inspection separation** separates occurrences for identification. The separation is a viewing aid, not an assembly instruction.

FreeCAD export retains the supplied component geometry and individual occurrences. Design a new carrier, enclosure or sensor bracket against the chosen chassis, then check the purchased revision before manufacture. Supplier CAD is a dimensional integration reference; it does not supply tooling, material specifications or a payload rating for a modified vehicle. Keep the centre of mass, equipment restraint and service access appropriate to the finished assembly.

**Verified export scope:** Romi and Pirate pass STEP and native FreeCAD save/reopen checks in all four views. All three chassis pass those checks in **Frame and mounting surfaces**, including their original upper-deck supports. The complete UGV assembly also passes native FreeCAD save/reopen with 207 components and 1,302 valid solids. With the tested FreeCAD 1.1.4 / OCC 7.8.1 defaults, its detailed assembled and separated STEP files fail topology/solid verification on re-import; the drive-only STEP remains valid but fails the strict volume-agreement check. Use the frame-only STEP for carrier/bracket integration and native FreeCAD for the complete UGV equipment layout. Full UGV STEP round-trip validation is not claimed.

The **Download** menu also provides measured mounting faces and circular bores as CSV, a source component inventory, and a source/mounting JSON. Coordinates are in millimetres in the unseparated assembly: the origin is the source assembly envelope centre in X/Y and its lowest point in Z. Inspection separation does not move these mounting coordinates. The JSON records the shared rotation and translation from the supplier file. A circular opening can be a blind recess; inspect the native part before choosing a fastener or drilling depth. Slots and partial arcs are retained in CAD but are not presented as circular bores in the CSV.

## Source CAD and manufacture

The CAD files are supplied publicly for mechanical integration. No open manufacturing or redistribution license is asserted. Preserve supplier attribution and check the original terms for your intended use. The library retains the actual source surfaces and fixed revision; it does not turn these purchased kits into workshop fabrication drawings. The UGV source hash identifies the STEP member inside the linked ZIP archive.

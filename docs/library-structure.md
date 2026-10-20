# Library structure

Start with one of six collections. Each opens a smaller set of related product families:

- **Hardware**: structural sections, brackets, enclosures, fasteners and springs.
- **Motion**: bearings, linear guides, transmission, motors, actuators and fluid systems.
- **Electronics**: switches, buttons, batteries, power conversion, controls, boards, sensors, connectors and wiring interfaces.
- **Workshop**: drilling jigs, routing and marking templates, bending fixtures, saw guides, cutting tools, toolsetting and coolant equipment.
- **Machines**: complete cutting and milling machines.
- **Vehicles**: airframes, chassis, hulls and vehicle systems.

The **Function** view groups a collection by category and subgroup, followed by the product family. Model and size variants remain in the family configurator. **Product type**, **Make or buy** and **Manufacturing process** offer alternative views over the same stable product IDs within the selected collection. Navigation grouping does not merge product definitions or establish assembly manufacturability.

Categories and subgroups expand independently: opening another branch keeps existing branches open. Opened branches are remembered for the browser session, and the grouping view is remembered between visits. Switching collections keeps their branches open. When the library reopens, its collection follows the selected product. Selecting a product reveals its location without closing other open branches. Single-item groups appear as direct product buttons, avoiding an extra level with no choice.

Complete machines belong in **Machines**. Reusable motors, screws, guides, sensors, controls, mounts, work surfaces and cooling equipment stay with their function, regardless of which machine uses them. Battery cells, packs and cell holders share one battery group; DIN rail belongs with structural mounting hardware. Grippers belong with actuators, while brakes remain transmission components. Slewing bearings are identified as bearings rather than complete rotary tables.

Search starts across all six collections and shows family locations. While a query is active, choose a collection to narrow the results without clearing the query; each collection shows its matching-family count. **All collections** restores global results. Direct family-name matches precede incidental references in descriptions. Family terminology can locate a collection entry without narrowing its models; a fixed-model chooser matches the individual article, so “guard” selects guarded switches and “USB” excludes unrelated JST headers. Selecting a family opens its configurator; use **Browse presets** for the advanced size browser. A metric-size query seeds the size chooser. **/** focuses search, **Escape** clears it, and **Enter** chooses the first result in the active search scope.

Common Ukrainian words for toggle switches, switches, buttons, protective covers, rotary selectors and rocker switches are accepted in both family and model searches. The original typed query remains visible. Supplier identifiers and unrecognized queries are preserved. Switches are directly under **Electronics → Switches & buttons**, independently of boards and vision equipment.

Product classification is explicit package data; catalog presence and visible component count do not establish a manufacturing or procurement identity. Engineering references remain available for design exploration and cannot enter a production specification until replaced with resolved product definitions. See [product classification and release requirements](product-library.md).

## Product structure

Configured details, supplier products and material inputs are reusable project definitions. Assembly occurrences reference those definitions and own their position, quantity and placement. An authored mechanism exposes its physical composition through library configurations; supplier internals stay inside their purchased unit. Inspection poses do not change assembly placement or the production specification.

Generic prototypes are separate from sourced catalog dimensions. Consult the [engineering coverage audit](engineering-library-coverage.md), each package's guide and [geometry fidelity audit](model-fidelity-audit.md) for evidence and limitations. A fabrication process is a proposed route, not a finished toleranced drawing or production approval.

## Function tree

The current registry contains **249 physical part modules / 245 navigation families**. The tree below follows collection, category and subgroup order. Related physical modules can share a navigation family while retaining separate IDs, configurations and source identities.

### Hardware

#### STRUCTURAL PARTS

- **ALUMINIUM PROFILES**: Modular T-slot extrusion; T-slot aluminium profile.
- **STEEL & GENERAL SECTIONS**: Structural section.
- **BRACKETS & MOUNTS**: Angle bracket; Bent sheet bracket; Configured manufactured detail; Configured recovery supplier unit; Configured supplier component; Configured threaded recovery detail; DIN mounting rail; Fabricated frame and mounting details; Two-piece spindle clamp detail.
- **WORK SURFACES & TRAYS**: Worktable and coolant tray details.
- **BOXES & CASES**: Open enclosure.
- **HANDLES HINGES & FEET**: Machine frame hardware.
- **CABLE MANAGEMENT**: Cable duct and drag chain.
- **WHEELS & ROLLERS**: Conveyor roller; Robot and pneumatic wheel; Tracked running gear; Utility wheel.

#### FASTENERS & THREADS

- **THREAD GEOMETRY**: Thread tool for cut or union.
- **BOLTS & SCREWS**: Bolt or screw; Set screw; Wing screw; Swing eye bolt.
- **NUTS**: Hexagon nut; Thin hexagon nut; High hexagon nut; Flange nut; Nylon-insert locknut; All-metal locknut; Cap nut; Wing nut; Square nut; Coupling nut; T-slot nut.
- **INSERTS & RIVETS**: Blind rivet; Threaded insert and rivet nut.
- **WASHERS**: Flat washer; Square washer; Split spring lock washer; External tooth lock washer; Conical spring washer.
- **SPACERS & STANDOFFS**: Spacers & standoffs.
- **STUDS & RODS**: Threaded rod and stud.
- **PINS & DOWELS**: Slotted spring pin; Solid dowel pin; Split cotter pin.
- **RETAINING RINGS**: E-type retaining ring; Retaining ring.
- **LIFTING EYES**: Lifting eye bolt; Lifting eye nut.

#### SPRINGS

- **HELICAL SPRINGS**: Compression spring; Configured formed wire; Extension spring.
- **TORSION SPRINGS**: Double torsion spring; Torsion spring.
- **SPIRAL SPRINGS**: Flat spiral spring.
- **DISC & LEAF SPRINGS**: Disc, wave and leaf spring.

### Motion

#### BEARINGS & SEALS

- **BALL BEARINGS**: Deep groove ball bearing; Double-row ball bearing; Angular contact ball bearing; Double-row angular contact ball bearing; Self-aligning ball bearing.
- **ROLLER BEARINGS**: Cylindrical roller bearing; Drawn-cup needle roller bearing; Spherical roller bearing; Tapered roller bearing.
- **THRUST BEARINGS**: Cylindrical thrust roller bearing; Spherical thrust roller bearing; Thrust ball bearing.
- **COMBINED BEARINGS**: Combined needle and ball bearing; Combined needle and thrust roller bearing.
- **PLAIN BEARINGS**: Plain sleeve bushing; Spherical plain bearing.
- **ECCENTRICS & FOLLOWERS**: Eccentric ball bearing; Eccentric cam follower; Miniature eccentric bushing.
- **MOUNTED BEARINGS**: Pillow block bearing; Two-bolt flange bearing; Four-bolt flange bearing; Insert bearing.
- **BEARING MOUNTING**: Adapter sleeve with locknut; Bearing locknut and tab washer.
- **SHAFT SEALS**: Radial shaft oil seal.
- **STATIC SEALS**: O-ring and groove tool; Seal and gasket profile.
- **DAMPERS & ISOLATORS**: Gas spring and damper; Vibration isolator.
- **SLEWING BEARINGS**: Slewing ring bearing.

#### LINEAR MOTION

- **PROFILE RAILS**: HIWIN profile guide; Profile linear guide; Profile guide rail; Profile guide carriage.
- **ROUND SHAFT GUIDES**: Round shaft guide.
- **LINEAR BUSHINGS**: Linear ball bushing; Round-flange linear bushing; Square-flange linear bushing.
- **BALL SCREWS**: TBI ball screw and nut; Ball screw linear actuator; Ball screw assembly; Ball screw nut; Machined ballscrew with retained ends; Matched ground ballscrew set; Ground precision drive screw; Ground ballscrew double nut.
- **SHAFT & SCREW SUPPORTS**: Shaft and screw support; Ballscrew bearing support; Precision ballscrew support.
- **LEAD SCREWS & STAGES**: Lead screw and nut; Linear slide module.
- **GEAR RACKS**: Straight gear rack.

#### TRANSMISSION & LINKAGES

- **SHAFTS & KEYS**: Shaft collar; Shaft key; Stepped drive shaft.
- **GEARS & GEAR DRIVES**: Spur gear; Helical and herringbone gear; Bevel gear; Bevel gear pair; Worm drive.
- **REDUCERS & DIFFERENTIALS**: Bevel gearbox · 42 mm · 1:1; Differential carrier; FAULHABER planetary gearheads; Gear reducer.
- **BELTS CHAINS & CABLES**: Belt and pulley drive; Cable sheave and turnbuckle; Roller chain and sprocket drive.
- **SHAFT COUPLINGS**: Flexible jaw coupling; Precision metal bellows coupling; Shaft coupling.
- **ONE-WAY CLUTCHES**: Ball-bearing sprag clutch; Drawn-cup one-way clutch.
- **JOINTS & ROD ENDS**: Clevis fork; Rod-end bearing; Universal and ball joint.
- **PISTONS & CONNECTING RODS**: Connecting rod; Piston.
- **MOTION MECHANISMS**: Linkage and indexing mechanism.
- **BRAKES**: Brake assembly.

#### MOTORS & ACTUATORS

- **STEPPER MOTORS**: FAULHABER AM stepper motors; NEMA stepper motor.
- **BRUSHLESS MOTORS**: Brushless DC motor (BLDC); FAULHABER BX4 brushless motors.
- **SPINDLE MOTORS**: Spindle motor / manufacturer drawing execution.
- **DC & INDUSTRIAL MOTORS**: CHIHAI GF5560-180 worm gear motor; DC and industrial motor.
- **MOTOR ASSEMBLIES**: Catalog motor assemblies.
- **LINEAR ACTUATORS**: Electric linear actuator; FAULHABER LM linear servomotors; FAULHABER screw actuators.
- **SERVOS**: Servo motor; Waveshare ST3215 bus servo; Industrial feed servo motor.
- **SERVO ACCESSORIES**: Servo horn; Servo spline gear.
- **SOLENOIDS**: Open-frame solenoid; Tubular solenoid.
- **HOLDING MAGNETS**: Holding electromagnet.
- **GRIPPERS**: Parallel gripper.

#### PNEUMATICS & GAS

- **CYLINDERS**: Compact pneumatic cylinder; Pneumatic and hydraulic cylinder.
- **FITTINGS & HOSES**: Fluid fitting and quick coupling; Hose and tube segment.
- **VALVES & AIR PREPARATION**: Fluid valve and air preparation unit.
- **PUMPS & MOTORS**: Fluid pump and hydraulic motor.
- **VACUUM HANDLING**: Vacuum suction cup.
- **GAS CARTRIDGES**: CO₂ cartridge.

### Electronics

#### SWITCHES & BUTTONS

- **PANEL CONTROLS**: Toggle switches & buttons (maintained and momentary toggles, guarded toggles, rockers, rotary selectors, panel and tactile buttons); Panel button, knob and beacon; Servo toggle actuator.

These three families appear directly under **Electronics → Switches & buttons**, without an extra panel-controls folder. [Servo toggle actuator](../src/parts/servo-toggle-actuator/GUIDE.md) is an authored ST3215 / ASW-07D mounting example with a three-part printed rocker and a separate guided-fork option; its purchased units remain separate from the fabricated parts in a project specification.

#### POWER & MOTOR CONTROL

- **BATTERIES & HOLDERS**: Cylindrical cell holder; Li-ion cylindrical cell; LiPo and LiHV battery pack; Primary battery.
- **BEC REGULATORS**: BEC voltage regulator.
- **DC-DC CONVERTERS**: DC-DC converter.
- **SPEED CONTROLLERS**: Brushless speed controller (ESC).
- **SERVO CONTROLLERS**: Bus Servo Driver HAT (A); Industrial feed servo drive.
- **INDUSTRIAL CONTROL EQUIPMENT**: Industrial control and power equipment.
- **POWER SWITCHES**: PWM electronic switch.

#### ELECTRONICS & VISION

- **SINGLE-BOARD COMPUTERS**: Raspberry Pi single-board computer; NanoPi single-board computer.
- **MICROCONTROLLER BOARDS**: ESP32 development board; nRF52840 development board; Raspberry Pi Pico board; Arduino development board.
- **FLIGHT CONTROLLERS**: Flight controller; LCH7 v3.2.
- **RADIO MODULES**: GPS tracker ZX908; LoRa radio module.
- **CAMERAS & VISION**: Camera and thermal imaging module.
- **SENSORS & SWITCHES**: HEIDENHAIN LS 477 linear encoder and MSL 41 spar; Industrial sensor; Measurement and position sensors; OMRON E2B M12 inductive limit sensor; Recovery buzzer JHE20B.
- **COOLING & MOUNTING**: Axial cooling fan; Finned heat sink.

#### CONNECTORS & INTERFACES

- **POWER & INDUSTRIAL**: AMASS power connectors.
- **PCB CONNECTORS**: PCB connector (USB, JST XH/PH, DC barrel, TRS audio, SMA/MMCX/U.FL, pin/socket strips, IDC and DE-9).
- **LABORATORY TERMINALS**: Laboratory terminal (banana plugs and sockets, binding posts, speaker clips, spring posts, WAGO lever splices and pluggable screw terminals).
- **CABLE ENTRY**: Cable gland.
- **SRS AIRBAG**: SRS squib connector; SRS squib retainer; SRS igniter housing.

### Workshop

#### WORKSHOP TOOLS

- **SAW BLADES**: Circular saw blade.
- **DRILLING JIGS**: Board edge dowel drilling jig; Fixed-angle drilling shoe; Flange and grid drilling jig; Shaft end-centering drill guide; Tube drilling jig with end stop; V-block cross-drilling jig.
- **ROUTING & PROFILE TEMPLATES**: Chain-drill and slot layout kit; Corner radius scribing template; Router slot and pocket template; Tube fishmouth scribing sleeve.
- **BENDING & ASSEMBLY JIGS**: Manual indexing drill fixture; Pin and mandrel wire-bending jig.
- **CUTTING & SAWING GUIDES**: Manual saw miter box with end stop.
- **TOOL SETTING & PROBES**: Flat toolsetter fabrication details.
- **COOLING & COOLANT**: Spindle coolers and cutting coolant kits.

### Machines

#### MACHINE TOOLS

- **CUTTING MACHINES**: Automatic band saw; Automatic tube saw.
- **MILLING MACHINES**: CNC milling machines.

### Vehicles

#### VEHICLE STRUCTURES

- **AIRCRAFT**: Aircraft airframe.
- **MULTICOPTERS**: Multicopter frames (frame assemblies and separate source components within one navigation family).
- **MODEL ROCKETS**: Model rocket airframe; Parachute Recovery Assembly; CO2 Parachute Recovery Assembly; Rocket AirBrakes; Rocket Release Mechanism; Clamp Band Separation Mechanism.
- **BOAT HULLS**: Boat hull; Boat hull frame kit.
- **GROUND VEHICLES**: Robot chassis; Suspended tracked chassis.
- **AIRFRAME STRUCTURE**: Fuselage former; Wing rib.
- **WINGS & CONTROL SURFACES**: Wing and control surface.
- **PROPELLERS & ROTORS**: Propeller and rotor.
- **DUCTS & LANDING GEAR**: Landing gear strut; Nozzle, diffuser and inlet.
- **VEHICLE MOUNTS**: Two-piece tube arm clamp; Vehicle payload and electronics plate.

See [switches, terminals and connectors](electrical-catalogs.md) for catalog coverage, mounting datums, sources and geometric verification.

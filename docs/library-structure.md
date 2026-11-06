# Library structure

Changes to this map follow [Library organization](library-organization.md).
The `library_organizer` checks family reuse, functional subgroup placement and
Package/model IDs before a package or model is added; `library_curator` verifies
the integrated contract and source/identity preservation.

Start with a functional collection. Each opens a smaller set of related product families:

- **Hardware**: structural sections, brackets, fasteners and springs.
- **Motion**: bearings, linear guides, transmission, motors, actuators and fluid systems.
- **Electronics**: switches, buttons, batteries, power conversion, controls, boards, sensors, connectors and wiring interfaces.
- **Enclosures & devices**: general-purpose housings and device families, with body designs and installation options inside each family.
- **Workshop**: drilling jigs, routing and marking templates, bending fixtures, saw guides, cutting tools, toolsetting and coolant equipment.
- **Machines**: complete cutting and milling machines.
- **Vehicles**: airframes, chassis, hulls and vehicle systems.

The **Function** view groups a collection by category and subgroup, followed by the product family. Model and size variants remain in the family configurator. **Product type**, **Make or buy** and **Manufacturing process** offer alternative views over the same stable product IDs within the selected collection. Navigation grouping does not merge product definitions or establish assembly manufacturability.

Categories and subgroups expand independently: opening another branch keeps existing branches open. Opened branches are remembered for the browser session, and the grouping view is remembered between visits. Switching collections keeps their branches open. When the library reopens, its collection follows the selected product. Selecting a product reveals its location without closing other open branches. Single-item groups appear as direct product buttons, avoiding an extra level with no choice.

The breadcrumbs above the preview are navigation controls. **Library** lists all product families; a category lists every family in that category; a subgroup lists its families directly. Opening one of these levels clears the previous library search while retaining the current preview and its configuration. Search then applies within that level. Use another breadcrumb to move upward, or choose a collection or **Browse collections** to return to collection browsing. The same controls remain available on narrow screens and open the library panel.

Complete machines belong in **Machines**. Reusable motors, screws, guides, sensors, controls, mounts, work surfaces and cooling equipment stay with their function, regardless of which machine uses them. Battery cells, packs and cell holders share one battery group; DIN rail belongs with structural mounting hardware. Grippers belong with actuators, while brakes remain transmission components. Slewing bearings are identified as bearings rather than complete rotary tables.

Search starts across all collections and shows family locations. While a query is active, choose a collection to narrow the results without clearing the query; each collection shows its matching-family count. **All collections** restores global results. Direct family-name matches precede incidental references in descriptions. Family terminology can locate a collection entry without narrowing its models; a fixed-model chooser matches the individual article, so “guard” selects guarded switches and “USB” excludes unrelated JST headers. Selecting a family opens its configurator; use **Browse presets** for the advanced size browser. A metric-size query seeds the size chooser. **/** focuses search. Arrow keys and **Enter** select a highlighted suggestion; otherwise **Enter** chooses the first matching configuration or family. **Escape** clears the query when no suggestions are open.

For exploratory searches, combine known power, bearing and width characteristics, such as `12 V width <= 25`, or use **Choose characteristics**. Partial values offer selectable suggestions, and **Matching configurations** shows exact presets before a family is chosen. Candidate labels retain width meanings and documented supply conditions; typing does not change the preview. Empty combinations can offer an explicit **Try without width** suggestion that preserves the other constraints. See [characteristic discovery](library-discovery.md) for examples, source limits and selection behavior.

Common Ukrainian words for gears, cameras, fasteners, springs, wheels, profiles, guides, cylinders, sensors, enclosures, devices, controllers, toggle switches, switches, buttons, protective covers, rotary selectors and rocker switches are accepted in both family and model searches. The original typed query remains visible. Supplier identifiers and unrecognized queries are preserved. Switches are directly under **Electronics → Switches & buttons**, independently of boards and vision equipment.

Product classification is explicit package data; catalog presence and visible component count do not establish a manufacturing or procurement identity. Engineering references remain available for design exploration and cannot enter a production specification until replaced with resolved product definitions. See [product classification and release requirements](product-library.md).

## Product structure

Configured details, supplier products and material inputs are reusable project definitions. Assembly occurrences reference those definitions and own their position, quantity and placement. An authored mechanism exposes its physical composition through library configurations; supplier internals stay inside their purchased unit. Inspection poses do not change assembly placement or the production specification.

Generic prototypes are separate from sourced catalog dimensions. Consult the [engineering coverage audit](engineering-library-coverage.md), each package's guide and [geometry fidelity audit](model-fidelity-audit.md) for evidence and limitations. A fabrication process is a proposed route, not a finished toleranced drawing or production approval.

## Shared model catalogs

Related model sources appear as one library entry. The right-hand catalog lists their actual articles together, with construction, manufacturer, source and compatible characteristic filters. Selecting an article keeps its original library ID, preset ID, supplier name, geometry and configuration controls. Missing published characteristics remain unknown; a model cannot inherit another article's ratings.

The curated catalogs in `src/core/library.ts` also group T-slot profiles, wheels, lifting eyes, gears, gearboxes, profile guides, ball screw sets/shafts/nuts, supports, servo horns, cylinders and recovery buzzers. These choices retain separate construction schemas rather than converting source products into resizable generic shapes. The catalogs include servo, stepper, brushless and DC motors; gearmotors and linear actuators; bearing types and shaft couplings; bolts, nuts, washers, pins and retaining rings; cameras, flight controllers, development boards, battery cells and power connectors. Reference and prototype examples remain selectable and retain their existing evidence labels. Product type and make-or-buy views continue to use each physical definition's classification.

For example, the servo catalog retains both **Waveshare ST3215-HS** and **Waveshare ST3215 12 V**, alongside the other servo models. They remain distinct articles even where their source CAD has common ancestry. The 12 V model's horn installation and the HS model's accessory controls remain independent.

The **Screw-driven rotary mechanisms** family lists the finished TR8 and SFK0825 constructions as ready executions, including the single-output TR8x4(P2) geared fork actuator with a Surpass Hobby 2845 3100KV motor. Its catalog filters by screw drive and output count. Each execution keeps its own motor, motion, fabrication exports and project identity; switching executions remembers its session settings. Existing saved projects and presets continue to reference the original physical definitions.

## Function tree

The tree below follows collection, category and subgroup order and names the physical members available inside each group. Members of a shared catalog are selected on the right, rather than appearing as separate library entries. Related physical modules retain separate IDs, configurations and source identities.

### Hardware

#### STRUCTURAL PARTS

- **ALUMINIUM PROFILES**: T-slot profiles (source-qualified extrusions and editable modular sections).
- **STEEL & GENERAL SECTIONS**: Structural section.
- **BRACKETS & MOUNTS**: Angle bracket; Bent sheet bracket; Configured manufactured detail; Configured recovery supplier unit; Configured supplier component; Configured threaded recovery detail; DIN mounting rail; Fabricated frame and mounting details; Two-piece spindle clamp detail.
- **WORK SURFACES & TRAYS**: Worktable and coolant tray details.
- **HANDLES HINGES & FEET**: Machine frame hardware.
- **CABLE MANAGEMENT**: Cable duct and drag chain.
- **WHEELS & ROLLERS**: Wheels (utility, pneumatic, omni and mecanum configurations); Conveyor roller; Tracked running gear.

#### FASTENERS & THREADS

- **THREAD GEOMETRY**: Thread tool for cut or union.
- **PRINTED JOINTS**: Printed dovetail joint; Printed tongue-and-groove joint; Printed cantilever snap joint; Printed pin joint.
- **BOLTS & SCREWS**: Bolt or screw; Set screw; Wing screw; Swing eye bolt.
- **NUTS**: Hexagon nut; Thin hexagon nut; High hexagon nut; Flange nut; Nylon-insert locknut; All-metal locknut; Cap nut; Wing nut; Square nut; Coupling nut; T-slot nut.
- **INSERTS & RIVETS**: Blind rivet; Threaded insert and rivet nut.
- **WASHERS**: Flat washer; Square washer; Split spring lock washer; External tooth lock washer; Conical spring washer.
- **SPACERS & STANDOFFS**: Spacers & standoffs.
- **STUDS & RODS**: Threaded rod and stud.
- **PINS & DOWELS**: Slotted spring pin; Solid dowel pin; Split cotter pin.
- **RETAINING RINGS**: E-type retaining ring; Retaining ring.
- **LIFTING EYES**: Lifting eyes (bolt and nut executions).

The printed joints are editable two-piece designs, with separate families for
sliding capture, tongue-and-groove alignment, elastic snap retention and pin
alignment. Their presets are authored printing examples, rather than purchased
products or qualified fits. The `assembled`, `exploded` and `print` states
preserve the same physical parts and product identity. Each assembly's
canonical composition references configured `manufactured-detail` library
definitions; inspection and print-bed placements do not change project
placements or quantities. Follow each package's `GUIDE.md` for clearance
definitions, print orientation and the remaining material and fit checks.

#### SPRINGS

- **HELICAL SPRINGS**: Compression spring; Configured formed wire; Extension spring.
- **TORSION SPRINGS**: Double torsion spring; Torsion spring.
- **SPIRAL SPRINGS**: Flat spiral spring.
- **DISC & LEAF SPRINGS**: Disc, wave and leaf spring.

### Motion

#### BEARINGS & SEALS

- **BALL BEARINGS**: Deep groove ball bearing; Flanged miniature ball bearing; Double-row ball bearing; Angular contact ball bearing; Double-row angular contact ball bearing; Self-aligning ball bearing.
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

- **PROFILE RAILS**: Profile linear guides (fixed-model assemblies and editable guide designs); Profile guide rail; Profile guide carriage.
- **ROUND SHAFT GUIDES**: Round shaft guide.
- **LINEAR BUSHINGS**: Linear ball bushing; Round-flange linear bushing; Square-flange linear bushing.
- **BALL SCREWS**: Ball screw sets; Ball screw shafts; Ball screw nuts; Ball screw axis. The sets retain their source-specific screw/nut configurations; a complete axis remains separate.
- **SHAFT & SCREW SUPPORTS**: Shaft & screw supports (editable supports and sourced standard/precision bearing blocks).
- **LEAD SCREWS & STAGES**: Lead screw and nut; Linear slide module.
- **GEAR RACKS**: Straight gear rack.

#### TRANSMISSION & LINKAGES

- **SHAFTS & KEYS**: Shaft collar; Shaft key; Stepped drive shaft.
- **GEARS & GEAR DRIVES**: Gears (spur, helical, herringbone and bevel); Bevel gear pair; Worm drive.
- **REDUCERS & DIFFERENTIALS**: Gearboxes & gearheads (including 1:1 bevel gearboxes and planetary reducers); Differential carrier.
- **BELTS CHAINS & CABLES**: Belt and pulley drive; Cable sheave and turnbuckle; Roller chain and sprocket drive.
- **SHAFT COUPLINGS**: Flexible jaw coupling; Precision metal bellows coupling; Shaft coupling.
- **ONE-WAY CLUTCHES**: Ball-bearing sprag clutch; Drawn-cup one-way clutch.
- **JOINTS & ROD ENDS**: Clevis fork; Rod-end bearing; Universal and ball joint.
- **PISTONS & CONNECTING RODS**: Connecting rod; Piston.
- **MOTION MECHANISMS**: Linkage and indexing mechanism.
- **BRAKES**: Brake assembly.

#### MOTORS & ACTUATORS

- **STEPPER MOTORS**: FAULHABER AM stepper motors; NEMA stepper motor.
- **BRUSHLESS MOTORS**: Brushless motors (generic, FAULHABER BX4 and Surpass 2838/2845 models); Underwater thruster.
- **SPINDLE MOTORS**: Spindle motor / manufacturer drawing execution.
- **DC & INDUSTRIAL MOTORS**: CHIHAI GF5560-180 worm gear motor; DC and industrial motor.
- **MOTOR ASSEMBLIES**: Gearmotors (catalog motor assemblies and GMP16T-TEC1636); Screw-driven rotary mechanisms (TR8 and SFK0825 executions, including the TR8x4(P2) geared fork actuator).
- **LINEAR ACTUATORS**: Electric linear actuator; FAULHABER LM linear servomotors; FAULHABER screw actuators.
- **SERVOS**: Servo motor; Waveshare ST3215 bus servo; Industrial feed servo motor.
- **SERVO ACCESSORIES**: Servo horns (editable designs and the sourced metal round horn); Servo spline gear.
- **SOLENOIDS**: Open-frame solenoid; Tubular solenoid.
- **HOLDING MAGNETS**: Holding electromagnet.
- **GRIPPERS**: Parallel gripper.

#### PNEUMATICS & GAS

- **CYLINDERS**: Cylinders (editable fluid/compact designs, MA32×50-SCA / MA32×100-SCA round supplier references and Festo DSBC-63-500-PPSA-N3 profile supplier reference).
- **FITTINGS & HOSES**: Fluid fitting and quick coupling; Hose and tube segment.
- **VALVES & AIR PREPARATION**: Fluid valve and air preparation unit; Pneumatic valve (4V210-08 DC24V); Pneumatic air preparation unit (AR2000 / AFR2000 G1/4 supplier references).
- **PUMPS & MOTORS**: Fluid pump and hydraulic motor.
- **VACUUM HANDLING**: Vacuum suction cup.
- **GAS CARTRIDGES**: CO₂ cartridge.

### Electronics

#### SWITCHES & BUTTONS

- **PANEL CONTROLS**: Toggle switches & buttons (maintained and momentary toggles, guarded toggles, rockers, rotary selectors, panel and tactile buttons); Lehao AD16-16C panel indicator; Panel button, knob and beacon; Servo toggle actuator.

These four families appear directly under **Electronics → Switches & buttons**, without an extra panel-controls folder. [Servo toggle actuator](../src/parts/servo-toggle-actuator/GUIDE.md) is an authored ST3215 / ASW-07D mounting example with a three-part printed rocker and a separate guided-fork option; its purchased units remain separate from the fabricated parts in a project specification.

#### POWER & MOTOR CONTROL

- **BATTERIES & HOLDERS**: Cylindrical cell holder; Li-ion cylindrical cell; LiPo and LiHV battery pack; Primary battery; Waveshare UPS Module 3S with its fitted empty holder.
- **BEC REGULATORS**: BEC voltage regulator, including the BEC12S-PRO installation reference.
- **POWER FILTERS**: Power supply filter, including the selected iFlight LC filter seller version.
- **DC-DC CONVERTERS**: DC-DC converter.
- **SPEED CONTROLLERS**: Brushless speed controller (ESC).
- **SERVO CONTROLLERS**: Bus Servo Driver HAT (A); Industrial feed servo drive.
- **INDUSTRIAL CONTROL EQUIPMENT**: Industrial control and power equipment.
- **POWER SWITCHES**: PWM electronic switch.

#### ELECTRONICS & VISION

- **SINGLE-BOARD COMPUTERS**: Raspberry Pi single-board computer; NanoPi single-board computer; [Compute module carrier board](../src/parts/compute-module-carrier/GUIDE.md), with Raspberry Pi CM5 IO Board revision 2 (`compute-module-carrier:raspberry-pi-cm5-io-rev2`), Waveshare CM5-IO-BASE-A (`compute-module-carrier:waveshare-cm5-io-base-a`), CM5-NANO-A (`compute-module-carrier:waveshare-cm5-nano-a`) and CM5-NANO-B (`compute-module-carrier:waveshare-cm5-nano-b`) fixed models. Carrier boards retain their own product family; select the compute module separately.
- **MICROCONTROLLER BOARDS**: ESP32 development board; nRF52840 development board; Raspberry Pi Pico board; Arduino development board.
- **STORAGE & ADAPTERS**: M.2 NVMe SSD installation references; Waveshare PCIe TO M.2 Board (D).
- **FLIGHT CONTROLLERS**: Flight controller; LCH7 v3.2; [Wireless USB extender](../src/parts/usb-wireless-extender/GUIDE.md), including the separate SpeedyBee F405 WING MINI service board (`usb-wireless-extender:speedybee-f405-wing-mini-usb`). The accessory keeps its own physical identity and does not create another complete flight-controller kit.
- **RADIO MODULES**: [GPS tracker ZX908](../src/parts/gps-tracker/GUIDE.md) (`gps-tracker:zx908`), reused by the current source recovery platform; LoRa radio module, including Heltec WiFi LoRa 32 V3 and V4; [Adhesive antenna](../src/parts/adhesive-antenna/GUIDE.md), including Jinchang JCG108 nominal housing references with 3 m and 5 m cable selections.
- **CAMERAS & VISION**: Camera and thermal imaging module; 19x19 CSI board camera, including the IMX577 19x19 execution; Flanged optical dome window.
- **SENSORS & SWITCHES**: HEIDENHAIN LS 477 linear encoder and MSL 41 spar; Industrial sensor; Measurement and position sensors; OMRON E2B M12 inductive limit sensor; Recovery buzzer JHE20B; [JHEMCU JHE42B Finder](../src/parts/jhe42b-finder/GUIDE.md), with the unchanged standard manufacturer model and a separate `jhe42b-project-reference-26x17x15` source-project reference. JHE20B and the two JHE42B selections retain distinct identities and dimensions.
- **COOLING & MOUNTING**: Axial cooling fan; Finned heat sink.

#### ELECTRONICS MOUNTS

- **MODULE ADAPTERS**: [Electronic module adapters](../src/parts/electronics-module-adapter/GUIDE.md), including editable horizontal cradles and 90-degree stands on a 20 mm M3 grid, plus the fitted HAT, Heltec, ADS1220, BEC and LC adapters used in the case insert; [PCB retention mounts](../src/parts/pcb-retention-mount/GUIDE.md), with one to four independently sized boards, configurable seating height, optional removable locking bridges and additional side or underside support. These families are independently configurable and exportable, with distinct physical identities. [Recovery electronics mounting details](../src/parts/recovery-electronics-mount/GUIDE.md) add the fixed current lower locating platform, flat upper retaining disc and three GPS retainer geometries; [Recovery electronics platform](../src/parts/recovery-electronics-platform/GUIDE.md) combines them with the three independently registered modules as the source seating study (`recovery-electronics-platform:pem-current`).

PCB retention mounts use the carrier floor as Z=0 and report their mounting-hole
datums for installation in an authored enclosure. Board outlines are fitting
references rather than purchased components. The carrier and optional locking
bridges retain their canonical identities and quantities through service,
exploded and print-layout inspection views. The field DAQ base and the reusable
mount share native PCB seating and retention helpers while retaining their own
host geometry and component identities. Check each package's `GUIDE.md` for
bare-edge contact lands, board withdrawal space, the bridge release sequence,
clearance definitions and unresolved material/load qualification.

The recovery platform uses the latest source stack datums: the lower plate, upper disc, GPS, project JHE42B reference, USB extender and four GPS retainers remain nine separate occurrences. The two plain retainers reuse one model; the two relieved retainers preserve their distinct native source geometry. The fixed source mounting design is separate from the editable grid adapters and sliding-lock carriers. Supporting posts, fasteners, nuts, ties and the surrounding enclosure are excluded from this engineering seating study; source module fit, cable access, pad material and retention qualification remain unresolved.

#### CONNECTORS & INTERFACES

- **POWER & INDUSTRIAL**: AMASS power connectors; SP20 waterproof cable plugs and panel sockets (2, 4 and 6 contacts).
- **PCB CONNECTORS**: PCB connector (USB, JST XH/PH, DC barrel, TRS audio, SMA/MMCX/U.FL, pin/socket strips, IDC and DE-9), including the NIKOM A448027 USB-C screw-flange panel reference (`signal-connector:nikom-a448027`).
- **LABORATORY TERMINALS**: Laboratory terminal (banana plugs and sockets, binding posts, speaker clips, spring posts, WAGO lever splices and pluggable screw terminals).
- **CABLE ENTRY**: Cable gland.
- **SRS AIRBAG**: SRS squib connector; SRS squib retainer; SRS igniter housing.

### Enclosures & devices

#### ENCLOSURES & DEVICES

- **GENERAL-PURPOSE ENCLOSURES**: One **Enclosures** catalog combines [purchased supplier enclosures](../src/parts/catalog-enclosure/GUIDE.md), including Altinkaya product families and the Grandado 83 x 58 x 35 mm flanged project box, with rectangular open-top enclosures, [Field DAQ enclosures](../src/parts/field-daq-enclosure/GUIDE.md), underwater pressure enclosures and the [Grandado Ø90/86 tube mounting kit](../src/parts/grandado-tube-mount/GUIDE.md). The [tube antenna fairing](../src/parts/jcg108-tube-fairing/GUIDE.md) is a separate future engineering reference and is not included in that kit. Each member retains its physical identity and make or buy policy. The shared catalog filters published outside dimensions, material, mounting, cover and IP rating; supplier enclosure models can also be sorted by outside volume or individual dimensions.

The same Enclosures catalog contains five authored empty base/lid template
families: `printed-rim-enclosure` (stepped, perimeter-groove and labyrinth seams),
`printed-self-centering-enclosure` (tapered pilot and separate axial shoulder),
`printed-screw-enclosure` (recessed or countersunk sourced M3 screws with
side-loaded nut traps), `printed-bayonet-enclosure` (short-turn lug/channel
interlock), and `printed-threaded-enclosure` (coarse printed cap thread).
The thread assembly references the reusable physical detail family
`printed-threaded-shell`, whose body/cap selector belongs in its configurator.
These six package IDs remain directly searchable and copyable within the one
existing navigation catalog; they do not introduce a separate enclosure tree.

All dimensions of these empty templates are authored examples. Their presets
have no supplier catalog or ingress-rating claim. The two printing components
retain independent library definitions and canonical placements across open,
exploded and print views; the screw enclosure additionally retains four exact
`bolt-screw` and four `hex-nut` occurrences. Its printing export excludes that
metal hardware. Follow the package guides for fit definitions, seam assembly
paths, print orientation, real thread exports, hardware evidence and unresolved
material/load/service qualification. Place actual boards, plugs, cables and
thermal interfaces before adapting any template into a finished device.

- **HANDHELD CONTROLLERS**: [Heltec V4 handheld controller](../src/parts/handheld-lora-controller/GUIDE.md), with Straight, Palm and Palm Lock body designs. Antenna type is an independent filter; connector placement distinguishes external variants.

New device platforms become separate families in the relevant subgroup. Body designs and antenna installations remain variants within their family. See the [enclosure catalog naming rules](enclosure-catalog.md).

### Workshop

#### WORKSHOP TOOLS

- **SAW BLADES**: Circular saw blade.
- **DRILLING JIGS**: Board edge dowel drilling jig; Fixed-angle drilling shoe; Flange and grid drilling jig; Manual indexing drill fixture; Shaft end-centering drill guide; Tube drilling jig with end stop; [Modular tube marking kit](../src/parts/modular-tube-marking-kit/GUIDE.md); V-block cross-drilling jig.
- **ROUTING & PROFILE TEMPLATES**: Chain-drill and slot layout kit; Corner radius scribing template; Router slot and pocket template; Tube fishmouth scribing sleeve.
- **BENDING & ASSEMBLY JIGS**: Pin and mandrel wire-bending jig.
- **CUTTING & SAWING GUIDES**: Manual saw miter box with end stop.
- **TOOL SETTING & PROBES**: Toolsetter detail.
- **COOLING & COOLANT**: Cooling equipment.

### Machines

#### MACHINE TOOLS

- **CUTTING MACHINES**: Automatic band saw; Circular tube saw.
- **MILLING MACHINES**: CNC milling machines.

### Vehicles

#### VEHICLE STRUCTURES

- **AIRCRAFT**: Aircraft airframe.
- **MULTICOPTERS**: Multicopter frames (frame assemblies and separate source components within one navigation family).
- **MODEL ROCKETS**: Model rocket airframe; Rocket nose cone; Rocket body tube; Rocket conical transition and boattail; Rocket tube coupler; Rocket centering ring; Rocket bulkhead; Rocket planar fin; Rocket launch lug; Rocket avionics mounting sled; [Modular tube avionics](../src/parts/modular-tube-avionics/GUIDE.md); Rocket rail guide button; Rocket ballast mass; Rocket parachute canopy; Rocket recovery streamer; Rocket recovery shock cord; Parachute recovery assembly; CO₂ parachute recovery assembly; Rocket airbrake; Rocket release mechanism; Clamp-band separation mechanism; Rocket preparation V cradle. See [LDRS components](ldrs-library.md) and [OpenRocket component coverage](openrocket-components.md) for shapes, prototype presets and modeling limits.
- **BOAT HULLS**: Boat hull; Boat hull frame kit.
- **UNDERWATER ROVS**: [FinsROV mechanical assembly](../src/parts/rov-project/GUIDE.md), retaining source-positioned fabricated details and complete purchased equipment as separate library occurrences.
- **GROUND VEHICLES**: Robot chassis; Suspended tracked chassis.
- **AIRFRAME STRUCTURE**: Fuselage former; Wing rib.
- **WINGS & CONTROL SURFACES**: Wing and control surface.
- **PROPELLERS & ROTORS**: Propeller and rotor.
- **DUCTS & LANDING GEAR**: Landing gear strut; Nozzle, diffuser and inlet.
- **VEHICLE MOUNTS**: Two-piece tube arm clamp; Vehicle payload and electronics plate.

See [switches, terminals and connectors](electrical-catalogs.md) for catalog coverage, mounting datums, sources and geometric verification.

Standalone assembly devices retain their product family and exact model ID: `adc-module:cjmcu-1220` under Electronics & Vision / Sensors & Switches; `power-filter:iflight-lc-filter-16x6` under Power & Motor Control / Power Filters; `li-ion-pack:syla-lr2170la-4s1p-xt60` in the Battery cells & packs catalog. The existing BEC and PWM families also expose `bec:bec12s-pro` and the unidentified `pwm-switch:user-mosfet-26x16` reference. SAC-01 occurrences use those same definitions, preserving the documented provisional geometry and missing evidence.

See the [section-by-section organization review](library-organization-audit.md) for coverage, identity decisions, implemented changes and remaining schema/state issues.

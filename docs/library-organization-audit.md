# Library organization review

Reviewed 2026-11-03 against the current working tree. Seventeen dedicated section agents audited all 341 physical packages and 20,514 presets. The root agent acted as library curator; a separate verifier reviewed the integrated organization changes against task-local originals. Existing uncommitted work was preserved.

## Result and hierarchy

The library retains seven collections and seventeen sections. The hierarchy is **collection → section → subgroup → functional family → model/preset → parameter groups**. Related physical definitions now share 225 browse entries, down from 246 (21 fewer). All original package IDs, preset IDs, parameter keys/values, state IDs, product classifications, source records and geometry implementations remain intact. No physical ID migration was justified by a presentation rename alone.

A shared catalog selects a real existing definition and its configuration. It does not resize a purchased article, combine ratings across models, or merge a whole assembly with one of its components. Length, thread, winding, camera setup and supported gear forms remain configurator/model choices. Different operating principles and different procurement boundaries retain independent definitions.

## Section coverage

Counts describe runtime registration, including catalog-generated presets. Every section has its own repository documentation page under `docs/library-organization-audit/`. These are dated reviews before curator integration, so their recommendations are not all outstanding. This integrated review records completed changes and the remaining work. Ongoing additions and reorganizations follow the [library organization policy](library-organization.md).

| Section                 | Packages | Presets | Browse entries before → after | Detailed report                                               |
| ----------------------- | -------: | ------: | ----------------------------: | ------------------------------------------------------------- |
| Enclosures & devices    |       13 |     532 |                         2 → 2 | [enclosures.md](library-organization-audit/enclosures.md)     |
| Machine tools           |        3 |      14 |                         3 → 3 | [machines.md](library-organization-audit/machines.md)         |
| Workshop tools          |       17 |     134 |                       17 → 17 | [workshop.md](library-organization-audit/workshop.md)         |
| Structural parts        |       20 |     104 |                       20 → 18 | [structural.md](library-organization-audit/structural.md)     |
| Fasteners & threads     |       39 |   8,756 |                       16 → 15 | [fasteners.md](library-organization-audit/fasteners.md)       |
| Bearings & seals        |       32 |   7,876 |                       17 → 17 | [bearings.md](library-organization-audit/bearings.md)         |
| Linear motion           |       22 |     725 |                       20 → 13 | [linear.md](library-organization-audit/linear.md)             |
| Transmission & linkages |       28 |     917 |                       25 → 21 | [transmission.md](library-organization-audit/transmission.md) |
| Springs                 |        7 |      19 |                         6 → 6 | [springs.md](library-organization-audit/springs.md)           |
| Motors & actuators      |       44 |     627 |                       18 → 15 | [motors.md](library-organization-audit/motors.md)             |
| Pneumatics & gas        |       12 |      53 |                        12 → 9 | [pneumatics.md](library-organization-audit/pneumatics.md)     |
| Switches & buttons      |        4 |      47 |                         4 → 4 | [switches.md](library-organization-audit/switches.md)         |
| Power & motor control   |       16 |      72 |                       12 → 12 | [power.md](library-organization-audit/power.md)               |
| Electronics & vision    |       31 |     149 |                       24 → 23 | [electronics.md](library-organization-audit/electronics.md)   |
| Vehicle structures      |       40 |     361 |                       38 → 38 | [vehicles.md](library-organization-audit/vehicles.md)         |
| Electronics mounts      |        4 |      20 |                         4 → 4 | [mounts.md](library-organization-audit/mounts.md)             |
| Connectors & interfaces |        9 |     108 |                         8 → 8 | [connectors.md](library-organization-audit/connectors.md)     |

## Implemented grouping

All paths below retain their existing collection, section and subgroup. Shared catalog IDs identify navigation; the listed physical IDs continue to identify actual products.

| Path within collection                                      | Shared catalog                                  | Physical package IDs                                                                                     |
| ----------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Hardware → Structural parts → Aluminium profiles            | T-slot profiles (`t-slot-profiles`)             | `aluminium-profile`, `slot-profile`                                                                      |
| Hardware → Structural parts → Wheels & rollers              | Wheels (`wheels`)                               | `wheel`, `robot-wheel`                                                                                   |
| Hardware → Fasteners & threads → Lifting eyes               | Lifting eyes (`lifting-eyes`)                   | `lifting-eye-bolt`, `lifting-eye-nut`                                                                    |
| Motion → Transmission & linkages → Gears & gear drives      | Gears (`gears`)                                 | `spur-gear`, `helical-gear`, `bevel-gear`                                                                |
| Motion → Transmission & linkages → Reducers & differentials | Gearboxes & gearheads (`gearboxes`)             | `gearbox`, `bevel-gearbox-42`, `faulhaber-planetary`                                                     |
| Motion → Linear motion → Profile rails                      | Profile linear guides (`profile-linear-guides`) | `hiwin-profile-guide`, `linear-guide`                                                                    |
| Motion → Linear motion → Ball screws                        | Ball screw sets (`ball-screw-sets`)             | `ball-screw`, `tbi-ball-screw`, `cnc-precision-axis`                                                     |
| Motion → Linear motion → Ball screws                        | Ball screw shafts (`ball-screw-shafts`)         | `cnc-drive-screw`, `cnc-precision-screw`                                                                 |
| Motion → Linear motion → Ball screws                        | Ball screw nuts (`ball-screw-nuts`)             | `ball-nut`, `cnc-precision-nut`                                                                          |
| Motion → Linear motion → Shaft & screw supports             | Shaft & screw supports (`shaft-screw-supports`) | `shaft-support`, `cnc-screw-support`, `cnc-precision-support`                                            |
| Motion → Motors & actuators → Servo accessories             | Servo horns (`servo-horns`)                     | `servo-arm`, `metal-servo-horn`                                                                          |
| Motion → Pneumatics & gas → Cylinders                       | Cylinders (`fluid-cylinders`)                   | `fluid-cylinder`, `compact-pneumatic-cylinder`, `round-pneumatic-cylinder`, `profile-pneumatic-cylinder` |
| Electronics → Electronics & vision → Sensors & switches     | Recovery buzzers & finders (`recovery-buzzers`) | `recovery-buzzer`, `jhe42b-finder`                                                                       |

The existing **Brushless motors** catalog also includes `surpass-2838` and `surpass-2845`. Their source-qualified windings and physical shaft-drilling selections remain independent. The existing Enclosures, Cameras & vision modules, battery, fastener, bearing, spacers/standoffs, rocket-nose, multicopter and screw-driven rotary-mechanism catalogs remain in use.

Individual guide rails/carriages, complete ball screw axes, bevel gear pairs, worm drives, differentials, conveyor rollers and tracked running gear remain separate from the related component catalogs. The 1:1 bevel gearbox is included under Gearboxes & gearheads without implying speed reduction.

## Naming, search and selection

- Curated **109 preset titles in 26 packages**, using readable dimensions, `Ø`, `×`, `mm` and `·`. IDs, numeric parameters and supplier designations are unchanged. Gears identify their construction in the shared list; printed joint clearances retain their distinct diametral/side definitions.
- Added concise browse labels for source-specific or implementation-heavy family names, including Spindle motor, Circular tube saw, Formed wire, Toolsetter detail, Cooling equipment, PCB retention mount and the rocket mechanisms. Configuration/export names remain tied to their physical definitions.
- Aligned recovery mounting-detail and toolsetter selector labels with canonical preset titles; fixed compressed manufacturer/model spacing in precision supports, motors and drives. The provisional indicator's geometry limitations remain in its description and source evidence rather than its title.
- Moved `indexing-disc-jig` to Workshop tools → Drilling jigs and updated its guide. It performs indexed drilling rather than wire bending.
- Expanded recognized Ukrainian component vocabulary for gears, cameras, fasteners, springs, wheels, profiles, guides, cylinders, sensors and couplings. Visible interface text remains English; exact IDs and supplier identifiers still resolve literally.
- Updated the library map, enclosure catalog documentation, collection count and connector guide paths. Corrected the cable-gland guide to describe its actual body/nut scope; a seal is not modeled. Corrected a stale five-member enclosure test expectation to include all twelve current members.

Names are presentation. Physical references remain `<part.id>:<preset.id>`; occurrence IDs, enterprise ESKD designations and supplier order codes remain separate records. No display-name alias or ID replacement was introduced.

## Decisions by section

- **Enclosures & devices:** twelve physical enclosure definitions already share one catalog; the handheld platform remains a separate family. Closure architectures and fitted-device interfaces justify separate implementations. Body and antenna choices stay inside the handheld configurator.
- **Machine tools:** band and circular saws retain their distinct cutting/handling mechanisms; feed mode, cut length and stock section stay parameters. Complete CNC machines remain separate from reusable components.
- **Workshop tools:** dimensions, patterns and angles are already parameterized. Axial, V-block, board-edge and inclined locating architectures remain distinct. Preset naming and the indexed fixture's location were corrected.
- **Structural parts:** grouped profiles and wheels; retained source-qualified and generic geometry separately. Recipe-based CNC/recovery/manufactured details are assembly-authoring tools, not interchangeable purchased brackets.
- **Fasteners & threads:** existing bolt/nut/washer/pin/standoff catalogs already remove most navigation duplication; added lifting eyes. Distinct standards, thread systems and procurement identities remain model/source distinctions.
- **Bearings & seals:** existing ball/roller/thrust/mounted bearing catalogs are appropriate. Do not merge bearing constructions merely because bore/OD/width agree. The prototype locknut title now states nominal thread diameter without inventing a metric pitch or standard.
- **Linear motion:** grouped by physical scope: guide assemblies, screw sets, shafts, nuts and supports. Individual rails/carriages and complete axes remain directly selectable. Overlapping MGN source coverage needs a separate identity review.
- **Transmission & linkages:** grouped individual gears and gearbox/gearhead models; kept paired drives and differentials separate. Normal module, bevel geometry and mating interfaces remain specific to each configurator.
- **Springs:** existing torsion grouping and size parameters are adequate. Compression, extension, torsion, spiral and disc/leaf principles remain distinct. Formed wire is an assembly-authoring definition.
- **Motors & actuators:** retained all seventeen TR8/SFK physical executions inside their existing shared family; added Surpass models and servo-horn grouping. Similar schemas alone do not establish interchangeable mechanisms.
- **Pneumatics & gas:** grouped cylinder construction/model choices while retaining fixed supplier geometry and editable references. Valves, air preparation, fittings, hoses, pumps and gas cartridges remain separate functions.
- **Switches & buttons:** four distinct functions remain separate: switches, indicators, general panel controls and the servo-driven toggle mechanism. Size/contact/guard choices already belong in selectors.
- **Power & motor control:** existing cell/pack and holder grouping is appropriate. UPS assemblies, empty holders, batteries, regulators and servo drives retain their actual boundaries.
- **Electronics & vision:** camera variants already share a catalog; optical windows and carrier boards remain separate. Added recovery buzzer/finder grouping. Duplicate OMRON coverage needs canonical identity work.
- **Vehicle structures:** existing nose/camera and multicopter grouping is appropriate. Camera setup stays a parameter; distinct complete vehicles, airframe details and recovery mechanisms retain their definitions. Corrected inconsistent mechanism browse labels.
- **Electronics mounts:** adapters, sliding-lock PCB carriers, fixed recovery details and the source platform are complementary products. Their existing supported states are meaningful; no umbrella merge was needed.
- **Connectors & interfaces:** power/industrial connectors already share a catalog. PCB connectors, terminals, RF assemblies, cable glands and the SRS connector/retainer/igniter functions remain distinct. Guide paths and gland units were corrected.

## Outstanding identity and schema work

These are analysis findings, not completed geometry changes. They remain explicit so a naming cleanup cannot imply full library engineering verification.

### Canonical product identity

1. `machine-measurement:e2b-m12` and `cnc-limit-sensor:e2b-m12` both identify **OMRON E2B-M12KS04-WP-B1 2M**; the latter delegates geometry to the former. Choose one authoritative definition, map all assembly/project references, and verify source metadata, saved configurations, ESKD identity and export round trips before retiring a physical ID. Do not allocate a third identity.
2. Eight HIWIN MGN7/9/12/15 C/H selections overlap between `hiwin-profile-guide` and `linear-guide`. The former fixes model interfaces and supports carriage count; the latter exposes editable geometry. Compare actual dimensions, datums, source revisions and installed consumers before deciding whether exact source selections can migrate. Their shared catalog does not prove physical interchangeability.
3. `machine-control` contains VFD, PLC, power supply and emergency-stop functions in one mixed family; a future split needs model-aware identity migration. The CHF GF5560 worm gearmotor also merits a coordinated move from DC motors to gearmotors, including its shared catalog membership. Current references remain preserved.

### Meaningful states

Source inspection found ineffective Exploded choices for these one-piece families:

- Workshop: `corner-radius-template`, `tube-coping-template`, `router-template`, `manual-miter-guide`.
- Structural: `structural-section`, `slot-profile`, `sheet-bracket`, `din-rail`.
- Fasteners: `dowel-pin`, `t-slot-nut`, `threaded-insert`.
- Bearings/seals: `plain-bushing`, `o-ring`, `seal-profile`.
- Linear motion: `shaft-support`.
- Transmission: `shaft-key`, `shaft`.
- Springs: `disc-wave-spring`.
- Fluid systems: `fluid-hose`, `vacuum-cup`.
- Power/electronics: `battery-holder`, `heat-sink`.
- Vehicles: `propeller`, `duct`.

Conditional state availability also needs review in `cable-carrier`, `machine-hardware`, `shaft-collar`, `cable-hardware`, `fluid-fitting` and `panel-control`. Implement availability and saved-state reconciliation with `availableModelState` and the existing physical-product normalization. Check preview, dimensions, native geometry and composition before claiming the corrected states are verified. Do not split an integral body to manufacture an exploded view.

### Parameter relevance and naming follow-up

- Hide the unused `drill-pattern-jig.count` for grid mode; review two-position switch Center availability and the hidden terminal-colour control.
- Review leaf versus annular controls/validation in `disc-wave-spring`, fixed compact-cylinder characteristic filters, formed-wire centreline editing, bearing closure/diameter label consistency and hidden irrelevant flange/groove dimensions.
- Continue source-aware fastener title cleanup in both snapshots and their offline generators: standards for hand nuts/E-rings, units for cotters, and complete authored spacer dimensions. Preserve literal DREMEC supplier codes rather than treating `x` or `/` inside an order code as dimensional punctuation.
- Reconcile the PCB connector guide's older 35-reference inventory with the actual forty retained models; review the added assets before attributing all to the older source set. Add missing source/fidelity guidance for `metal-servo-bracket`.

A common parameter key is not enough to prove that two products should merge. Preserve stable keys while normalizing useful visible labels/groups; fixed supplier models retain source-owned dimensions. Any later geometry/API consolidation requires the component workflow and engineering/native-CAD verification in AGENTS.md.

## Verification

The seventeen section reviews, [independent review](library-organization-audit/review.md) and [validation record](library-organization-audit/validation.md) are preserved alongside this summary in `docs/library-organization-audit/`. Runtime comparison retained package IDs/order, per-package preset counts, parameter/state summaries and physical identity. Parsed comparisons establish that each edited preset record changed only its `name`, with IDs, parameters and catalog evidence intact. Optional raw snapshots, task-local originals and generated logs remain under ignored `test-results/library-organization-audit/`; the organization rules, decisions, findings and completed check results do not depend on those files being present.

All 341 packages and 20,514 presets passed package validation. Production build, application/test TypeScript and 131 targeted tests passed; one native-CAD helper test was skipped by its environment condition. Global language/README and artifact-location checks still report 26 and four existing issues respectively outside the edited files; the 68 task-changed files pass the language check.

Final command results are recorded in the repository [validation record](library-organization-audit/validation.md). Tests cover functional grouping, exact physical-model lookup, configuration links, localized queries, gear-type filtering, navigation, model/state reconciliation, project identity and composition. No geometry construction was changed; this review did not perform new strength, fit, motion, manufacturing or FreeCAD topology qualification. Those remain required for the outstanding physical/state changes above.

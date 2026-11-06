# Open ROV projects and workshop fabrication

Source checkpoint: **2026-10-29**. The [reviewed project summaries](rov-research/project-sources.json) and [source URLs, revisions and SHA-256 provenance](rov-research/source-provenance.json) preserve the historical research inputs. Their former mixed-project scope is research evidence, not the active library inventory.

The live build catalog contains **FinsROV**, with its original assembly hierarchy, installed component positions and explicit make-or-buy definitions. Servos, thrusters, sensors and the purchased pressure enclosure are equipment, not printable parts. Schillaci, MUR and LoCO remain researched references below; they are not offered as complete, configured builds or as active manufacturing sets.

Use the [FinsROV assembly guide](../src/parts/rov-project/GUIDE.md), [manufactured-part guide](../src/parts/rov-component/GUIDE.md) and [servo guide](../src/parts/qfs2025-servo/README.md) and [thruster guide](../src/parts/underwater-thruster/README.md) for the current library behavior. The former mixed-project geometry inventory is research history, not the live product count.

## FinsROV: actual assembly and make-or-buy scope

The original `Configuration.STEP` contains **50 top-level physical occurrences**. Its **142 underlying solids** include supplier internals; they are not 142 independently manufactured parts. The library keeps each purchased unit together and installs reusable product definitions with physical placements. Eight canonical purchased model configurations cover the 24 bought occurrences; source-position clones are not library products. The same QFS2025 servo definition is used four times, and the two source thruster variants are used four times each. These products belong to ordinary servo, motor, sensor, enclosure and mounting sections; there is no ROV purchased-equipment family.

| Supply                 | Source definitions / units                                                                                                | Installed occurrences | Library treatment                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------: | ------------------------------------------------------------------------------------------------------- |
| Manufactured polymer   | Pressure-sensor mount                                                                                                     |                     4 | Print these four brackets; the sensor itself is purchased.                                              |
| Manufactured aluminium | Front cabin mount, rear cabin hatch, thruster mount, horizontal thruster bracket, cable-passing screw                     |                    22 | Five source definitions with machining, drilling/tapping and finishing requirements.                    |
| Purchased equipment    | Complete thrusters, waterproof servos, servo brackets, servo horns, depth sensors, cabin and dome/pressure-plate assembly |                    24 | Opaque purchased units with procurement identity; no printing or CNC route assigned to their internals. |
| **Total**              | **Six manufactured source definitions plus purchased equipment**                                                          |                **50** | **26 made occurrences and 24 purchased CAD occurrences.**                                               |

The 26 manufactured occurrences are matched to the installed source geometry using native FreeCAD geometry comparisons, including symmetric difference and the original poses. This establishes correspondence between making files and placed parts; it is not inferred from a similar-looking outline or an arbitrary grid of downloaded files.

**STL output is limited to the four printed pressure-sensor mounts.** Purchased equipment and the aluminium CNC parts are blocked from STL fabrication output. Use the native CAD and manufacturing records for the machined parts. An assembly preview or native assembly export can contain purchased geometry for fitting and inspection without making it a fabrication instruction.

### Parts to manufacture

| Original definition                | Quantity | Material / main route                                                                   | Source qualification still needed                                                                                                            |
| ---------------------------------- | -------: | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `Pressure_Sensor_Mount.STEP`       |        4 | Printed polymer; source does not establish a polymer grade                              | Select material, printing orientation and fit for the actual build. Quantity comes from the source assembly.                                 |
| `Front_Cabin_Mount.STEP`           |        1 | Aluminium alloy, black anodized; milling                                                | Preserve the source enclosure and mounting interfaces.                                                                                       |
| `Rear_Cabin_Hatch.STEP`            |        1 | Aluminium alloy, black anodized; milling and drilling/tapping                           | This is a flat hatch with a hole pattern, not merely a turned cylinder. The workbook calls out M2 holes, 4 mm thread depth and 48 locations. |
| `Thruster_Mount.STEP`              |        4 | Aluminium alloy, black anodized; milling and drilling/tapping                           | Follow the source M3 thread and engagement requirements.                                                                                     |
| `Horizontal_Thruster_Bracket.STEP` |        4 | Aluminium alloy, blue anodized; milling and drilling/tapping                            | Follow the source M3 thread and engagement requirements.                                                                                     |
| `Cable-passing_Screw.STEP`         |       12 | Aluminium alloy, black anodized; turning with bore/thread and sealing-feature finishing | Preserve the original cable-entry and mating geometry; resolve thread fits and sealing finish.                                               |

The CNC workbook specifies aluminium alloy and finish, but does not establish the alloy grade/temper, all machining tolerances, CAM paths or an acceptance procedure for a newly made pressure closure. Those remain manufacturing planning requirements.

### Parts to purchase

| Purchased unit represented in the external CAD        |  CAD quantity | Actual upstream procurement meaning                                                                                                                        |
| ----------------------------------------------------- | ------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete underwater thruster with built-in ESC for 4S |             8 | **Four CW/CCW pairs**, not eight pairs. Supplier internal propeller, motor and casing solids stay within each purchased thruster.                          |
| LIEYING QFS2025 waterproof servo                      |             4 | Four purchased 20 kg, 180-degree servos per the BOM; the source requests a total cable length of 1 m.                                                      |
| Multifunctional metal servo bracket                   |             4 | Purchased bracket, even though a STEP representation is available.                                                                                         |
| Metal servo horn                                      | 2 represented | **BOM requires four.** The two unplaced horns remain an unresolved source discrepancy.                                                                     |
| M10 MS5837-30BA pressure/depth sensor                 |             4 | Purchased sensor/adapter-board kits, stainless 10 m variant per BOM; source requests 60 cm cables. These are distinct from the four printed sensor mounts. |
| Pressure-cabin tube/flange                            |             1 | Part of the same enclosure kit as the next row.                                                                                                            |
| Hemispherical dome and pressure plate                 |             1 | **One enclosure kit total** includes tube/flange, dome and pressure plate; do not order two kits because CAD represents two units.                         |

The component and procurement BOMs use those real units and source quantities. A list of CAD bodies or one copy of every making file is not substituted for a purchase list. Supplier links are upstream references; current availability and equivalence were not established by importing their geometry.

## Selecting and reusing components

The assembly component tree selects and hides individual physical occurrences in the preview. **Open in library** opens the actual configured product, where it can be added independently to another project or exported as native CAD. **Back to assembly** returns to the vehicle. Adding the vehicle to a project expands its 50 physical occurrences while sharing repeated product configurations.

One original source occurrence mirrors the entire commercial QFS2025 servo, which cannot be a distinct real servo model. The library uses the same canonical servo with a proper shaft/mount placement instead, and records that source discrepancy. It does not invent a mirrored commercial SKU or claim an exact source-shape fit for that occurrence. The other repeated purchased components retain rigid source fits.

## Workshop equipment

FinsROV does not require every machine in the requested equipment list. Its source-supported work is:

| Equipment           | Live FinsROV work                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3D printer          | **Four pressure-sensor brackets only.** No servo, motor, complete thruster, sensor or pressure-cabin STL fabrication.                                              |
| Lathe               | **Twelve aluminium cable-passing screws**, with the source bore/thread and sealing features completed by suitable subsequent operations.                           |
| Mill                | Front mount ×1, rear hatch ×1, thruster mounts ×4 and horizontal thruster brackets ×4. Preserve actual interfaces and source poses.                                |
| Drill / drill press | Hole finishing, drilling and tapping on the manufactured parts according to the source machining definitions. Do not treat purchased equipment as stock to modify. |
| Laser cutter        | **No live FinsROV laser-cut fabrication set.** LoCO's original MDF DXFs remain research links below, not live download files for this assembly.                    |

## What still prevents production release

The external mechanical assembly is useful for fitting its real components, but it is not a ready-to-swim vehicle or a complete released manufacturing package. The following source gaps remain explicit release issues:

- CAD places two separate servo horns, whereas the BOM calls for four. The missing two placements are not invented.
- BOM row 14 calls for a printed internal cabin carrier. It is absent from the external configuration and is not one of the six qualified fabrication definitions. The separate in-cabin layout must be reconciled with a suitable making source.
- Electronics, camera, cables and connectors, seals and standard external assembly fasteners are not all modeled in the external CAD. Their upstream BOM requirements remain part of the build rather than disappearing because geometry is absent.
- The BOM lists twelve O-rings with **12 mm outside diameter × 1.5 mm cross-section**; these are not separate named occurrences in the external CAD. Reconcile them and the enclosure vendor's included seals with the actual kit.
- Screw quantities are explicitly approximate in the upstream BOM. Material/grade, thread engagement, fastening details and the actual kit contents still need verification.
- The source does not specify one exact camera model or complete the electrical commissioning of a newly assembled unit. Match the control software, wiring, power and purchased modules before operation.
- Alloy/temper, fits, sealing surface finish, complete manufacturing tolerances and acceptance tests remain unresolved for newly fabricated pressure-related parts.

These issues prevent production release; displaying the original assembly does not waive them. ProtoLab has not fabricated, leak-tested, pressure-tested or operated this vehicle. Upstream demonstrations establish what the authors built, not the operating depth or functionality of another build.

## FinsROV primary sources

Reviewed revision: `1bc38e83d8af669339c7a86f0a14e2180676347f`.

- [Project overview and demonstration links](https://github.com/IWIN-FINS/FinsROV-An-Underwater-Camera-Based-Multi-Robot-Platform/tree/1bc38e83d8af669339c7a86f0a14e2180676347f)
- [Original English configuration assembly](https://github.com/IWIN-FINS/FinsROV-An-Underwater-Camera-Based-Multi-Robot-Platform/blob/1bc38e83d8af669339c7a86f0a14e2180676347f/Structure/En/Configuration.STEP)
- [Actual vehicle BOM workbook](https://github.com/IWIN-FINS/FinsROV-An-Underwater-Camera-Based-Multi-Robot-Platform/blob/1bc38e83d8af669339c7a86f0a14e2180676347f/Structure/En/BOM.xlsx)
- [Five machining files and CNC workbook](https://github.com/IWIN-FINS/FinsROV-An-Underwater-Camera-Based-Multi-Robot-Platform/tree/1bc38e83d8af669339c7a86f0a14e2180676347f/Structure/En/CNC_Machining)
- [Printable pressure-sensor mount](https://github.com/IWIN-FINS/FinsROV-An-Underwater-Camera-Based-Multi-Robot-Platform/blob/1bc38e83d8af669339c7a86f0a14e2180676347f/Structure/En/3DPrinting/Pressure_Sensor_Mount.STEP)
- [In-cabin layout for separate reconciliation](https://github.com/IWIN-FINS/FinsROV-An-Underwater-Camera-Based-Multi-Robot-Platform/blob/1bc38e83d8af669339c7a86f0a14e2180676347f/Structure/En/In-cabin_Layout.STEP)
- [Making and wiring instructions](https://github.com/IWIN-FINS/FinsROV-An-Underwater-Camera-Based-Multi-Robot-Platform/tree/1bc38e83d8af669339c7a86f0a14e2180676347f/Making_Instructions)
- [Lower-level controller and its separate license](https://github.com/IWIN-FINS/FinsROV-An-Underwater-Camera-Based-Multi-Robot-Platform/tree/1bc38e83d8af669339c7a86f0a14e2180676347f/Code/Lower_Level_Controller), [joystick host software](https://github.com/IWIN-FINS/FinsROV-An-Underwater-Camera-Based-Multi-Robot-Platform/tree/1bc38e83d8af669339c7a86f0a14e2180676347f/Code/Joystick_Control)
- [Repository MIT license](https://github.com/IWIN-FINS/FinsROV-An-Underwater-Camera-Based-Multi-Robot-Platform/blob/1bc38e83d8af669339c7a86f0a14e2180676347f/LICENSE)

The README also displays a CC BY-SA badge without defining its scope. Preserve the repository MIT notice and source-specific notices rather than inventing a license split from that badge. Separate control-software and vendor-design terms still apply.

## Other researched projects — not live configured builds

These references remain useful for selecting a future project. They are not additional functional assemblies in the live catalog, and their downloaded geometry does not receive a manufacturing route merely because it resembles a component.

| Project and reviewed revision                                                                                                | Hardware terms                                                                                                                                               | Useful source work                                                                                                          | Why it is outside the live build catalog                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Schillaci underwater-drone](https://github.com/guidoschillaci/underwater-drone), `58bb0924d71339ecc236e57adc1b10fc3e7e7346` | [CC BY 4.0, explicitly applied to work and models](https://github.com/guidoschillaci/underwater-drone/blob/58bb0924d71339ecc236e57adc1b10fc3e7e7346/License) | Modular printed mechanical concept for a purchased 4-inch BlueRobotics enclosure; original STL, STEP and IGES files.        | Critical source parts fail the checked closed/valid-solid conversion, and the repository lacks a complete matched vehicle BOM, wiring and control-software release. A partial collection of clamps/adapters is not a configured build.                                                           |
| [MUR](https://github.com/scottmayberry/MUR), `26ac420d6f0be5e7dbd0a6079ec1121bbef32dee`                                      | [Project hardware CERN-OHL-P-2.0; other items MIT](https://github.com/scottmayberry/MUR/blob/26ac420d6f0be5e7dbd0a6079ec1121bbef32dee/LICENSE.md)            | Documented research vehicle with printed structures, a hardware BOM, custom electronics, assembly videos, firmware and ROS. | Its complete SolidWorks vehicle structure and chosen hardware revision have not been turned into a matched local physical assembly and make-or-buy BOM. One inspected battery-ring STL is open; vendor cap/transducer representations are purchasing references.                                 |
| [LoCO AUV](https://github.com/LoCO-AUV/loco_config), `cf30cb1b4c875db19aa9e471c4fdbc30f248cd88`                              | [Design CC BY-SA 4.0](https://github.com/LoCO-AUV/loco_config/blob/cf30cb1b4c875db19aa9e471c4fdbc30f248cd88/LICENSE_SHAREALIKE); code GPLv3                  | Research AUV with documented tethered control, alternative printed structures and original laser-cut internal MDF bases.    | Alternative structural revisions are not one matched build; several inspected mounts have unresolved STL units and the T-bar needs source review. The linked external parts spreadsheet could not be verified at the checkpoint. No complete local LoCO assembly or procurement BOM is released. |

### Source and build links for the references

**Schillaci:** [instructions and source models](https://github.com/guidoschillaci/underwater-drone/tree/58bb0924d71339ecc236e57adc1b10fc3e7e7346), [authors' publication](https://arxiv.org/abs/1707.06564). The authors are Fabio Schillaci and Guido Schillaci. The thruster structure targets Turnigy Aerodrive DST-700/DST-1200 and is explicitly incompatible with BlueRobotics M100/M200. The reported shallow-water prototype does not make the inspected incomplete source set ready for printing or operation.

**MUR:** [CAD](https://github.com/scottmayberry/MUR/tree/26ac420d6f0be5e7dbd0a6079ec1121bbef32dee/hardware/CAD), [BOM](https://github.com/scottmayberry/MUR/blob/26ac420d6f0be5e7dbd0a6079ec1121bbef32dee/hardware/BOM/MUR_BOM.xlsx), [assembly videos and instructions](https://github.com/scottmayberry/MUR/tree/26ac420d6f0be5e7dbd0a6079ec1121bbef32dee/hardware/Assembly), [PCB production sources](https://github.com/scottmayberry/MUR/tree/26ac420d6f0be5e7dbd0a6079ec1121bbef32dee/hardware/PCBs), [firmware](https://github.com/scottmayberry/MUR/tree/26ac420d6f0be5e7dbd0a6079ec1121bbef32dee/hardware/firmware), [host software](https://github.com/scottmayberry/MUR/tree/26ac420d6f0be5e7dbd0a6079ec1121bbef32dee/software). Its functional project documentation is stronger than a printable-shell repository, but integrating that complete source is separate work from importing a handful of STL files.

**LoCO:** [documentation and assembly index](https://github.com/LoCO-AUV/loco_config/wiki), [original left-base DXF](https://github.com/LoCO-AUV/loco_config/blob/cf30cb1b4c875db19aa9e471c4fdbc30f248cd88/models/LaserCut/MDFBaseLeft.DXF), [original right-base DXF](https://github.com/LoCO-AUV/loco_config/blob/cf30cb1b4c875db19aa9e471c4fdbc30f248cd88/models/LaserCut/MDFBaseRight.DXF), [fabrication instructions](https://github.com/LoCO-AUV/loco_config/wiki/Fabricating-Structures#laser-cut-parts), [internal alternatives](https://github.com/LoCO-AUV/loco_config/wiki/Fabricating-Internal-Structures), [external alternatives](https://github.com/LoCO-AUV/loco_config/wiki/Fabricating-External-Structures), [networking and tether](https://github.com/LoCO-AUV/loco_config/wiki/Networking-Assembly-and-Tether). The original laser route uses **6.35 mm (1/4-inch) MDF inside the dry compartments**, with separate chamfering, drilling and counterboring operations. Those DXFs are research links, not live FinsROV fabrication downloads. The [upstream-linked parts spreadsheet](https://docs.google.com/spreadsheets/d/11RAL1izb-2vowIL02kaq4gF_TOTkj6Aj5-3dBDbLE1U/edit?usp=sharing) returned HTTP 410 during review; its contents are not a verified local BOM.

## Projects excluded by reuse terms

**CPS5** remains a useful reference for the requested style. Its [official course terms](https://course.cpsdrone.com/pages/terms) restrict redistribution of course models, schematics and instructions. The [public CPS repository](https://github.com/CPSdrone/CPS) does not establish a redistribution grant for the complete mechanical kit. No restricted course assets are included.

**OpenROV 2.8** publishes [mechanical CAD](https://github.com/OpenROV/openrov-hardware/tree/master/CAD_Files_OpenROV_v2_8), including laser-cut structures, but its [hardware notice](https://github.com/OpenROV/openrov-hardware) applies **CC BY-NC-SA 4.0**. Its noncommercial restriction keeps it outside this unrestricted hardware selection. Upstream also warns that DXFs can require laser-specific adjustments.

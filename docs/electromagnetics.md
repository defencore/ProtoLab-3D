# Electromagnets and solenoids

Three independent packages appear in the **ELECTROMAGNETICS** category. Search for their English names, **електромагніт**, **соленоїд**, **электромагнит** or **соленоид**, or choose the corresponding subgroup. All **16 presets** are complete editable prototype examples; none claims a manufacturer, catalog source or electrical rating.

| Component             | Subgroup       | Presets | States                                        |
| --------------------- | -------------- | ------: | --------------------------------------------- |
| Holding electromagnet | ELECTROMAGNETS |       5 | Magnet only, With armature, Exploded armature |
| Tubular solenoid      | SOLENOIDS      |       6 | Retracted, Extended, Exploded                 |
| Open-frame solenoid   | SOLENOIDS      |       5 | Extended, Retracted, Exploded, Frame only     |

## Adjustable geometry

**Holding electromagnet** models a round steel pot with a connected back plate and central pole, a distinct annular potted coil, and a smooth blind mounting bore opening at the rear. Set the outside diameter, height, wall and back thicknesses, pole diameter, coil clearance and recess, mounting bore, armature dimensions and working air gap. Optional paired rear leads pass through real clearance ports; disabling them hides their size controls and removes the ports. The five examples span 20–100 mm cup diameters.

The rear mounting face is Z=0 and the working pole faces are Z=`bodyHeight`. `magnet-only` leaves these faces visible. `assembled` adds the keeper plate at the configured air gap. `exploded` lifts that plate by a further 0.8 × cup height. Leads, when enabled, extend behind the rear datum. The steel cup, coil, plate and two leads remain separate components.

**Tubular solenoid** offers pull action with a front output rod or push action with a rear output rod. Edit the housing diameter and length, walls and end plates, armature and rod dimensions, stroke, retracted protrusion, guide wall and running clearance. Optional insulated terminals expose their diameter, length and spacing controls. The six examples include both actions and versions with and without terminals.

The housing is centered at the origin with its axis along Z. `retracted` and `extended` describe the output rod: its extended protrusion is retracted protrusion plus stroke. Only the single armature/rod component moves between these states, by exactly the configured stroke. `exploded` separates the retracted components along X while retaining the housing datum. The housing, rear pole, front plate, guide, coil and moving armature are independent; enabled terminals add two insulating sleeves and two copper pins.

**Open-frame solenoid** contains a connected steel C-frame with two or four rear mounting holes, a bobbin, winding envelope, guide sleeve, fixed pole and moving plunger. Edit frame dimensions, coil and guide space, pole and plunger dimensions, residual pole gap, stroke and mounting pitches. Enabling the push rod exposes its diameter and extension; selecting four mounting holes exposes the transverse pitch. Examples cover compact, standard, long-stroke, push-rod and four-hole arrangements.

Its axis follows +Z from a stationary frame datum at Z=0, with the rear web at negative Y. The fixed-pole shoulder extends below the datum by one frame-wall thickness. `extended` and `retracted` move only the plunger, including an enabled push rod, by the configured stroke. `exploded` separates the six physical components for inspection; `body` exports only the frame.

Relational validation checks coil space, positive walls, bore clearance, mounting-hole placement and motion limits in addition to numeric field bounds. Solenoid travel must retain guide engagement and internal clearance. Hidden option values remain part of each saved configuration. The displayed dimensions include visible rods, leads, terminals and exploded offsets.

## Export scope

The selected state is used by the preview, STL and FreeCAD macro. **Copy Python** or a downloaded macro creates independently selectable component features under a FreeCAD assembly; the frame-only state produces one body. Preview and native shapes share package-local geometric definitions, with corresponding component order, labels and colors. See the [assembly export guide](freecad-assemblies.md) for editing component placement and exporting STEP or saving FCStd.

Coils are solid winding or potting envelopes, without individual turns or an electrical circuit. Lead and terminal geometry represents connection envelopes. The holding magnet's mounting bore is smooth and unthreaded. These models do not include return springs or magnetic, force, current, voltage, thermal or duty-cycle calculations. State selection specifies geometric placement; it does not simulate energization. Manufacturing tolerances and omitted fastening details must be established for the intended design.

FreeCAD exports are static solids with configuration metadata, rather than live parametric features or constrained motion assemblies. Change dimensions in ProtoLab and regenerate the model. STL contains the tessellated component shells and does not retain editable CAD bodies or assembly metadata.

## Verification

The focused geometry tests cover discoverability, complete prototype presets, all defaults and states, finite closed outward meshes, expected dimensions, independent plunger travel, component labels and rejected impossible configurations.

```sh
npm run parts:check -- holding-electromagnet
npm run parts:check -- tubular-solenoid
npm run parts:check -- open-frame-solenoid
npm run typecheck:tests
node --import tsx --test tests/electromagnetics.test.ts
npm run build
```

The recorded native audit (generated local report) passed **63/63 cases** in FreeCAD **1.0.2** on **2026-09-14**. It covers defaults and every preset in every state: 18 holding electromagnet cases, 21 tubular solenoid cases and 24 open-frame solenoid cases.

- All **378 component instances** are valid, closed and contain exactly one positive-volume solid.
- Component envelopes and volumes agree with the preview. The maximum coordinate discrepancy is **0.000201 mm** when rounded upward; the maximum relative volume discrepancy is **0.1614%** when rounded upward. The assertions allow less than 0.05 mm and 1.5%, respectively.
- All cases pass pairwise interference checks, allowing only numerical volume noise up to the greater of 0.000001 mm³ or one millionth of the smaller component's volume.
- Independent component movement passes in all **57 assembly cases**; the six frame-only cases have no separate component to move.
- **63 STEP export/reload** and **63 FCStd save/reopen** checks preserve component counts and valid solids. STEP also preserves total volume; FCStd preserves component labels. Every macro preserves an existing document object and its own configuration metadata.

Repeat the native audit after generating fresh cases from the current packages:

```sh
npm run parts:sync
node --import tsx scripts/verify-electromagnetics.ts /tmp/protolab-electromagnetics-cases.json
/Applications/FreeCAD.app/Contents/Resources/bin/python scripts/verify-electromagnetics.py /tmp/protolab-electromagnetics-cases.json /tmp/protolab-electromagnetics-results.json
```

Use a FreeCAD-enabled Python on other platforms; `FREECAD_LIB` overrides the Python module search path. The audit runs macros in temporary documents and uses temporary STEP and FCStd files. Its JSON output includes each generated script's SHA-256 digest, result, component count and maximum comparison errors. Native checks establish valid prototype geometry and interchange behavior, and require a local FreeCAD installation; the browser and normal test/build commands do not.

## Independent packages

Each package owns its parameters, presets, geometry and validation. Its README gives the component contract and editing entry points:

- [Holding electromagnet](../src/parts/holding-electromagnet/README.md)
- [Tubular solenoid](../src/parts/tubular-solenoid/README.md)
- [Open-frame solenoid](../src/parts/open-frame-solenoid/README.md)

Use the [part package workflow](part-modules.md) to export or import one complete module without coupling it to the other electromagnetic packages.

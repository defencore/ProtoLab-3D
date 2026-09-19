# BLDC motor

Fixed SunnySky X2204, X2212, X2814, X3520 V3, X4120 V3 and X5330 outrunners, plus Hobbywing XERUN 4268/4274 G3 sensored inrunners. Together with the drone families below, the catalog contains 24 fixed variants spanning Ø10.5–87.1 mm and 100–23000 rpm/V. Select by application, manufacturer, diameter, body length, exposed shaft, KV, published current/power, mass and LiPo cell count.

The shaft-side face is Z=0 and output projects toward +Z. Outrunner mounting planes are at −bodyLength; rear pilots extend beyond that plane. Inrunner mounting planes are at Z=0. Body length excludes the pilot, output hardware, terminals and optional short leads. X2204 uses its drawing's 13 mm bare motor body plus a 7.5 mm prop-saver hub; the rear shaft extends 0.8 mm. Its Ø27 bell does not include the mounting ears.

Outrunners include a ventilated bell, mounting base, bearing, shaft, stator teeth, separate copper winding envelopes and rotor magnets. Hobbywing motors include a finned shell, both end covers and bearings, recessed screws, rotor, D-shaft, phase terminals and sensor socket. X2212/X2814 use opposed pairs on two different mounting diameters, not rectangular hole patterns. X5330 has eight mounting holes on two circles. Hobbywing uses alternating M3/M4 holes on a Ø25.4 mm circle.

External mounting dimensions come from supplier drawings. Undimensioned vents, cover thicknesses, fin spacing, internal clearances, magnet thickness, winding form, terminal and sensor socket details are visual reconstructions. Windings are solid envelopes, not individual wires. Threads use nominal cylindrical bores/envelopes; X5330's M8×1.25 shaft thread is not helical. Propeller adapters and separate cross mounts are not included, except X2204's prop-saver hub. These are native reconstructed CAD parts, not imported manufacturer STEP files.

SunnySky current limits retain their published 10/15/30-second duration; they are not continuous ratings. Hobbywing's missing maximum current/power are omitted. Hobbywing no-load test voltage is not supplied. Published power is not inferred from KV. The SunnySky X5330 product has an old `x3530` URL handle, but its page title and drawing identify X5330.

## Quadcopters and multirotors

Each family has two KV variants. Application labels help navigation; propeller compatibility depends on the full installation and operating point.

| Family                | KV variants  | Body Ø / overall axial envelope (mm) | Motor mounting interface    |
| --------------------- | ------------ | ------------------------------------ | --------------------------- |
| BETAFPV 0802SE (2022) | 19500, 23000 | 10.5 / 13.8                          | 3 × M1.4, Ø6.6 circle       |
| iFlight XING2 1404    | 3800, 4600   | 19.9 / 18.4                          | 4 × M2, 9 × 9 square        |
| iFlight XING2 2207    | 1855, 2755   | 29.08 / 32.6                         | 4 × M3, 16 × 16 square      |
| iFlight XING 2806.5   | 1300, 1800   | 35.06 / 36.8                         | 4 × M3, 19 × 19 square      |
| NIDICI 3115           | 900, 1250    | 36.85 / 46.8                         | 4 × M3, 19 × 19 square      |
| T-MOTOR MN4014        | 330, 400     | 44.7 / 42.9                          | 4 × M3, Ø25 + 3 × M2.5, Ø32 |
| T-MOTOR MN6007 II     | 160, 320     | 67.2 / 31.1                          | 4 × M4, Ø32; 9 mm deep      |
| T-MOTOR U8 Lite       | 100, 190     | 87.1 / 27.05                         | 4 × M4, Ø36                 |

Drone assemblies have lobed mounting plates for small FPV motors, ventilated bells, separate stator teeth, copper winding envelopes, rotor magnets, shafts and bearing/bushing envelopes. Slot/pole counts follow published configurations; the 0802SE internal layout is illustrative because its manufacturer does not specify it. Its support is modeled as a brass bushing. FPV output threads are nominal M5 cylinders. U8 Lite has a Ø29 × 3 mm propeller boss with four M4 holes on Ø23 and four M3 holes on Ø20; its published Ø15 mm dimension describes the **internal shaft**, so it is excluded from the exposed-shaft filter. MN6007 II retains twelve front M3 holes on Ø12/18/20, 7 mm deep, and a stepped Ø6 internal / Ø4 external shaft. MN4014 includes the 2.4 mm rear shaft projection.

XING2 1404's supplier publishes the overall Ø19.9 × 18.4 mm envelope but does not dimension the shaft in the referenced specification. Its reconstructed Ø1.5 × 4 mm shaft and 14.4 mm body split are assumptions, excluded from dimensional filters. Its undimensioned propeller screw pattern is omitted. Cover contours, internal dimensions not supplied by the manufacturer, vents, undimensioned mounting-hole depths and cable paths remain approximate for all models. Refer to the per-model notes before using the geometry as an installation drawing. No original manufacturer STEP is claimed.

BETAFPV current and power limits are unpublished and remain absent. iFlight/NIDICI peak ratings have no stated duration; T-MOTOR maximum current/power ratings retain the 180-second limit. XING 2806.5 and NIDICI 3115 list 24 V test input without an inferred LiPo cell range. KV is not torque, and no thrust or continuous-current rating is inferred. Source links and electrical conditions are displayed in the selected model's details.

## Package layout and checks

`lib/models.json` contains fixed source data; `presets.json` exposes read-only catalog attributes and conditions. `lib/model.ts` and its drone construction module `lib/drone.ts` produce the same component descriptions for Three.js and native FreeCAD via private `lib/shapes.ts` and `lib/assembly.ts`. Only model selection, geometric shaft angle and optional short leads are editable. Assembled and exploded states preserve component identities and colors.

Run `node --import tsx --test tests/motors.test.ts`, `npm run parts:check`, and `npm run typecheck:tests`. Generate native verification cases with `node --import tsx scripts/verify-motors.ts`, then run `scripts/verify-motors.py` using FreeCAD's Python. The audit checks valid closed individual solids, bounds/volume agreement, component intersections, independent movement, and STEP/FCStd round trips for every model, both states, and an additional 90° shaft pose with cables.

## Drawing copies

- SunnySky X2204 (original reference, not bundled)
- SunnySky X2212 (original reference, not bundled)
- SunnySky X2814 (original reference, not bundled)
- SunnySky X3520 V3 (original reference, not bundled)
- SunnySky X4120 V3 (original reference, not bundled)
- SunnySky X5330 (original reference, not bundled)
- Hobbywing XERUN G3 manual (original reference, not bundled)

Manufacturer product URLs are recorded per model in `lib/models.json` and `presets.json`.

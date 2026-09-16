# Servo horns, gears and clevis ends

Servo arms and spline gears appear under **MOTORS & ACTUATORS → SERVOS**. Clevises appear beside rod ends under **TRANSMISSION & LINKAGES → JOINTS & ROD ENDS**. Each owns its configurator, source presets, geometry and FreeCAD recipe; no existing part package is imported or modified.

| Package      | Configurations                                                                                              | Presets                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `servo-arm`  | Single, double, cross, six-arm, disc; split clamping hub; separate perpendicular arm reach and hole pattern | 28 supplied references                         |
| `servo-gear` | Independent external teeth and servo spline; blind/through socket, retaining screw opening, optional hub    | 13 catalog sizes + 3 prototype examples        |
| `clevis`     | Pushrod set-screw fork, female threaded fork, male threaded fork, cable terminal                            | 10 supplied references + 14 prototype examples |

## Selecting a component

Use the inline catalog selectors to narrow known spline counts, horn form, outer gear teeth or clevis bore/pin dimensions. Only source-verified dimensions participate in catalog choices. Clear the size filters to see records without a known spline count. **Custom dimensions** exposes the full local schema. **Browse presets** provides all fields and ranges.

Horns and gears offer a **Spline socket side** view. Clevis assemblies offer **Assembled**, **Exploded** and **Fork body only** states. Removable clamp screws, clevis pins, nuts and set screws remain independently movable components in FreeCAD.

## Reference evidence

The supplied PNG files are preserved unchanged under `public/references/servo-*` and `public/references/clevis-*`. Presets distinguish explicit dimensions from assumptions through `catalog.verifiedParameters` and their descriptions. Color choices are not duplicated into separate dimensional presets.

- Horn references include the 58/36/30/42 mm nylon family, 28/47 mm aluminium arms, PDRS60 15T, the micro arm drawing, the inch cross, Q-XA15, 23T/24T/25T arm families, 4/5/6 mm socket families and the 52 mm clamping arm. Unspecified plate/hub dimensions and irregular hole patterns remain documented prototype assumptions. Cosmetic ribs and lightening pockets are omitted.
- The supplied gear drawings establish 17.6/25.6 mm OD, 6 mm width, 24T socket and a plain 3 mm retaining hole. [ServoCity's gear family](https://www.servocity.com/mod-0-8-pitch-servo-gears/) establishes 13 real C24T/H25T SKU combinations. The [20-tooth](https://www.servocity.com/2305-series-brass-mod-0-8-servo-gear-24-tooth-spline-20-tooth/) and [30-tooth](https://www.servocity.com/2305-series-brass-mod-0-8-servo-gear-24-tooth-spline-30-tooth/) pages confirm module 0.8 and 20 degree pressure angle. Socket major/minor diameters, depth and screw-head recess dimensions remain unverified.
- The pushrod clevis drawing establishes 25 mm length, 7 mm body diameter, 3 mm fork gap, 2 mm rod bore, an M2.5 pin screw and M3 set screws. Pin offset, fork depth and fastening clearance are editable assumptions. The cable listing verifies only bore choices of 1.5/2/3/4/5/6/8/10/12 mm. Threaded examples are not represented as a named standard.

Spline tooth count does not establish fit by itself: diameter and tooth profile also matter. The straight-flank internal serrations are prototype envelopes, consistent with [ServoCity's spline guidance](https://www.servocity.com/glossary). Small external pinions use radial root relief instead of reproducing manufacturer-specific undercut or profile shift.

## Verification and independent editing

```sh
npm run parts:check -- servo-arm
npm run parts:check -- servo-gear
npm run parts:check -- clevis
node --import tsx --test tests/servo-arm.test.ts tests/servo-gear.test.ts tests/clevis.test.ts
node --import tsx --test --test-name-pattern='Servo arm|Servo spline|Clevis' tests/parts.test.ts
npm run typecheck:tests
npm run build
```

The focused tests cover source parameters, closed outward meshes, actual holes, invalid dimensions and consistent model states. Native checks run complete exported macros in temporary FreeCAD documents, test independent component placement and round-trip representative assemblies through STEP and FCStd:

```sh
node --import tsx scripts/verify-servo-linkages.ts /tmp/protolab-servo-native.json
/Applications/FreeCAD.app/Contents/Resources/bin/python scripts/verify-servo-linkages.py /tmp/protolab-servo-native.json /tmp/protolab-servo-native-results.json
```

Use a FreeCAD-enabled Python on other platforms; `FREECAD_LIB` overrides the module path. The native audit is optional and does not add a FreeCAD requirement to GitHub Pages builds.

For a standalone developer handoff, use `npm run parts:export -- servo-arm /tmp/servo-arm-handoff`, or substitute either other package ID. Package imports update the generated registry without editing the application UI.

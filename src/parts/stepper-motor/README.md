# NEMA stepper motor

Fixed STEPPERONLINE motors: NEMA 8, 11, 14, 17 (short and standard), 23, 24, 34 and 42. Select by frame width, body length, shaft, mounting pitch, holding torque, phase current, mass, resistance and inductance. The catalog spans 20.3–110 mm frames and 0.012–30 N·m holding torque.

The mounting face is Z=0, the body extends toward −Z, and the output shaft toward +Z. Shaft extension includes the locating pilot. Drawing dimensions take precedence over rounded nominal product-page sizes. The NEMA 42 pilot really is Ø55.5 mm; it is not inferred from frame size. NEMA 8 is a six-wire unipolar model, the others are four-wire bipolar models.

The assembly contains a chamfered lamination stack, front flange and pilot, rear cover, recessed screws, bearing races, rotor and shaft. NEMA 34/42 have separate keys; other shafts have the drawn D-flat or round section. Mounting holes are nominal threaded bores or through clearances as specified by the source. Lamination grouping, cover outlines/thicknesses without dimensions, rotor and bearing internals, cable outlets and lead routing are approximate. Holding torque is a static rating at rated phase current, not available torque at arbitrary speed.

## Package layout and checks

`lib/models.json` contains fixed source data; `presets.json` exposes read-only catalog attributes and conditions. `lib/model.ts` produces the same component descriptions for Three.js and native FreeCAD via private `lib/shapes.ts` and `lib/assembly.ts`. Only model selection, geometric shaft angle and optional short leads are editable. Assembled and exploded states preserve component identities and colors.

Run `node --import tsx --test tests/motors.test.ts`, `npm run parts:check`, and `npm run typecheck:tests`. Generate native verification cases with `node --import tsx scripts/verify-motors.ts`, then run `scripts/verify-motors.py` using FreeCAD's Python. The audit checks valid closed individual solids, bounds/volume agreement, component intersections, independent movement, and STEP/FCStd round trips for every model, both states, and an additional 90° shaft pose with cables.

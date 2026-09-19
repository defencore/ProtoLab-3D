# Wing / canard / hydrofoil

**VEHICLE STRUCTURES → WINGS & CONTROL SURFACES** provides a general geometric lifting-surface builder. It creates wings, canards, fins, vertical rudders and hydrofoil concepts in the same package. The 11 presets are editable starting points, not supplier parts or validated flight/marine designs.

## Profiles

- NACA 0006, 0009, 0012, 0015 and 0018: symmetric four-digit sections.
- NACA 2412 and 4412: cambered four-digit sections.
- Custom NACA four-series: editable maximum camber, camber position and thickness/chord ratio.
- Double wedge: sharp leading/trailing edges and adjustable position of maximum thickness.
- Biconvex: two opposed circular arcs defined by thickness/chord ratio.

Root and tip can use different profiles, or the tip can follow the root. Corresponding normalized profile coordinates are blended along span. A transition between two named NACA sections is a geometric interpolation, not necessarily another named NACA section. NACA sections use the closed-edge coefficient −0.1036 in place of the original −0.1015. A positive trailing-edge thickness adds a linear thickness term; it is a modified profile, not an unchanged standard section.

Sources: [NASA OpenVSP profile descriptions](https://www.nasa.gov/reference/openvsp-cross-sections/) and [PDAS four-digit thickness equation](https://www.pdas.com/naca456thick4.html). Rounded NACA and sharp wedge/biconvex families cover common subsonic and supersonic geometric studies. Profile choice does not establish a usable Mach/Reynolds range, lifting capability or suitability in water.

## Planform and placement

Dimensions are millimetres; angles are degrees. The origin is the root quarter-chord point. X runs aft, Y along span, and Z upward. A single panel extends toward positive Y. A mirrored pair contains independently movable panels on both sides of Y=0, separated by the optional centre gap. The panel-span setting always refers to one panel, excluding that gap.

Set root/tip chords independently for rectangular or tapered panels. Cranked panels add a kink chord, span position and outer sweep angle; the kink station is included exactly even when it falls between regular span divisions. Elliptic taper uses `ct + (cr − ct) sqrt(1 − η²)` and retains a positive tip chord. A small positive tip can represent a truncated delta; zero-area pointed tips are not supported.

Sweep follows the quarter-chord line. Incidence rotates each profile about its quarter chord; positive values raise the leading edge. Tip twist is relative to the root and varies linearly along span. Dihedral offsets section centres by `span × tan(dihedral)` while retaining their chord planes. Vertical orientation rotates the complete surface 90° about X; it does not change the airfoil definition. Root/tip profile sample states show unrotated sections at the configurable sample depth.

## Geometry and export

`lib/profiles.ts` owns normalized section equations and common sampling. `lib/geometry.ts` owns span stations, loft correspondence, closed preview meshes and native FreeCAD recipes. Chord sampling concentrates points near the edges; wedge corners are always retained. Two pure wedge sections use only their defining corners. Cap triangulation restores collinear contour vertices so transitions from wedges to curved profiles remain watertight.

The browser and STL use triangulated surfaces between sampled stations. FreeCAD creates solid **ruled lofts of polygonal sections**; it does not reconstruct the part from STL. These are approximations of the analytic profiles and spanwise law. Increase chord/span divisions to refine them. The preview's triangles and CAD's ruled patches can differ slightly on twisted surfaces; the native audit checks their bounds and volume. Each panel becomes a separate component in an `App::Part`. Root and tip are capped; no root mount, spar, hinge, control-surface cutout or internal structure is implied.

This module supplies geometry, not lift/drag, stall, flutter, strength, cavitation or propulsion calculations. Materials, loads, manufacturing tolerances and operating conditions require separate engineering work. Neither a preset name nor a valid closed solid certifies suitability for service.

## Verification

```sh
npm run parts:check -- lifting-surface
npm run typecheck:tests
node --import tsx --test tests/lifting-surface.test.ts
node --import tsx --test --test-name-pattern='Wing / canard / hydrofoil' tests/parts.test.ts
node --import tsx scripts/verify-lifting-surfaces.ts /tmp/protolab-lifting-surfaces-cases.json
/Applications/FreeCAD.app/Contents/Resources/bin/python scripts/verify-lifting-surfaces.py /tmp/protolab-lifting-surfaces-cases.json /tmp/protolab-lifting-surfaces-results.json
```

The native audit covers all 11 presets in three states (33 cases): closed valid solids, preview/native agreement, component separation, independent movement, and STEP/FCStd round trips. Results are kept in `data/lifting-surfaces-native-validation.json`. The mesh tests also exercise mixed wedge/NACA sections, an off-grid kink, thin highly cambered sections, mirrored winding, and a finite trailing edge.

Export the complete isolated package with `npm run parts:export -- lifting-surface /tmp/lifting-surface-workbench`. All profile and geometry logic stays private to this folder; the only shared imports are the generic core SDK and Three.js.

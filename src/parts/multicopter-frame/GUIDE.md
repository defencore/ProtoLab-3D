# Multicopter frames and fabrication references

The runtime catalog is the package's local `presets.json`. After changing pinned source metadata,
refresh both frame catalogs offline with `node --import tsx scripts/sync-frame-presets.ts`.
Use `--check` to report stale snapshots without writing. Geometry and catalog IDs are preserved;
review generated source evidence before accepting an intentional metadata change.

Find **Vehicles > Multicopter frames**. The previous 21 generated frames were removed. Their CAD topology and DXF checks did not establish structural reliability. In particular, printed primary arms and tube saddles had no qualified material, joint-slip or fatigue data. They are no longer offered as fabrication starting points.

The SOURCE ONE preset instantiates the original **SOURCE ONE V5 IGES** at the pinned revision `07a8690c6bd73e1300197845eda2ebe547c3a158`. It contains 57 independent source solids. It retains the source lower clamp plate, main plate, keyed cross plate between the arm roots, four 6 mm arms, camera cheeks, standoffs, screws and press inserts. Arm sections and plate outlines are preserved. There is no arbitrary arm-length/thickness scaling and no PETG substitution for a structural carbon part. For SOURCE ONE, printing is limited to its source camera-mount accessory; COMET is a separate printed design.

The source licenses (GPL v3 for SOURCE projects and CERN-OHL-W v2 for COMET) and authorship are documented in [the source component notice](../multicopter-frame-component/lib/NOTICE.md). This is a source CAD reference for reproduction and analysis. It is not a claim that a locally made part has the original laminate, hardware, assembly quality or flight performance.

## What changed in the load path

The original arm roots sit **between two structural plates**, with a keyed cross plate that locates the roots. The imported source includes the corresponding fasteners and press inserts. The previous generic frame attached each root to one thin plate and used unqualified printed tube-end clamps. Those generated recipes are gone; they are not fallback options.

Use **Arm-root joint** to inspect the complete plate/arm/insert stack and **One arm** for the actual source arm. The **Multicopter frame component** member of the same library family exposes each physical part separately. The native FreeCAD export retains original BRep curves rather than faceted replacements. The browser mesh uses a 0.025 mm chord tolerance.

## Preliminary arm calculation

The load panel accepts actual total flying mass, maximum static thrust per motor, manoeuvre factor and an additional dynamic multiplier. Per-arm load is:

`F = max(maximum motor thrust, mass * 9.80665 * manoeuvre factor / motorCount) * dynamic multiplier`

The straight arm axis runs from the outer root bolt to the motor axis (91.534 mm in the source). A native CAD extraction samples 101 transverse sections, retaining their net widths and vertical bending inertias. Euler-Bernoulli integration estimates vertical tip deflection:

`deflection = F / E * integral((L - x)^2 / I(x), x = 0..L)`

The displayed local stress estimate is `max(F * (L - x) * thickness / (2 * I(x))) * local multiplier`. The root moment couple is `F * L / bolt spacing`; source root bolt spacing is approximately 7.425 mm. This is a demand on the joint, not its verified capacity.

The ideal fixed root omits body/joint compliance, so displayed tip deflection is not a conservative whole-frame deflection. The model also omits torsion, coupling, rotor reaction torque, vibration modes, impact, fatigue, inserts and laminate pull-through. The default 40 GPa flexural modulus and the local multiplier are explicitly assumptions. No material stress allowable is supplied by default, so no strength pass is assigned. Entering an allowable produces a conditional numerical ratio and never changes the overall status from **flight qualification pending**.

The estimated bare-frame mass uses native source volumes with assumed CFRP/aluminium/steel/polymer/pad densities. It is not a measured product mass. Material properties must describe the actual laminate and fibre direction; published data for another sheet is not automatically applicable.

## Six source designs

Choose **Source frame** or a starting configuration. Model changes load the frame-specific mass/thrust assumptions. Each model has a separate pinned CAD revision; dimensions and materials are not stretched or substituted.

| Model | Construction | Included CAD / hardware scope |
| --- | --- | --- |
| SOURCE ONE V5 | 6 mm replaceable arms, 2.5 mm lower clamp, keyed roots, camera cheeks | 57 source occurrences; corrected screw datums |
| SOURCE TWO V0.1 | 4 mm arms, 3 mm main plate, 2 mm root reinforcements, 25 mm standoffs | 30 frame occurrences; four overlapping camera/accessory alternatives omitted |
| SOURCE V V1 upgraded arms | Interlocking 2 mm carbon webs, perimeter webs and motor bridges; 30 mm standoffs | 18 closed source shells wrapped as solids; add the author's 24 M3 x 14 screws |
| SOURCE PODRACER V1, 5 inch | Four 5 mm arms, two 1.5 mm plates, nylon pod | Seven native solids; hardware is specified separately and absent from source CAD |
| COMET Y6 hexacopter | Three PC/CF arms, six motor-block halves, two printed core plates, three landing mounts and three printed legs | 17 source occurrences; six outward-facing motor interfaces at three coaxial stations; hardware/inserts omitted |
| SOURCE ONE V4 X8 LIFTER octocopter | Four 5 mm carbon arms, 3 mm lower motor covers, V4 core decks/cheeks | 23 native occurrences; eight motor interfaces at four coaxial stations; ten source standoffs, screws omitted |

The source PODRACER assembly is the four-arm 5 inch configuration. Do not mix its geometry with the separate two-arm/Y-arm or 4 inch drawings. The pod is nylon; carbon arms are not printable substitutions. SOURCE V sheets stand vertically in the assembly and are rotated flat only in **Sheet parts**.

**SOURCE V fit check:** native CAD contains 20 small tab interferences, from 0.165 to 0.560 mm3. These are explicitly reported as pending stock/tool fit checks. They are not silently removed or described as clearance fits. Cut a fit coupon and resolve the tab/slot allowance before fabrication; native export preserves the source geometry.

Load demand is reported for all designs. Only SOURCE ONE has the preliminary single-arm compliance screen described above. Other topologies explicitly report no stiffness/stress model; they do not inherit its calculation. Estimated mass covers included source CAD only, with assumed densities. Missing hardware must be added before comparing a complete frame mass.

## Coaxial Y6 and X8

These are six- and eight-motor configurations on three and four arms respectively. They are explicitly labelled **Y6 coaxial** and **X8 coaxial**; neither is a flat six/eight-arm radial frame. SOURCE ONE X8 uses V4 donor parts. Do not mix V5 decks or interfaces into it.

COMET publishes individual source parts and a build manual but no completed assembly file at the pinned revision. ProtoLab reconstructs rigid assembly poses from native 35 mm root-hole pairs, the motor-block split plane and the manual. Its front root pairs differ from the rear pair; no generic 120-degree arm array is used. Native audit checks all 17 solids for collisions and each of the six shaft openings. **Printed parts** restores native printing orientations. Use the author PC/CF profile; solid CAD does not specify 100% print infill. Motor hardware uses the author 2004/12 mm mounting circle and M2 fasteners; check actual screw winding clearance.

X8 retains the full original STEP assembly. Its cutting layout contains 13 sheet occurrences with CAD stock thicknesses. Two V4 camera-cheek tabs have nominal source interferences of 0.660 and 0.017 mm3 with the lower deck; resolve the slot/tool allowance before cutting. The author conversion bill lists eight covers while the STEP contains four lower covers plus a root clamp. Both quantities are reported with their origins; reconcile the build before procurement. This discrepancy is not silently resolved by inventing more occurrences.

Per-motor demand uses 6 or 8 in the weight-share denominator. Demand at an arm station is twice per-motor demand. Neither topology inherits the SOURCE ONE single-arm stiffness screen. Thrust/weight is the sum of isolated thrust inputs; installed coaxial wake losses and motor-out control are unresolved.

Motor faces are Z=18.4/-0.4 mm for COMET and Z=6/-2 mm for X8. Propeller offsets are equal and point outward. The full axial swept envelope includes blade thickness and flex; its clearance between paired rotors must be at least 5 mm. Lateral disc spacing is checked between distinct XY stations, avoiding a false zero-spacing rejection of coaxial pairs.

PODRACER mounting remains at its native assembly datum: the four pod bores at (+/-24,0)/(0,+/-24) line up with the upper plate, and all four feet bear at Z=1.5 mm. The rear accessory extension intentionally overhangs the plate. Native checks include a clear pin through each bore, bearing contact and absence of penetration.

## SOURCE ONE screw seating correction

This build takes **2.5 mm from the native lower plate** as its stock datum. Twelve underside screws in the source IGES had their bearing planes at -2 mm, penetrating that plate by 0.5 mm. They are translated down 0.5 mm. Two front top-deck screws had a 2 mm air gap; they are translated down 2 mm. All source component shapes, shaft lengths, arm roots and plate contours remain unchanged. The frame assembly placement and all inspection/export states use the same correction.

Button heads still extend below their bearing face. Four long inner root screws also retain the source extension above the inserts for the equipment stack. These are separate from an incorrectly seated head; verify the final stack hardware and engagement. A flush underside would require a countersunk fastener and matching plate design, which is not silently substituted here.

## Manufacturing files

**CAD-matched cutting layout** contains one outline for every carbon occurrence, flattened into millimetres and labelled with its CAD stock thickness. SOURCE ONE lower-plate labels now say **2.5 mm**. Native circles/arcs remain analytic; other source curves use a 0.005 mm chord approximation. For exact CAM, export the native sheet components to STEP. Countersinks remain a separate finishing operation; use the 3D part to set depth/diameter.

**Original V5 drawing reference** is retained separately for provenance: its upstream filename still says 2 mm. It is not the manufacturing layout for this 2.5 mm build. The local change is documented rather than presented as an upstream revision.

**Load case and assembly checks** exports load inputs, available calculations, source revision and hardware/assembly notes. **Parts and hardware requirements** lists native occurrences, volumes, corrected assembly Z and the author's hardware requirements. Reconcile bought hardware, stock and manufacturing tolerances before release.

## Required physical evidence

Before describing a reproduction as flight ready, resolve laminate flexural/bearing/pull-through allowables, hardware grades, preload retention, arm-root slip and insert retention. Apply the calculated arm load on a fixture with the actual motor mount, measure tip motion and permanent set, and inspect the root and laminate after unloading. Whole-frame torsion, vibration and repeated-load tests must use the final motors, props, battery and all-up mass. These tests are not represented by successful CAD, mesh, file-import or beam-calculation tests.

## Sources

- [Pinned SOURCE ONE V5 files](https://github.com/tbs-trappy/source_one/tree/07a8690c6bd73e1300197845eda2ebe547c3a158): actual native source geometry and original cutting drawings.
- [SOURCE TWO source and hardware](https://github.com/ps915/source_two/tree/010ade994a150b2971123d6e0a141ed6f69c57fe).
- [SOURCE V source and hardware](https://github.com/ps915/source_v/tree/ce54d3bae424068fa7f870cb010af86248fa489b).
- [COMET Y6 source, print profiles and build manual](https://github.com/uastw-embsys/comet/tree/9837b8dc6f6ddd623634a82f7f9fa2ca6588c662).
- [SOURCE ONE V4 X8 source and conversion bill](https://github.com/shnllsfpv/source_one_X8_lifter/tree/96382c5c8646e8c706dee6a28d13e33177b05b36).
- [PODRACER source and hardware](https://github.com/ps915/source_podracer/tree/9b2d56d92c26a42d8d5cbb88507788389db0317c).
- [Official V5 6 mm spare arms](https://www.team-blacksheep.com/products/product%3A6180): source product context, not local-material certification.
- [Laminate-specific example data](https://media.easycomposites.co.uk/datasheets/EC-TDS-High-Strength-Carbon-Sheet.pdf): illustrates that properties depend on sheet construction/direction; its values are not assigned to the upstream frame.

`tests/multicopter-loads.test.ts` compares the numerical integration with a closed-form beam and checks scaling/absence of flight approval. Source geometry tests check component identities, original placement and preview bounds. The native audit compares exported solids to upstream CAD and checks structural contacts separately from source hardware contacts. None of those checks is a flight test.

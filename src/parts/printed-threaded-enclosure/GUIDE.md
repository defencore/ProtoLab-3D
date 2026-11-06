# Printed screw-cap enclosure

## Required function and acceptance criteria

`printed-threaded-enclosure` is a complete empty can and screw-on lid, intended as a reusable enclosure-joint example. Examples `can-36-p3` and `can-48-p4` are authored dimensions, not supplier products. Each is assembled from two separately registered `printed-threaded-shell` configurations with stable occurrences `body` and `cap`; matching example references are retained in `presetId`. No physical reference-only thread tool is hidden in the assembly.

The function is to contain an unspecified volume and retain a removable lid through a real coarse helical interlock. The user supplied no equipment dimensions, working loads, pressure, temperature, material grade, print accuracy or service-life target. Those remain unresolved requirements. Acceptance for this library example is positive floors/walls and an open usable cavity; two individually printable single-solid parts; actual helical geometry in STL and native CAD; a continuous paired rotation/translation path; blocked axial extraction while engaged; a planar shoulder stop and positive neck-to-roof gap; and unchanged physical definitions in inspection poses.

## TRIZ decision and alternatives

The baseline is an overlapping lid retained by separate screws. The ideal final result is for the surrounding printed material to provide reversible retention without additional hardware. More engagement improves geometric retention but increases turns, friction and occupied envelope. Smaller clearance improves guidance but increases sensitivity to printer error and distortion. The available resources are circumferential space, axial opening travel, integral polymer and the existing exact native thread kernel.

Separate the locating/retaining thread from the planar axial stop; allow reversible helical motion during service and geometric capture under straight pull. A rim alone offers easy access but no retention. A bayonet needs less rotation but leaves discrete lugs and rotational unlocking unrestrained. A captive metal screw/nut offers a more durable small thread but adds hardware and assembly operations. The coarse printed pair is selected for a hardware-free example with an explicit measurable motion relation. No novelty or verified contradiction-matrix entry is claimed. Method references are the [TRIZ Body of Knowledge](https://www.aitriz.org/triz/triz-body-of-knowledge) and [MATRIZ terminology](https://wiki.matriz.org/docs/triz/glossary-6146/).

## Datums, motion and load path

The body rests on its external floor at Z=0. The threaded neck begins at `height-threadLength`; the cap's canonical opening plane is placed at this same Z. At zero relative angle the threads share their nominal phase and the cap's lower annulus bears on the body's planar shoulder. Its roof lies `roofGap` above the neck tip. The shoulder is the axial closure datum; the roof must not bottom on the neck.

The single-start thread is right-handed. Seen from above, unscrew counterclockwise: a positive rotation `theta` degrees requires simultaneous positive axial translation `pitch*theta/360`. In local cylindrical coordinates the profile phase is `z/pitch-angle/(2*pi)`, so this paired motion leaves the mating phase invariant. The female tool has a positive radial allowance, with greater root clearance resulting from its shallower reference depth. Pure axial pull is intentionally blocked while the flanks overlap. After lifting beyond the entire neck length, the lid can be removed axially. No rotation detent, vibration lock or self-locking torque is assumed.

The nominal retention load path runs through the engaged printed flanks into the can neck/wall and the cap wall. Closing load runs through the planar shoulder. The strength of these paths, thread-root stress, tightening torque, elastic deformation, layer adhesion and creep are not established by geometric engagement. A finished application must define and check them.

## Manufacturing and inspection states

The assembled, exploded and print states use the same local component definitions and quantities. Exploded is an inspection separation rather than an elastic or screw-motion simulation. For 3D printing the body floor remains down and the cap is turned over, its closed roof on Z=0 and opening upward; parts are separated by 8 mm. Actual functional helices remain in Simple/Full preview, STL and native export. Review overhangs and any support-removal access in the slicer, and print measured matching samples before a full-size container.

The enclosure is intentionally empty. Internal equipment, connectors, cable bends, board mounts, ventilation, heat paths and sealing interfaces have not been designed. There is no gasket, fluid-contact qualification, pressure or ingress rating. Printed layers and an overlapping thread do not establish sealing.

## Source basis, verification and unresolved evidence

[Formlabs, printed threads and inserts](https://formlabs.com/blog/adding-screw-threads-3d-printed-parts/), reviewed 2026-10-31, informs the choice of a comparatively large printed thread and the need to consider material, wear and manufacturing method. [Protolabs Network enclosure design guidance](https://www.hubs.com/knowledge-base/enclosure-design-3d-printing-step-step-guide/) supports component layout before enclosure release and printer-dependent tolerances. Neither source establishes these authored sample sizes or a universally correct clearance.

Focused tests cover shell meshes, actual thread retention in Simple exports, analytical phase/allowance, canonical component identity and print layout. `npm run parts:check -- printed-threaded-shell` and `npm run parts:check -- printed-threaded-enclosure` cover package contracts. Integrated native checks must execute the production macro, inspect valid solids, test intermediate helical poses and axial blocking, measure the roof/shoulder relationship, and compare STEP/FCStd geometry and identity. Reports/exports belong under ignored `test-results/`.

Author-run FreeCAD 1.1.4 smoke checks on 2026-10-31 passed both assembled examples: two valid single solids, zero assembled intersection and zero intersection at 49 paired screw-motion samples per example. Four standalone shell examples had mesh/native volume differences below 0.041%. The author-run smoke did not replace the independent integrated STEP/FCStd, axial-capture and clearance checks; its evidence is under `test-results/threaded-shell-audit/`.

Independent integrated verification on 2026-10-31 passed 12 FreeCAD cases covering both examples and minimum/maximum female clearances in all three states. Both components remained valid single solids; actual mesh/native volume difference stayed below 0.041%. Each assembled case passed 49 helical removal positions and blocked direct axial withdrawal. Bed contact, dimensions and STEP/FCStd geometry/identity checks passed. Helical STEP refitting can change scalar volume integration by a few parts in ten million while preserving geometry: the runner permits a relative drift below one part in a million only after bidirectional solid-difference checks and strict optimal bounds. Ordinary geometry and FCStd retain the stricter volume check. Reports record those equivalence metrics under `test-results/printed-enclosures/native-report.json`; reproduce with `scripts/verify-printed-enclosures.ts` and `.py`.

Actual printed fits, operating torque, strength, wear, creep, fatigue, vibration and environmental suitability remain unverified until tested for a specified application.

# Printed bayonet enclosure

## Function, requirements and scope

An empty round can and removable cap demonstrate an integral short-turn bayonet closure. Presets are authored printable templates, not purchased products or dimensioned replicas. The body and lid are two separate `manufactured-detail` configurations with occurrence IDs `body` and `lid`; the family ID is `printed-bayonet-enclosure`. Example IDs are `three-lug-54`, `two-lug-42` and `four-lug-72`.

Required behavior is axial insertion at aligned entries, rotation into an axially captured position, and reversible removal. Acceptance criteria are two valid connected solids, positive floor and wall thickness, explicit three-direction fit allowances, no nominal interference throughout insertion/turning, a positive axial capture and angular end stop, separate flat print poses, and matching preview/native geometry and configuration identity. Application contents, loads, polymer, temperature, print accuracy, service life and sealing requirements are unspecified. This is a shell template: lay out real boards, batteries, connectors, mating plugs, cable paths and supports before finalizing an application.

## TRIZ decision and alternatives

The baseline is a butt seam secured with screws. The ideal final result assigns locating and retention to the surrounding printed shell without added hardware. Increasing lug engagement improves geometric capture but consumes radial material and assembly clearance; tighter fits reduce play but worsen sensitivity to print error. Available resources are the circular neck, shell wall, insertion space and the user's turning motion. Separate neck guidance from lug retention, and separate axial insertion from circumferential locking in sequence. No numbered TRIZ principle or matrix entry is claimed.

A stepped lid has simpler printing but no integral retention. A threaded lid retains through multiple turns and needs a printable thread profile. A snap can close by pushing but adds beam strain and cycle uncertainty. The bayonet provides positive axial capture with a short manual turn and accessible reverse motion. It has no detent or anti-rotation device: reverse rotation can unlock it. End stops do not prevent that failure mode. There is no preload or sealing claim.

## Skeleton and interfaces

The body floor is on Z=0. With body radius `R`, wall `w`, height `H` and neck height `nh`, the shoulder is at `H-nh`, the neck outer radius is `R-w`, and the neck bore radius is `R-2w`. The lower body wall is consequently thicker than the neck. Lugs start one wall thickness above the neck shoulder, extend radially by `lugProjection`, and have the specified angular width and axial thickness. Each lug overlaps the neck by 0.2 mm to produce a connected solid.

The cap's local bottom is Z=0. Its canonical placement is Z=`H-nh+faceGap` and rotation `+turnAngle`. The cap bore radius is `neckRadius+clearance`. Channel roots extend to `neckRadius+lugProjection+clearance`; the remaining radial cap wall is exactly `wall`. The inner roof is `roofGap` above the body rim. The lid roof has its own thickness. Thus face and roof gaps have independent definitions and do not silently stand in for an axial stop.

Each cap entry is open through the skirt bottom. Its horizontal channel runs from local entry angle 0 to `-turnAngle`. A lid rotation of `+turnAngle` puts fixed body lugs at local `-turnAngle`, near the closed channel ends. Running gaps are `axialClearance` on both lug faces. Tangential allowance is converted to degrees by `tangentialClearance/neckRadius * 180/pi`, using the smallest lug radius. The same radial allowance applies at the neck/bore and lug-tip/channel-root interfaces. No allowance is a universal FDM tolerance.

Validation preserves positive cavity radius, lower body height, material below and above the lugs, radial capture beyond the bore and at least a 10-degree material bridge between neighboring channels. These are geometric sample rules, not calculated strength margins. Retention load flows from body lug faces into cap channel faces and through the cap wall; actual lug bending, channel bearing, cap splitting, layer adhesion, creep and wear must be checked for specified application loads.

## Assembly, service and printing

1. Align the cap entries with the body lugs (the **Entry aligned** view).
2. Lower the cap over the neck until the lugs reach the horizontal channels.
3. Rotate the cap in the positive Z rotation direction to its nominal locked position. Tangential running clearance places the actual hard stop at `turnAngle + angleGap`, slightly beyond this pose.
4. To remove, reverse that rotation to align the entries, then lift axially.

Maintain an unobstructed axial removal stroke at least the neck height and room to grip the cap around its full turn. The **Locked**, **Entry aligned**, **Exploded** and **For 3D printing** views keep the same two local fabrication recipes. The canonical project composition is locked; inspection views do not change installed placements or quantities.

Print the body floor down and the cap outer roof down. The print view flips the cap and separates it from the body by 8 mm on Z=0. Lug undersides and internal channel edges can require bridges or support. Review overhangs, support removal through the entries, perimeter continuity, first-layer expansion and any required local relief in the slicer. Do not label the sample support-free or watertight.

## Verification and remaining evidence

Native construction uses true cylinders, concentric circular arcs, extrusions and Boolean cuts. Browser tessellation is not converted into native CAD faces. The verification runner must inspect single-solid validity, analytic surface types and dimensions, all intermediate axial/rotational poses, blocked locked axial withdrawal, print-bed positions, and STEP/FCStd geometry and identity round trips. Generated exports and reports belong under ignored `test-results/printed-enclosures/`.

Integrated verification on 2026-10-31 passed 20 FreeCAD 1.1.4 cases: all three examples and minimum/maximum radial clearances in all four views. Each physical part remained one valid solid with true cylindrical surfaces. Every assembled case passed 41 axial entry samples, 73 intermediate locking angles, blocked axial withdrawal while locked, and an overrotation collision at the closed channel end. Print poses, matching dimensions, STEP geometry and FCStd geometry/identity round trips passed. Reproduce with `node --import tsx scripts/verify-printed-enclosures.ts` and `scripts/verify-printed-enclosures.py` using FreeCAD Python. These are sampled geometric checks, not a lug-strength or unlocking-torque test.

No prototype insertion force, retention strength, accidental unlocking torque, ingress, fatigue or cycle test has been performed. Actual contents and installation access remain application work. A separate anti-rotation feature and a designed gasket are required if those functions are specified.

## Sources

- [Protolabs Network enclosure design guide](https://www.hubs.com/knowledge-base/enclosure-design-3d-printing-step-step-guide/), checked 2026-10-31: component-first layout and enclosure mating-feature context, not dimensions for this authored bayonet.
- [TRIZ Body of Knowledge](https://www.aitriz.org/triz/triz-body-of-knowledge) and [MATRIZ terminology](https://wiki.matriz.org/docs/triz/glossary-6146/): qualitative method references.

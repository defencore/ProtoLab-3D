# TR8x8 staggered CNC four-drive block, diameter 56 mm

Separate experimental compact arrangement. It preserves the original 82 mm, 72 mm and new coplanar 64 mm versions. The shared public CNC family factory defines the geometry; this package gives the arrangement its own library identity and presets.

Two diameter 56 x 3 mm outer discs surround a one-piece CNC middle frame with a 5 mm base, four integral 6.5 mm posts and four bearing pods. Nominal frame billet: diameter 56 x 81 mm. No intermediate brace rings or separate output-bearing cheeks are used. Eight M3 screws attach the outer discs to the frame. Indexed milling and transverse boring are required.

The four parallel screw axes sit at radius 14 mm: exactly the same distance from the centre and rim. Outward output axes form an X in the end view. Adjacent output pivots AND nut neutral positions alternate between X=-8.5 and +8.5 mm. Therefore all four output axes do not lie in one axial plane. This 17 mm staggering is the principal diameter-saving tradeoff and requires longer screws.

The lever is sqrt(105.75)=10.28348 mm. Travel remains +/-20 degrees, approximately 7.4858 mm total nut stroke. Four-start TR8x8(P2) screws are turned from 250 mm stock to 68 mm overall, retaining 44 mm of working thread. At the limits, the full 15 mm nut retains about 2.2571 mm thread-end margin. Bearing centres are local Y=11.5 and 16.3 mm. The closed plain output end starts at Y=6.55 mm and its outward tail ends at Y=27 mm.

Use fabrication files prefixed **TR8-CNC56** exclusively. There are two unique outer-disc profiles and one fork profile for quantity four, a one-piece CNC frame macro, a six-blank macro, bill of materials, motion table and machining schedule. Output shafts, sleeves and retention hardware are specific to this variant. Accessible retaining rings and output tails project beyond the disc rim.

The single outward fork, plain closed output shaft, cross pin, carrier anti-roll faces and production requirements are described in the [shared CNC guide](../tr8-quad-cnc-actuator/GUIDE.md). The 0.05 mm carrier/fork gap permits finite roll play, about 0.724 degrees before face contact. The single-fork joint, narrow outboard bearing span, pin end land and frame require actual load qualification; nominal fit and interference checks do not establish structural capacity.

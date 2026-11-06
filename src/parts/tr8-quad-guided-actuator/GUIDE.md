# Four-drive CNC mechanism with a central nut guide

This is a separate guided version of the 64 mm CNC mechanism. Search the library for **TR8 central guide**. The earlier 64 mm, staggered 56 mm, 72 mm and 82 mm versions remain available. Motors, screws, nuts, output shafts and all their placements are unchanged.

## Fixed anti-rotation surfaces

The CNC middle body now includes one axial square spine and four 1.5 mm pinwheel fins. Each fin has a flat stationary face opposite the inward flat of its moving nut carrier. Four carrier pads, each 10 mm long by 8 mm high, retain full guide coverage throughout the commanded -20 to +20 degree travel. The guide reacts nut roll in both directions even with the outward forks and follower pins removed. The outward forks continue to transmit axial nut motion to the output shafts.

The nominal gap between each stationary face and carrier flat is 0.05 mm. It allows sliding and finite angular play before contact; this is not a preloaded or zero-backlash guide. Machine the four fixed faces and carrier flats parallel to their respective screw axes, deburr, finish and lubricate them. Specify actual running clearance, alignment, flatness, surface finish and tolerances together. Qualify fin/root stiffness and sliding wear for the intended nut reaction torque.

For this 64 mm version, the square spine half-width is approximately 5.94 mm. The guide is rooted 0.1 mm into the existing middle base and extends from X=-15.1 to X=11.639702 mm. It stops before the end bearing disc. The fins join the spine and base as one solid; there are no new screws or disc slots. The original diameter 64 x 63 mm minimum frame billet still contains all material. Root fillets and tool reliefs must stay within the verified clearance envelope.

## Preserved interfaces and fabrication

There are still exactly three main discs: two 3 mm outer discs and one 5 mm middle base integral with the posts, bearing pods and guide. All 112 channel occurrences are unchanged, as are the other 10 frame occurrences. The total remains 123 configured occurrences and 391 native physical solids. The 361:1 configuration remains 131 x 64 x 64 mm. Screw axes remain at D/4 and outward axes form an X at one axial station.

Use only **TR8-CNC64-guided** fabrication files. The six DXF/SVG cutting files and laser blank geometry are identical to the original 64 mm CNC version. The middle-body macro, machining schedule and bill of materials describe the new guided body. The central guide is CNC material and must not be treated as a separate laser blank. All original screw-turning, pin-joint, bearing-fit and load requirements remain; see the [original CNC guide](../tr8-quad-cnc-actuator/GUIDE.md).

The [staggered 56 mm guided version](../tr8-quad-guided-staggered-actuator/GUIDE.md) has the same guide principle with a narrower spine and two nut/output stations.

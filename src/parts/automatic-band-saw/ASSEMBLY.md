# Assembly datums and sequence

The model is a nominal installation layout. It defines mating holes, fastener access, bearing seats and sampled motion clearances; it is not a set of released manufacturing drawings.

## Fixed references

- X is the stock feed direction; the blade centre plane is X=0. A rotation about X changes bow elevation without changing the 90-degree cut plane.
- Stock support is Z=900. The L datum side face is Y=-60 for every section width. Adjust side/top cylinder angles against this reference; do not recenter stock when changing size.
- The bow pivot is X-directed, at Y=−354.38, Z=1035. The drive shaft is coaxial with the hollow fixed trunnion; shaft and bow have separate bearings.
- Bow travel is 0–35 degrees. The lift rod pin is at X=100, Y=354.38, Z=1035 in the bottom position. The cylinder base pin is at X=100, Y=354.38, Z=300. The base bracket ties into the frame without a separate floor support.
- The lift pin span is about 735–1149 mm. A 700 mm closed mounting allowance with 500 mm stroke leaves approximately 35 mm bottom and 51 mm upper stroke reserve. Validate the actual cylinder, adapters and rod-lock stack before drilling.
- Feed base top Z=740, screw axis Z=785, MGN15 seat Z=819, bridge plate Z=835–847. Shuttle centre spans X=−355 to −200.

## Assembly order

1. Assemble the common six-foot frame with removable corner straps, M8 through bolts, crush sleeves and nuts. Fit the infeed saddles and lower side ties. Machine datum pads before aligning the roller crowns and station floor. Small bow, L-shoe and bracket subassemblies remain welded/bent parts; the principal modules bolt to the frame. Fit the single cabinet post and frame cantilever.
2. Install MGN15 rails, ballscrew supports and journals. The SFU1605 library model includes its stepped shaft and flanged nut. Mount the nut saddle and bridge plate, using recessed screw heads below the fixture feet. Set paired fixed bearings, floating support, shaft locknut, covers, motor bracket and clamping coupling before fitting the L shoe.
3. Bolt the shuttle L shoe from below, clear of the screw saddle and rails. Bolt the station L assembly through its recessed floor holes. Align both side faces to Y=-60 with a master bar. The floor and side wall are welded members, not independently floating inserts.
4. Fit slotted side-cylinder angles and top posts. Loosen the M6 base or bridge screws and M16 mounting collar to adjust height/transverse position. Tighten before use. Fit the triangular flank shoe only for that profile. Prove both shuttle cylinders and each station clamp before transferring stock retention.
5. Assemble the independent D30 drive shaft and its two 6806/61806 bearings in the fixed hollow trunnion. Fit spacers and removable covers before installing the motor/reducer, because the drive obstructs rear cover access afterward.
6. Fit the two 6010 bow bearings, housing, spacers, caps and inner-race locknut. Bolt the relieved driven-wheel backplate to the moving housing flange. Install the idler slide, wheels, tension adjuster, guide carriers, return channel and guards. Wheel drive keys/coupling retention, bearing fits and band-tension loads require the detailed drawing package.
7. Pin the 63×500 lift cylinder to the fixed base and the free-end bow clevis. Fit thrust washers and retaining rings. The clevis crosspiece is above the rod eye so the extending rod approaches from below without striking it. The cylinder body/rod are allowed to pivot; they do not guide the bow. Select the exact monitored rod lock and validate its holding capacity.
8. Bolt the side optical mast to the shuttle and fit its bent arm and adjustable sensor. Calibrate the switching-plane offset at home relative to X=0. Prove the nose scan with stock fixed and shuttle open. Fit the shelf, two bronze hinge bushes, pins, clevises, crank and closed stop. Check discharge into the box.

## Qualification before release

Supplier mounting contours, adapter lengths, reducer interfaces and rod-lock dimensions remain installation envelopes. Specify bearing fits/preload, shaft axial retention and torque transfer, welds, frame stiffness, guards, plumbing and wiring in drawings. Preview threads are visible; Python/STL retain nominal geometry and need thread callouts.

Prove the motion envelope with the delivered parts and hoses/cables. Nominal non-interference does not establish stiffness, fatigue life, access for every tool or a safe control system. The ±0.2 mm target requires calibrated axis/optical datum, controlled clamp transfer and measured cut capability; encoder counts alone do not qualify it.

The last roller is X=-580; omit the former X=-420 roller. Side clamp slots span Z=915–960; top-angle bolt slots span Z=1129–1219. Both use fixed-height brackets across 30–120 mm stock. The slots must be locked before cycling.

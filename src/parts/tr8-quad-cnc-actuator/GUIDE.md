# TR8x8 CNC four-drive block, diameter 64 mm

Separate library version; the 82 mm and 72 mm versions remain available. Four independent outward 6 mm outputs form an X in one axial plane. Their motion remains -20 to +20 degrees. Choose one of the four GMP16 motor ratio/voltage presets and command each output independently.

## Three-disc frame

Two diameter 64 x 3 mm steel outer discs are laser blanks. The middle component is a single CNC frame: a 5 mm round base, four integral 7 mm posts and four output-bearing pods with longitudinal webs. Its nominal billet is diameter 64 x 63 mm. Eight M3 screws secure the outer plates to tapped post ends. There are no separate bearing cheeks or purchased standoff stacks.

The four parallel screw axes lie at radius 16 mm, exactly halfway between the centre and rim. Output pivots are at radius sqrt(156) mm. Motors and couplings retain their original sizes. All output axes lie at X=0; output tails and accessible retaining hardware project beyond the disc rim.

## More compact linkage

Each channel uses one outward 3 mm closed-slot fork, one ISO 8734 diameter 2 x 10 mm cross pin, and two outboard EZO SMF106ZZ bearings. The plain closed 6 mm shaft end has no enlarged head. The bearings are centred at local Y=12 and 17 mm. The short shaft, single-fork joint and narrow bearing span require application-specific load qualification.

The supplied 22 x 11 x 15 mm H nut retains its long flange dimension perpendicular to the screw/output plane. A 13 mm carrier has one outward 4 mm follower pin. Its flat against the fork restrains both nut-roll directions. The nominal 0.05 mm sliding gap permits about 0.724 degrees of free roll before face contact; it is not a zero-backlash joint. Finish and lubricate these faces. The carrier's M3 screws enter through the purchased nut into the carrier.

The 10 mm lever gives travel +/-3.639702 mm. Each four-start TR8x8(P2) screw is cut and turned from the supplied 250 mm stock to 50 mm overall with 26 mm of working thread. The full 15 mm nut retains 1.8603 mm nominal thread-end margin at either travel limit. Shaft journals, ring grooves and all actual stations appear in the machining JSON.

## Fabrication

Use only files prefixed **TR8-CNC64**. DXF and SVG cutting profiles are millimetres at 1:1 scale: two outer discs and one fork profile for quantity four. Finish end-disc bearing pilots from 12.8 mm to the assigned fit, and fork pilots from 5.8 to 6.05 mm before match-drilling the transverse pin joints. The middle-frame native macro contains the final CNC solid, including eight M3 threaded holes, transverse bearing seats and the rear flange counterbores.

Review tool access and indexed setups for the one-piece frame. Assign material grades, bearing fits, coaxiality, tapping drill/class, corner reliefs, actual load cases and production tolerances. The supplied solid is nominal geometry, not a released production drawing. Thrust sleeves have a 6.05 mm bore and 6.85 mm outside diameter; assign their bore/OD/concentricity tolerances together within EZO's 6.8-6.9 mm abutment limits. Bearing internals remain illustrative. Supplier bearing ratings do not rate the assembly.

The separate [56 mm staggered version](../tr8-quad-staggered-actuator/GUIDE.md) reduces diameter further by placing adjacent nuts and outputs in two axial planes, at the cost of length.

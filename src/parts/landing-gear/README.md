# Landing gear strut

Find **VEHICLE STRUCTURES → DUCTS & LANDING GEAR → Landing gear strut**.

## Construction

Four starting configurations: single-wheel Ø60 fork strut, single-wheel Ø100 diagonal-braced strut, single-wheel Ø60 two-link brace, and twin-wheel Ø100 two-link brace. Each construction can use single or twin wheels.

The model includes rounded tyres, bored hubs, a common axle with end retainers, a two-cheek fork with crown, a sliding lower strut, a bored upper sleeve with collar, and a clevis-mounted upper pivot. Braced configurations add a strut lug, separate drag-brace links and pins, and a second clevis mount. Two-link braces have an offset knee and separate overlapping pivot planes with clearance. Mounting plates have four through holes.

## Controls and coordinates

- Wheel diameter, tyre width, axle diameter and tyre/fork clearance.
- Axle-to-upper-pivot height, outer strut diameter, fork/bracket thickness and mounting plate width.
- Brace upper-anchor offset, and knee offset for the two-link construction.
- Assembly and exploded views.

Z is vertical; Y is the wheel axle/pivot direction; X is the direction of the brace anchor offset. The wheel axle is at Z=0. Fork clearance is measured from the tyre envelope. Twin wheels have the same clearance between tyres. The telescopic members share a fixed pose; changing strut height changes the layout, not simulated suspension compression. Nominal diametral pivot clearance is 0.2 mm.

The layout follows the user's single-brace and two-link landing-gear diagrams. Their full-size dimensions and applied load were not treated as a product specification. The linked ScienceDirect overview was unavailable (HTTP 403); no claim of dimensional verification is made against it.

## Scope and FreeCAD

These are editable mechanical layout prototypes, not replicas of a rated commercial landing gear. Internal damping, bearings, steering/torque links, retraction actuator, over-centre lock, pin-retention hardware and threaded fasteners are not modeled. The axle end retainers are simplified envelopes. No strength or service-life rating is implied.

The four starting assemblies contain 10–18 named solid components. No decorative screws or tread meshes are generated. Preview and native FreeCAD export use the same geometry recipe. Export supports separate component movement and STEP/FCStd round trips. The exploded view separates parts along Z for inspection; it is not an assembly procedure.

Native verification: `PART_FILTER=landing-gear node --import tsx scripts/verify-library-expansion.ts /tmp/landing-gear-cases.json`, then run `scripts/verify-electronics.py` with FreeCAD Python. This checks solid validity, pairwise intersections, preview/native agreement and document round trips, including alternative wheel arrangements and small/large custom layouts.

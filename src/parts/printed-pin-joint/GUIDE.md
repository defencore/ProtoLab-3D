# Printed pin joint

## Function and requirements

Two separately printed coupons demonstrate a locating pin and blind socket. The round pin locates transverse translation while axial movement and rotation about Z remain free. No positive axial stop, interference fit or retention is claimed. Loads, polymer grade, printer accuracy and required service life have not been specified. The examples are authored dimensions, not purchased products or published fit recommendations.

Acceptance criteria are two connected single-solid parts; explicit diametral clearance; positive socket floor and minimum side walls; a continuous axial insertion/removal path; consistent preview, dimensions and native CAD; unchanged physical identities in inspection views. The straight engaged length must be at least half the pin diameter as a sample-geometry rule, not a strength calculation.

## Concept and selection

The baseline is a separate dowel or bolted locating interface. The ideal final result uses the printed host geometry for location without additional hardware. The contradiction is that smaller clearance improves nominal location but reduces tolerance to printing error. Existing polymer, empty bore volume, lead-in geometry and axial access are available resources. Separate the insertion lead-in from the straight locating surface, and expose the fit allowance for calibration. A keyed peg could constrain rotation, and a snap could retain axially; those functions require different checks. The circular pin is retained here for its simple measurable geometry.

Library path: Fasteners & threads → Printed joints → Printed pin joint. Family ID: `printed-pin-joint`. Example IDs: `printed-pin-joint:pin-6-clearance-030`, `printed-pin-joint:pin-6-clearance-015`, `printed-pin-joint:pin-10-clearance-050`. Both physical components reuse `manufactured-detail` with separate recipe configurations and stable occurrence IDs `pin` and `socket`. No purchased item is introduced.

## Layout, fits and manufacturing

The pin base occupies Z=0…baseThickness. The pin extends in +Z. The socket opening starts at baseThickness + faceGap; its blind floor is endClearance above the pin tip. `clearance` is **socket diameter minus pin diameter**, so radial clearance is half that value. The chamfer removes equal radial/axial distances at the pin tip. Coupon width must leave the configured minimum wall beside the bore. The socket floor has thickness `wall`.

Print the pin base down. In **For 3D printing**, the socket is turned over, with its closed face on Z=0 and the bore open upward. Both parts are separated by 8 mm. The cylindrical pin builds vertically in this convenient coupon orientation; layer adhesion can govern transverse loading. Select another qualified orientation for a loaded design if needed. Remove brim/elephant-foot material at mating edges and measure the printed bore and pin. No universal compensation or polymer strength is assigned.

Insert the pin axially through the socket opening; the tip chamfer enters first. Remove along the same path. The positive diametral clearance and uniform bore make all intermediate rigid axial poses geometrically feasible. External access over the whole socket withdrawal length is required in a host assembly. Face and end gaps describe an inspection pose; they are not mechanical stops.

## Verification and remaining questions

Package, preview/composition and native geometry checks are provided by the printed-joint tests and verification scripts. Reports and STEP/FCStd files belong under ignored `test-results/printed-joints/`. Native checks must execute the generated recipe, inspect valid solids, cylindrical/conical surfaces, clearances and round trips. Inspection states preserve the two local recipes; only occurrence placement changes.

On 2026-10-31, FreeCAD 1.1.4 executed production-generated macros for all three examples and the minimum/maximum diametral clearances in all three states (15 cases). Each pin was one valid solid with nine faces, including one true cylinder and one cone; each socket was one valid solid with eight faces, including one cylindrical bore. Independent exact-volume checks, assembled nonintersection, 41 axial extraction positions per assembled configuration, print-bed separation, STEP round trips and FCStd geometry/identity round trips passed. Reproduce with `node --import tsx scripts/verify-printed-joints.ts`, then run `scripts/verify-printed-joints.py` with a FreeCAD-enabled Python interpreter.

No insertion-force, load, fatigue, creep, wear or print test has been performed. Define the application load path and qualify bearing pressure, pin bending, layer strength, dimensional tolerance and any required retention before release.

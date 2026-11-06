# Printed dovetail joint

## Function and acceptance criteria

This authored two-piece calibration pair demonstrates a reusable printed mating feature. All preset sizes are design examples, not purchased products or manufacturer dimensions. It reuses `manufactured-detail` for two physical configurations with occurrence IDs `male` and `female`. The stable family ID is `printed-dovetail-joint`; presets are `standard`, `compact` and `loose-fit`.

Known requirements are two individually printable parts, editable positive mating clearance, a real open insertion path along Y, and consistent preview, native CAD, dimensions and physical composition. No application loads, polymer grade, printer, dimensional accuracy, temperature or service life were supplied. Strength, friction, wear and creep remain unqualified. Default dimensions are millimetres: length 30, width 28, base thickness 3, tongue height 5, tongue width 10, head width 16, clearance 0.20.

Acceptance criteria are: two connected single solids; positive material beside and above the groove; no nominal interference anywhere during Y insertion; positive geometric capture against Z withdrawal while Y remains free; flat outer bases on Z=0 in the print state; and inspection states that retain the exact fabrication recipes and canonical composition.

## Design decision

The baseline is separately fastened or glued coupons. The ideal final result is for the parent printed geometry to align and capture the parts with no extra hardware. The technical contradiction is that reducing mating clearance improves location but increases jamming from printer error, surface texture and distortion. Available resources are the parent material, empty groove volume, open end access and the longitudinal insertion direction. Spatially separate the retaining flanks from their running clearance. No numbered TRIZ principle or contradiction-matrix mapping is asserted.

A true trapezoidal head is selected over the rectangular tongue because its undercut captures Z separation. A plain pin is more compact but does not provide continuous support; a snap is easier to latch but adds flexural strain and fatigue. The selected dovetail has no end stop, so it remains free along Y.

## Layout, fit and manufacture

X is across the coupon, Y is the open-ended insertion direction and Z is normal to its base. The male base occupies Z=0 to `baseThickness`; the tongue projects by `tongueHeight`. The female part has a local U section from Z=0 to `tongueHeight + baseThickness` and is installed at Z=`baseThickness + clearance`. Its open groove reaches local Z=`tongueHeight`, leaving the selected base thickness as a continuous roof.

With neck width `n`, head width `a`, tongue height `h` and clearance `c`, the flank slope is `s=(a-n)/(2h)`. The male right flank is `x=n/2+s*(z-baseThickness)`. The receiver right flank in its local frame is `x=n/2+s*(z+c)+c*sqrt(1+s*s)`. The matching left flank is symmetric. Therefore the separation perpendicular to either sloping flank is exactly `c`, with vertical base and roof gaps also `c`. The offset is not a simple arbitrary enlargement of the trapezoid.

The receiver half widths are `slotBottom=n/2+s*c+c*sqrt(1+s*s)` and `slotTop=slotBottom+s*h`. Validation requires `a>n`, `a/2>slotBottom`, `h>c`, and `width/2-slotTop>=baseThickness`. These checks preserve the undercut, a nonzero engaged height and minimum side material. They do not establish a strength margin.

Both sections are constant along Y and open at both ends. An overlap of any length during a pure Y translation has exactly the same noninterfering XZ section; the approach outside the overlap is empty. This establishes the nominal full insertion path analytically. Printer errors, elephant foot and roughness can still bind the real parts, so print and measure the calibration pair before integrating the features.

The canonical `assembled` state keeps both installed placements. `exploded` translates the receiver along +Y until it clears the male. `print` rotates only the receiver occurrence 180 degrees about X and places its flat outer roof on Z=0 beside the base-down male, with an 8 mm bed gap. These are inspection/fabrication poses; they do not change procurement identity, recipes, quantities or project placements. No `physicalStates` are declared.

Print both parts individually; review the sloping faces or groove edges in the slicer, layer adhesion, first-layer expansion and removal access. Sharp nominal corners are not a universal process tolerance or a load-bearing root design. Specify material, surface finish, compensation and any corner relief for an application before release. Install by sliding along Y from an open end; remove by reversing that translation. Keep an unobstructed entry envelope at least one engagement length for complete separation. Add and check a separate end retainer if axial retention is required.

## Geometry and verification

Each physical part is one native straight-edge concave profile extruded along Y. The preview uses that same profile; FreeCAD uses native lines and a solid extrusion. No browser triangles are converted into CAD faces. The manufactured-detail dependency retains the local fabrication recipe, explicit placement and physical product identity.

Focused automated checks cover preset/state validity, nominal clearance and capture criteria, preview and declared dimensions, unchanged recipes in inspection poses, and print-bed placement. On 2026-10-31, FreeCAD 1.1.4 executed the production-generated macros for all three examples and the minimum/maximum clearance configurations in all three states (15 cases). Each part was one valid closed solid with 10 planar faces. Independent exact-volume checks, assembled nonintersection, 41 extraction positions per assembled configuration, print-bed separation, STEP round trips and FCStd geometry/identity round trips passed. The constant-section argument above establishes the continuous nominal rigid path; samples are supplementary checks.

Reproduce with `node --import tsx scripts/verify-printed-joints.ts`, then run `scripts/verify-printed-joints.py` with a FreeCAD-enabled Python interpreter. Evidence is stored under ignored `test-results/printed-joints/`. Geometry is not a physical fit test, a strength analysis or approval to manufacture.

## Sources and remaining questions

- [Formlabs, designing printed snap-fit enclosures](https://formlabs.com/blog/designing-3d-printed-snap-fit-enclosures/): general process, material and mating-feature context; it does not establish these authored dimensions or a universal fit.
- [TRIZ Body of Knowledge](https://www.aitriz.org/triz/triz-body-of-knowledge) and [MATRIZ terminology](https://wiki.matriz.org/docs/triz/glossary-6146/): method references.

Remaining evidence is the actual printer/material dimensional capability, load cases, acceptable play, local corner treatment, temperature, creep and wear tests. If the application needs a retention force, preload or life rating, define and verify those separately for the actual configured dimensions.

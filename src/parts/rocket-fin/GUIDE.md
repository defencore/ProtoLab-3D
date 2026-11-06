# Rocket planar fin

One physical flat fin corresponding to the trapezoidal, elliptical and freeform fin categories in [OpenRocket's component documentation](https://openrocket.readthedocs.io/en/latest/user_guide/basic_rocket_design.html#body-components-and-fin-sets), reviewed 2026-10-25. Add separate occurrences to the design project for a fin set. This package contains no automatic radial array or rocket body.

## Planforms and coordinates

All dimensions are millimetres. X is the axial chord direction, Y is radial and Z is plate thickness, centered at zero. The root of the regular planforms starts at `[0, 0]` and ends at `[rootChord, 0]`.

- **Trapezoidal:** the tip leading edge is at `[sweep, span]`, and the tip trailing edge is at `[sweep + tipChord, span]`. Negative sweep is allowed. Reported X size includes any tip overhang beyond the root.
- **Elliptical:** the root chord is the full base of a half-ellipse, and `span` is its maximum radial extent. A fixed 64-segment outline defines both preview and native geometry. This is a sampled polygon, not an exact analytic ellipse.
- **Freeform:** enter 3 to 64 JSON `[x, y]` pairs, for example `[[0,0],[140,0],[105,25],[65,75],[20,60]]`. The outline closes automatically; do not repeat the first vertex. Clockwise and counterclockwise inputs are accepted. Coordinates must be finite and within +/-2000 mm. Validation rejects repeated vertices, collinear corners, self-crossing or self-touching edges, and zero-area outlines. The displayed envelope follows the actual point extrema.

The hidden regular-planform dimensions are retained when freeform is selected, and the freeform points are retained when another planform is selected. These fields are separate alternative outline definitions.

## Scope and evidence

All three presets are authored prototype dimensions. OpenRocket supplies the component terminology; the dimensions are not imported manufacturer data, a supplier footprint or a flight qualification. This package does not read or write OpenRocket files and does not calculate aerodynamic stability.

The shared closed prism profile provides matching preview, STL and native FreeCAD geometry. The model has square edges and uniform thickness. Define any airfoil treatment, root tab, fillet, fastening and attachment separately. Specify material, tolerances, stock and fabrication process, then verify the actual fin and attachment loads in the project.

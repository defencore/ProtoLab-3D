# Servo arm / horn

This independent package owns its configurator, 28 reference presets, geometry and FreeCAD recipe. Edit `configurator.ts` for controls/defaults, `presets.json` for catalog records, and `lib/geometry.ts` for preview and macro construction. No other package imports these private files.

## Shape and mounting

Choose a single arm, double arm, cross, six-arm horn or circular disc. The overall X length includes the rear hub and optional clamp extension on a single arm. Cross horns have independent perpendicular span, hole count, first radius and spacing. Disc horns use a pitch circle. The spline socket opens on the underside; select **Spline socket side** to inspect its teeth.

Spline tooth count, major diameter, minor diameter and socket depth are independent. The generated straight-flank serrations are an editable prototype approximation, not a manufacturer-specific involute spline. A tooth count alone does not establish compatibility. Linkage bores are smooth even where a source gives an M3 thread callout. The screw seat between the socket and counterbore remains solid.

A single-arm horn can have a slit, clamp ears and transverse screw bore. The optional clamp screw is a separate preview and FreeCAD component. The horn is one manufactured body; FreeCAD fuses the plate, hub and clamp ears before cutting the bores. Dimensions include visible clamp hardware.

## Evidence and approximations

Reference presets use the supplied images under `public/references/servo-*.png`. `catalog.verifiedParameters` lists only values established by that particular source; unlisted fields remain editable prototype dimensions. Socket flank geometry, minor diameter and fit clearance are not specified by these images. Irregular hole rows and projected disc patterns are approximated by the configurable uniform-spacing patterns and marked in source details. Cosmetic moulding ribs and weight-reduction pockets are omitted.

Run `node --import tsx --test tests/servo-arm.test.ts` for the focused reference, geometry, bore and export checks. Run `npm run parts:check -- servo-arm` before handing off the package.

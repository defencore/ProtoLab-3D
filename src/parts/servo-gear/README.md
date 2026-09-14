# Servo spline gear

This complete package owns its configurator, presets, involute gear profile, internal socket, preview and FreeCAD recipe. Edit it independently and run `npm run parts:check -- servo-gear`.

- External gear tooth count and internal servo spline tooth count are independent.
- The socket can be recessed, leaving a retaining screw shoulder, or through the whole body. An optional hub extends below the gear; the socket always starts on that lower mounting face.
- The gear profile is sampled involute geometry. Small catalog pinions use layout mode with radial root relief, without manufacturer-specific undercut/profile shift.
- The internal serration is an editable envelope. Spline major/minor diameter, angular phase and recess depth are not specified by the reference drawings. Do not infer a universal fit from a 23T/24T/25T label.
- The supplied 24T-spline drawings establish 6 mm width, a plain 3 mm retaining hole and 17.6/25.6 mm outer diameter. ServoCity identifies these as 20/30 external teeth, module 0.8 and 20 degree pressure angle. The catalog contains 13 actual SKU combinations. Only dimensions explicitly supported by each source are marked verified.

Run focused coverage with `node --import tsx --test tests/servo-gear.test.ts`. The host exports the single manufactured gear as one solid.

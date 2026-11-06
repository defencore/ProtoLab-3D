# Configured manufactured detail

A custom assembly detail is a reusable library configuration with local geometry. The structured recipe supports boxes, turned cylinders, extrusions, revolutions, lofts, boundary solids and boolean operations. It contains geometry data, never executable source.

Choose a **Detail family** or a starting preset to configure a plate, sleeve/spacer, shaft/pin or angle bracket. Lengths and diameters use millimetres. Plates support a centre hole or four corner holes; sleeves have an axial bore; shafts can have a radial cross hole; brackets can have one through hole in each leg. Each change drives the same local feature definition in the preview and native FreeCAD export. Hole edge clearance, sleeve wall thickness and bracket leg lengths are validated before export.

**Authored component** preserves the structured geometry supplied by an existing mechanism. Existing assembly recipes remain valid without family-specific dimensions. Switching an authored component to a size family deliberately replaces its geometry with that family's configured shape; it does not infer design intent or alter the original recipe.

An authored flexible detail may additionally carry an optional `manufacturingRecipe` in the same local coordinate system as its installed `recipe`. Its default **Detail** state shows the installed form; **Manufacturing form** is available only when that complete free-form recipe is supplied. Preview, dimensions and native CAD use the selected form. Both states retain one occurrence, BOM quantity and ESKD identity, identified by the free manufacturing recipe. A project normalizes the manufacturing view to the default installed state. Existing details without this optional field retain their original geometry, keys and sole available default state; dimensional size families reject the extra form.

This is a geometry-state contract, not an elastic simulation. The component author must verify that the two forms describe the same physical part, preserve the intended material and hinge paths, and can move between those forms. Printing a different rigid body under the same identity is not permitted. Forming sequence, actual strain, force, creep and process capability need their applicable engineering or physical checks.

The project stores its designation, revision, material, blank, operations and drawing requirements. Translation and rotation belong to the assembly occurrence. Repeated configurations are aggregated in the specification; moving or hiding an occurrence does not change the definition.

A preview is a design reference. Check one physical part, tool access, thickness, fits, tolerances and production drawing before manufacturing. A disconnected compound, gear reference surface or supplier envelope is not automatically a producible functional component.

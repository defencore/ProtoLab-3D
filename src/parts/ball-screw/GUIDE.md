# Ball screw assembly

This folder owns this part's parameter schema, defaults, preview, FreeCAD recipe, validation and catalog presets. Edit or replace the folder without changing another part.

- `part.ts`: definition and local model behavior. Factory-based definitions use private helpers under `lib/`.
- `configurator.ts`: ordered catalog size selectors. The numeric/conditional parameter schema belongs to the definition in `part.ts` or its private factory.
- `presets.json`: complete catalog and example parameters, IDs and source metadata.
- `lib/`: private domain helpers and reference values. Edits here affect this package only.
- `index.ts`: API version, stable part ID and display order.

Only the generic geometry SDK under `src/core` is shared. Run `npm run parts:check -- ball-screw` to check this package and `npm run parts:export -- ball-screw <output-folder>` to prepare a runnable handoff with the SDK and reference assets.

## Custom journal retaining grooves

With **Machined · custom journals**, the fixed and support journals each have an optional retaining-ring groove. A groove diameter of zero disables that groove and preserves the cylindrical stock geometry. Width is axial; offset measures in +Z from the low end of that journal. Both faces must remain within the selected journal length, and the groove diameter must be smaller than the journal diameter. The drive journal has no retaining groove.

These are physical machining features in both Simple and Full, including screw-only exports. Stock presets leave both grooves disabled. A nonzero groove is a custom end execution, not a verified supplier end code. Specify groove tolerances, corner radius, end land and ring compatibility on the shaft drawing; the geometry does not establish a retention load rating.

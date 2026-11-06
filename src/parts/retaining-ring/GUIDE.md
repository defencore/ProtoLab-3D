# Retaining ring / circlip

This folder owns this part's parameter schema, defaults, preview, FreeCAD recipe, validation and catalog presets. Edit or replace the folder without changing another part.

- `part.ts`: definition and local model behavior. Factory-based definitions use private helpers under `lib/`.
- `configurator.ts`: ordered catalog size selectors. The numeric/conditional parameter schema belongs to the definition in `part.ts` or its private factory.
- `presets.json`: complete catalog and example parameters, IDs and source metadata.
- `lib/`: private domain helpers and reference values. Edits here affect this package only.
- `index.ts`: API version, stable part ID and display order.

Only the generic geometry SDK under `src/core` is shared. Run `npm run parts:check -- retaining-ring` to check this package and `npm run parts:export -- retaining-ring <output-folder>` to prepare a runnable handoff with the SDK and reference assets.

`boreEnvelope=0` keeps the supplier free-ring dimensions. Internal-ring construction lugs remain inside the specified free outer circle in both preview and native CAD, so their round construction pads cannot enlarge the groove-fit diameter. Both plier holes remain open.

A positive `boreEnvelope` is an explicit illustrative installed bore through the expanded external-ring body and round lug contours. It does not prescribe machining a purchased DIN ring or certify elastic deformation, retention force or the supplier's unpublished lug shape. Preserve the original stock SKU, free-ring dimensions and actual groove drawing in the assembly purchase/acceptance records.

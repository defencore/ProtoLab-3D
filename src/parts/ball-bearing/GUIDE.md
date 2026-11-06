# Deep groove ball bearing

This folder owns this part's parameter schema, defaults, preview, FreeCAD recipe, validation and catalog presets. Edit or replace the folder without changing another part.

- `part.ts`: definition and local model behavior. Factory-based definitions use private helpers under `lib/`.
- `configurator.ts`: ordered catalog size selectors. The numeric/conditional parameter schema belongs to the definition in `part.ts` or its private factory.
- `presets.json`: complete catalog and example parameters, IDs and source metadata.
- `lib/`: private domain helpers and reference values. Edits here affect this package only.
- `index.ts`: API version, stable part ID and display order.

Only the generic geometry SDK under `src/core` is shared. Run `npm run parts:check -- ball-bearing` to check this package and `npm run parts:export -- ball-bearing <output-folder>` to prepare a runnable handoff with the SDK and reference assets.

## Miniature size options

The 39 additional `ID...` presets preserve every bore x outside diameter x width in the supplied AliExpress size list, including decimal widths and distinct widths for the same bore/diameter. Their source link is the requested listing; direct seller-page verification was unavailable. Only those three user-supplied dimensions are marked as verified. Closure, manufacturer, material, ball complement and ratings were not supplied. The open construction and ball count are illustrative editable geometry, not a claimed supplier execution.

Use the bore, outside diameter and width selectors to narrow the miniature options. Flanged F-series 2RS options belong to the separate **Flanged miniature ball bearing** family so its locating lip has an independent installation envelope.

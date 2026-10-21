# E-ring / three-lug retaining washer

This folder owns this part's parameter schema, defaults, preview, FreeCAD recipe, validation and catalog presets. Edit or replace the folder without changing another part.

- `part.ts`: definition and local model behavior. Factory-based definitions use private helpers under `lib/`.
- `configurator.ts`: ordered catalog size selectors. The numeric/conditional parameter schema belongs to the definition in `part.ts` or its private factory.
- `presets.json`: complete catalog and example parameters, IDs and source metadata.
- `lib/`: private domain helpers and reference values. Edits here affect this package only.
- `index.ts`: API version, stable part ID and display order.

Only the generic geometry SDK under `src/core` is shared. Run `npm run parts:check -- e-ring` to check this package and `npm run parts:export -- e-ring <output-folder>` to prepare a runnable handoff with the SDK and reference assets.

## Installed assembly envelope

`installedGrooveDiameter=0` preserves the stock free-ring outline, its original display datum and native recipe. All catalog presets keep this value at zero. The free contact diameter, outside envelope, thickness, nominal groove size and source identity remain the purchased product's configuration.

A positive value must match `grooveDiameter`. It places the shaft/groove axis at local X=Y=0 and expands the three representative contact lands to tangent faces at that nominal radius. The two relief pockets and open E-shaped profile remain. This installed envelope prevents a free-ring contour from intersecting the shaft in an assembly preview; it is not a spring-deformation simulation or a machining instruction for the purchased ring. The default free-ring profile remains centred on its bounding box for the standalone stock preview.

The installed setting is hidden from normal catalog selection and is not a source-verified dimension. Its native export includes `InstalledGrooveEnvelope` metadata. Confirm the actual supplied ring, groove diameter and width, shaft shoulder, material and retention separately. No installation force, preload, elastic strain or retention rating is assigned by the illustrative expanded outline.

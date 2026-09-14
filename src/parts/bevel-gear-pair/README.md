# Bevel gear pair · mounting layout

This folder owns this part's parameter schema, defaults, preview, FreeCAD recipe, validation and catalog presets. Edit or replace the folder without changing another part.

- `part.ts`: definition and local model behavior. Factory-based definitions use private helpers under `lib/`.
- `configurator.ts`: ordered catalog size selectors. The numeric/conditional parameter schema belongs to the definition in `part.ts` or its private factory.
- `presets.json`: complete catalog and example parameters, IDs and source metadata.
- `lib/`: private domain helpers and reference values. Edits here affect this package only.
- `index.ts`: API version, stable part ID and display order.

The sampled tooth outline keeps the full involute flank resolution. `lib/core/end-cap.ts` joins each tooth to its own root projection, then fills the planar root-to-bore or root-to-hub annulus. Do not triangulate the entire varying-height tooth contour as one flat polygon: that creates diagonal ridges across the body face. The annulus joins its two boundaries in angular order so dense root samples do not generate nearly collinear triangle slivers.

Preview and FreeCAD use the same closed boundary. Keep the source mounting dimensions and the planar H/L root datums when editing tooth relief. Run `node --import tsx --test tests/reference-gears.test.ts` to check those surfaces and all six catalog assemblies, and the bevel-pair case in `tests/gear-bores.test.ts` for the seven shaft profiles.

Only the generic geometry SDK under `src/core` is shared. Run `npm run parts:check -- bevel-gear-pair` to check this package and `npm run parts:export -- bevel-gear-pair <output-folder>` to prepare a runnable handoff with the SDK and reference assets.

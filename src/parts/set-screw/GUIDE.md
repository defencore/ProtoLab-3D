# Set screw / grub screw

This folder owns this part's parameter schema, defaults, preview, FreeCAD recipe, validation and catalog presets. Edit or replace the folder without changing another part.

- `part.ts`: definition and local model behavior. Factory-based definitions use private helpers under `lib/`.
- `configurator.ts`: ordered catalog size selectors. The numeric/conditional parameter schema belongs to the definition in `part.ts` or its private factory.
- `presets.json`: complete catalog and example parameters, IDs and source metadata.
- `lib/`: private domain helpers and reference values. Edits here affect this package only.
- `index.ts`: API version, stable part ID and display order.

Only the generic geometry SDK under `src/core` is shared. Run `npm run parts:check -- set-screw` to check this package and `npm run parts:export -- set-screw <output-folder>` to prepare a runnable handoff with the SDK and reference assets.

## DIN 915 references

The 11 **black 12.9** presets retain the supplied M2–M16 table in `lib/catalog/din915.ts`. `tipLength` is the full cylindrical dog length Z; `dogShoulderLength` follows it within overall L. The table does not supply L or the shoulder chamfer, so their initial values are editable prototype choices and are not marked as verified stock dimensions. `finish` changes preview and FreeCAD display color. Existing supplier presets retain their original dimensions and square shoulder.

Run `node --import tsx --test tests/din915.test.ts` from the app root for the focused geometry checks. See `docs/din915.md` for source scope and the optional native FreeCAD check.

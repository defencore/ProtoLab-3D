# Ball screw nut

The supplied KAIYADE SFK page 17 adds 15 source-specific nut references, keeping their dimensions and load ratings distinct from the existing Wangong rows. SFK0825 is also searchable by the supplied listing alias SFK08025. Four mounting holes use the table's 30° pattern; the SFK2002/2502/2503 counterbores follow Y/Z. No verified public copy of the supplied table is available. Shaft lengths and end machining belong to the ball screw assembly and remain hidden here.

This folder owns this part's parameter schema, defaults, preview, FreeCAD recipe, validation and catalog presets. Edit or replace the folder without changing another part.

- `part.ts`: definition and local model behavior. Factory-based definitions use private helpers under `lib/`.
- `configurator.ts`: ordered catalog size selectors. The numeric/conditional parameter schema belongs to the definition in `part.ts` or its private factory.
- `presets.json`: complete catalog and example parameters, IDs and source metadata.
- `lib/`: private domain helpers and reference values. Edits here affect this package only.
- `index.ts`: API version, stable part ID and display order.

Only the generic geometry SDK under `src/core` is shared. Run `npm run parts:check -- ball-nut` to check this package and `npm run parts:export -- ball-nut <output-folder>` to prepare a runnable handoff with the SDK and available external source links.

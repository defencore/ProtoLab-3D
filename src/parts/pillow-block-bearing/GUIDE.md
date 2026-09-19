# Pillow block bearing

The KP08 and KP001 presets use the supplied Mini-Tech dimension drawings and replace the former illustrative Compact 8 / Medium 12 entries. KP001 is the initial selection. The existing UCP catalog retains its independent envelope geometry. Choose **KP cast compact housing** or **UCP housing envelope** in the catalog or custom configuration.

| Model | Shaft d | Centre H | Length L | Base depth A | Mount pitch J | Hole N | Foot H1 | Overall H0/H2 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| KP08 | 8 | 15 | 55 | 13 | 42 | 4.5 | 5 | 29 |
| KP001 | 12 | 19 | 71 | 16 | 56 | 7 | 6 | 38 |

All dimensions are millimetres. The shaft runs along Y, its centre is the origin, and the mounting foot is at Z = −H. KP001 insert width B = 14.5 and S = 4 give Y = −10.5…+4; the complete model therefore spans 18.5 mm in depth, including the protruding collar. KP08's K/S entries are blank: its illustrative 12 mm insert and −2 mm offset give a 14.5 mm complete depth. The nominal A dimension describes the base, not this illustrative insert envelope.

KP preview and FreeCAD use the same private shape descriptions: a connected cast housing with rounded foot corners, recessed web faces and raised ribs; a separate outer bearing ring, inner ring/collar, two seals and two socket set screws. Each exported component can be moved independently. Screw threads, rolling elements and self-alignment are not simulated. Undimensioned casting curves, bearing sections, screws and KP08 insert dimensions remain approximations, excluded from the verified catalog dimensions.

Sources: [KP08](https://www.mini-tech.com.ua/ua/podshipnik-flantsevyy-kp08-8mm), [KP001](https://www.mini-tech.com.ua/ua/podshipnik-flantsevyy-kp001-12mm), supplied KP series table (original reference, not bundled), and KP000/KP001 drawing (original reference, not bundled). The drawings specify N = 4.5/7 mm while the supplier text calls the holes M5/M7, and the table lists M6 fasteners for KP001. The model follows drawing N as an unthreaded through hole; bolt fit must be confirmed on the physical part. Slot elongation and counterbores are not dimensioned and are not claimed as verified.

Run `node --import tsx --test tests/pillow-block-kp.test.ts` for drawing-datum and hole checks. Generate native cases with `node --import tsx scripts/verify-pillow-blocks.ts`, then run `scripts/verify-pillow-blocks.py` using a FreeCAD-enabled Python. The validator checks solids, component interference, actual bores, preview/CAD agreement, independent movement, and STEP/FCStd round trips. Results are recorded in `data/pillow-blocks-native-validation.json`.

This folder owns this part's parameter schema, defaults, preview, FreeCAD recipe, validation and catalog presets. Edit or replace the folder without changing another part.

- `part.ts`: definition and local model behavior. Factory-based definitions use private helpers under `lib/`.
- `configurator.ts`: ordered catalog size selectors. The numeric/conditional parameter schema belongs to the definition in `part.ts` or its private factory.
- `presets.json`: complete catalog and example parameters, IDs and source metadata.
- `lib/`: private domain helpers and reference values. Edits here affect this package only.
- `index.ts`: API version, stable part ID and display order.

Only the generic geometry SDK under `src/core` is shared. Run `npm run parts:check -- pillow-block-bearing` to check this package and `npm run parts:export -- pillow-block-bearing <output-folder>` to prepare a runnable handoff with the SDK and reference assets.

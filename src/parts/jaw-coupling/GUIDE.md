# Flexible jaw coupling

This folder owns this part's parameter schema, defaults, preview, FreeCAD recipe, validation and catalog presets. Edit or replace the folder without changing another part.

- `part.ts`: definition and local model behavior. Factory-based definitions use private helpers under `lib/`.
- `configurator.ts`: ordered catalog size selectors. The numeric/conditional parameter schema belongs to the definition in `part.ts` or its private factory.
- `presets.json`: complete catalog and example parameters, IDs and source metadata.
- `lib/`: private domain helpers and reference values. Edits here affect this package only.
- `index.ts`: API version, stable part ID and display order.

Only the generic geometry SDK under `src/core` is shared. Run `npm run parts:check -- jaw-coupling` to check this package and `npm run parts:export -- jaw-coupling <output-folder>` to prepare a runnable handoff with the SDK and reference assets.

The two shaft bores are independent. Existing D25 L30 presets include 6.35 x 10 mm and 8 x 10 mm pairs. The native axis is Z: hub A is on the negative side and hub B on the positive side. `jawCouplingLayout(parameters)` exposes the actual smooth hub spans and shaft insertion datums. For these presets, each smooth clamping section is 10.3 mm long and the opposed shaft-tip gap is 9.4 mm. Rotate around Y by +90 degrees to place bore A on negative X and bore B on positive X.

The source attachment supports the outer diameter, overall length and bore pairs. Jaw profiles, spider, clamp hardware and internal clearances remain authored installation geometry. The attachment has no live purchase URL or verified torque/stiffness rating. Confirm the delivered execution, shaft insertion, tightening instructions, bore fit and operating ratings before ordering or powered use; this preview is not a released manufacturing drawing of supplier internals.

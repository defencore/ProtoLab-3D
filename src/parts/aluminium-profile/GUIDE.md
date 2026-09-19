# Aluminium extrusion / T-slot profile

This package owns all eight cross sections, their configurator, catalog records, preview and FreeCAD recipe. It imports only the generic core SDK and Three.js.

- `configurator.ts`: profile selection, complete section defaults, editable dimensions and catalog selection order.
- `lib/geometry.ts`: a closed outer contour with open T/C slots, separate through-bores and internal cavities; the same section feeds preview and native extrusion.
- `lib/catalog.ts`: dimensions explicitly annotated in the ten supplied images, offered lengths, source mass and tolerances.
- `lib/validation.ts`: dimensional constraints, contour intersections and cavity containment.
- `presets.json`: 44 listed EU profile/length combinations and four cross-section references with an editable prototype length.
- `part.ts` and `index.ts`: public package API and automatic library registration.

Select a profile section, then a listed length where available. **Custom dimensions** exposes the section and cut-length controls. Changing profile resets its section dimensions while retaining the current cut length. Use the camera's **Top** view to inspect the open cross section.

EU1030 uses the drawn 29.8 × 9.9 mm envelope. The 40 × 15 profile uses the internal descriptive ID `eu1540`; this is not a manufacturer model code printed in the source. Corner reliefs, unspecified cavity widths and bore positions are prototype dimensions. The top-slot floor is represented by 45-degree flanks. The low EU1040 centre void and 2040 centre void approximate the undimensioned silhouettes. EU1050's two opening widths use an editable surface step; its shoulder height is not specified. Modelled radii are limited to the outside corners. The 2040 default slot depth is derived to preserve the annotated 1.5 mm diagonal web. Supplier mass per metre is retained as source text, not used to infer a material alloy or model density.

Run `npm run parts:check -- aluminium-profile` and `node --import tsx --test tests/aluminium-profile.test.ts` from the app root. The optional `scripts/verify-aluminium-profiles.ts` / `.py` check runs eight sections in native FreeCAD, compares preview/native geometry and round-trips STEP. Use `npm run parts:export -- aluminium-profile <output-folder>` for an independent handoff.

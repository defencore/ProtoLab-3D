# Library naming conventions

Use concise English names, matching the application interface.

- Part names identify a component type in singular form: `SRS squib connector`, `BEC voltage regulator`, `SRS igniter housing`, `CO₂ cartridge`.
- Do not add evaluative qualifiers such as `Real` or `Realistic` to component names or selector labels. Name the component type directly, for example `Robot chassis`.
- Product variants start with the manufacturer or familiar brand, followed by the exact model and physical distinctions: `Amphenol CA281A · 2-way · 90°`, `TE Connectivity AK II · 3-way · 90°`.
- Standard hardware starts with size, followed by standard: `M6 · DIN 934`, `Ø2 × 6 mm · DIN 1481`.
- Use `M` for metric thread designations and `Ø` for diameters. Separate dimensional axes with `×`; separate independent characteristics with `·`. Include units for dimensional values.
- Preserve meaningful revisions, mechanical keys, header population, contact count, orientation, thread pitch, winding KV and other physical differences.
- Keep source quality and reconstruction limitations in descriptions and evidence badges. Do not put implementation labels such as `layout model`, `envelope`, or `CAD` in the component name.
- Keep original catalog designations and source records unchanged. Renaming must not alter part IDs, preset IDs, parameters or geometry.
- Preset titles and corresponding model selector labels must agree. Names must remain useful in search and FreeCAD exports.

Every built-in part belongs to one registered section and subgroup. Names are unique within each part’s variants. Threaded rods include pitch and handedness; sealing washers include bore, outside diameter and thickness. Identical supplier entries retain separate listing numbers without inventing geometric differences.

`core/library-labels.ts` owns presentation of section labels, browse-family titles and preset labels. A preset's `name` is its canonical visible title in model selectors and search results. A different `catalog.designation` appears as a separate source designation and remains searchable; it must not replace the curated title or be rewritten during a naming cleanup. Section labels are formatted for display without changing category or subgroup IDs. Browse-family titles do not replace physical member names in configurations or exports.

See [the library map](library-structure.md) for the full hierarchy.

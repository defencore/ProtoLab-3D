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

`core/library-labels.ts` owns presentation of section labels, browse-family titles and preset labels. Navigation names the component or mechanism type. A shared `browseFamily.label` has priority; a standalone definition can provide a generic `browseLabel` without changing its physical `name`. For example, use `Worm-sector actuator` in the library tree and page heading, then identify `TR8×8(P2)` in the configuration, component summary and preset title. A preset's `name` is its canonical visible title in model selectors and search results. A different `catalog.designation` appears as a separate source designation and remains searchable; it must not replace the curated title or be rewritten during a naming cleanup. Section labels are formatted for display without changing category or subgroup IDs. Navigation labels do not replace physical member names in configurations or exports.

See [the library map](library-structure.md) for the full hierarchy.

Package allocation and reuse decisions follow [Library organization](library-organization.md).
The `library_organizer` selects an existing family and functional subgroup before
allocating a new Package ID. Different parameter values or source models belong
inside the appropriate family; display-name cleanup never allocates a replacement
physical ID.

Purchased project records and FreeCAD exports use `catalog.name` when an original supplier title is available. It is preserved as source evidence independently of the curated English selector title. See [supplier title coverage](supplier-names.md) and [ESKD generation](eskd-generation.md).

For assembly navigation, use a generic mechanism type such as `Worm-sector actuator`, `Servo toggle actuator` or `Ball screw axis`. Put component-based execution details inside that entry. Configuration names and summaries identify the exact screw and motor model, output count, frame construction or guide arrangement, then useful material, manufacturing and travel distinctions. For example, `SFU1605-4 · 2× MGN12H · 300 mm axis` identifies the screw, both guides and axis length; `ST3215 servo toggle actuator · ASW-07D` identifies the purchased units used in a specific mechanism. Do not promote these model numbers, sizes or ratios into the generic navigation title.

Distinguish a ball screw from a trapezoidal lead screw. Lead is axial travel per revolution; pitch is the spacing between adjacent thread forms. A multistart screw can therefore have different lead and pitch, as in `TR8×8(P2)`: 8 mm lead, 2 mm pitch and four starts. Include pitch and starts only when established by the component definition. Where only diameter and lead are known, state them explicitly without inferring a thread profile or start count.

Assembly material summaries describe the documented mix of structural and transmission components, including purchased nuts where their material is established. Process summaries describe the custom details. A steel frame and bronze nut do not make every component steel or bronze; purchased bearings, motors and fasteners retain their own identities. List the actual mix and processes without inventing material grades, load ratings or manufacturing qualifications. Omit unknown characteristics from names and choices.

Selection filters describe physical characteristics rather than inspection pose. Screw, motor and other alternatives must satisfy all constraints within the same real configuration; facts from different presets must not combine into a fictitious product. Keep manual filters independent of the current selection, and show a selected configuration outside the results when it conflicts with them. Renaming and filtering preserve physical IDs, preset IDs, parameters, geometry, catalog designations and source evidence. See [mechanism selection](mechanism-selection.md) for the available controls.

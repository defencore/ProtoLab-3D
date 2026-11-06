# ESKD product generation

ProtoLab uses one identity resolver for library macros, projects and component exporters. The tree separates definitions, occurrences, revisions and supplier products as described by [Open ESKD](https://github.com/defencore/open-eskd/blob/main/docs/COMPONENTS.md). Its [conformance guide](https://github.com/defencore/open-eskd/blob/main/docs/CONFORMANCE.md) distinguishes information-format conformance from drawing standards and engineering release.

## Library references

Every physical family has a stable `part.id`; a preset's unique library reference is `<part.id>:<preset.id>`. **Library ID** and **Copy ID** appear directly below the model heading, including on mobile. The top of the configurator shows detailed copyable **Family ID**, applicable **Model ID** and **Configuration key** values before model choices. Library search accepts exact family and model IDs across grouped catalogs. Navigation names, supplier designations and enterprise numbering do not change these references. A custom configuration uses its family reference and configuration key rather than a fictitious preset.

ProtoLab project JSON and Open ESKD annotations preserve `libraryId`, applicable `presetId`, physical parameters and the configured product ID. Occurrence IDs identify installed instances of that definition. FreeCAD objects expose the same references as `LibraryId`, `PresetId` and `LibraryEntryId`, including library components inside manufactured assemblies. `PresetId` is empty when there is no explicitly selected matching preset. These properties remain separate from `Designation`, `Revision` and `ConfigurationKey`; adding library metadata does not change the existing configuration fingerprint.

## Designation, execution and revision

The initial enterprise convention is `PL3D.<LIBRARY-FAMILY>-<EXECUTION>`. The execution is a deterministic 16-character identifier of the physical configuration, including its manufacturing definition when assigned at creation. This is an editable ProtoLab convention, not a normative classification number. In **Design projects → Structure → Properties**, replace **Family designation** and **Execution / size variant** with your numbering, for example `MECH.100.001` and `02`. The result is `MECH.100.001-02`.

A different size or configuration receives a different execution. Repeated instances reuse the definition. Revision is separate: a corrected design can remain `MECH.100.001-02` with revision `B`. Moving an occurrence or changing its BOM position never changes its designation. Conflicting definitions with the same designation and revision are rejected.

Preview quality does not allocate executions. Parametric manufactured details derive identity from their effective recipe; inactive dimensions do not matter. SFK/TR8 families use their neutral assembly definition for pose identity; clamp release and inspection separation retain one execution. Other parameters remain significant unless the family explicitly declares otherwise.

## Purchased and standard products

`preset.name` remains the curated library title. `catalog.name` stores the original supplier listing title, including its source language. `procurement.name` records it in the configured product and takes precedence over an installation role such as "drive motor". Supplier designation, manufacturer, source URL and standard remain separate.

Original snapshots restore 12,092 titles. Absent titles are not fabricated: the library title supports preview, and project review reports the missing exact supplier title. Enter a verified title in **Make / buy → Exact shop / supplier name**. See [supplier title coverage](supplier-names.md).

Purchased and standard units are opaque. Supplier geometry may have separate visible solids, but internals do not become fabricated details or separate purchasing rows. Components cannot be added inside a purchased unit.

## FreeCAD

Manufactured objects use `<designation> <name> · rev <revision>`. Purchased objects use their supplier name. Standalone and project macros retain identity on physical objects and nested groups. Thread callouts do not rename purchased products.

| Property                       | Meaning                                  |
| ------------------------------ | ---------------------------------------- |
| `LibraryId`                    | Stable physical family ID                |
| `PresetId`                     | Selected model ID within its family      |
| `LibraryEntryId`                | Family ID or qualified family:model ID   |
| `Designation`                  | Enterprise designation or supplier model |
| `ProductName`                  | Manufactured name or supplier title      |
| `BaseDesignation`, `Execution` | Family and physical configuration        |
| `Revision`                     | Independent design revision              |
| `ConfigurationKey`             | Configuration fingerprint                |
| `ProductType`, `SupplyPolicy`  | Product category and make/buy policy     |

Macro, STL and parameter filenames contain designation and revision. Save an executed macro as FCStd to retain hierarchy and properties. Geometry is static in FreeCAD; change dimensions in ProtoLab and generate the new execution.

## Manufactured detail configurator

Find **Configured manufactured detail** and select a starting configuration or **Detail family**:

- Plate: length, width, thickness, centre or four-hole pattern.
- Sleeve / spacer: outside diameter, bore and length.
- Shaft / pin: diameter, length and optional transverse hole.
- Angle bracket: width, depth, height, wall and optional holes.

One validated definition drives preview, dimensions, identity and native FreeCAD geometry. Authored recipes remain available for complex mechanism parts. Material, blank, tolerances, finish and inspection requirements belong to the manufacturing record.

## Exchange and verification

**Design projects → Exports → Open ESKD JSON** exports a schema-6 draft for the referenced editor. ProtoLab project JSON remains its editable backup. See [exchange mapping and limits](open-eskd.md). Drawings are external files; JSON does not embed or create them.

The default-configuration audit covers 71 mechanisms, 5,756 declared occurrences and 6,293 identity records. Native FreeCAD tests cover metadata, supplier opacity, groups, placements, FCStd save/reopen, STEP export, rollback and the four forms. These checks do not supply toleranced ESKD drawings, title blocks, calculations or release approval.

`npm run audit:eskd` checks the complete default project creation and draft exchange path for every manufactured mechanism. Its report is `test-results/eskd-project-coverage.json`. The current 71/71 project and exchange fixtures were additionally validated against the upstream schema and semantic validator at the source commit recorded in that report. The local audit has no upstream runtime dependency and does not construct CAD geometry.

Incomplete supplier identities remain explicit draft records in Open ESKD; a `Draft:` exchange designation is never an ordering code. Geometry parameters exceeding the annotation size limit remain in the full ProtoLab Project JSON backup, with a fingerprint and omission notice in the exchange. Long manufacturing requirements remain complete in annotations, with a pointer in the bounded operation field. See the exchange guide before handing off these records.

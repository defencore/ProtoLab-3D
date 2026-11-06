# Library organization

This is the standing policy for placing, identifying and extending library elements. Apply it whenever a task introduces or changes a component, mechanism, source model, parameterized execution or navigation entry. The current paths are in [Library structure](library-structure.md); the [organization review](library-organization-audit.md) preserves the section analyses and outstanding work.

## Responsibility on every library change

The **`library_organizer`** role in [AGENTS.md](../AGENTS.md#library-organization-agent-library_organizer) owns the family-reuse decision, functional path and allocation of new Package IDs. Involve it before creating a package folder or detailed geometry and again before handoff. It checks the scope of every affected task so organization is maintained as the library grows.

The **`library_curator`** reviews the organizer's decision and verifies the package contract, source fidelity, parameters, model states, physical composition and integration. Component authors use the agreed IDs and interfaces. One agent may perform both roles when delegation is unavailable; record the responsibilities honestly. These reviews are part of ordinary implementation and do not add a user-confirmation requirement.

## One hierarchy

Use **collection → section/category → subgroup → functional family → model/execution/preset → parameter groups and fields**. Models and dimensions live in the selected family's configurator. Avoid extra folders for individual sizes, suppliers or projects.

Choose a location by the product's engineering function. Complete machines stay in Machines; reusable bearings, motors, guides, mounts and controls stay with their own functions. Reuse the existing categories and subgroups before adding another branch. Product type, Make or buy and Manufacturing process are views of the same products; keep their classification in `product.json`.

The package's `category` and `subgroup` must match the registered tree. Coordinate taxonomy changes across `src/core/library.ts`, `src/core/library-navigation.ts`, `src/core/library-labels.ts`, affected definitions and the [library map](library-structure.md). A shared catalog must have consistent member locations and a canonical primary. Do not edit the generated `src/parts/index.ts` registry by hand.

## Decide reuse before creating a package

Search `src/parts/`, package presets and guides, shared catalogs and relevant `src/catalog/` data. Search exact manufacturer/model/order codes and existing IDs as well as familiar names. Compare function, operating principle, physical composition, mounting interfaces, parameter contracts and source evidence; a visual resemblance alone does not establish a match.

Use the first applicable choice:

| Situation                                                                                                                               | Action                                                                                           | Identity result                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| The required configuration already exists                                                                                               | Reuse that family/model and add another physical occurrence where needed                         | Same Package/model IDs; a new occurrence ID identifies the installation              |
| Only supported design dimensions or continuous motion differ                                                                            | Configure existing parameters; add a useful preset when needed                                   | Same Package ID; distinct saved configuration, with a preset ID only when registered |
| The same design supports another thread, gear form, camera setup or accessory arrangement                                               | Extend compatible selectors, conditional fields, geometry and validation in the existing family  | Same Package ID; stable model/preset choices identify supported executions           |
| Another fixed supplier execution fits the family contract                                                                               | Add the actual sourced model and its preset; preserve its geometry and published characteristics | Same Package ID; a distinct model/preset ID and source identity                      |
| Related existing definitions have independently justified source/API or physical boundaries                                             | Put them in a shared `browseFamily`/catalog while preserving their implementations               | One browse entry; existing physical Package/model IDs remain selectable              |
| A distinct function, operating principle, composition or incompatible interface/source contract cannot fit an existing family correctly | Document that boundary, select a location and allocate a new package                             | New Package ID after uniqueness and curator review                                   |

Different lengths, diameters, thread sizes, gear ratios, camera models, motor windings or project names alone do not justify duplicate packages. Do not copy an existing mechanism into another package merely to change a parameter default. Parameterization must implement supported combinations in preview, dimensions, validation, native CAD and composition; a new selector label alone is not an implementation.

Keep purchased articles fixed to their source dimensions. Published ratings belong in `catalog.attributes` with corresponding filter fields, not editable design controls. Unknown values stay unknown. Different supplier executions remain identifiable even when their nominal envelopes match. A camera selector must select the actual camera definition and compatible installation; it must not resize one supplier camera to imitate another.

## Package, model and navigation IDs

| Record                 | Contract                                                                                   | Meaning                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Package ID             | `part.id`, globally unique, lowercase and hyphen-separated; matches `src/parts/<part.id>/` | The reusable physical family/definition                                                 |
| Model/preset ID        | Stable `preset.id`, unique within that package                                             | A registered execution or starting configuration                                        |
| Qualified library ID   | `<part.id>:<preset.id>`                                                                    | An unambiguous registered library selection                                             |
| Browse-family ID       | `browseFamily.id` or the shared catalog ID                                                 | Navigation grouping, not a physical product identity                                    |
| Configuration identity | Existing configuration key plus physical parameters/state                                  | A configured definition, including a custom configuration without a synthetic preset    |
| Occurrence ID          | Unique installed-instance reference                                                        | Placement and quantity in a project                                                     |
| Supplier/ESKD records  | Linked order code, enterprise designation and revision                                     | Procurement and engineering-document identities, independent of the internal Package ID |

The organizer allocates a Package ID only after searching the current registry, folders, exact product sources and any reviewed migration records for an existing definition. For a genuinely new family, choose a concise functional name consistent with nearby IDs. Supported dimensions and model selections belong below it. Established IDs can include meaningful construction distinctions; do not rename historical IDs merely to enforce a new spelling preference.

The curator checks uniqueness before registration or assembly use. Validate the folder/`part.id` match, local preset uniqueness and qualified lookup using the existing identity resolver. Keep all IDs visible and copyable through the normal metadata interface. See [the package contract](part-modules.md) and [ESKD identity rules](eskd-generation.md).

Renaming or moving a family changes its presentation/location, not its Package ID. Reusing a physical product in another project never allocates a second definition ID. Do not reassign an old ID to a different product or use a browse-family ID as `libraryId` in a project/export.

When actual duplicate physical definitions are established, choose an authoritative existing definition and document the mapping of affected Package/model IDs, source records, consumers and saved configurations. Migrate and verify project/ESKD/export references before retiring a definition. Similar names or common dimensions do not authorize silently deleting, redirecting or merging IDs. The existing OMRON and HIWIN overlap findings remain in the [review](library-organization-audit.md#canonical-product-identity) until that work is verified.

## Parameters, variants and states

Separate product selection, editable design dimensions, sourced characteristics, installation/motion controls and inspection controls. Use predictable groups, consistent quantity labels/units, valid defaults/presets and the existing `visibleWhen`, option `availableWhen`, `updateParameters` and relational validation mechanisms. Preserve keys whose meaning is unchanged.

Thread, length and other editable dimensions are parameters. Discrete supported camera, motor or gear choices use model/form selectors or presets, with dependent controls and interfaces reconciled on switching. If two gear constructions have incompatible geometry contracts, they may remain independently implemented members of one Gears catalog. The same distinction applies to source-qualified camera packages: one browse entry does not erase separate physical identities.

Model states express implemented physical/inspection behavior. Do not use Exploded, Open or another state ID to represent a size, camera model or thread choice. Inspection states preserve procurement identity, BOM quantity and installed placement; genuine physical selections use the existing `physicalStates` contract deliberately. Follow the curator's availability and `physicalProductState` rules.

## Required decision and handoff record

Before implementation, record the proposed collection/section/subgroup/family path, reused or allocated Package/model IDs, compared existing definitions, and why the difference is a parameter, a source model, a grouped member or a new package. Include affected parameter groups, valid combinations, states and source/identity limitations. Put package-specific decisions in its `GUIDE.md`; put shared taxonomy decisions in the [library map](library-structure.md) and relevant organization documentation.

At handoff, the organizer and curator verify:

1. The changed scope contains no newly duplicated size/model-only family, misplaced reusable component, orphaned entry or empty navigation branch.
2. The registered path, breadcrumbs, family/model search, exact Package/qualified-ID search and configurator all resolve the intended physical definition. Shared catalogs keep original source members selectable.
3. Parameter/model switching exposes only relevant controls, selects compatible configurations and reconciles unavailable states without changing physical identity accidentally.
4. Affected package checks and relevant navigation, naming, parameter/state, identity and composition tests pass. Run the application checks required by the package contract; perform native geometry checks when construction changes. Documentation-only edits need document/link checks, not new geometry analyses.
5. The handoff lists paths, Package/model IDs, reuse and grouping decisions, completed checks and remaining issues. Resolve confirmed organization defects in the changed scope; record wider findings without implying they were fixed.

## Documentation that remains with the project

Keep the policy here, the current hierarchy in [Library structure](library-structure.md), naming in [Library naming](library-naming.md), and reviewed section findings and follow-up decisions under `docs/library-organization-audit/`. Package-specific sources and design decisions belong in `GUIDE.md`.

Raw generated validation logs, measurements, inventory snapshots, backups and CAD exports remain in ignored `test-results/` under the [artifact rules](repository-hygiene.md). Summarize their relevant results, scope, limitations and unresolved findings in the reviewed documentation. A reader of a clean checkout must be able to understand the organization and its decisions without local test output. Historical review counts are snapshots, not live counts or proof that current code has passed the same checks.

# ProtoLab 3D agent instructions

These rules apply to the entire repository. Write repository documentation,
instructions, comments and interface text in English, as required by `README.md`.

## TRIZ design agent (`triz_designer`)

Use this role when designing a new mechanism or structure, or substantially
changing its operating principle or architecture. Involve it before detailed
geometry is created. Delegate the role when available; otherwise perform it
yourself. Scale the analysis to the engineering problem and apply the relevant
TRIZ tools rather than requiring every tool for every task.

### Design workflow

1. Define the required function, inputs, outputs and measurable acceptance
   criteria. Record relevant loads, motion, installation envelope, mass,
   precision, energy, manufacturing and maintenance constraints. Distinguish
   established requirements from assumptions and identify a baseline solution.
2. Inspect the existing component inventory and library capabilities. Model the
   useful, insufficient and harmful interactions between components; identify
   the cause of the main limitation and where and when it occurs. Consider the
   subsystem, system and surrounding system when choosing the problem boundary.
3. Formulate the ideal final result (IFR): describe how the required function
   would be achieved with minimal added resources and harmful effects while
   retaining required performance. Use it to guide simplification and reuse.
4. State the technical contradiction explicitly: improving a named parameter
   worsens another named parameter. Where useful, deepen it into a physical
   contradiction: the same element or property needs opposing characteristics
   under specified conditions. If no meaningful contradiction exists, record
   that finding and use the appropriate straightforward engineering solution.
5. Inventory available resources: existing parts, materials, geometry, motion,
   forces, energy/fields, space, time and information, including resources of
   the surrounding system. Look for functions that can be reassigned to remove
   unnecessary components while retaining their useful effects.
6. Select suitable TRIZ methods and explain the concrete transformation they
   suggest. Use inventive principles and, where appropriate, the contradiction
   matrix for technical contradictions; separation in space, time, condition or
   system level for physical contradictions. Consider functional analysis,
   trimming, substance-field analysis and standard inventive solutions, or
   physical effects when relevant. Use ARIZ for difficult unresolved inventive
   problems with a verified procedure. Verify any cited matrix entry, numbered
   principle or physical effect from a reliable source; do not invent mappings.
7. Develop mechanically distinct candidate concepts when several approaches are
   plausible. Compare them and the baseline against the same acceptance
   criteria, including relevant performance, size, mass, energy, complexity,
   manufacturability, component sourcing, cost and serviceability. Explain how
   each candidate addresses the contradiction and what disadvantages remain.
8. Validate the chosen concept with the calculations and checks appropriate to
   it: kinematics and travel, force/torque paths, strength or stiffness,
   tolerance/clearance requirements, interference and assembly access. Record
   assumptions and unresolved evidence. A TRIZ principle alone does not prove
   function, novelty or engineering readiness; do not claim an unperformed
   calculation, simulation or test.

### Integration and design record

- Before modeling a candidate's components, follow the required component
  workflow below. Have `library_organizer` resolve family reuse, placement and
  Package IDs, then coordinate with `library_curator` on hierarchy,
  unique element IDs, parameter groups, physical composition and appropriate
  Model states. Research and register missing purchased components first.
- Preserve source-qualified purchased dimensions and native analytic CAD
  geometry. Concept changes must not bypass source fidelity, product identity,
  FreeCAD performance or verification requirements.
- When reproducing an existing project, retain the requested source design.
  Keep TRIZ improvement proposals distinct from the faithful reconstruction;
  apply them when redesign is within the user's requested scope.
- Keep a concise design record in the relevant package `GUIDE.md` or established
  project engineering documentation: function and criteria → IFR and
  contradiction → resources and selected method → alternatives and selection
  rationale → library component IDs → verification and remaining questions.
  Keep the record proportionate to the problem and sufficient to review the
  decision.

Use the [TRIZ Body of Knowledge](https://www.aitriz.org/triz/triz-body-of-knowledge)
and [MATRIZ terminology](https://wiki.matriz.org/docs/triz/glossary-6146/) as
method references, alongside engineering sources for the actual mechanism.

## Library organization agent (`library_organizer`)

Use this role for every task that adds, removes, renames, moves or consolidates
library elements, models, parameterized variants or Package IDs, including
components introduced by a mechanism or project. Assign one organizer before
creating package folders or detailed geometry when delegating; otherwise perform
this role yourself. Apply the review during every affected task and again before
handoff, without waiting for a separate cleanup request. This is a standing
repository responsibility.

The organizer owns the reuse decision, functional location and allocation of new
Package IDs. The `library_curator` reviews that decision and owns package-contract,
source, parameter/state and integration verification. The same agent may perform
both roles when necessary, with both responsibilities recorded. Routine organizer
and curator decisions do not require an additional user approval step.

Follow [library organization](docs/library-organization.md), the current
[library structure](docs/library-structure.md) and
[naming rules](docs/library-naming.md).

### Required organization workflow

1. Search `src/parts/`, package `presets.json` and `GUIDE.md` files, existing shared
   catalogs and relevant `src/catalog/` sources. Compare engineering function,
   operating principle, interfaces, physical composition, source identity and
   configurable differences. Check exact manufacturer/model IDs as well as names.
2. Choose in order: reuse an existing configuration; add a preset or source model;
   extend a compatible family's parameters/selectors; group independently justified
   definitions in an existing shared catalog; create a new package only when the
   earlier choices cannot represent the product correctly. Record that reason.
3. Keep variations of the same mechanism or element inside its configurator.
   Thread, length, diameter, gear type, camera type, motor execution and compatible
   accessory choices alone must not multiply standalone packages or browse rows.
   Use conditional controls and validation for supported combinations. Fixed
   purchased products select actual sourced models; they are not freely resizable.
4. Assign an existing collection → section → subgroup → family by engineering
   function, including each reusable assembly component. Reuse established branches
   before adding navigation. A complete machine, its drive and a separately
   purchased motor retain their appropriate physical boundaries and locations.
5. Reuse the Package ID for an existing physical definition. Allocate a new
   lowercase, hyphen-separated `part.id` matching its package folder only after
   checking global uniqueness and the need for a new family. Each model/execution
   has a stable local `preset.id`; its qualified ID is `<part.id>:<preset.id>`.
   A `browseFamily.id` groups navigation and never replaces these physical IDs.
   Do not allocate new IDs merely for another project, display name, size or supplier
   listing of the same product. Preserve existing IDs on renames and moves.
6. Agree the path, Package/model IDs, reuse decision, parameter groups and valid
   model/state combinations with `library_curator` before implementation. Component
   agents use that shared decision rather than independently creating duplicates.
   Distinct architectures or incompatible source contracts can retain separate
   physical packages in one shared catalog; similar appearance is not proof of
   interchangeability. Consolidating existing IDs requires an explicit consumer
   migration and identity/export checks, not silent deletion or reassignment.
7. Before handoff, check family/model search and exact-ID lookup, breadcrumbs,
   subgroup placement, selector switching, parameter relevance and supported states.
   Apply the curator's affected package, identity, composition and application
   checks. Inspect the changed scope for newly duplicated families or misplaced
   components; repair confirmed issues in that scope and record wider findings.

### Durable organization record

Keep organization rules in `docs/library-organization.md`, the current map in
`docs/library-structure.md`, and component-specific reuse/ID decisions in the
affected `GUIDE.md`. Update relevant reviewed findings under `docs/` when resolved.
The handoff identifies the hierarchy path, reused/allocated Package and model IDs,
parameter/model choices, duplicate-prevention rationale, checks and remaining gaps.
Only raw generated logs, CAD exports and temporary audit data belong in ignored
`test-results/`; durable decisions and reviewed section findings must remain in
project documentation without depending on ignored files.

## Library curator agent (`library_curator`)

Use this role whenever adding, removing or changing library families, models,
navigation, parameter schemas or model states. Assign one curator for the task
when delegating work; otherwise perform this role yourself. Component agents
must follow the shared structure and have their changes reviewed against these
rules before handoff. The curator agrees the location, parameter scheme and
state semantics before implementation, then verifies the integrated result.
Review the `library_organizer` reuse, location and ID decision; do not register a
new package before that organization review. Reject size/model-only duplicates
that fit an existing family's parameter or catalog contract.

### Hierarchy and classification

- Maintain one hierarchy: collection → category/section → subgroup → product
  family → model/execution/preset → parameter groups and fields. The last two
  levels belong to the selected family's configurator, not extra navigation
  folders for every size or supplier.
- Reuse existing categories, subgroups and families before adding new ones.
  Group components by engineering function; complete machines and their
  reusable components retain their appropriate separate locations. Avoid
  duplicate families, orphaned entries, empty branches and unnecessary nesting.
- Each physical package has an explicit `category` and `subgroup`. Group related
  sources through `browseFamily` and shared catalogs while preserving each
  member's physical identity, geometry, supplier evidence and configuration.
- Keep taxonomy changes coordinated across `src/core/library.ts`
  (`librarySections`, `libraryCatalogGroups`), `src/core/library-navigation.ts`
  (collections and category mapping), `src/core/library-labels.ts` and affected
  package definitions. Update [library structure](docs/library-structure.md) and
  follow [library naming](docs/library-naming.md). Do not edit the generated
  package registry manually.
- Function, Product type, Make or buy and Manufacturing process remain views of
  the same products. Keep production classification in `product.json`;
  navigation grouping must not redefine procurement or manufacture.
- Preserve package IDs, preset IDs, parameter keys and state IDs when their
  meaning is unchanged. Renaming or moving a family must preserve saved
  configurations, project references and original supplier designations.

### Unique element IDs and ESKD references

- Every element added to the library must have a unique, stable ID before it is
  registered or used in an assembly. The curator checks uniqueness and rejects
  missing or duplicate IDs. Reuse an existing element's ID for the same product;
  never allocate another ID merely because another project uses it, or reassign
  an old ID to a different product.
- Follow the existing ID contract: `part.id` is globally unique, lowercase and
  hyphen-separated, and matches its package folder. Each catalog model/execution
  has a stable `preset.id`, unique within its package; the qualified reference
  `<part.id>:<preset.id>` identifies that specific library entry unambiguously,
  matching the existing preset-search entry ID.
  A family ID alone must not stand for several different size executions.
- Make IDs visible and copyable in element metadata, and ensure exact-ID lookup
  can find the corresponding family/model and select it for an ESKD project.
  Search and selection must resolve the physical element even when it appears
  through a grouped catalog or its display name or category changes.
- Preserve `libraryId`, applicable `presetId`, physical configuration and the
  existing configuration identity when adding to a project or exporting to
  ESKD/FreeCAD. Occurrence IDs identify installed instances; repeated instances
  reference the same product definition. Do not resolve products by display
  name, tree position or BOM row number alone.
- Library identity, enterprise ESKD designation, supplier order code and revision
  remain separate linked records. Use the existing identity resolver and
  [ESKD identity rules](docs/eskd-generation.md); do not replace a supplier code
  or enterprise designation with the internal library ID. Verify uniqueness,
  exact-ID lookup and identity retention through project/export round trips
  when changing identification or selection behavior.

### Parameter consistency

- Use consistent names, symbols and units for the same physical quantities.
  Organize fields into clear groups in a predictable order. Define types,
  defaults, numeric bounds and steps, compatible options and useful descriptions
  through the existing parameter schema.
- Use `visibleWhen`, option `availableWhen`, `updateParameters` and relational
  `validate(parameters, state)` rules for dependent controls. Defaults and
  presets must remain valid; switching models must reconcile incompatible
  choices and expose only relevant fields.
- Keep product selection, editable design dimensions, sourced characteristics
  and operating/inspection controls distinct. Fixed purchased models retain
  their real dimensions; catalog filters select actual products rather than
  resizing them. Store published ratings in `catalog.attributes` with matching
  `catalogFilterFields`; unknown values remain unknown.

### Correct Model state for each element

- Define only meaningful, implemented `PartDefinition.states`. Examples include
  Assembled/Exploded for separable assemblies, Cutaway where section geometry is
  supported, Free/Compressed for a spring, or Open/Closed for a suitable
  mechanism. Do not copy generic state options onto every component. A simple
  part with no useful alternative can omit `states` and use `default`.
- Every state needs a stable ID, clear label and description, with corresponding
  preview geometry, native CAD output, dimensions and validation. Changing a
  label alone does not implement a state. Keep Simple/Full thread detail in its
  existing geometry-mode control; model and size variants belong in selectors
  or presets. Continuous angle, travel and extension normally use parameters.
- Set `states[].availableWhen(parameters)` for model-specific states. Put a
  sensible canonical state first and ensure every supported configuration has
  at least one valid available state. When a model or parameter change makes
  the selected state unavailable, reconcile it through the shared
  `availableModelState` helper. Check availability explicitly; state-ID
  validation alone does not establish that a state applies to the current model.
- Inspection states such as exploded or cutaway must not alter procurement
  identity, BOM quantities or installed project placements. Follow the existing
  `physicalProductState` normalization when adding products to projects.
  Declare `physicalStates` deliberately for genuine physical selections, such
  as screw-only versus nut-only, and preserve their identities in composition
  and exports. Document the distinction for each family.
- Check model/preset switching, state availability and fallback, conditional
  fields, preview, `dimensions`, `python` and applicable `buildExportGeometry`
  or `exportDimensions`, plus canonical project state and physical composition.

### Curator review

For implementation changes, run affected package checks and relevant navigation,
catalog-family, naming, parameter, state-selection and composition tests. Check
that tree navigation, breadcrumbs, search and configurator agree. Report the
resulting hierarchy path, element IDs, parameter groups, supported states and unresolved
inconsistencies. Follow [the package contract](docs/part-modules.md),
[mechanism selection](docs/mechanism-selection.md) and
[project state rules](docs/engineering-projects.md).

## Engineering design and review agents

Use the relevant roles below for new or changed mechanisms, structures,
enclosures, frames and their engineering interfaces, including changes to loads,
kinematics, materials or manufacturing processes. Agree on shared requirements,
layout, datums and interface parameters before parallel implementation. Assign
roles when delegating; otherwise perform the applicable work yourself. Scale
analysis and verification to the change and its unresolved engineering questions.
Documentation-only edits require document checks, not new geometry analyses.

### Mechanism engineer (`mechanism_engineer`)

Own the kinematic scheme, degrees of freedom, joints, bearings, guides, drive and
transmission selection. Produce a motion scheme, load path, relevant operating
cases and source-backed component selection. Check travel, force/torque, speed,
losses, backlash, lubrication, stops and the motion envelope. Coordinate concept
changes with `triz_designer` and component identities with `library_curator`.

### Structural reviewer (`structural_reviewer`)

Review load-bearing parts, frames, enclosure mounts and their connections.
Identify the load path to supports and assess strength, stiffness and relevant
stability, fatigue, vibration, creep and thermal effects. Record material and
process assumptions, boundary conditions, allowable deformation and the basis
for margins. Explain which failure mode or deformation governs the design.

### Manufacturing and assembly reviewer (`dfm_dfa_reviewer`)

Review the chosen manufacturing route, functional datums, fits, tolerance stacks,
tool access and assembly/disassembly sequence. Own enclosure integration checks:
real component fit, ports, cable routing, thermal paths and required sealing.
Check installation, adjustment, inspection and replacement of service parts.
Return concrete geometry or process corrections with the affected component IDs.

### Design verifier (`design_verifier`)

Check the integrated design against its acceptance criteria and the evidence
produced by the other roles. Prefer a reviewer other than the design author
when delegation permits; identify a self-review honestly when it does not.
Verify applicable calculations, tolerance/motion checks, physical composition,
source identities and generated FreeCAD geometry. Distinguish completed checks
from proposals, assumptions and remaining gaps. Report failures with affected
IDs and configurations; resolve applicable failures before claiming verification.
Keep the verification traceable from requirement to calculation/source, model
configuration and actual check result.

### Shared engineering principles

1. **Requirements before geometry.** Establish the function, interfaces, loads,
   travel, speed, accuracy, installation envelope, life, operating environment
   and manufacturing route as applicable. Define measurable acceptance criteria,
   units and operating cases; separate known inputs from assumptions.
2. **Skeleton / top-down design.** Start with a layout of axes, datums, mounting
   points, envelopes and interface dimensions. Give shared dimensions one
   authoritative definition and derive dependent geometry consistently. Keep
   reusable parts in their local coordinate systems and position occurrences
   explicitly. Fixed purchased products retain their sourced dimensions.
3. **Kinematics and constraints.** Define allowed and restrained motion for each
   joint, intended degrees of freedom, actuation and travel limits. Check
   unintended mobility, binding, dead centres and singular positions. Justify
   intentional redundant constraints and how alignment or compliance handles
   them; an animated pose alone does not prove a workable mechanism.
4. **Load paths and drive sizing.** Trace forces and moments from the working
   element through transmissions, shafts, bearings, fasteners and joints to the
   supports. Evaluate relevant working, acceleration, braking, holding and
   specified overload cases. Select drives using required force/torque and speed,
   efficiency, inertia, duty and thermal limits. Verify self-locking, bearing
   load capacity, axial retention and preload where relied upon; do not infer
   them from appearance or the presence of a motor, screw or bearing.
5. **Strength and stiffness.** Check allowable stress and functional deformation.
   Include frame racking, torsion, guide alignment and connection compliance
   where relevant; assess buckling, fatigue, vibration, creep or thermal
   distortion when the operating cases require them. Choose margins from the
   material, process, loads, uncertainty and applicable requirements. Do not
   assign a universal safety factor to every construction.
6. **Datums, fits and tolerance stacks.** Identify what locates, clamps, transmits
   load and provides axial retention. Define functional bases and critical
   interfaces; calculate limiting clearances, interference and alignment from
   component tolerances, process capability and temperature. Justify any
   statistical tolerance method and its assumptions. Select bearing locating
   and floating arrangements for the application, including thermal expansion.
   Do not invent a universal fit or clearance for all materials and processes.
7. **Full motion and installation envelopes.** Check the path between end states,
   including intermediate positions and relevant parameter extremes. Include
   fasteners, accessories, cables, hoses, connector insertion/removal and tool
   access. Maintain required operating and installation clearances; endpoint
   screenshots or an exploded view do not establish interference-free motion
   or a possible assembly sequence.
8. **Design for manufacturing (DFM).** Choose the process early and use its real
   constraints: cutter reach, tool radii and setups for machining; bend radii,
   bend allowance, reliefs and flat patterns for sheet metal; weld access and
   distortion for welded frames; layer orientation, anisotropy, supports and
   insert installation for printed parts; draft, wall transitions, ribs and
   bosses for moulded parts. Size walls and features using the chosen material,
   process capability and loading, not one copied thickness for every product.
9. **Design for assembly and service (DFA).** Demonstrate the installation order
   and entry path of components, bearings, fasteners and captive nuts. Check
   tool access, tightening, adjustment, inspection and disassembly. Standardize
   suitable hardware and interfaces, and allow replacement of wear parts.
   Avoid assembly steps that require passing a part through a smaller opening
   or tightening an inaccessible fastener.
10. **Enclosures as component interfaces.** Lay out the actual boards, batteries,
    connectors, controls and mounts before finalizing the enclosure. Account for
    connector bodies and mating plugs, cable bend space and strain relief,
    service access, heat sources and heat paths. Where specified, design sealing
    surfaces, gasket compression, cable entries, ventilation or condensation
    management for the operating environment and verify the relevant criteria.
11. **Failure review and evidence.** Use a proportionate failure-mode review
    (FMEA where appropriate) for relevant wear, loosening, jamming, overload and
    loss-of-function cases, and connect mitigations to checks. Start with useful
    analytical estimates; use simulation or prototypes when needed to resolve
    the engineering question. For FEA, document material properties, loads,
    constraints, contacts and mesh convergence. Tie each claimed result to the
    actual configuration and revision; keep incomplete concepts identified.

### Engineering review sequence and records

Establish requirements and a concept with `triz_designer`, then have
`library_organizer` resolve reusable families, locations and IDs and agree missing
components and their contracts with `library_curator`. Develop the layout and load
cases with the mechanism and structural roles, involving DFM/DFA before geometry
is finalized. Follow the component registration and native CAD rules below.
Review the integrated geometry and assembly sequence, then have `design_verifier`
check the relevant acceptance criteria and evidence. Repeat the affected checks
when a design change invalidates their inputs or results.

Keep the layout, calculations, interface/tolerance decisions, assembly sequence
and verification status in the relevant `GUIDE.md` or established engineering
documentation. Store generated reports and exports under ignored `test-results/`.
Existing production-release requirements continue to apply; these roles do not
replace the project's manufacturing, procurement or ESKD records.

Method references include [skeletal modeling](https://help.autodesk.com/cloudhelp/2022/ENU/Inventor-Help/files/GUID-0435FE9D-6283-4CE0-813B-BD9B0BE5778C.htm),
[bearing selection and arrangements](https://www.skf.com/binaries/pub12/Images/0901d196802809de-Rolling-bearings---17000_1-EN_tcm_12-121486.pdf),
[FDM design considerations](https://www.stratasys.com/en/stratasysdirect/resources/articles/3d-printing-balanced-design-key-factors/)
and [mechanism design and verification](https://standards.nasa.gov/standard/NASA/NASA-STD-5017).
Use the references relevant to the selected technology and application.

## Required component workflow

For any new or substantially changed complex mechanism, including a copy or
adaptation of an existing project, use this order:

1. Break the mechanism down into physical components and subassemblies. Record
   quantities, make or buy status, supplier identities, required interfaces and
   the intended FreeCAD group paths before modeling the components.
2. Check the existing library before creating geometry. Search `src/parts/`,
   package `presets.json` and `GUIDE.md` files, and the relevant `src/catalog/`
   sources by component type, manufacturer, exact model, execution and dimensions.
   A similar-looking family is not proof that the required product is available.
3. Have `library_organizer` record the reuse/parameter/model decision, hierarchy
   path and IDs with `library_curator` before creating a new package. Reuse
   matching library configurations. If a family exists but the required
   supplier execution is missing, add a sourced preset or model to that family
   when it fits the package contract; avoid duplicate definitions.
4. Research, model, verify and register missing components in the library before
   incorporating them into the mechanism. This is primarily required for
   purchased components and standard hardware.
5. Build the mechanism from those library definitions and their physical
   occurrences. Declare package dependencies and physical composition according
   to [the package contract](docs/part-modules.md) and
   [product library rules](docs/product-library.md). Do not hide a purchased
   component's only definition inside assembly-specific geometry.

## Missing purchased components

- Identify the actual manufacturer, model, order code and relevant revision or
  execution. Research the exact product rather than inventing a plausible shape.
- Prefer original manufacturer CAD for that execution. Otherwise reconstruct
  the model from manufacturer dimensioned drawings, datasheets and verified
  dimensions. Use traceable supplier documentation when manufacturer evidence
  is unavailable, and record that source's limitations.
- Preserve source geometry when importing CAD. For reconstruction, reproduce all
  documented geometry and dimensions, including mounting holes, shafts, threads,
  seats, connectors, travel and installation clearances where applicable.
  Verify units, axes and origin; do not arbitrarily scale a purchased product to
  fit an assembly or combine dimensions from different executions.
- Record source URLs, document or CAD revision, verified dimensions and any
  conflicts or modifications. For imported CAD, retain source hashes and
  applicable license notices using the existing native-CAD workflow. Keep
  catalog evidence in `presets.json`, classification in `product.json`, and
  component-specific sources and fidelity limitations in `GUIDE.md`.
- Missing dimensions must remain explicitly unresolved. Search for additional
  drawings or CAD rather than guessing critical geometry. An approximation or
  installation envelope does not satisfy the requirement for an accurate
  purchased-component model. Keep incomplete work identified as an engineering
  reference and report the missing evidence; do not present the component or
  dependent mechanism as fully verified.
- A purchased motor, bearing, gearbox or electronic module remains one
  procurement unit unless its parts are separately purchased for this project.
  Preserve documented internal geometry when available; do not invent
  undocumented internals or turn display solids into extra procurement items.

## Copying or adapting an existing project

Before recreating the assembly, inspect the original BOM, CAD tree, drawings and
available source files. Record the upstream project, revision and license.
Decompose its subassemblies into separately purchased and manufactured physical
components, retaining quantities, dimensions and assembly placements.

Map every component to an existing library definition or add the missing reusable
definition/configuration first, including project-specific manufactured details.
Research and model purchased items using the rules above. Keep source identity
and original geometry traceable; record deliberate modifications separately.
Then reconstruct the project from library occurrences. A single imported mesh
or opaque authored assembly does not replace the component breakdown and library
registration. Purchased supplier units retain the procurement boundary above.

## FreeCAD assembly tree

- For every new or substantially changed multi-component device, mechanism or
  complex product, plan the FreeCAD tree during the component breakdown. Keep
  real subassemblies together and group their components by installation
  function. Reuse clear English folder labels such as **Fasteners**,
  **Enclosures**, **Electronics**, **Motion & drives** and **Structural parts**
  wherever they apply. Create only folders that have components, and keep each
  physical component individually selectable.
- In standalone CAD recipes, declare explicit `component_groups` paths for
  named subassemblies and components whose role is ambiguous or differs from
  their library category. When supplying `component_groups`, assign a path to
  every direct shape child in recipe order. Use an empty path only for a
  component that belongs directly under the assembly. Use automatic grouping
  for a recipe only when verified library categories produce the planned tree.
- In project exports, group leaf siblings within their existing occurrence
  parent and retain subassemblies as occurrence containers. Preserve placements,
  component indices, library and occurrence IDs, and BOM quantities. Use the
  shared `App::Part` grouping workflow with identity placement at creation. Keep
  each purchased or standard product as one procurement unit. An ordinary
  standalone single-body detail stays one `Part::Feature`.
- Before handoff, have `design_verifier` execute the command generated by
  **Copy for FreeCAD** for a representative assembled configuration and the
  project macro where applicable. Check that the tree matches the planned paths,
  every component is in the expected folder and selectable, and placements and
  identities match the source. Record the checked configuration and result in
  the package `GUIDE.md` or established project engineering documentation.

See the [FreeCAD assembly export guide](docs/freecad-assemblies.md) for the
generator and traversal contracts.

## Native CAD geometry and FreeCAD performance

- Model engineering surfaces with native analytic or parametric CAD geometry.
  Use true lines, circles and arcs in profiles; native cylinders, cones, spheres
  and tori; and appropriate extrusions, revolutions, sweeps and Boolean features.
  Preserve genuine spline/freeform surfaces when the design requires them.
- Keep browser/STL tessellation separate from native CAD construction. Generate
  FreeCAD solids from dimensions, analytic profiles or retained source BREP/STEP,
  rather than converting preview triangles or STL facets into individual CAD
  faces. Carry native geometry descriptions through component recipes and
  placements using the existing native-geometry SDK and serializers; a circular
  profile must not become a sampled polygon on export.
- A plain full solid cylinder must remain a native cylinder: normally one
  cylindrical side face and two planar end faces, rather than hundreds or
  thousands of planar strips or triangles. Apply the same principle to round
  holes, shafts, fillets and other curved surfaces. Increasing preview segments
  must not increase native face counts for these primitives. Hiding edges does
  not correct faceted native topology.
- Preserve dimensions, bores, threads, component boundaries and intentional flat
  faces such as hexagons and gear teeth. Keep original manufacturer CAD surfaces;
  source-only mesh data requires documented reconstruction and verification,
  not a claim of exact native CAD. Do not simplify a part into an inaccurate
  envelope merely to reduce its face count.
- Refine redundant Boolean splitters where appropriate without losing physical
  features or component identity. Refinement is not a replacement for rebuilding
  a tessellated cylinder with an actual cylindrical surface.
- Inspect generated FreeCAD shapes, not just shaded previews. Check solid
  validity, surface types, face counts, volumes and source dimensions on representative
  configurations and relevant STEP/FCStd round trips. For simple primitives,
  verify their expected analytic topology; investigate unexplained face-count
  growth and correct unnecessary faceting before handoff. When optimizing
  existing geometry, record before/after face counts and
  file sizes while checking that required geometry and placements are retained.

See [native geometry guidance and verification](docs/native-geometry-optimization.md).

## Verification and handoff

- Check source dimensions and interfaces against the resulting model. Keep the
  browser preview, reported dimensions, native FreeCAD geometry and physical
  composition consistent. Verify relevant geometry and execute the generated
  macro when changing shape construction; package validation alone does not
  prove geometric accuracy.
- Run `npm run parts:check -- <part-id>` for affected packages and the relevant
  geometry/composition tests. Follow the package contract for application checks
  and builds when changing implementation.
- Follow [manufacturer CAD guidance](docs/manufacturer-cad.md),
  [model fidelity evidence](docs/model-fidelity-audit.md) and
  [repository artifact rules](docs/repository-hygiene.md). Keep generated exports
  and verification reports under ignored `test-results/`.
- In the handoff, identify reused and added library components, their source
  evidence, completed checks and remaining gaps. Keep shared package `README.md`
  files universal; put component-specific notes in `GUIDE.md`.

# Product library and design release

The library starts with six collections: **Hardware**, **Motion**, **Electronics**, **Workshop**, **Machines** and **Vehicles**. Within a collection, **Function** groups products by category and subgroup. Related product families keep their model or size choices in the configurator. Categories and subgroups expand independently; opened branches are remembered for the browser session, and the grouping view is remembered between visits. The collection follows the selected product when the library reopens.

Navigation is separate from a product's type, supply policy and manufacturing processes. Its package ID remains stable when the collection or navigation view changes. Each package owns its classification in `product.json`; registration and portable-package checks reject missing or invalid profiles. API2 registration also requires a physical composition function for manufactured assemblies, complexes and kits. Purchased supplier units can remain opaque.

**Product type** groups details, assembly units, complexes, kits, materials and engineering references. **Make or buy** separates manufactured, standard, purchased and reference families. **Manufacturing process** lists families under every process declared by their profile; it does not invent a fabrication route for purchased components. These are alternative views of the same products within the selected collection. Opening another branch does not close the branches already in use. During search, selecting a collection keeps the query and narrows its results; **All collections** returns to global results. See the [library structure](library-structure.md) for collection contents and search behavior.

## Product types and specification sections

| Product               | Meaning                                                                     | Specification section               |
| --------------------- | --------------------------------------------------------------------------- | ----------------------------------- |
| Detail                | A part with its own design definition                                       | Details when manufactured           |
| Assembly unit         | Components joined in an assembly                                            | Assembly units when manufactured    |
| Complex               | Interconnected products with a common purpose                               | Complexes when manufactured         |
| Kit                   | A defined set supplied or used together                                     | Kits when manufactured              |
| Material or stock     | Raw material, extrusion or another specified stock input                    | Materials                           |
| Standard product      | A configured product identified by an applicable normative product standard | Standard products                   |
| Purchased product     | An identified supplier execution used as a procurement unit                 | Other products                      |
| Engineering reference | A design tool, installation envelope or incomplete functional construction  | No production specification section |

Purchased motors, bearings, electronics and similar supplier assemblies remain procurement units. Their visible internal solids do not imply that a project owner must manufacture winding packs, bearing races or electronic components. Conversely, an authored machine or mechanism requires individually identified physical components and an explicit make or buy definition for each occurrence.

Authored assemblies render and export their configured library components. Custom details use a structured local geometry recipe; translation and rotation belong to their occurrences. Recipes support turned and extruded profiles, lofts, analytic shaft bores, helical worm cuts and boolean features without executable source in configuration data. The component retains its local definition when an inspection view moves it or the project reuses it at another position. Annular gear profiles retain their complete closed CAD boundary; analytical machining features preserve round bores and helical cuts in the native export. Selected mesh joining and conformance policies are recorded on the configured detail and apply consistently to its preview, project occurrence and STL. They do not establish a manufacturing tolerance.

Supply is recorded on a configured project product and can differ from a family's default policy. For example, a machined shaft design may instead be ordered from a supplier; a custom screw cannot claim standard-product status merely because its library family contains standard presets. Materials retain the materials section even when identified by a supplier or a material standard.

An engineering reference cannot acquire a production section by changing its supply field. It must be replaced by a library definition with the necessary product or fabrication evidence.

## Sources and manufacturing definitions

Catalog identity, geometry fidelity and production approval are separate records. A source reference can establish a nominal diameter without establishing a complete product execution, fit, working rating or manufacturing drawing. Manufacturer CAD establishes the recorded source geometry and its documented exceptions; it does not approve the project application.

The distinction is explicit for the following examples:

- Thread-tool presets cite thread-size tables. They define geometric tools and configurable caps or plugs, rather than supplier products available for purchase.
- A bevel-gear pair combines separately sold gears. Its default policy is an authored assembly, not one purchased product.
- MGN mounting-envelope labels are geometry references, not normative product standards.
- Generic fluid cylinders, valve blocks, motors, sensors and similar functional envelopes remain engineering references when they lack a complete supplier execution or detailed internal design.

A manufactured configuration needs a selected material, blank, processes and engineering requirements. Profiles declare applicable processes; a configured manufacturing definition must choose its actual route. Turning, milling, cutting, drilling, bending, printing, moulding, wire forming and assembly are distinct processes. No process list by itself establishes a production drawing, safe load rating or functional qualification.

Spring designs require material condition, forming and heat treatment, a load curve and suitable acceptance criteria. Sheet brackets require a developed blank, bend radius and bend allowance. Stock sections require a real section specification and cut allowance. Gears require a manufacturable tooth form and mating-clearance requirements. Generic geometry cannot substitute for those records.

## Release requirements

Every family declares `releaseRequirements`. These requirements describe engineering work that a configured project must resolve; adding a profile does not mean the work has been completed.

Before production release, verify the project's designations, revisions, drawings, assembly composition, procurement references, manufacturing definitions and acceptance criteria. Engineering references, unresolved assembly components and missing make or buy definitions prevent production release while remaining available for design exploration.

Specification sections follow the selected documentation policy. The application records product structure and design-document links; these records do not certify compliance with every applicable ESKD/DSTU/GOST requirement or generate all required toleranced drawings automatically.

## Maintaining a package

Keep classification in the package's `product.json`, component-specific evidence in its `GUIDE.md`, catalog evidence in `presets.json`, and physical composition in the definition's composition function. Do not infer make or buy classification from a part name, engineering category, number of visible solids or the mere presence of a catalog row.

Run the package checker after changing classification. `tests/product-library.test.ts` checks portable profile coverage, classification exceptions, specification mapping and all library views. `npm run audit:models` regenerates the source-fidelity inventory and preserves the reviewed product profile for every family in its JSON report, with independent classification counts.

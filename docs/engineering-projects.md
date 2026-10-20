# Engineering project workspace

Open **Design projects** after configuring a library product. A project stores
configured product definitions separately from their physical occurrences. The
same shaft or bearing configuration can appear at several positions; each
occurrence owns its parent, quantity, local placement and installation notes.
Definitions own designation, revision, manufacturing or purchasing records and
associated documents.

## Build the product structure

The workspace separates **Structure**, **Specification**, **Exports** and
**Review**. Select a product under Structure, then use **Properties**, **Make /
buy** or **Documents** for its records. Project details and enterprise rules are
available in a disclosure above these tabs. A save badge distinguishes a locally
saved project, an unsaved draft and stored records requiring recovery.

1. Create or select a project and enter its name, designation and revision.
2. Add the current library model at the root, or select an assembly and add it as
   a child. An authored mechanism imports its explicit physical library
   composition. A purchased supplier assembly remains one procurement unit.
3. Select an occurrence to edit its position, quantity, parent, placement or notes.
   Define its make or buy record, material, stock, route, supplier or standard as
   applicable. Reopen its configuration in the library to inspect the model.
4. Add drawing, assembly drawing, specification, model or instruction records.
   A record includes designation, name, revision, format and file reference; it
   does not generate a toleranced drawing automatically.
5. Use **Create independent design** before changing the structure of one reused
   assembly. This forks its design and nested assembly records while retaining
   unchanged leaf details. Old documents are not copied as unreviewed revisions.

Inspection states such as exploded or cutaway are converted to the canonical
physical state when adding a model. States explicitly representing different
physical items, such as a ball screw versus its nut or a guide rail versus its
carriage, remain separate designs. Imported project records cannot designate an
inspection-only state as a physical product.

Repeated occurrences of one assembly design must have the same child structure.
Changing only one occurrence's composition requires an independent design. A
single designation and revision cannot identify conflicting configurations.
Cycles, orphaned references, unknown library products, invalid configurations,
nonfinite placements and duplicate sibling positions fail validation.

## Apply enterprise documentation rules

**Enterprise documentation rules** stores the section order, section labels,
designation pattern and additional document kinds with the project. The default
section sequence is documents, complexes, assembly units, details, standard
products, other products, materials and kits. Section labels can follow the
enterprise's language and adopted forms.

A blank designation pattern imposes no format constraint. A pattern such as
`^PL\.[0-9]{4}$` accepts `PL.0001`. The bounded pattern syntax requires `^` and `$`,
limits fixed repetition counts to 1–64 and permits at most one variable
repetition. Groups, alternatives, optional repetitions and backreferences are
rejected. The rule checks project, product and document designations.

Manufactured details require material, stock, a route, inspection requirements
and a drawing record. Manufactured assemblies require an assembly route,
inspection requirements, assembly drawing and specification records. Enterprise
additional-document requirements augment these defaults. Purchased products
require actual supplier designation, manufacturer and source; standard products
also require the applicable normative product standard.

The policy selection is a declaration of the documentation basis. Section
ordering and naming follow the saved enterprise rules. The application does not
certify statutory compliance or engineering approval. Documentation completeness
and outstanding engineering review requirements are displayed separately.

## Export and preserve work

Projects are saved in this browser after valid changes. **Project JSON** is the
portable backup, including rules, configurations, occurrences and documents.
Import accepts only the current strict schema and resolves its library IDs
against the installed definitions. Rejected stored records are reported and can
be downloaded for recovery; automatic persistence does not overwrite them.

A specification lists the selected assembly's documents and direct children.
It does not flatten every nested component into that assembly's specification.
The purchasing and manufacturing CSV lists flatten the product tree, multiply
nested quantities and aggregate reused definitions. Procurement stops at a
purchased assembly, preventing another order for its internal supplier parts.
Reference geometry is omitted from production specifications and supply lists.

**Project FreeCAD macro** constructs the project tree from configured library
leaves, carries occurrence placements and preserves configuration, designation,
revision, quantity and manufacturing or procurement metadata. Parent containers
hold their configured children without duplicating the parent preview geometry.
A BOM quantity does not invent a spatial array: each occurrence has its recorded
placement. Add separate occurrences when separate installed positions are needed.

Choose **Simple** or **Full** in Exports before downloading a FreeCAD macro.
Simple uses nominal thread surfaces while retaining drawing callouts. Full adds
helical geometry for authored thread features. The filename and FreeCAD design
metadata record the selected mode. This export choice does not change product
identity, dimensions, project JSON or the specification. The library's own
Simple / Full control sets preview detail and the default project export choice.

The macro uses the active FreeCAD document and preserves existing objects.
Draft exports retain documentation issues and engineering review requirements.
CAD geometry, specification data and file links remain reviewable engineering
records rather than production approval.

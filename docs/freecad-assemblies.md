# FreeCAD assembly export

A single manufactured body creates one `Part::Feature`. A multi-component model creates an `App::Part` containing separate component features. Expand the parent in FreeCAD's model tree, select a component and change its **Placement**, or use Space to hide it. Moving the parent moves the full assembly. Rings, cages, rolling elements, shafts, nut bodies, seals, coupler hubs and gears retain their physical boundaries.

The parent stores the part identifier, parameters, selected display state and exact catalog attribution when applicable. Its geometry is static: edit dimensions in ProtoLab and generate another assembly. The export does not create assembly constraints or simulate motion inside FreeCAD.

Use **File → Save** for an FCStd document with the component tree. Select the assembly parent and use **File → Export → STEP** to export it with the standard FreeCAD importer/exporter. A script can use `Import.export([assembly], path)`; the low-level `Part.export` helper does not traverse an `App::Part` container.

## Generator contract

A part's Python recipe assigns `shape`. For an assembly, construct a `Part.makeCompound` with one direct child per physical component. Fuse surfaces or portions of the same manufactured body first. Nested compounds stay one logical component. Optional `component_labels` and `component_colors` lists must match those direct children in order. Colors are RGB triples from 0 to 1.

The wrapper preserves final component placements rather than reconstructing shapes from preview meshes. It validates geometry and dimensions before creating objects. Trimmed helical faces occasionally produce conservative analytical bounding boxes; a 0.005 mm tessellation refines a mismatched bound before the wrapper accepts or rejects it. Failed creation aborts the transaction and removes only objects created by that macro, including in headless documents with undo disabled.

## Guided ball screw axis

`ball-screw-axis.ts` composes the screw and two MGN guide modules in isolated Python functions. A base plate, moving table, carriage risers, nut saddle, socket-head bolts, and fixed/floating bearing supports complete the layout. Position changes move the table, nut, saddle, risers and carriages together, with usable travel limited by support clearance. Six presets use dimensioned SFK/SFU screw and MGN rail rows; the assembled stage is explicitly a custom prototype rather than a supplier product.

The default **Helical raceways and balls** detail shows the screw ball train immediately. Choose **Fast envelope** for a lighter preview. Guide recirculating balls remain separate components. Support bearing rings represent fit envelopes, not a load-rated bearing design.

## Repeat native validation

The checks run in a separate FreeCAD Python process and never touch a GUI document. They execute complete generated macros, move individual children and parents, verify component identity after FCStd reload, verify STEP solid/volume preservation, and force an invalid component to check rollback cleanup.

```sh
node --import tsx scripts/generate-freecad-assembly-checks.ts /tmp/protolab-assemblies.json
FREECAD_LIB=/Applications/FreeCAD.app/Contents/Resources/lib \
  /Applications/FreeCAD.app/Contents/Resources/bin/python \
  scripts/validate-freecad-assemblies.py \
  /tmp/protolab-assemblies.json /tmp/protolab-assembly-results.json
node --import tsx --test tests/ball-screw-axis.test.ts
```

On another platform, use its FreeCAD Python runtime and library location. The report records only the configurations that were executed; these checks do not certify dimensions, tolerances or load capacity for manufacturing.

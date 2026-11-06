# FreeCAD assembly export

See [ESKD product generation](eskd-generation.md) for designations, executions, revisions, supplier names and Open ESKD exchange.

A single manufactured body creates one `Part::Feature`. An assembly opens as an `App::Part` with separate component features and groups in the model tree. Standalone assemblies can show folders such as **Enclosures**, **Electronics**, **Fasteners**, **Motion & drives** and **Structural parts**. Expand the assembly and select a component to edit its **Placement**. Press Space on a component or group to toggle its visibility. Moving a group moves its descendants, and moving the assembly parent moves the full assembly.

Groups start at identity placement so all components keep their exported positions. The tree organizes geometry for browsing and selection. Product and occurrence identities, source attribution and BOM quantities continue to come from the original configuration and composition records.

The parent stores the part identifier, parameters, selected display state and exact catalog attribution when applicable. Its geometry is static: edit dimensions in ProtoLab and generate another assembly. The export does not create assembly constraints or simulate motion inside FreeCAD.

Use **File → Save** for an FCStd document with the component tree. Select the assembly parent and use **File → Export → STEP** to export it with the standard FreeCAD importer/exporter. A script can use `Import.export([assembly], path)`; the low-level `Part.export` helper does not traverse an `App::Part` container.

## Generator contract

A part's Python recipe assigns `shape`. For an assembly, construct a `Part.makeCompound` with one direct child per physical component. Fuse surfaces or portions of the same manufactured body first. Nested compounds stay one logical component. Optional `component_labels` and `component_colors` lists must match those direct children in order. Colors are RGB triples or RGBA quadruples; every channel must be a finite number from 0 to 1. RGB is opaque. RGBA's fourth channel is opacity: 0 is transparent, 1 is opaque. Malformed colors are rejected by standalone and project macros, including headless execution.

Standalone and project macros apply each RGB/RGBA value through an explicit FreeCAD surface material (`ShapeAppearance`), with material transparency equal to one minus opacity. This replaces inherited face materials instead of depending on the document's default appearance. Exported components use **Shaded** display, matching ProtoLab's solid preview. FreeCAD's Flat Lines display can conceal the surface color beneath dense polygon edges, particularly on the coupling spider. The jaw coupling uses the same sRGB palette for its preview and native export: silver hubs, dark screws and an orange elastomer spider. Different viewport lighting can still affect shading.

The appearance regression audit covers all five states of HLTNC, LF Clamp and LF Thimble, plus project export. Sixteen native GUI cases retain their exact RGB colors, opacity and Shaded mode after FCStd save/reopen. It also reproduces the black edge band with Flat Lines. Run `node --import tsx scripts/verify-freecad-colors.ts`, then execute the generated `test-results/jaw-coupling-colors/verify.FCMacro` with the FreeCAD GUI. The report and before/after renders stay in that ignored results directory.

`tests/freecad-appearance.test.ts` separately verifies RGB/RGBA validation, native `App.Material` opacity and headless standalone/project rollback. Headless FreeCAD has no `ViewObject`, so this check does not establish GUI display or transparent-material persistence through FCStd save/reopen.

Optional `component_groups` supplies one list of group labels per direct recipe component. For example, `[["Airframe", "Upper"], ["Electronics", "Battery"]]` places the two features under separate two-level paths. Authored paths take precedence over inferred grouping, including an empty path that places a component directly under its assembly. Common path prefixes reuse an `App::Part`. Each group contains at least one component or another occupied group.

For standalone assemblies that infer groups, the exporter uses the category of a resolved concrete library component first. Where a recipe supplies only recognizable component labels, the exporter can use those labels to choose a display folder. When some components can be classified, the remaining components go under **Other components**. Label-based classification applies only to the model tree.

In project exports, category folders organize siblings within each existing occurrence parent. The configured subassemblies and their descendants retain their recorded occurrence ancestry and relative placements. Purchased and standard products retain their procurement boundary and any authored groups for their display geometry.

Components keep their global `ComponentIndex`, original `AssemblyPlacement` and `AssemblyGroup` path where applicable. Scripts that enumerate geometry should traverse nested groups and select leaf `Part::Feature` objects. Sort those leaves by `ComponentIndex` when the recipe's original component order matters. For project occurrence records, look up the `App::Part` objects by `OccurrenceId`. Manufacturing metadata cannot overwrite native or assembly properties.

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

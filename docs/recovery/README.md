# CAD handoff documentation

Use this workflow for any generated part or assembly:

1. Export a FreeCAD macro from the library and run it in FreeCAD.
2. Inspect the component tree, configuration, geometry evidence, and available manufacturing properties.
3. Save the document as FCStd. Export selected solids as STEP when another CAD system is required.
4. Create drawings for individual manufactured parts. Assign datums, dimensions, tolerances, material, surface finish, and a revision before release.
5. Keep drawings, source configuration, CAD files, and the parts list together so their revisions remain traceable.

[SelectedPartDrawing.FCMacro](SelectedPartDrawing.FCMacro) creates three orthogonal TechDraw views of a selected solid in a new document. It does not assign manufacturing dimensions or qualify a part for production.

Component-specific dimensions, procurement details, and validation limitations belong in separate guides. The [manufacturing handoff guide](manufacturing-handoff.md) documents a reviewed assembly using this workflow. The [project README](../../README.md) covers installation and the complete library.

If drawing edges merge into thick bands, see [readable TechDraw views](../freecad-techdraw.md) and the repair macro for existing pages.

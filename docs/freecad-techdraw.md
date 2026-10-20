# Readable TechDraw views

Choose **Simple** above the library preview or in **FreeCAD options** before copying code. It generates smooth nominal thread envelopes, including printed threads, to keep projected edge counts small. Thread designations, pitch, direction and length remain in the manufacturing properties. Choose **Full** for helical thread geometry. The same choice is available under a design project's **Exports** tab.

Full adds helices where a thread profile and span are defined. Imported manufacturer CAD retains its supplied geometry, and models with unverified thread dimensions retain nominal surfaces. Consult the selected model's **Modeling notes** and source information; for example, the reconstructed SunnySky X5330 shaft remains nominal because its catalog record does not define the threaded span.

TechDraw line widths are measured in millimetres on the drawing sheet. They are independent of the source object's 3D viewport line width. Switching the library mode regenerates future exports; it does not modify existing FreeCAD objects.

## Existing drawings

Select a view, projection group, or page and run [FixTechDrawLines.FCMacro](recovery/FixTechDrawLines.FCMacro). With no selection, it updates all part views in the active document. The operation is undoable.

The macro sets visible lines to **0.18 mm**, hidden/isoparametric line widths to **0.13 mm**, and turns off smooth, seam, and isoparametric visible edges. It preserves source geometry, scale, placement, dimensions, hidden-line visibility, and application preferences. Per-edge cosmetic overrides are not reset.

To make the same change manually, select the drawing view in the tree. In the property editor's **View** tab, set **Line Width**, **Hidden Width**, and **Iso Width**. In **Data**, turn off **Smooth Visible**, **Seam Visible**, and **Iso Visible**. Changing the source solid's line width will not change the drawing.

## New drawings

[SelectedPartDrawing.FCMacro](recovery/SelectedPartDrawing.FCMacro) creates three views of one selected solid with the same thin strokes and exact projection. Its source geometry and the original assembly remain intact.

For views created manually with FreeCAD's Insert View command, choose a thinner **Line Group** under **Preferences → TechDraw → Annotation**, such as **FC 0.25mm**, or edit each view as above. Existing views retain their own settings. Reloading the ProtoLab solid does not set drawing preferences.

Regenerate previously exported parts in **Simple** to replace detailed helices. Each affected part carries a thread designation in its label plus `ThreadCallouts` and `ThreadFeaturesJSON` manufacturing properties. Nominal bores represent the thread major diameter, not a tap-drill or clearance-hole instruction. Use the callout and any full-depth / drill-depth notes when dimensioning a drawing. Full thread geometry still benefits from a detail view; drawings require datums, tolerances and process-specific dimensions.

Property definitions: [official FreeCAD TechDraw View documentation](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/TechDraw_View.md), [line groups](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/TechDraw_LineGroup.md).

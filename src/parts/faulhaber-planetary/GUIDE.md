# FAULHABER planetary

623 catalog presets with product, drawing and CAD source links. Only compressed runtime meshes and native BREP are bundled; original STEP/ZIP/PDF files stay external.

Original manufacturer external installation solids for the standard output-shaft execution and the selected number of gear stages. Shafts, pilots and mounting holes follow supplier CAD. Gear teeth, bearings and internal stages are not separate parts in these files. Ratios within the same stage count can legitimately share the same external geometry; their ratio and torque ratings remain distinct. Ratios are rounded catalogue values. The selected gearhead excludes the motor and motor-specific input adapter flanges supplied separately in the CAD archives. Catalogue L2 and the bare CAD body can consequently differ (notably the 22/32 mm GPT families). CAD bounds include the output shaft and all supplied projections. The 22GPT HT L2 values follow the dimensional drawing, which resolves duplicate shop length fields. No arbitrary scaling, gearbox simulation or load calculation.

Runtime meshes use lossless zlib compression. Regenerate with FreeCAD Python: `scripts/import-faulhaber-drives.py manifest.json models.json`. The manifest explicitly selects supplier solid indices from each archive execution. Selected file names, indices and SHA-256 hashes are preserved in every native asset.

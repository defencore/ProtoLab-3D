# FAULHABER BX4 brushless motors

21 buyable winding/execution presets. Geometry is baked from the official FAULHABER STEP archives. See each preset for product, drawing, CAD URL and SHA-256. Only runtime BREP/mesh data is bundled; reference PDFs and original STEP archives remain external.

Mounting plane Z=0, front shaft +Z. Manufacturer dimensions are fixed. The supplier models are installation solids, not exploded internal mechanisms. Electrical variants reuse their exact mechanical execution.

The separate **2250S024BX4 6855** preset is part number 2250.00430. Its exact product page links the same 2250S_BX4 STEP archive (SHA-256 `6b45e62b98198243e0b174761c382a56ced7a54dc219587f902a8f222071f6a8`). Its six blind M2 mounting holes are represented by Ø1.6 tap-drill bores in that supplier solid; the CAD does not contain internal helical threads.

Rebuild with FreeCAD Python: `scripts/import-faulhaber.py <download-directory>`. The importer selects one execution from archives containing multiple side-by-side alternatives.

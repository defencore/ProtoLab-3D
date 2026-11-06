# MS5837-30BA M10 depth sensor

A fixed stainless M10 MS5837-30BA depth sensor installation model from the original bill of materials. The ordered 10 m execution includes an adapter board absent from the external CAD.

The supplier execution is selected with `model`; geometry and measured installation dimensions are fixed. Original native faces remain in the normalized BREP. Each placement is one complete purchased unit. Source internal solids are retained for appearance, not promoted to made details. Printing fabrication export is disabled; FreeCAD installation export is available.

The complete catalog is owned by `presets.json`; the shared purchased-product reader consumes those records without runtime enrichment. `lib/catalog.json` retains the linked native source and installation metadata. Regenerate presets, native assets and assembly placements together with `scripts/rov/normalize-purchased-components.py`, using the original source import cache. The shared reader lives in the underwater-thruster package; declared package dependencies include that reader.

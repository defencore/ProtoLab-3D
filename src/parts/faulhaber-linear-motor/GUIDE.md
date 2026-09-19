# FAULHABER linear motor

32 catalog presets with product, drawing and CAD source links. Only compressed runtime meshes and native BREP are bundled; original STEP/ZIP/PDF files stay external.

Original FAULHABER housing and stroke-specific rod CAD assembled on their common Z axis. Position is a percentage of nominal stroke, from 0% to 100%, with 50% at the center of the catalog body. It translates only the rod and is not an electrical simulation. The 11 (analog Hall) and 12 (sin/cos) sensor versions share the same 1X mechanical housing. LM0830 includes the separate terminal foil provided in supplier CAD. Rod length is not stroke; mounting dimensions and terminal projections follow supplier CAD. Optional guides, cables and controllers are excluded. The supplier installation models do not resolve internal magnets, coils or sensors.

Runtime meshes use lossless zlib compression. Regenerate with FreeCAD Python: `scripts/import-faulhaber-drives.py manifest.json models.json`. The manifest explicitly selects supplier solid indices from each archive execution. Selected file names, indices and SHA-256 hashes are preserved in every native asset.

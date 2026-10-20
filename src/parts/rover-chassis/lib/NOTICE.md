# Supplier CAD provenance

These models are integration references from the identified manufacturers. They retain original surfaces and assembly placements, with a common rigid coordinate normalization for the library. Preview tessellation is separate from the native BRep. Any omitted defective or non-volumetric source feature is recorded by the importer and included in the model scope; no substitute equipment geometry is invented.

- **Pololu Romi**: official assembled-chassis STEP, https://www.pololu.com/file/0J1298/romi-chassis-kit.step . SHA-256 `38bb9571c9125f7f00ea12be1d8b85326b6557a96ddf9451932069ee58991be9`. This source has five solids; retail kit contents and CAD contents differ.
- **DFRobot Pirate 4WD ROB0003**: https://raw.githubusercontent.com/CainZ/ROB003/master/ROB0003.STEP , linked by https://www.dfrobot.com/product-97.html . SHA-256 `f0d62d2059f8768b2dc3f59a09711e0dd0d591e612bdfb3d32db2e6cd813584f`. The original 2015 STEP has 48 solids; it omits motors and the battery holder. Do not rescale it to match a different revision.
- **Waveshare UGV Rover PI4B AI Kit, no PT**: STEP member of https://files.waveshare.com/wiki/UGV-Rover/UGV_Rover_PI4B_AI_Kit.zip . Member SHA-256 `eec517fb278c336c5d6a2ec11636f60eb74c1b5a5c9743081220462e1903b6e0`. This is the PI4B source configuration, not a Pi 5, PT or bare UGV02 substitute.

The manufacturers retain their rights. Public CAD availability is not treated as an open manufacturing license. No supplier affiliation, product certification or unverified load rating is asserted. Follow original supplier terms for downstream distribution or manufacture.

Regenerate with the isolated FreeCAD Python importer in `scripts/import-robot-chassis.py`. Read its module header for the model selector and expected source paths and preserve the original source/member hashes. The source geometry hashes identify the downloaded revision, not a claim that every currently sold kit has the same revision.

# Bevel gearbox · 42 mm · 1:1

A distinct catalog assembly based on the supplied `differential-Part.step` and seller images for AliExpress item 1005006771991196. Two-gear and three-gear arrangements, 8/10 mm D, hex, keyway and inward-key socket presets. The three-gear arrangement is a fixed three-port transmission, not a differential.

Each gear has its own 61802/6802 bearing (15×24×5), a DIN 471 15×1 shaft ring and DIN 472 24×1.2 bore ring. Bearings are lightweight sealed cartridges; balls and cages are not separately modeled. The shaft and bore rings have separate plier holes and installed grooves. FreeCAD exports every cartridge, gear, ring and housing as an individually movable part.

The original housing outer geometry and mounting holes are retained. Its Ø21/Ø15 internal steps were incompatible with the pictured Ø24 bearing seat and are enlarged. Groove positions, bearing selection and internal clearance are inferred. Source mounting-hole positions differ from some photo annotations and follow the user-designated STEP. Thread holes remain smooth source geometry.

The source specifies M1, Z20, 1:1 and a 15 mm gear length. Tooth sweep is editable from 0 to 8° because the seller does not provide spiral angle, flank equations or a manufacturing drawing. The rejected 12° trial intersected at the tooth flanks; values above 8° are blocked. These are reconstructed tooth surfaces, not certified conjugate gearing. Hex dimensions are across flats; key depths beyond the supplied 8 mm example are approximate. The outward keyway runs into the hub and fades to a round bore at the small tooth end; its axial runout is reconstructed. Presets describe visible product variants, not independently verified SKUs.

The functional housing BREP/preview data are stored in `lib/housing.json`, with the original SHA-256 and every internal modification recorded. Reproduce using `scripts/import-bevel-gearbox-housing.py INPUT.step OUTPUT.json` with FreeCAD Python. No source STEP, PDF or reference-image archives are copied into the project.

## Verification

Validated with FreeCAD 1.0.2: all 16 presets, three additional display states, rotations at 5°, 37° and 90°, and the 0° sweep endpoint (23 configurations). Every physical component is one valid closed solid. Checks cover component intersections, independent movement, preview/CAD bounds and volume agreement, and STEP/FCStd roundtrips. This does not establish conjugate tooth contact, production fits or load capacity.

Reproduce the native audit with `FULL=1 node --import tsx scripts/verify-bevel-gearbox-42.ts`, then run `scripts/verify-electronics.py /tmp/protolab-bevel-42-cases.json` using a FreeCAD-enabled Python. The module also has targeted tests in `tests/bevel-gearbox-42.test.ts` and participates in the shared catalog/STL/macro tests.

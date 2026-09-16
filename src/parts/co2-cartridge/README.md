# CO₂ cartridges · threaded / unthreaded

**PNEUMATICS & GAS → GAS CARTRIDGES** contains 12 fixed Leland cartridge models, selected by CO₂ fill mass, neck type/connection and dimensions. 8, 12 and 16 g have both threaded and unthreaded variants; 20, 25, 33, 38 and 45 g extend the range. The two 38 g models have different neck threads. A matching gas charge does not imply identical dimensions or connector compatibility.

Dimensions A (overall length), B (body diameter), C (neck diameter/thread) and D (neck length) come from manufacturer specification tables Rev 14.0, converted using 25.4 mm/in. This is a versioned catalog reference: the manufacturer's general overview and newer product variants sometimes differ; dimensions from different rows are not mixed. The source is linked in every preset.

- [Specification 1.1 — smooth neck](https://www.lelandltd.com/small_high_pressure.htm)
- [Specification 2.1 — threaded neck](https://www.lelandltd.com/small_high_pressure2.1.htm)
- [Specification 3.1 — narrow smooth 12 g neck](https://www.lelandltd.com/small_high_pressure3.1.htm)

The model has a rounded base, smooth shoulder, sealed recessed cap, and a real helical UNF thread on threaded versions (3/8″-24 or 1/2″-20). Bottom radius, shoulder curvature, cap details, collars and thread coverage are reconstructed because the sources do not dimension them. Threads use nominal flat-root 60° profiles, without class-specific 1A/2A tolerance allowances. Manufacturer table dimensions are reference values, not inferred manufacturing limits.

Each export creates **one closed external solid** with the cartridge axis along +Z, bottom at Z=0 and cap at the source overall length. It represents a purchased cartridge for placement and clearance studies. It does not model pressure-vessel wall thickness, internal gas volume, weld construction or a puncture mechanism. The grams shown are CO₂ fill mass, never gross cartridge weight; CAD solid volume must not be interpreted as steel mass or gas capacity.

The browser preview and native FreeCAD macro share the same envelope and thread geometry. Use the generated Python/FCMacro for CAD geometry; STEP can be exported from FreeCAD.

## Verification

All 12 presets are checked for closed, oriented preview meshes and source A/B/C/D conversions in `tests/co2-cartridges.test.ts`. The native report in `data/co2-cartridges-native-validation.json` covers every model in FreeCAD 1.0.2: one valid closed solid, matching preview bounds/volume, preserved existing document objects, STEP export/reimport and FCStd save/reopen. These are geometry and integration checks, not a certification of source-undimensioned details.

```sh
node --import tsx --test tests/co2-cartridges.test.ts
node --import tsx scripts/verify-co2-cartridges.ts /tmp/protolab-co2-cases.json
# Use a FreeCAD-enabled Python; FREECAD_LIB overrides the default macOS library path.
python scripts/verify-electronics.py /tmp/protolab-co2-cases.json data/co2-cartridges-native-validation.json
```

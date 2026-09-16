# Thread tools · internal / external

Standalone, closed helical solids for FreeCAD Boolean operations. Select **FASTENERS & THREADS → THREAD GEOMETRY**. Includes M1–M68 coarse and selected fine metric sizes, UNC, UNF (including 3/8″-24), UNEF, basic Tr and ACME profiles. Use **Custom dimensions** to change nominal diameter, pitch in mm or TPI, length, handedness, starts and radial allowance; the custom profile adds angle, depth and crest width.

- **External · Union**: the tool is a solid threaded rod. Fuse it into a base with a positive overlap. Do not fuse a nominal-diameter shaft along its whole length: that fills the grooves. A supporting shaft along the thread must fit inside the tool's minor diameter.
- **Internal · Cut**: the tool is the positive volume removed to create the threaded bore, including its core. Select the target first and tool second, then Part → Boolean → Cut. No pilot hole is necessary. For through holes, extend the cutter beyond both target faces.

Use Placement to position and rotate the tool. Its axis is +Z; its lower end is at Z=0. Python/FCMacro adds one Part::Feature to the active document without changing existing objects. STEP preserves a CAD solid; STL is a mesh and should not be used directly for Part Booleans.

## Geometry contract

Pitch is axial spacing between neighboring crests. Lead = pitch × starts. Inch conversions use 25.4 exactly: 3/8″-24 is diameter 9.525 mm and pitch 25.4/24 mm. Left/right handedness is shared by preview and CAD. Each tool is limited to 80 axial pitches and 1–4 starts. Both ends are plane-trimmed; no chamfer or thread runout is implied.

Metric and Unified tools use a truncated 60° reference profile: crest P/8, external radial depth 17√3·P/48, internal-cutter radial depth 5√3·P/16. Roots are flat approximations. Tr and ACME use basic, symmetric 30° and 29° profiles with depth P/2; standard root clearances and class-specific allowances are omitted. These are design tools, not certified ISO 6g/6H or ASME 2A/2B gauges. Catalog size references do not certify a finished mating fit. NPT/BSPT pipe tapers and rounded Whitworth forms are not included.

Radial fit adjustment adds to an Internal Cut tool radius and subtracts from an External Union tool radius. Applying 0.1 mm to each half creates 0.2 mm additional radial gap (0.4 mm diametral). It is a radial offset, not a normal flank offset or tolerance class.

Sources: manufacturer BAER metric/UNC/UNF/UNEF/Tr tables and Roton ACME size references, linked per preset. Nominal diameter and pitch are source values; length, number of starts, direction, custom profile and fit adjustment are design choices.

## Verification

`tests/thread-tools.test.ts` checks all 79 presets in both modes for finite, closed, consistently oriented preview meshes and expected bounds, plus pitch conversion, handedness, lead, clearance and rejected inputs (163 tests). Generic module tests cover STL, macro export and parameter boundaries.

`scripts/verify-thread-tools.ts` prepares 24 representative native cases: M1, M2, each thread family, 3/8″-24 UNF, left-hand and multi-start threads, and a custom profile with clearance. `scripts/verify-thread-tools.py` runs their complete macros using FreeCAD, checks the radial profile against the preview, performs actual Cut/Union operations, and round-trips STEP and FCStd. Results are recorded in `data/thread-tools-native-validation.json`. This samples supported geometries; it is not certification of every arbitrary custom combination or manufactured fit.

```sh
node --import tsx --test tests/thread-tools.test.ts
node --import tsx scripts/verify-thread-tools.ts /tmp/protolab-thread-cases.json
# Run with a FreeCAD-enabled Python (FREECAD_LIB may override the default macOS library path):
python scripts/verify-thread-tools.py /tmp/protolab-thread-cases.json data/thread-tools-native-validation.json
```

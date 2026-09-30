# Thread tools, caps and plugs

Standalone helical Boolean tools and finished threaded caps or plugs, each exported as one closed solid. Select **FASTENERS & THREADS → THREAD GEOMETRY**. Includes M1–M68 coarse and selected fine metric sizes, UNC, UNF (including 3/8″-24), UNEF, basic Tr and ACME profiles. Use **Custom dimensions** to change nominal diameter, pitch in mm or TPI, length, handedness, starts and radial allowance; the custom profile adds angle, depth and crest width.

- **External thread · tool / plug**, with **Threaded body / Boolean tool** selected: the tool is a solid threaded rod. Fuse it into a base with a positive overlap. Do not fuse a nominal-diameter shaft along its whole length: that fills the grooves. A supporting shaft along the thread must fit inside the tool's minor diameter.
- **Internal thread · cutter / cap**, with **Threaded body / Boolean tool** selected: the tool is the positive volume removed to create the threaded bore, including its core. Select the target first and tool second, then Part → Boolean → Cut. No pilot hole is necessary. For through holes, extend the cutter beyond both target faces.

Use Placement to position and rotate the tool. Its axis is +Z; its lower end is at Z=0. Python/FCMacro adds one Part::Feature to the active document without changing existing objects. STEP preserves a CAD solid; STL is a mesh and should not be used directly for Part Booleans.

## Body forms and central holes

**Body form** offers a plain threaded body, a round cap/plug and a hexagonal cap/plug. Catalog entries continue to specify nominal thread size; the body form and its dimensions are custom design choices, not standard cap or fastener specifications.

- In external mode, a cap form makes a threaded plug with an integral head. Thread runs from Z=0 to **Threaded length / cap cavity depth**; the head starts there and adds **Cap end thickness**.
- In internal mode, a cap form makes a finished female threaded cap. The cavity opens at Z=0 and ends at the threaded depth; a solid end of the chosen thickness closes it. This is the finished part, not a positive cutter to subtract from another part.
- **Cap diameter / hex across flats** sets the round outside diameter or the wrench size of a regular hexagon. Hex vertices lie at 0, 60, ... degrees; X extent is across-flats × 2/√3 and Y extent equals across-flats. The smallest outside radius must leave more than 0.1 mm radial stock beyond the adjusted thread crest. This is only a geometric minimum, not a strength requirement.
- **Central through hole** enables an axial bore. On a threaded body or plug it passes through the complete part; on a female cap it passes through the end into the threaded cavity. Disable it for a solid plug or closed cap. Its radius must remain at least 0.1 mm below the thread root, preserving an unbroken thread wall or end annulus.
- A hollow **Internal Cut tool** removes an annular threaded volume and leaves a central post in the target. Keep its hole disabled when making an ordinary threaded bore.

The defaults preserve the plain tool without a hole. All forms share thread direction, pitch, starts and radial adjustment. Ends and head transitions are sharp; machining fillets, thread runout, engagement, sealing surfaces and load capacity must be specified for the intended part.

## Geometry contract

Pitch is axial spacing between neighboring crests. Lead = pitch × starts. Inch conversions use 25.4 exactly: 3/8″-24 is diameter 9.525 mm and pitch 25.4/24 mm. Left/right handedness is shared by preview and CAD. Each tool is limited to 80 axial pitches and 1–4 starts. Both ends are plane-trimmed; no chamfer or thread runout is implied.

Metric and Unified tools use a truncated 60° reference profile: crest P/8, external radial depth 17√3·P/48, internal-cutter radial depth 5√3·P/16. Roots are flat approximations. Tr and ACME use basic, symmetric 30° and 29° profiles with depth P/2; standard root clearances and class-specific allowances are omitted. These are design tools, not certified ISO 6g/6H or ASME 2A/2B gauges. Catalog size references do not certify a finished mating fit. NPT/BSPT pipe tapers and rounded Whitworth forms are not included.

Radial fit adjustment adds to an Internal Cut tool radius and subtracts from an External Union tool radius. Applying 0.1 mm to each half creates 0.2 mm additional radial gap (0.4 mm diametral). It is a radial offset, not a normal flank offset or tolerance class.

Sources: manufacturer BAER metric/UNC/UNF/UNEF/Tr tables and Roton ACME size references, linked per preset. Nominal diameter and pitch are source values; length, number of starts, direction, custom profile and fit adjustment are design choices.

## Verification

`tests/thread-tools.test.ts` checks all 79 presets in both modes for finite, closed, consistently oriented preview meshes and expected bounds, plus pitch conversion, handedness, lead, clearance and rejected inputs. Additional cases cover both cap shapes, both thread modes and holes on/off; the optional `FREECAD_PYTHON` test validates native solid topology, cavity and roof occupancy, full through holes, bounds and preview/native volume agreement. Generic module tests cover STL, macro export and parameter boundaries.

`scripts/verify-thread-tools.ts` prepares 24 representative native cases: M1, M2, each thread family, 3/8″-24 UNF, left-hand and multi-start threads, and a custom profile with clearance. `scripts/verify-thread-tools.py` runs their complete macros using FreeCAD, checks the radial profile against the preview, performs actual Cut/Union operations, and round-trips STEP and FCStd. Results are recorded in `data/thread-tools-native-validation.json`. This samples supported geometries; it is not certification of every arbitrary custom combination or manufactured fit.

```sh
node --import tsx --test tests/thread-tools.test.ts
node --import tsx scripts/verify-thread-tools.ts /tmp/protolab-thread-cases.json
# Run with a FreeCAD-enabled Python (FREECAD_LIB may override the default macOS library path):
python scripts/verify-thread-tools.py /tmp/protolab-thread-cases.json data/thread-tools-native-validation.json
```

## Manufacturing method

Choose **Machined metal** for a smooth nominal-diameter tool, cap or plug with drawing callouts. It creates no helical faces and applies no print-fit allowance. Choose **3D printed** when the exported mesh must contain the real thread flanks. Printed thread tools and their presets use this explicit mode. Thread size, pitch, handedness and length remain available in FreeCAD manufacturing properties in either mode.

# Flexible jaw coupling

This folder owns this part's parameter schema, defaults, preview, FreeCAD recipe, validation and catalog presets. Edit or replace the folder without changing another part.

- `part.ts`: definition and local model behavior. Factory-based definitions use private helpers under `lib/`.
- `configurator.ts`: ordered catalog size selectors. The numeric/conditional parameter schema belongs to the definition in `part.ts` or its private factory.
- `presets.json`: complete catalog and example parameters, IDs and source metadata.
- `lib/`: private domain helpers and reference values. Edits here affect this package only.
- `index.ts`: API version, stable part ID and display order.

Only the generic geometry SDK under `src/core` is shared. Run `npm run parts:check -- jaw-coupling` to check this package and `npm run parts:export -- jaw-coupling <output-folder>` to prepare a runnable handoff with the SDK and reference assets.

The two shaft bores are independent. Existing D25 L30 presets include 6.35 x 10 mm and 8 x 10 mm pairs. The native axis is Z: hub A is on the negative side and hub B on the positive side. `jawCouplingLayout(parameters)` exposes the actual smooth hub spans and shaft insertion datums. For these presets, each smooth clamping section is 10.3 mm long and the opposed shaft-tip gap is 9.4 mm. Rotate around Y by +90 degrees to place bore A on negative X and bore B on positive X.

For the HLTNC entries, the source attachment supports the outer diameter, overall length and bore pairs. Jaw profiles, spider, clamp hardware and internal clearances remain authored installation geometry. The attachment has no live purchase URL or verified torque/stiffness rating. Confirm the delivered execution, shaft insertion, tightening instructions, bore fit and operating ratings before ordering or powered use; this preview is not a released manufacturing drawing of supplier internals.

## Miniature LF coupling

The LF D14 L22 two-jaw design adds 11 Clamp bore pairs, 17 Thimble bore pairs and an **Other hole** order for each fastening type. Choose **Coupling design**, **Shaft fastening** and **Bore pair**; Other hole exposes both bore dimensions. The catalog also filters by source series, fastening and fixed/custom bore order. Existing HLTNC D25 L30 configurations retain their three-jaw design.

Clamp uses a split hub and transverse clamp screw. Thimble uses an unsplit hub and radial set screw. The two LF jaw sets are offset by 90 degrees and surround a four-lobe polyurethane spider. Assembly, exploded, individual hubs and spider views use the same construction as the FreeCAD export. LF jaw arcs, root dimensions, clearances and screw-head details are authored installation geometry. Clamp screws are illustrative M2 geometry; the M3 fastener in the supplied drawing does not establish the clamp-version screw size.

The supplied LF-B-D14L22(2 claws) drawing specifies D14 mm, L22 mm, a 3–6.5 mm bore range and M3 fastening. It lists zinc-alloy hubs, a polyurethane spider, 0.8 N·m rated torque, 1.5 N·m maximum torque, 19000 r/min maximum speed, 0.02 mm allowable eccentricity, 1 degree allowable deflection and 14 g mass. These ratings belong to the drawing execution; they do not establish ratings for modified or oversized bores.

The user also requested 7–8 mm Thimble bores. They are retained as listing options with explicit **provisional D14 L22 envelope** descriptions; their outside diameter and length are excluded from verified dimensions. The supplied drawing does not verify their installation envelope. Other hole bores are editable custom order inputs and do not qualify as fixed catalog bore dimensions. The seller page could not be independently inspected; the supplied drawing, photos and variant list are the evidence for these entries.

The LF source drawing and three construction photos are bundled under `public/references/jaw-coupling/` and linked directly from each LF catalog entry.

## Analytic native surfaces

FreeCAD jaw sectors and spider lobes use exact concentric circular arcs joined by radial lines, followed by extrusion and ordinary cylindrical bore cuts. A curved wall is one cylindrical surface rather than a sequence of narrow planar strips. The HLTNC six-lobe spider has 27 native faces; the LF four-lobe spider has 19. Hexagonal screw sockets remain true polygonal cuts.

The browser keeps its tessellated display of those same radii, angular limits and clearances. Native curves remove the small chord approximation in the previous exported outline; nominal bores, overall dimensions, component positions and selectable states remain the same. `tests/jaw-coupling-analytic.test.ts` checks every preset's native spider against its independently calculated annular-sector area, analytic wall count and envelope when `FREECAD_PYTHON` is set.

The FreeCAD 1.1.4 comparison covered all 68 assembly presets and the other four states of three representative constructions, for 80 cases. Every case retained its solid count, closed valid geometry and envelope; all assemblies retained noninterfering components. The largest envelope difference was 0.00000005 mm. The largest volume change was 0.0166%, from replacing sampled chords with the intended circular arcs.

| Representative assembly | Native faces before / after | STEP bytes before / after | FCStd bytes before / after |
| ----------------------- | --------------------------: | ------------------------: | -------------------------: |
| HLTNC D25 L30, 5 / 5 mm |                    847 / 97 |       1,241,611 / 182,739 |           185,023 / 61,167 |
| LF Clamp, 3 / 4 mm      |                    581 / 81 |         855,307 / 156,585 |           126,251 / 58,105 |
| LF Thimble, 3 / 4 mm    |                    567 / 67 |         820,808 / 123,065 |           109,945 / 42,658 |

These STEP/FCStd samples preserve the same five physical solids and their component boundaries. The full comparison report, before/after native source and Flat Lines renders are local audit outputs under `test-results/analytic-geometry/jaw-coupling/`.

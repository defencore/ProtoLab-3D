# Analytic native CAD and consistent appearance

All 285 registered families use the common standalone and project exporters. Both assign explicit opaque component materials and Shaded display. The default surface RGB now comes from the same steel palette as browser primitives. The bearing/seal and mounting families changed in this pass also publish their actual preview colors for individual races, rolling elements, cages, seals and other components.

The library audit generated all 571 available default states in Simple mode without errors. This inventories real recipes and verifies shared appearance routing; it does not claim native GUI execution of every preset. Package validation passed all 285 packages and 19,805 presets.

## Geometry changes

Known circular geometry is expressed as native circles, arcs, cylinders, cones, revolutions and Boolean cuts. Browser triangles and STL tessellation remain necessary display/export representations; they are not used to rebuild these native surfaces.

- Jaw sectors and elastomer spiders use exact concentric arcs and radial lines, extrusion and bore cuts.
- Nineteen bearing/seal families recover straight and circular meridians. Fifteen of those families have fewer native faces. Noncircular authored roller profiles retain their existing geometry.
- Spring pins use cylindrical/conical stock with bore and slit cuts. Adapter sleeves use their taper, bore, slit and circular locknut profiles.
- Three linear-bushing families use circular cages and rectangular return-channel cuts.
- Four shared shape kernels emit rounded rectangles with true corner arcs. Mechanical arc bands and tori retain explicit native primitives. Eight independent shape serializers also use analytic meridians.
- Analytic descriptions survive manufactured-detail recipes and coordinate reanchoring. Validation rejects descriptions that contradict the sampled preview geometry. Intentional polygonal outlines, such as hexagonal profiles, retain their flat faces.

Imported manufacturer and community CAD remains unchanged. Polygon wires and explicit shells in the audit can represent intentional flats, teeth or freeform surfaces; their presence alone does not justify replacing a model with a simpler envelope.

## Measured examples

| Native model                     | Faces before | Faces after |      Size before |     Size after |
| -------------------------------- | -----------: | ----------: | ---------------: | -------------: |
| HLTNC jaw coupling assembly      |          847 |          97 | STEP 1,241,611 B | STEP 182,739 B |
| LF Thimble jaw coupling assembly |          567 |          67 |  FCStd 109,945 B | FCStd 42,658 B |
| Spring pin                       |          392 |           8 |   BRep 441,255 B |   BRep 8,222 B |
| Adapter sleeve                   |          489 |          26 |   BRep 375,987 B |  BRep 19,097 B |
| Linear ball bushing              |          886 |         179 |   BRep 606,352 B | BRep 158,558 B |
| Plain spherical bearing          |           70 |           8 |    BRep 43,731 B |   BRep 4,201 B |

Across 80 coupling comparisons, BRep bytes fell 77.3% and generated Python fell 83.5%. Across 24 shared-kernel comparisons, native faces fell from 1,104 to 147 and BRep bytes from 596,128 to 92,010. These are measured cases rather than an extrapolated percentage for the entire library.

Native comparisons preserve component counts, bores, openings, placement and nominal dimensions. Bounds differ by at most 0.00212 mm in the mounting examples and 0.0000001 mm in the bearing examples. Small volume changes replace the previous chord approximations with the intended circular surfaces; they are recorded in the reports. The kernel checks also compare against exact mathematical volumes.

## Verification and reproduction

- 80 coupling comparisons, all 68 complete preset assemblies checked for interference, 72 exact spider-area/cylindrical-wall cases, and three STEP/FCStd round trips.
- 34 bearing comparisons with STEP round trips, selected interference checks and explicit component-color checks.
- 27 mounting/bushing comparisons with STEP round trips and physical-feature checks.
- 24 shared-kernel before/after comparisons with exact volumes and STEP round trips; additional native tests cover reversed/full sectors and translated detail recipes.
- Four shared-kernel preview tests compare the original sampled triangle coordinates exactly.

Generate the library inventory with `node --import tsx scripts/audit-native-geometry.ts`. It saves to `test-results/native-geometry-audit/inventory.json`. Generate kernel cases with `node --import tsx scripts/verify-analytic-kernels.ts`; execute `scripts/verify-analytic-kernels.py` with a FreeCAD-enabled Python. An optional earlier case file produces before/after measurements.

Native reports, source hashes and before/after renders stay under `test-results/analytic-geometry/` and `test-results/native-geometry-audit/`. The coupling Flat Lines renders demonstrate an actual reduction in topology; the improvement does not depend on hiding edges with Shaded mode.

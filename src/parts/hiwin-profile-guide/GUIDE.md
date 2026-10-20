# HIWIN profile guide

Find **Components → Linear motion → Profile rails → HIWIN profile guide**. Use the inline model catalog to filter series, nominal size, actual rail width, carriage length/width, assembly height or mounting pitches. Select a real model, then set the requested rail cut length and carriage arrangement below the catalog. No source cross section is scaled when a length changes.

The package includes 30 executions from HIWIN G99TE22-2011:

- MGN 7, 9, 12 and 15, in C and H lengths: eight conventional miniature models.
- MGW 7, 9, 12 and 15, in C and H lengths: eight wide miniature models.
- HGH 15CA and 20/25/30 CA/HA: seven square industrial models.
- HGW 15CC and 20/25/30 CC/HC: seven flanged industrial models.

The conventional MGN/MGW series is deliberately distinguished from the newer -O series: MGN12H here is 45.4 mm long, not MGN12H-O's 47.6 mm. Nominal industrial size is also distinct from rail width: HG size25 uses a 23 mm-wide rail; size30 uses 28 mm. MGW15 has a 42 mm-wide rail with two mounting rows 23 mm apart.

The rail direction is X, rail centre is Y=0 and the rail mounting base is Z=0. Source H and H1 are measured from that mounting base. Native rail and carriage mounting holes are actual voids; counterbore depths, top thread diameters/depths and B/C mounting pitches are taken directly from the relevant source row. One to four carriages can be placed along the rail; validation rejects overlap or insufficient length. Rail-only and one-carriage states provide separate physical supplier units.

A symmetric hole arrangement is derived for each custom cut, retaining the source pitch and positive end material around the counterbores. Its exact end distances are displayed in the design assessment. The source's typical end distances are reference values; confirm the ordered cut and end-hole arrangement with the supplier.

This is an installation model reconstructed from published mounting drawings. External envelope and mounting interfaces are source dimensions. Raceway radii, channel clearance, cover and centre-body contours, rolling elements, return paths and detailed manufacturing tolerances are not supplied by those drawings. They must not be treated as a rail/carriage manufacturing drawing. Specify preload, accuracy class, seals and lubrication execution when ordering.

Source: [HIWIN G99TE22-2011](https://www.hiwin.com/wp-content/uploads/Linear_Guideway-E.pdf), printed pp37, 41, 86 and 87; checked 2026-10-19. Local source metadata and the catalog SHA-256 are in `lib/source-evidence.json`.

Run `npm run parts:check -- hiwin-profile-guide`, `node --import tsx --test tests/motion-catalog.test.ts`, then use `scripts/verify-motion-catalog.ts` and `scripts/verify-motion-catalog.py` for native FreeCAD validation and sample STEP/FCStd exports.

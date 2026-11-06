# Miniature motion components

All four requested component groups are available in the Motion collection. Existing families retain their previous supplier configurations.

| Component                  | Added choices                                                | Location and selection                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GMP16T-TEC1636 gearmotor   | 17 reduction ratios at 12/24 V; 34 references                | Motors & actuators > Motor assemblies. Search `107-11.6D7` or `361-11.6D7`; filter ratio, voltage, stages, envelope and published speed/torque.                                                        |
| Miniature radial bearings  | All 39 requested bore x outside diameter x width tuples      | Bearings & seals > Ball bearings > Deep groove ball bearing. Select dimensions or search the ID size code.                                                                                             |
| Flanged miniature bearings | F623, F686, F688, F689, F695, F696, F698 and F608-2RS        | Bearings & seals > Ball bearings > Flanged miniature ball bearing. Select bore, body diameter and overall width.                                                                                       |
| KAIYADE SFK                | 15 table rows; 180 screw choices and 15 standalone nuts      | Linear motion > Ball screws. Select family, diameter, lead and 100–550 mm length. SFK08025 also matches SFK0825/SFK082.5. End machining offers Unmachined, EK6/EF6 0802 reference and custom journals. |
| LF jaw coupling            | 11 Clamp pairs, 17 Thimble pairs, plus two Other hole orders | Transmission & linkages > Shaft couplings > Flexible jaw coupling. Select LF D14 L22, fastening and bore pair; Other hole exposes independent bore dimensions.                                      |

The gearmotor changes gearbox length with stage count. Only eight ratios have published output performance; other values remain unknown. The attachment conflicts between its general 3 kgf·cm gearbox rating and 5 kgf·cm values in some output-table rows; catalog notes preserve that distinction.

Flanged bearings have an integral outer-ring flange in preview and FreeCAD. Body dimensions and closures follow the requested list; flange geometry uses independent manufacturer references and does not establish seller interchangeability.

KAIYADE references remain distinct from Wangong where dimensions or load ratings differ. The supplied EK6/EF6 drawing establishes the 0802 end envelope. Applying that envelope to other 8 mm SFK leads is explicitly provisional. Total shaft length includes journals. Nominal M6 x 0.75 end-thread dimensions are recorded; its thread form is not modeled.

LF Clamp has split hubs and transverse screws; Thimble has unsplit hubs and radial set screws. The D14 L22 drawing supports bores up to 6.5 mm. Requested 7–8 mm variants retain their bore choices but carry provisional outside envelopes; those envelope dimensions cannot satisfy verified catalog filters.

The [TT Motor GMP16T-TEC1636 datasheet](https://www.ttmotor.com/uploads/GMP16T-TEC1636.pdf) provides a public source for the supplied motor table. The original KAIYADE and LF attachments remain identified in the catalog without a verified public copy. AliExpress pages could not be inspected, so current listing availability and combinations beyond the supplied options remain unconfirmed. The product guides document the evidence and geometry limits:

- [GMP16 gearmotor](../src/parts/gmp16-gearmotor/GUIDE.md)
- [Radial bearings](../src/parts/ball-bearing/GUIDE.md)
- [Flanged miniature bearings](../src/parts/flanged-ball-bearing/GUIDE.md)
- [SFK ball screws](../src/parts/ball-screw/GUIDE.md)
- [LF jaw couplings](../src/parts/jaw-coupling/GUIDE.md)

## Verification

Focused checks cover option completeness, independent filters, source evidence, invalid configurations, preview envelopes, mounting pilots, the motor D-flat, retaining grooves, clamp/set-screw differences and watertight boundary samples. Native FreeCAD checks verify solid validity and representative preview/export agreement. STEP round trips supplement the native checks.

Reproduce the motor audit with `node --import tsx scripts/verify-gmp16-gearmotor.ts`, then run `scripts/verify-motors.py` against the generated cases using a FreeCAD-enabled Python. Motor cases cover every ratio/voltage in assembled/separated states with and without leads and at 0/90-degree shaft positions. The package guides and focused tests retain the remaining component-specific evidence.

Native reports are saved under `test-results/gmp16-gearmotor/` (136 cases), `test-results/miniature-bearings/` (18 cases) and `test-results/kaiyade-sfk/` (three complete assemblies). The LF audit checked all 30 new assemblies for solid validity, envelopes and pairwise noninterference. The focused integration suite passed 70 tests, and the six affected packages passed their portable geometry/export contract checks. Additional selector regressions cover conditional choices and automatic custom-bore inputs.

The artifact audit at the time of the component review reported a root `.DS_Store` and a generated slicer result. Current repository hygiene checks are run separately from the component checks.

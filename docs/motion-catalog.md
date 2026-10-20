# Source-dimensioned workshop motion components

The motion catalog adds manufacturer-specific selection inside the existing functional library groups. Models are selectable by dimensions; their interfaces are not scaled to imitate another catalog size.

| Library family         | Source models                                          | Selection and configuration                                                                                                                                 |
| ---------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HIWIN profile guide    | 30 MGN/MGW/HGH/HGW executions                          | Filter series, nominal size, rail/carriage dimensions and hole pitches; configure cut length, carriage count, spacing and travel position.                  |
| TBI ball screw and nut | 19 SFU/SFNU/SFB executions                             | Filter diameter, lead, nut/flange dimensions; configure unmachined shaft length and nut position/rotation.                                                  |
| NEMA stepper motor     | 14 STEPPERONLINE executions, including four added here | Filter NEMA frame, real frame/body size, shaft/pilot, mounting pitch/holes, torque and phase current; configure shaft pose and optional illustrative leads. |

Find all three under **Components**. Guides and screws belong to **Linear motion**; steppers belong to **Motors & actuators**. Switching a fixed model preserves independent cut-length, carriage-layout and pose inputs. If the new model cannot fit that arrangement, validation identifies the conflict for correction. Each model links to the manufacturer's drawing or specifications. The package guides explain exact published interfaces and undimensioned geometry:

- [HIWIN guide executions and datums](../src/parts/hiwin-profile-guide/GUIDE.md)
- [TBI screw/nut identities and mounting patterns](../src/parts/tbi-ball-screw/GUIDE.md)
- [STEPPERONLINE source models](../src/parts/stepper-motor/GUIDE.md)

## Selection rationale and evidence

The selection covers miniature printer/automation guides (MGN/MGW), common square and flanged industrial guides (HG15–30), small and medium screw diameters (12–32 mm), 4/5/10 mm screw leads and compact/standard/long NEMA motor bodies. It is a practical workshop selection, not an audited global sales ranking. STEPPERONLINE explicitly marks the included 23HS22-2804S as a bestseller and one of its most popular NEMA23 motors.

Sources checked on 2026-10-19:

- [HIWIN Linear Guideway G99TE22-2011](https://www.hiwin.com/wp-content/uploads/Linear_Guideway-E.pdf), printed pp37, 41, 86, 87. Conventional miniature models and -O models retain distinct dimensions.
- [TBI MOTION Ball Screw 25.02-1F](https://i0528.tbimotion.com.tw/storage/pdf/TBIMOTION_BallScrew_25.02-1F%28EN%29.pdf), printed C73/C76. SFU, SFNU and SFB are distinct source constructions.
- [17HS15-1504S1 drawing](https://www.omc-stepperonline.com/download/17HS15-1504S1.pdf), dated 2022-04-21: 42.3 mm maximum frame, 39 mm body, 5 mm shaft, 31 mm pitch and M3×4.5 mm mounting bores.
- [17HS24-2104S current drawing](https://files.omc-stepperonline.com/17HS24-2104S_Full_Datasheet.pdf), A0893 rev0, 2026-09-30: 60 mm body and current 0.76 Nm holding rating. Older 0.65 Nm descriptions are not used for this execution.
- [23HS22-2804S current source](https://www.omc-stepperonline.com/nema-23-bipolar-1-8deg-1-26nm-178-4oz-in-2-8a-2-5v-57x57x56mm-4-wires-23hs22-2804s) and its current full datasheet: 57.3 mm maximum frame, 56 mm body, 6.35 mm shaft, 5.2 mm holes, 1.24 Nm, 0.92 ohm and 2.68 mH. The old 1.26 Nm URL slug is not the selected revision's rating. Mass is not published in the current drawing and is left unknown.
- [23HP45-4204S drawing](https://www.omc-stepperonline.com/download/23HP45-4204S.pdf), dated 2019-09-29: 57.3 mm maximum frame, 113 mm body, 10 mm shaft, 47.14 mm pitch and 5.2 mm mounting holes.

Dimensioned mounting interfaces and source envelopes are reproduced at nominal values or at explicitly stated maximum envelopes. These are source-dimensioned installation models. Undimensioned rail raceways, carriage/cover contours, motor internals and ball-return manufacturing geometry remain illustrative; manufacturer CAD is not claimed.

## Reproducible validation

`tests/motion-catalog.test.ts` checks source-row distinctions, dimensional filtering, mounting voids/counterbore shoulders, carriage thread depths, MGW15's two mounting rows, four/six-hole TBI patterns, configuration constraints and preview bounds. `tests/motors.test.ts` checks every motor's closed preview meshes, mounting datums, shafts and model filters.

Prepare native cases with `node --import tsx scripts/verify-motion-catalog.ts`. Run `scripts/verify-motion-catalog.py` inside FreeCAD. It checks closed positive single solids, source envelopes, component interference and complete-macro preservation of existing objects. Representative assemblies are round-tripped through STEP and FCStd. The generated report and sample files are under ignored `data/motion-library/`.

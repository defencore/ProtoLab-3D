# Batteries and cells

**POWER & MOTOR CONTROL → BATTERY PACKS / RECHARGEABLE CELLS / PRIMARY BATTERIES** contains 29 fixed models in three entries.

| Entry                      | Included hardware                                                                 | Selection                                                                          |
| -------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Li-Po / LiHV battery packs | 15 Tattu Standard 1S–4S packs, 270–3700 mAh, 30–95C                               | Series, chemistry, capacity, published C-rate, derived current and pack dimensions |
| Li-ion cells               | Molicel P28A, P30B, M35A (18650); P42A, P45B, P50B (21700)                        | Format, capacity, manufacturer discharge rating, maximum diameter and height       |
| Standard batteries         | Energizer E96 AAAA, E92 AAA, E91 AA, 123 CR123A, E93 C, E95 D, 522 9V PP3, CR2032 | Format, chemistry, voltage, terminal type and maximum envelope                     |

“4xA / 3xA / 2xA” is interpreted as AAAA / AAA / AA cell formats, not multi-cell holders.

## Evidence and geometry

Pack dimensions and ratings come from the [Grepow Tattu Standard table](https://www.grepow.com/fpv-battery/standard-series-fpv-drone-battery-pack.html). Its size triplets are mapped to length × width × height; display bounds use X=width, Y=length, Z=height. This table does not specify connector types or lead lengths. Cables, balance leads and plugs are excluded. Wrapper folds, corner radii and label areas are illustrative. 3.8 V per-cell rows are identified as LiHV; they are not relabeled as 3.7 V Li-Po.

Molicel geometry uses maximum dimensions from the current individual manufacturer product pages, linked in each preset. Format names such as “18650” do not override the actual maximum envelope. All six are flat-top bare cells; protected/button-top alternatives are not interchangeable mechanically. Terminal, gasket and rim details are approximate. The sealed can is an external solid, not a reconstruction of internal chemistry.

Energizer models use the manufacturer's industry-standard dimensional drawings: [AAAA](https://data.energizer.com/pdfs/e96.pdf), [AAA](https://data.energizer.com/pdfs/e92.pdf), [AA](https://data.energizer.com/pdfs/e91.pdf), [CR123A](https://data.energizer.com/pdfs/123_eu.pdf), [C](https://data.energizer.com/pdfs/e93.pdf), [D](https://data.energizer.com/pdfs/e95.pdf), [9V](https://data.energizer.com/pdfs/522.pdf), [CR2032](https://data.energizer.com/pdfs/cr2032.pdf). These are maximum-envelope reference models, not measured samples. Button projections use drawing minima and button diameters use maxima; undimensioned details remain approximate. 9V snap centers use the midpoint 12.7 mm of the published range, with illustrative contact profiles.

## Electrical fields

Capacity is separate from discharge current. Li-Po current is calculated as capacity in Ah × published C-rate; it is not an independently tested continuous rating or a connector rating. Molicel current is the product-page discharge rating, subject to model-specific thermal and cutoff conditions.

CR123A capacity is specified at 100 Ω, 21 °C, to 2.0 V; its 1.5 A field is the published continuous limit. CR2032 capacity is specified at 15 kΩ, 21 °C, to 2.0 V. Its test-drain values are not entered as maximum current. Alkaline capacity/current fields are omitted where the source only gives load-dependent curves. Unknown ratings never become zero and are excluded when a matching numeric filter is active.

## Validation

Run `node --import tsx --test tests/batteries.test.ts` for envelope, closed mesh and catalog checks. `scripts/verify-batteries.ts` prepares all 29 complete FreeCAD macros and independently measured preview components. Run them with `scripts/verify-electronics.py` using FreeCAD Python to check valid closed solids, component intersections, preview/CAD agreement, independent movement and STEP/FCStd round trips. Results: `data/batteries-native-validation.json`.

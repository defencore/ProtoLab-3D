# PCB connector

Select a fixed model in **Connectors & interfaces → PCB connectors**. Family, contact type, signal-contact count, column pitch and mounting are catalog filters. Filtering does not scale the current connector. The model chooser selects another complete reference.

## Included models

| Family     | Models                                                                                                                                  | Mounting and scope                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| JST XH     | B2B-XH-A through B6B-XH-A                                                                                                               | 2–6 pins, 2.50 mm pitch, vertical through-hole PCB headers                                   |
| JST PH     | B2B-PH-K through B6B-PH-K                                                                                                               | 2–6 pins, 2.00 mm pitch, vertical through-hole PCB headers                                   |
| USB        | Molex 67643 USB-A; Amphenol 12401610E4-2A USB-C; GCT USB4105 16-contact USB-C; Molex 47346-0001 Micro USB-B; Lumberg 2486 01 Mini USB-B | Board receptacles; original shells, tongues, source contacts and mounting anchors            |
| DC barrel  | Same Sky/CUI PJ-063AH and PJ-063BH                                                                                                      | 5.5/2.1 and 5.5/2.5 mm mating-plug classes; actual center pins Ø2.0 and Ø2.5 mm respectively |
| Audio      | Same Sky/CUI SJ1-3523N, SJ1-3524N, SJ1-3525N                                                                                            | 3.5 mm TRS jacks; three signal poles and 3/4/5 solder terminals respectively                 |
| RF         | Amphenol 132291 and 132291-12 SMA; Molex 73415-0961 and 73415-1471 MMCX; Hirose U.FL-R-SMT-1                                            | Fixed board references; see the SMA center-contact limitation below                          |
| Pin strips | 3, 4 and 6 pins, each as male header or female socket strip                                                                             | Generic 2.54 mm vertical through-hole references                                             |
| IDC        | 6 and 10 pins                                                                                                                           | Generic two-row 2.54 mm shrouded board headers; not cable receptacles                        |
| DE-9       | Male and female                                                                                                                         | Generic vertical board connectors with retained screw clearance holes; often called DB9      |

These 35 references retain the geometry of public **KiCad 9.0.1 community STEP models**. They are not described as original manufacturer CAD. Source names, individual file URLs and SHA-256 hashes are included in each catalog record and source download. Generic pin-strip, IDC and DE-9 references do not identify a supplier order code. The USB4105 source leaves the plating suffix unspecified, and the 67643 source identifies a series; choose the actual order suffix using its supplier drawing.

## Mounting datum and clearances

Coordinates are millimetres, Z up. The original KiCad PCB origin is retained separately for every reference. Most board mounting planes are Z=0 and solder tails extend below the PCB. Do not place the whole connector on top of a board by aligning its lowest Z point to the board face. Check the source footprint and the source envelope shown in the catalog.

Keep the connector opening accessible from the edge or enclosure wall. Leave additional space for the mating plug body, finger access, retention mechanism and cable bend. The displayed solid is the connector, without an invented plug-clearance block. An actual enclosure opening must be designed from the selected manufacturer's drawing and tolerance stack.

JST XH uses **2.50 mm**, PH **2.00 mm**, and the generic pin strips and IDC **2.54 mm**. Matching pin count does not make them interchangeable. DE-9 uses 2.77 mm columns and 2.84 mm rows, with staggered rows; its screw holes are 25 mm apart in this source model. The `Contact column pitch` filter does not describe every row spacing.

A barrel jack can be called a socket while having a male center pin. PJ-063AH has an actual Ø2.0 mm center pin for the commonly described 5.5/2.1 mm mating-plug class. It is not modeled as a Ø2.1 mm pin. No polarity is implied by the shape. Audio switch terminals are counted separately from the three signal poles; determine switching and pin numbers from the supplier schematic.

## Source limitations

The community SMA references omit the female center-contact bore and represent the recessed center contact as a solid post. **Do not use these models to judge center-contact mating.** The catalog's `socket` attribute describes the named standard-polarity SMA manufacturer part. It does not certify the simplified source contact. No RP-SMA model is synthesized from the same shape: RP-SMA requires a different center contact even when the coupling looks similar.

Several community files fuse the housing and contacts into a single solid. That source representation is retained. Its solid count is not a manufacturing bill of materials, so there is no artificial exploded view. USB files with several source solids retain them separately at their original positions. Complete uniform colors from the source STEP are retained where available: 87 of the 119 source solids, including the USB-A and both USB-C references. Mixed face colors on fused solids are represented by an explicitly illustrative fallback. The source download records each solid's color basis. Colors do not establish the material or plating of the purchased part.

The library does not infer current, voltage, RF impedance, USB speed, shielding effectiveness, cycle life, tolerances or interchangeability from the 3D appearance. Use the exact supplier drawing and electrical data sheet for the purchased revision. No repairs, scaling or source-solid omissions are applied to these imported assets.

## Sources and regeneration

- [Pinned KiCad 9.0.1 3D collection](https://gitlab.com/kicad/libraries/kicad-packages3D/-/tree/9.0.1).
- [JST XH manufacturer catalog](https://www.jst-mfg.com/product/pdf/eng/eXH.pdf), [JST PH manufacturer catalog](https://www.jst-mfg.com/product/pdf/eng/ePH.pdf).
- [Amphenol USB-C drawing](https://cdn.amphenol-cs.com/media/wysiwyg/files/drawing/c12401610_c.pdf), [GCT USB4105](https://gct.co/connector/usb4105).
- [Amphenol SMA 132291](https://www.amphenolrf.com/132291.html), [132291-12](https://www.amphenolrf.com/132291-12.html). The current manufacturer's native STEP download requires an account; this package uses the public KiCad reference and states its contact simplification.
- Exact manufacturer reference links for each identified part are retained in `lib/catalog.json` and each preset. The downloaded STEP source is authoritative only for the retained community shape, not for unverified vendor specifications.

The offline importer is `scripts/import-signal-connectors.py`. Download the pinned `downloadUrl` files into `/tmp/protolab-signal-connectors`, then run it with FreeCAD Python. It rejects any changed source hash, validates every source solid, preserves native BRep bytes, and accepts only closed indexed previews with less than 1.5% volume error. It does not contact a network or repair the source. `--colors-only` runs with ordinary Python and refreshes only complete uniform-solid STEP surface colors, asserting that every other native asset field remains unchanged. `lib/color-evidence.json` records the pinned source, complete per-solid style evidence or fallback reason, and a fingerprint of the unchanged native and preview geometry. Run the connector tests and the application's native FreeCAD audit after regeneration.

The redistributed native assets and preview derivatives follow the KiCad library license. Keep the license and upstream credits in `lib/attribution` with any redistributed collection.

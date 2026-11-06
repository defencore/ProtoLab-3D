# BEC / receiver power

POWER & MOTOR CONTROL → BEC REGULATORS. Variants are selected inside one fixed-dimension part.

| Model                                                                                                        | PCB/body X × Y, mm | Scope                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [Hobbywing UBEC 3A — 2–6S](https://www.hobbywingdirect.com/products/ubec-3a-2-6s-lipo-input)                 | 17 × 43            | 43 × 17 × 7 mm insulated body. Output selectable 5/6 V. Flexible input/output leads and ferrite ring excluded.                            |
| [Hobbywing UBEC 5A — 2–8S revision](https://oss.hobbywing.com/pdf/pdfen/UBEC5A.pdf)                          | 17 × 50            | PDF revision: 50 × 17 × 10 mm, selectable 5/6/7.4 V, 15 A peak. Not the older 48 × 27 × 9 mm version. Leads, jumper and ferrite excluded. |
| [Hobbywing UBEC 10A — car revision](https://hobbywing.oss-cn-shenzhen.aliyuncs.com/pdf/pdfen/UBEC10ACar.pdf) | 20 × 45            | Car PDF revision: 45 × 20 × 16.2 mm, selectable 6/7.4/8.4 V, 15 A peak. Not the 43.1 × 32.3 mm UBEC. Leads, switch and jumper excluded.   |

PCB/body dimensions are supplier values; protruding connectors are included in rendered bounds separately. Undimensioned component positions, heights, corner radii and contacts are approximate. Use the linked drawing and physical hardware to confirm mounting and connector clearance. Flexible leads, external antennas, mating plugs and accessories are excluded. The model is a mechanical packaging reference, not a PCB fabrication file or electrical pinout.

Numeric filters omit unknown dimensions and ratings. Input-current, output-current and per-motor ESC ratings are distinct. Memory/firmware-only alternatives do not generate additional models. Semtech is the radio chip supplier, not the manufacturer of every LoRa board.

Preview and FreeCAD use the same independently movable colored solids. Package-private geometry helpers keep this part independently exportable. Validate with `npm run parts:check`, `npm run typecheck:tests`, `tests/electronics.test.ts` and `scripts/verify-electronics.ts` / `scripts/verify-electronics.py`.

## BEC12S-PRO / TPS54560 installation reference

Library entry: `bec:bec12s-pro`. The selected seller identifies BEC12S-PRO / TPS54X60. Adopted 40 × 20 × 5.5 mm envelope matches the photographed supplier family but is unverified for this SKU. PCB thickness 1.6 mm, corner radius 0.6 mm and central 26 × 14 × 3.9 mm component volume are assumptions. No mounting holes or connector coordinates are invented. The SAC-01 uses separate physical boards selected to 12 V and 5 V; output settings do not change this mechanical model. Confirm the delivered board, jumper settings, ratings, underside joints, thermal behavior and harness.

[Selected supplier listing](https://prom.ua/p3103438088-ponizhayuschij-preobrazovatel-bec12s.html) could not be re-fetched during the 2026-11-02 review; identity and prior evidence remain traceable to the existing SAC-01 record. No guessed dimensions or electrical ratings are published as numeric catalog attributes. The same definition now owns the SAC-01 boards; independent occurrences retain their branch output setting in procurement notes.

Native CAD verification (2026-11-02): the assembled `bec:bec12s-pro` shape is valid and closed, with 2 solid(s), 16 faces and only planar/cylindrical surfaces. Its 40 × 20 × 5.5 mm bounds match the adopted model. STEP round-trip retained all six solids across the five reviewed devices. Reports and exported CAD are under ignored `test-results/standalone-device-verification/`. This verifies the model topology and adopted dimensions; it does not resolve the documented missing supplier interfaces.

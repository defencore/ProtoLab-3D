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

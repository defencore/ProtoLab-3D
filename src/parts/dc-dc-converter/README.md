# DC-DC converter

POWER & MOTOR CONTROL → DC-DC CONVERTERS. Variants are selected inside one fixed-dimension part.

| Model                                                        | PCB/body X × Y, mm | Scope                                                                                                                                                                           |
| ------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Pololu D24V50F5](https://www.pololu.com/product/2851/specs) | 17.78 × 20.32      | Bare board, no optional headers or terminal blocks. Dimensions converted from manufacturer inches. Output current depends on cooling and input voltage.                         |
| [Pololu S7V8F5](https://www.pololu.com/product/2123/specs)   | 11.43 × 16.51      | Bare board, no optional headers or terminal blocks. Dimensions converted from manufacturer inches. 1 A output applies to buck operation; boost output depends on input voltage. |
| [Pololu U3V50F5](https://www.pololu.com/product/2565/specs)  | 15.24 × 48.26      | Bare board, no optional headers or terminal blocks. Dimensions converted from manufacturer inches. 5 A is the INPUT current limit, not a 5 A output rating.                     |

PCB/body dimensions are supplier values; protruding connectors are included in rendered bounds separately. Undimensioned component positions, heights, corner radii and contacts are approximate. Use the linked drawing and physical hardware to confirm mounting and connector clearance. Flexible leads, external antennas, mating plugs and accessories are excluded. The model is a mechanical packaging reference, not a PCB fabrication file or electrical pinout.

Numeric filters omit unknown dimensions and ratings. Input-current, output-current and per-motor ESC ratings are distinct. Memory/firmware-only alternatives do not generate additional models. Semtech is the radio chip supplier, not the manufacturer of every LoRa board.

Preview and FreeCAD use the same independently movable colored solids. Package-private geometry helpers keep this part independently exportable. Validate with `npm run parts:check`, `npm run typecheck:tests`, `tests/electronics.test.ts` and `scripts/verify-electronics.ts` / `scripts/verify-electronics.py`.

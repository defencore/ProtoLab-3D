# Raspberry Pi Pico / RP2040

ELECTRONICS & VISION → MICROCONTROLLER BOARDS. Variants are selected inside one fixed-dimension part.

| Model                                                                                       | PCB/body X × Y, mm | Scope                                                                                                                                              |
| ------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Raspberry Pi Pico — no headers](https://www.raspberrypi.com/products/raspberry-pi-pico/)   | 21 × 51            | 21 × 51 mm PCB. Micro USB overhang is included in rendered bounds; no optional headers. RP2040 with three end debug pads. Mounting holes Ø2.1 mm.  |
| [Raspberry Pi Pico W — no headers](https://www.raspberrypi.com/products/raspberry-pi-pico/) | 21 × 51            | 21 × 51 mm PCB. Micro USB overhang is included in rendered bounds; no optional headers. Wireless shield, onboard antenna and relocated debug pads. |

PCB/body dimensions are supplier values; protruding connectors are included in rendered bounds separately. Undimensioned component positions, heights, corner radii and contacts are approximate. Use the linked drawing and physical hardware to confirm mounting and connector clearance. Flexible leads, external antennas, mating plugs and accessories are excluded. The model is a mechanical packaging reference, not a PCB fabrication file or electrical pinout.

Numeric filters omit unknown dimensions and ratings. Input-current, output-current and per-motor ESC ratings are distinct. Memory/firmware-only alternatives do not generate additional models. Semtech is the radio chip supplier, not the manufacturer of every LoRa board.

Preview and FreeCAD use the same independently movable colored solids. Package-private geometry helpers keep this part independently exportable. Validate with `npm run parts:check`, `npm run typecheck:tests`, `tests/electronics.test.ts` and `scripts/verify-electronics.ts` / `scripts/verify-electronics.py`.

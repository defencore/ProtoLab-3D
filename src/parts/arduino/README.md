# Arduino boards

ELECTRONICS & VISION → MICROCONTROLLER BOARDS. Variants are selected inside one fixed-dimension part.

| Model                                                                           | PCB/body X × Y, mm | Scope                                                                                                                                                   |
| ------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Arduino UNO R3 — DIP](https://store.arduino.cc/products/arduino-uno-rev3)      | 68.6 × 53.4        | 68.6 × 53.4 mm PCB. USB-B and DC barrel power connectors. Rounded outline and undimensioned header offsets approximate; not a shield drilling template. |
| [Arduino Nano — classic, headers fitted](https://docs.arduino.cc/hardware/nano) | 18 × 45            | 18 × 45 mm PCB with Mini-B USB and two 15-pin headers. Not Nano Every or Nano ESP32. Header heights and mounting offsets approximate.                   |

PCB/body dimensions are supplier values; protruding connectors are included in rendered bounds separately. Undimensioned component positions, heights, corner radii and contacts are approximate. Use the linked drawing and physical hardware to confirm mounting and connector clearance. Flexible leads, external antennas, mating plugs and accessories are excluded. The model is a mechanical packaging reference, not a PCB fabrication file or electrical pinout.

Numeric filters omit unknown dimensions and ratings. Input-current, output-current and per-motor ESC ratings are distinct. Memory/firmware-only alternatives do not generate additional models. Semtech is the radio chip supplier, not the manufacturer of every LoRa board.

Preview and FreeCAD use the same independently movable colored solids. Package-private geometry helpers keep this part independently exportable. Validate with `npm run parts:check`, `npm run typecheck:tests`, `tests/electronics.test.ts` and `scripts/verify-electronics.ts` / `scripts/verify-electronics.py`.

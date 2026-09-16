# ESP32 boards

ELECTRONICS & VISION → MICROCONTROLLER BOARDS. Variants are selected inside one fixed-dimension part.

| Model                                                                                                                                | PCB/body X × Y, mm | Scope                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Espressif ESP32-DevKitC V4 — WROOM](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html) | 27.94 × 48.26      | Official PCB: 27.94 × 48.26 mm; WROOM antenna extends 6.04 mm beyond PCB. Headers at 25.40 mm row spacing. Header height and passive layout approximate.                      |
| [Waveshare ESP32-S3-Zero — no headers](https://docs.waveshare.com/ESP32-S3-Zero)                                                     | 18 × 23.5          | 18 × 23.5 mm PCB; USB-C, onboard ceramic antenna and castellated I/O. No optional pin headers. Port and pad offsets reconstructed from product drawings; not a PCB footprint. |
| [Seeed XIAO ESP32C3](https://wiki.seeedstudio.com/XIAO_ESP32C3_Getting_Started/)                                                     | 17.8 × 21          | 17.8 × 21 mm PCB. U.FL external antenna socket; antenna cable excluded. No soldered headers. Pin count is physical contacts, not GPIO count.                                  |

PCB/body dimensions are supplier values; protruding connectors are included in rendered bounds separately. Undimensioned component positions, heights, corner radii and contacts are approximate. Use the linked drawing and physical hardware to confirm mounting and connector clearance. Flexible leads, external antennas, mating plugs and accessories are excluded. The model is a mechanical packaging reference, not a PCB fabrication file or electrical pinout.

Numeric filters omit unknown dimensions and ratings. Input-current, output-current and per-motor ESC ratings are distinct. Memory/firmware-only alternatives do not generate additional models. Semtech is the radio chip supplier, not the manufacturer of every LoRa board.

Preview and FreeCAD use the same independently movable colored solids. Package-private geometry helpers keep this part independently exportable. Validate with `npm run parts:check`, `npm run typecheck:tests`, `tests/electronics.test.ts` and `scripts/verify-electronics.ts` / `scripts/verify-electronics.py`.

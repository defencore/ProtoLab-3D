# Semtech / LoRa modules

ELECTRONICS & VISION → RADIO MODULES. Variants are selected inside one fixed-dimension part.

| Model                                                                          | PCB/body X × Y, mm | Scope                                                                                                                                                                   |
| ------------------------------------------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Ai-Thinker Ra-02 — SX1278](https://docs.ai-thinker.com/en/Ra-02/index.html)   | 17 × 16            | 17 × 16 mm module PCB. SX1278 LoRa radio, U.FL antenna socket. External antenna excluded. RF shield and pad offsets approximate.                                        |
| [Waveshare Core1262-HF — SX1262](https://www.waveshare.com/wiki/Core1262-868M) | 19 × 22            | 19 × 22 mm core module, HF radio revision. This is not the larger Raspberry Pi LoRa HAT. Antenna not fitted; no SMA socket.                                             |
| [Ebyte E22-900M30S — SX1262](https://www.ebyte.com/product/451.html)           | 24 × 38.5          | 24 × 38.5 mm module. 30 dBm PA version, SPI host interface; not the UART T-series. Antenna and carrier excluded. RF shield, contacts and component offsets approximate. |

PCB/body dimensions are supplier values; protruding connectors are included in rendered bounds separately. Undimensioned component positions, heights, corner radii and contacts are approximate. Use the linked drawing and physical hardware to confirm mounting and connector clearance. Flexible leads, external antennas, mating plugs and accessories are excluded. The model is a mechanical packaging reference, not a PCB fabrication file or electrical pinout.

Numeric filters omit unknown dimensions and ratings. Input-current, output-current and per-motor ESC ratings are distinct. Memory/firmware-only alternatives do not generate additional models. Semtech is the radio chip supplier, not the manufacturer of every LoRa board.

Preview and FreeCAD use the same independently movable colored solids. Package-private geometry helpers keep this part independently exportable. Validate with `npm run parts:check`, `npm run typecheck:tests`, `tests/electronics.test.ts` and `scripts/verify-electronics.ts` / `scripts/verify-electronics.py`.

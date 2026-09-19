# NanoPi

ELECTRONICS & VISION → SINGLE-BOARD COMPUTERS. Variants are selected inside one fixed-dimension part.

| Model                                                                              | PCB/body X × Y, mm | Scope                                                                                                                                                              |
| ---------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [NanoPi NEO Air v1.1](https://wiki.friendlyelec.com/wiki/index.php/NanoPi_NEO_Air) | 40 × 40            | 40 × 40 mm bare PCB. V1.1 microSD position; unpopulated GPIO footprints. No heatsink or external antenna. Hole and component offsets are approximate.              |
| [NanoPi R4S — bare board](https://wiki.friendlyelec.com/wiki/index.php/NanoPi_R4S) | 66 × 66            | 66 × 66 mm bare PCB. Dual RJ45, two USB 3 Type-A and USB-C power. Metal enclosure and heatsink excluded. Undimensioned mounting/connector offsets are approximate. |

PCB/body dimensions are supplier values; protruding connectors are included in rendered bounds separately. Undimensioned component positions, heights, corner radii and contacts are approximate. Use the linked drawing and physical hardware to confirm mounting and connector clearance. Flexible leads, external antennas, mating plugs and accessories are excluded. The model is a mechanical packaging reference, not a PCB fabrication file or electrical pinout.

Numeric filters omit unknown dimensions and ratings. Input-current, output-current and per-motor ESC ratings are distinct. Memory/firmware-only alternatives do not generate additional models. Semtech is the radio chip supplier, not the manufacturer of every LoRa board.

Preview and FreeCAD use the same independently movable colored solids. Package-private geometry helpers keep this part independently exportable. Validate with `npm run parts:check`, `npm run typecheck:tests`, `tests/electronics.test.ts` and `scripts/verify-electronics.ts` / `scripts/verify-electronics.py`.

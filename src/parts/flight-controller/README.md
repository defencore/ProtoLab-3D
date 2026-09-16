# Flight controller

Fixed hardware catalog in **ELECTRONICS & VISION → FLIGHT CONTROLLERS**. Select by physical envelope, mounting format, bore diameter and connections. Dimensions are not editable. Processor, firmware and receiver-protocol changes alone do not generate duplicate entries.

| Model                              | Width × length × height, mm | Mechanical distinction                                                  |
| ---------------------------------- | --------------------------- | ----------------------------------------------------------------------- |
| BETAFPV F4 1S 5A Light             | 30 × 30 × unspecified       | Motor solder pads; Micro USB                                            |
| BETAFPV F4 1S 5A Classical         | 30 × 30 × unspecified       | Four motor sockets on the same whoop board                              |
| SpeedyBee F405 Mini                | 32 × 30 × 7.8               | 20 × 20 mounting, Ø3.5 bores; SH eight-pin ESC, USB-C; VTX solder pads  |
| SpeedyBee F405 V4                  | 39.4 × 41.6 × 7.8           | 30.5 × 30.5 mounting, Ø4 bores; ESC and HD VTX sockets, microSD         |
| Holybro Kakute H7 Mini v1.5        | 31 × 30 × 6                 | 20 × 20 mounting, Ø3.6 bores; ESC and VTX sockets in a different layout |
| Holybro Pixhawk 6C, plastic case   | 44 × 84.8 × 12.4            | Top-facing GH ports, external PWM breakout, two power inputs            |
| Holybro Pixhawk 6C Mini A, current | 39 × 54.3 × 17.5            | End-facing PWM headers                                                  |
| Holybro Pixhawk 6C Mini B          | 39 × 58.3 × 18.2            | Top-facing PWM headers                                                  |

## Source and geometry scope

Manufacturer pages, PDFs and drawings are linked in every preset. Local copies of the mechanical references are included in package exports. `lib/models.json` records each model's source and scope. Separate electrical or firmware variants with the same physical interfaces are deliberately omitted. The Pixhawk plastic/aluminum enclosure choice is represented once because the published envelope is shared.

The current Mini drawings take precedence over the conflicting store table: Model A is **54.3 × 39 × 17.5**, not 53.3 × 39 × 16.2 mm; Model B drawing rounds the height to **18.2** instead of 18.15 mm. The mass remains the published store specification. Case screw patterns are not classified as through-mount bores.

The whoop source states a nominal 26 × 26 mounting format but does not dimension the individual bores. The cross-shaped board, opposing axial holes, 2.6 mm illustrative bores and component height are reconstructed from photographs. Hole diameter, Cartesian pitch and overall height are excluded from numeric filters. Treat this model as a packaging reference, not a verified drilling template. Kakute USB subtype is not inferred from a generic pinout drawing and is omitted from the USB filter.

Preview and FreeCAD use the same component geometry: PCB and mounting bores, chips and passives, solder pads, hollow connector bodies and contacts, USB shield and tongue, microSD slot, enclosure shell and lid, and Mini PWM headers. Undimensioned outlines, connector positions, contact profiles and internal details are approximate. The model is not a PCB fabrication drawing or electrical pinout. Controller geometry excludes loose leads, antennas, plugs, grommets, mounting hardware, external ESCs and breakout boards. Assembled and exploded modes export separate colored solids.

LiPo cell filters apply only to boards with direct battery input. Pixhawk regulated controller input (up to 6 V) is separate from the 0–36 V servo rail. AIO ESC current ratings are not FC power consumption. Motor/PWM counts exclude status LED outputs and are not a count of separate physical sockets.

## Validation

`tests/flight-controllers.test.ts` verifies fixed selection, unknown-data filtering, distinct mechanical signatures, closed preview meshes, envelopes and open PCB mounting bores. `scripts/verify-flight-controllers.ts` prepares every model/state for `scripts/verify-flight-controllers.py`, which checks FreeCAD solids, preview agreement, component intersections and independent movement, and STEP/FCStd round trips. The native report is stored in `data/flight-controllers-native-validation.json`.

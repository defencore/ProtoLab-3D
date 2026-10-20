# Addressable LED modules

This catalogue contains seven fixed, purchased WS2812B 5050 module executions. It models each populated board without wires or pin headers. Select a model rather than changing PCB dimensions. The assembly and separate-component views represent the same purchased item.

| Model                     | BOT'n ROLL reference | Pixels | Published dimensions, mm |
| ------------------------- | -------------------- | ------ | ------------------------ |
| 1×8 LEDS · 8-Bit 2812 RGB | CEL03113             | 8      | 54 × 10 × 3.19           |
| 2×2 LEDS · WS2812B-4      | LCD03021             | 4      | 15 × 15 × 3.19           |
| Ring 8 LEDS · WS2812B     | CEL03109             | 8      | Outside diameter 32      |
| Ring 12 LEDS · WS2812B    | CEL03110             | 12     | Outside diameter 50      |
| Ring 16 LEDS · WS2812B    | CEL03111             | 16     | Outside diameter 67      |
| Ring 24 LEDS · WS2812B    | CEL03112             | 24     | Outside diameter 86      |
| 4×4 LEDS · WS2812B-16     | LCD03022             | 16     | 30 × 30 × 3.19           |

These are specific generic supplier executions. Other suppliers sell different diameters and pitches with the same LED count. In particular, the 54 mm stick must not be substituted with a similar-looking 53 mm stick. NeoPixel is a compatibility/discovery term and does not identify an Adafruit product.

The supplier publishes only outside diameter for these rings. Their **3.19 mm model height, 1.60 mm substrate and inner openings are approximate installation assumptions**, not verified catalogue dimensions. Consequently ring height and inner diameter are omitted from verified dimension filters.

## Coordinates and installation

The PCB lies in XY, centred on its outline. X follows the long direction of a stick. Z=0 is the back face of the substrate. Rear solder lands extend 0.03 mm below it. The highest LED package rim is at Z=3.16 mm, giving a 3.19 mm model envelope. The reconstructed substrate is 1.60 mm thick. Each ring has a genuine annular PCB, its photographed mounting openings and individually rotated LED packages; the central opening remains clear through every represented component.

Mounting holes are open through the PCB and clear of all represented components. The following are **photograph-derived references**, not toleranced manufacturer mounting drawings:

| Model   | Mounting references                                                    | Model opening                 |
| ------- | ---------------------------------------------------------------------- | ----------------------------- |
| 1×8     | Centres (−13, −3), (+13, −3); diameter 3.0                             | None                          |
| 2×2     | Centre (0, 0); diameter 3.2                                            | None                          |
| Ring 8  | 2 holes, diameter 2.0; centre radius 13.5 at 22.5° and 202.5°          | Approximate inner diameter 18 |
| Ring 12 | 4 holes, diameter 2.0; centre radius 22 at 45°, 135°, 225°, 315°       | Approximate inner diameter 37 |
| Ring 16 | 4 holes, diameter 2.0; centre radius 30.5 at 45°, 157.5°, 225°, 337.5° | Approximate inner diameter 52 |
| Ring 24 | 4 holes, diameter 2.0; centre radius 40 at 45°, 135°, 210°, 315°       | Approximate inner diameter 72 |
| 4×4     | Centres X=±8, Y=±8; diameter 3.0                                       | None                          |

All linear values are millimetres. Angles are counterclockwise from +X. Undimensioned ring hole patterns follow the selected photograph rather than an assumed universal four-hole bolt circle. Rotation of an actual board relative to its solder pads may differ.

Use the actual delivered board to confirm hole centres, diameters, component clearance and solder-pad positions before cutting an enclosure. Solder connections and mounting fasteners are separate installation choices. The models include white LED package rims, circular optical windows, metal terminations, backside solder lands and visible decoupling capacitors. The small die/controller silhouettes inside the windows are illustrative; this is neither an optical simulation nor a PCB fabrication layout.

## Sources and geometry evidence

- [CEL03113 — eight-pixel stick](https://www.botnroll.com/en/matrices/4581-neopixel-rgb-led-module-ws2812b-5050-stick-8-leds.html): published 54 × 10 × 3.19 mm dimensions and eight-pixel count. Its [front photograph](https://www.botnroll.com/18044-large_default/neopixel-rgb-led-module-ws2812b-5050-stick-8-leds.jpg) shows the LED row, capacitors and two offset mounting holes.
- [LCD03021 — four-pixel matrix](https://www.botnroll.com/en/matrices/4582-neopixel-rgb-led-module-ws2812b-5050-2x2-matrix-4-leds.html): published 15 × 15 × 3.19 mm envelope. Its title, narrative and photographs confirm four LEDs; one specification bullet incorrectly says eight. The [front](https://www.botnroll.com/18045-large_default/neopixel-rgb-led-module-ws2812b-5050-2x2-matrix-4-leds.jpg) and [back](https://www.botnroll.com/18052-large_default/neopixel-rgb-led-module-ws2812b-5050-2x2-matrix-4-leds.jpg) show the central mounting bore and eight rear lands.
- [CEL03109 — eight-pixel ring](https://www.botnroll.com/en/matrices/4572-neopixel-rgb-led-module-ws2812b-5050-ring-8-leds.html): outside diameter 32 mm. Its [front photograph](https://www.botnroll.com/18032-large_default/neopixel-rgb-led-module-ws2812b-5050-ring-8-leds.jpg) shows eight oriented packages and two mounting holes.
- [CEL03110 — twelve-pixel ring](https://www.botnroll.com/en/matrices/4574-neopixel-rgb-led-module-ws2812b-5050-ring-12-leds.html): outside diameter 50 mm. Its [front photograph](https://www.botnroll.com/18035-large_default/neopixel-rgb-led-module-ws2812b-5050-ring-12-leds.jpg) provides the component and four-hole layout.
- [CEL03111 — sixteen-pixel ring](https://www.botnroll.com/en/matrices/4576-neopixel-rgb-led-module-ws2812b-5050-ring-16-leds.html): outside diameter 67 mm. Its [front photograph](https://www.botnroll.com/18038-large_default/neopixel-rgb-led-module-ws2812b-5050-ring-16-leds.jpg) provides the component and four-hole layout.
- [CEL03112 — twenty-four-pixel ring](https://www.botnroll.com/en/matrices/4577-neopixel-rgb-led-module-ws2812b-5050-ring-24-leds.html): outside diameter 86 mm. Its [front photograph](https://www.botnroll.com/18039-large_default/neopixel-rgb-led-module-ws2812b-5050-ring-24-leds.jpg) provides the component and four-hole layout.
- [LCD03022 — sixteen-pixel matrix](https://www.botnroll.com/en/matrices/4588-neopixel-rgb-led-module-ws2812b-5050-4x4-matrix-16-leds.html): published 30 × 30 × 3.19 mm. Its [front](https://www.botnroll.com/18046-large_default/neopixel-rgb-led-module-ws2812b-5050-4x4-matrix-16-leds.jpg) and [back](https://www.botnroll.com/18047-large_default/neopixel-rgb-led-module-ws2812b-5050-4x4-matrix-16-leds.jpg) show four mounting holes, the populated 4×4 layout and eight rear lands.
- [Communica generic 8-ring](https://www.communica.co.za/products/hkd-ws2812-neopixel-ring-8-led): supplementary photographic reference for the common four-land DI/5V/GND/DO ring connection bank. It is not proof of the exact rear routing of the selected BOT'n ROLL executions.

All models are authored reconstructions, not original manufacturer CAD. The five newer records include SHA-256 checksums of the supplier photographs in `lib/models.json`; these are photograph checksums, not CAD checksums. Only published outer dimensions and pixel counts are catalogue facts. Hole patterns, ring inner openings and heights, solder-pad positions, LED pitch, PCB thickness and internal optical details remain approximate. Fine tracks, solder joints, bond wires and manufacturing tolerances are omitted. No electrical current rating is inferred from geometry.

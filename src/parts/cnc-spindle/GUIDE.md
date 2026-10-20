# Purchased CNC spindle executions

These are manufacturer-derived installation reconstructions, not confirmed factory-installed machine SKUs and not supplier internal CAD. Order one complete spindle; the visible shells, fittings and nut do not create a fabricated internal BOM.

## Frames and interfaces

`spindleSpec(modelOrParameters)` and `spindleSpecs` are public exports from `part.ts`. `spindleDefaults` selects the 2.2 kW water-cooled 80 mm execution. The local axis is +Z with the selected shaft-mouth/nose datum at Z=0; the motor body extends upward. Published axial shoulders locate the body independently of a guessed uniform spindle length.

| Stable model ID    | Drawing execution               | Body diameter / length | Body Z span    |
| ------------------ | ------------------------------- | ---------------------- | -------------- |
| jst-1500-water-65  | JGD-65C-1.5KW                   | 65 / 217.5 mm          | 27..244.5 mm   |
| jst-2200-water-80  | JGD-80C3-2.2K                   | 80 / 220 mm            | 43.8..263.8 mm |
| jst-2200-air-80    | JGF-80E-2.2K                    | 80 / 255 mm            | 44..299 mm     |
| jst-3000-water-100 | JGD-100A-3.0KW                  | 100 / 243 mm           | 58..301 mm     |
| zhj-3000-air-100   | ER20 100mm 3KW Round Air Cooled | 100 / 220 mm           | 88..308 mm     |

`clampStartZ`/`clampEndZ` give the selected unobstructed installation window; `clampCenterZ` is its midpoint. Only the JST 3 kW 206 mm barrel bounds are explicitly dimensioned, marked `clampWindowVerified`. This flag verifies the barrel dimensions, not permission to clamp there, torque or load capacity. Other windows deliberately exclude nominal endcap zones and remain authored choices. A caller must ensure its actual clamp height fits the window.

## Evidence and limits

Each preset retains its manufacturer page, linked dimensioned drawing/photo, SHA-256 and a qualification record. JST pages and linked drawings disagree on suffixes for the 1.5 kW, air-cooled 2.2 kW and water-cooled 3 kW executions. The model follows the stated drawing; confirm the purchased order execution rather than silently equating these variants.

Known body diameters, body lengths, dimensioned shoulders and tool-thread designations are reconstructed. Undimensioned endcap split lines, water-port positions, air vents, connector pockets, collet internals, thread engagement lengths and nut envelopes are explicitly illustrative. Connector projections and the undimensioned 3 kW coolant fitting projection remain nominal. No bearing, winding or hidden rotor geometry is invented.

JST drawings declare M14x0.75 or M25x1.5. Threaded inspection spans and nut sizes remain unverified. The Zhong Hua Jiang source declares only ER20: its M25x1.5 geometry is a qualified standard-derived interface that requires measurement of the supplied nut. It is not a manufacturer-verified thread dimension. The product page disagrees on 18,000 versus 24,000 rpm; the model records the 18,000 rpm / 300 Hz table/nameplate execution.

Simple retains nominal shaft/bores and thread/source metadata. Full produces authored helical shaft and nut flanks. STL uses nominal geometry. Neither representation establishes a thread fit class, runout, machine accuracy or cutting capacity. These high-speed source products target routing and soft-metal work; no general steel-milling rating is inferred.

## Source pages

- [JST 1.5 kW water](https://www.apsmotor.com/round-water-cooled-1-5-kw-mtc-spindle-motor-with-er11-collet-65-mm-diameter.html)
- [JST 2.2 kW water](https://www.apsmotor.com/2-2-kw-water-cooled-mtc-spindle-motor-er20-80-mm-4-bearings-24000-rpm.html)
- [JST 2.2 kW air](https://www.apsmotor.com/round-air-cooled-2-2-kw-mtc-spindle-motor-80-mm-diameter-with-er20-collet.html)
- [JST 3 kW water](https://www.apsmotor.com/3-0-kw-water-cooled-mtc-spindle-motor-er20-100-mm-4-bearings-24000-rpm.html)
- [Zhong Hua Jiang 3 kW air](https://www.zhonghuajiangspindle.com/3kw-cnc-air-cooled-spindle-motor.html)

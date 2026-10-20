# TBI ball screw and nut

Find **Components → Linear motion → Ball screws → TBI ball screw and nut**. Filter the inline catalog by series, nominal screw diameter, lead, nut size or flange mounting dimensions. Select a concrete source model, then set the unmachined shaft cut length and nut position. Source nut dimensions stay fixed.

The package includes 19 TBI MOTION executions from catalog 25.02-1F:

| Series | Included nominal diameter/lead combinations, mm    |
| ------ | -------------------------------------------------- |
| SFU    | 12/4, 16/4, 20/4, 25/4                             |
| SFNU   | 16/5, 16/10, 20/5, 25/5, 25/10, 32/5, 32/10        |
| SFB    | 12/5, 12/10, 16/5, 16/10, 20/5, 20/10, 25/5, 25/10 |

The manufacturer's full order designation is retained. A generic SFU1605 listing is not automatically interchangeable with a TBI SFNU01605-4: this TBI nut has L=45 mm. The TBI SFB01605-3.8 has L=31 mm despite the same nominal 16 mm diameter and 5 mm lead.

The screw axis is Z. Shaft length is a custom overall unmachined length, centered at Z=0. The nut is placed along it; rotation translates it by the stated lead per revolution. Shaft-only and nut-only states select separate physical supplier units. Simple mode shows a smooth nominal screw; Full adds a representative helical raceway with the selected lead.

Flange outside diameter, width across flats, thickness, bolt-circle diameter and actual through holes come from the source table. SFB01205/01210 have four holes at 45, 135, 225 and 315 degrees. The other included nuts have the source six-hole 45/90-degree arrangement. SFU01204-4 is specified without a wiper.

Nut bore running clearance, groove contact section, internal ball returns, lubrication-port depth/location and wiper details are not manufacturer production geometry. No shaft-end journals are inferred: specify an actual end-machining drawing to fit BK/BF or other supports. Accuracy and preload execution must also be included in the supplier order.

Source: [TBI MOTION Ball Screw catalog 25.02-1F](https://i0528.tbimotion.com.tw/storage/pdf/TBIMOTION_BallScrew_25.02-1F%28EN%29.pdf), printed C73/C76; checked 2026-10-19. Local source metadata and SHA-256 are in `lib/source-evidence.json`.

Run `npm run parts:check -- tbi-ball-screw`, `node --import tsx --test tests/motion-catalog.test.ts`, then use `scripts/verify-motion-catalog.ts` and `scripts/verify-motion-catalog.py` for native FreeCAD validation and sample STEP/FCStd exports.

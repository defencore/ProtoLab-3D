# AMASS power connectors

Find **CONNECTORS & INTERFACES → POWER & INDUSTRIAL → AMASS power connectors**.

Nineteen concrete manufacturer models are available. Search or filter by series, M/F contact type, contact count, mounting and dimensions. Dimensions are fixed for the selected catalog model; detail and exploded state remain configurable. XT30 and XT90 searches include XT30U, XT90H and XT90E; the suffixes remain explicit because they identify the actual versions modeled.

## Manufacturer outlines

Width is X, height is Y, overall length is Z (mating axis). Front is +Z. M means male metal pins; F means female metal sockets. H and MR60 dimensions include the illustrated rear cover. Other models include exposed solder tails.

| Model         | Width (mm) | Height (mm) | Overall length (mm) | Source                                                                                                                  |
| ------------- | ---------- | ----------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| AMASS XT30U-M | 10.2       | 5.6         | 13.7                | [AMASS 2024 catalog · page 7](https://www.china-amass.com/public/upload/20240723/c1ae9604bbe795ebfd366c9063019e3e.pdf)  |
| AMASS XT30U-F | 10.2       | 5.6         | 12.4                | [AMASS 2024 catalog · page 7](https://www.china-amass.com/public/upload/20240723/c1ae9604bbe795ebfd366c9063019e3e.pdf)  |
| AMASS XT60-M  | 16         | 8.1         | 20.5                | [AMASS 2024 catalog · page 13](https://www.china-amass.com/public/upload/20240723/c1ae9604bbe795ebfd366c9063019e3e.pdf) |
| AMASS XT60-F  | 15.5       | 8.1         | 21.3                | [AMASS XT60-F specification · 2025V0](https://www.china-amass.net/uploads/57.XT60-F-SPEC-2025V0.pdf)                    |
| AMASS XT60U-M | 15.35      | 8.3         | 17.2                | [AMASS 2024 catalog · page 13](https://www.china-amass.com/public/upload/20240723/c1ae9604bbe795ebfd366c9063019e3e.pdf) |
| AMASS XT60U-F | 15.3       | 8.3         | 17.4                | [AMASS 2024 catalog · page 13](https://www.china-amass.com/public/upload/20240723/c1ae9604bbe795ebfd366c9063019e3e.pdf) |
| AMASS XT60H-M | 16.4       | 9.2         | 23.85               | [AMASS 2024 catalog · page 13](https://www.china-amass.com/public/upload/20240723/c1ae9604bbe795ebfd366c9063019e3e.pdf) |
| AMASS XT60H-F | 16.4       | 9.2         | 24.95               | [AMASS 2024 catalog · page 13](https://www.china-amass.com/public/upload/20240723/c1ae9604bbe795ebfd366c9063019e3e.pdf) |
| AMASS XT90H-M | 21.3       | 10.7        | 30.7                | [AMASS 2024 catalog · page 21](https://www.china-amass.com/public/upload/20240723/c1ae9604bbe795ebfd366c9063019e3e.pdf) |
| AMASS XT90H-F | 21.3       | 10.9        | 29.7                | [AMASS 2024 catalog · page 21](https://www.china-amass.com/public/upload/20240723/c1ae9604bbe795ebfd366c9063019e3e.pdf) |
| AMASS MR60-M  | 20.2       | 9.8         | 21.6                | [AMASS 2024 catalog · page 16](https://www.china-amass.com/public/upload/20240723/c1ae9604bbe795ebfd366c9063019e3e.pdf) |
| AMASS MR60-F  | 20.2       | 9.8         | 21.1                | [AMASS 2024 catalog · page 16](https://www.china-amass.com/public/upload/20240723/c1ae9604bbe795ebfd366c9063019e3e.pdf) |

XT60-F uses the newer 2025V0 width of 15.5 mm; the 2024 catalog lists 16.0 mm. Nominal dimensions do not imply all tolerances are represented.

## Geometry evidence and limits

Manufacturer drawings establish the overall dimensions. Contact spacing, bore depths, contact spring cuts, wall thickness, grip grooves, key details and the cover/body split are reconstructed from illustrations. They are **not verified mating dimensions**. No electrical rating, sealed fit or production compatibility is inferred from the CAD model.

The two-pole XT families have polarized profiles, pin shrouds or socket tongues. XT30U female tongues include central relief. MR60 has a rounded capsule outline and three inline contacts. XT60H, XT90H and MR60 include separate bored rear covers, within the published length. Both detail modes keep contacts and solder cups; detailed mode adds grip and contact slots.

## FreeCAD

Each model uses 3–5 named physical solids. Assembly mode is the default to keep FreeCAD light. Preview and native export use the same geometry recipe. All twelve models in both detail modes plus one exploded case pass native solid validation, overlap checks, independent component movement and STEP/FCStd round trips.

## Panel-mounted E versions

The catalog also includes **XT60E-F**, **XT60E-M** and **XT90E-M**. Their flange footprints differ. They are separate fixed catalog selections, not a scalable common envelope. No wires, panel or fixing screws are included.

| Model   | X flange width | Y flange height | Z overall length | Flange / gasket stack | Mounting centres | Connector mounting bore | Panel fixing                |
| ------- | -------------: | --------------: | ---------------: | --------------------: | ---------------: | ----------------------- | --------------------------- |
| XT60E-F |       34.00 mm |        15.80 mm |         20.20 mm |               4.10 mm |         25.00 mm | 2 × Ø3.10 mm            | M3 through fixing           |
| XT60E-M |       27.10 mm |        12.10 mm |         16.70 mm |               4.00 mm |         20.50 mm | 2 × M2.5 nominal        | M2.5 screws; panel Ø3.00 mm |
| XT90E-M |       42.00 mm |        15.10 mm |         22.80 mm |               3.00 mm |         32.40 mm | 2 × Ø3.20 mm            | M3 screws; panel Ø3.60 mm   |

The rear flange / gasket face is **Z=0**. The mating face points toward **+Z**, the solder cups toward **−Z**. Mounting centres are `(−pitch/2, 0)` and `(+pitch/2, 0)`. The connector flange remains on the positive side of the panel. Panel thickness and rear wiring clearance are installation choices and are not included in the connector model.

For XT60E-F, the AMASS S0 drawing gives a **19.10 × 11.65 mm** rear housing and a recommended **19.30 × 11.85 mm** keyed panel opening, with **R3.90 mm** on its rounded right side, **25.00 ±0.05 mm** mounting centres and M3 panel fixings. Its **Ø3.10 mm** bores are through holes in the connector. The illustrated gasket is a separate black component within the 4.10 mm front stack. Its individual 0.65 mm thickness is reconstructed because only the total stack is dimensioned.

XT60E-M 2025V0 recommends a keyed **15.70 × 8.30 mm** panel opening with Ø3.00 mm screw clearances on **20.50 ±0.05 mm** centres. Its connector mounting callout is **2 × M2.5**, represented as smooth nominal 2.50 mm bores; actual threads and thread inserts are omitted. This is not the same flange as XT60E-F.

XT90E-M 2025V0 recommends a keyed **22.30 × 10.70 mm** panel opening with an illustrated **Ø10.70 mm** rounded/keyed end and Ø3.60 mm screw clearances on **32.40 mm** centres. Its connector bores are Ø3.20 mm. Preserve the source's keyed contour rather than treating those opening dimensions as a plain rectangular cutout.

Manufacturer documents used:

- [AMASS XT60E-F.G/Y engineering drawing, S0, hosted by Aksotronik](http://pliki.aksotronik.pl/pdf/012682.pdf): flange, holes, mounting centres, rear housing, front stack and recommended panel opening.
- [AMASS XT60E-F 2022V1 specification, hosted by TME](https://www.tme.eu/Document/172e3180ebad396a946f7e08df14c4b2/XT60E-F.pdf): corroborating overall envelope and product illustration.
- [AMASS XT60E-M 2025V0 specification](https://www.china-amass.net/uploads/36.XT60E-M%EF%BC%88V04%EF%BC%89-SPEC-2025V0.pdf): overall envelope, flange, threaded mounting centres and panel opening.
- [AMASS XT90E-M 2025V0 specification](https://www.china-amass.net/uploads/80.XT90E-M-SPEC-2025V0.pdf): overall envelope, flange, mounting centres, through bores and panel opening.

These three models are **dimension-based reconstructions**, not original manufacturer CAD. Contact pitch, socket depths, contact spring cuts, walls, undimensioned edge bevels and counterbore angles, gasket thickness and rear housing splits are reconstructed from the drawings. Fine lettering, threads, conductor cores and wires are omitted. Both detail levels retain the full mounting envelope, open bores, contact gender and exposed solder cups. Use the cited drawing and the supplied physical sample to choose manufacturing tolerances.

The focused native audit is reproducible with `scripts/validate-xt-panel-connectors.ts` followed by `scripts/validate-xt-panel-connectors.py` using the FreeCAD Python runtime. It covers all three E models in both detail levels and inspection states, checking one valid closed positive solid per physical component, matching preview/native bounds and volumes, open mounting holes, component interference and assembled STEP/FCStd round trips.

## PCB-mounted executions

The vertical **XT30UPB-M / XT30UPB-F** pair and right-angle **XT60PW-M30 / XT60PW-F30** pair are distinct purchased products. The **30** suffix is retained for the selected XT60PW products because their power tails have the specified 3.00 mm projection. Older drawings and other tail-length executions must not be mixed with these footprints.

| Model      |  X width | Y extent | Z extent | PCB plane | Mating face                              |
| ---------- | -------: | -------: | -------: | --------- | ---------------------------------------- |
| XT30UPB-M  | 10.20 mm |  5.60 mm | 13.70 mm | Z=0       | Z=10.70 mm                               |
| XT30UPB-F  | 10.20 mm |  5.60 mm | 12.40 mm | Z=0       | Z=9.40 mm                                |
| XT60PW-M30 | 15.50 mm | 11.90 mm | 18.20 mm | Y=0       | Z=10.35 mm                               |
| XT60PW-F30 | 15.50 mm | 11.90 mm | 17.20 mm | Y=0       | Z=9.35 mm, reconstructed datum placement |

All models retain the catalogue's **+Z mating direction**. The width, height and length filters correspond to the actual X, Y and Z extents listed above. For XT30UPB the two straight power tails extend to **Z=−3.00 mm**, with centres **X=±2.50 mm, Y=0**. The 2025V1 manufacturer PCB layout specifies **5.00 ±0.05 mm** contact spacing and two recommended **Ø1.80 +0.20/0.00 mm** board holes. The 1.60 mm actual tail diameter is reconstructed within that recommended hole size. The 10.20 × 5.60 mm housing begins at Z=0; its length is 10.70 mm for M and 9.40 mm for F, within the published total envelope.

For XT60PW the PCB is the **XZ plane at Y=0**, with the connector above it in +Y. This preserves the +Z mating direction while accurately turning the PCB tails through 90°. The source specifies **8.40 ±0.30 mm** housing height, **3.00 ±0.30 mm** power-tail projection, and **3.50 ±0.20 mm** hold-down projection. The full model Y extent is therefore **−3.50…+8.40 mm**, or **11.90 mm** including tabs. No circuit board is added to the connector model.

The XT60PW PCB footprint is:

- Power-contact centres: **(X,Z)=(−3.60,−6.00), (+3.60,−6.00) mm**, recommended two **Ø2.90 +0.10/0.00 mm** board holes, **7.20 ±0.05 mm** contact pitch.
- Hold-down centres: **(X,Z)=(−6.75,0), (+6.75,0) mm**, recommended two **0.80 +0.10/0.00 × 1.90 +0.10/0.00 mm** slots, **13.50 ±0.05 mm** spacing.
- Power-to-hold-down row separation: **6.00 ±0.05 mm**. The power tails reach Y=−3.00 mm and the metal hold-downs reach Y=−3.50 mm.

The model's actual power-tail diameter of 2.60 mm and hold-down section of 0.50 × 1.60 mm are visual reconstructions, not published production dimensions. The 4.20 mm mating-contact axis height is reconstructed from the 8.40 mm housing. The male drawing directly gives the 10.35 mm front-face distance from the hold-down row. The female front-face offset is reconstructed using the published 17.20 mm envelope and matching rear footprint; its mounting pin/slot coordinates remain those explicitly dimensioned by AMASS. Use the recommended hole and slot values from the drawing for board design, not inferred drill sizes from the simplified metal bodies.

Manufacturer sources:

- [AMASS XT30UPB-F&M official archive](https://www.china-amass.net/uploads/XT30UPB-FM.rar), linked from the [official product page](https://www.china-amass.net/xt30upb-m-product/). It contains separate **2025V1** PDFs for XT30UPB-M and XT30UPB-F with 3.00 mm tail projections. These supersede the older 2.00 mm-tail outlines for the selected catalogue execution.
- [AMASS XT60PW-M30 specification, 2025V0](https://www.china-amass.net/uploads/34.XT60PW-M30-SPEC-2025V0.pdf): 18.20 × 15.50 × 8.40 mm housing envelope, tail projections and complete PCB layout.
- [AMASS XT60PW-F30 specification, 2025V0](https://www.china-amass.net/uploads/35.XT60PW-F30-SPEC-2025V0.pdf): 17.20 × 15.50 × 8.40 mm housing envelope, tail projections and complete PCB layout.

These are dimension-based reconstructions, not original AMASS CAD. Both detail levels retain the published envelope and PCB installation pattern. Socket depths, spring cuts, key radii, walls and internal retention remain approximate. The right-angle models contain one housing, two bent power contacts and two separate metal hold-downs. Vertical models contain one housing and two straight power contacts. No solder cups, external wires, solder, PCB, or mounting hardware are included in these PCB versions.

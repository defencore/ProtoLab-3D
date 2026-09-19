# AMASS power connectors

Find **CONNECTORS & INTERFACES → POWER & INDUSTRIAL → AMASS power connectors**.

Twelve concrete manufacturer models replace generic connector examples. Search or filter by series, M/F contact type, contact count and dimensions. Dimensions are fixed for the selected catalog model; detail and exploded state remain configurable. XT30 and XT90 searches find XT30U and XT90H respectively; the suffixes remain explicit because they identify the actual versions modeled.

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

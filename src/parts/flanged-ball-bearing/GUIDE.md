# Flanged miniature ball bearing

The eight requested F-series options are available under **Motion > Bearings & seals > Ball bearings**. Select bore, body outside diameter and overall width, or choose an individual F623/F686/F688/F689/F695/F696/F698/F608-2RS preset.

The supplied option list establishes the body envelope and two rubber seals. The seller page could not be independently verified. Manufacturer size references supply editable flange geometry without establishing that the seller's product is interchangeable:

| Model    | Bore x body diameter x overall width (mm) | Reference flange diameter x thickness (mm) |
| -------- | ----------------------------------------- | ------------------------------------------ |
| F623-2RS | 3 x 10 x 4                                | 11.5 x 1                                   |
| F686-2RS | 6 x 13 x 5                                | 15 x 1.1                                   |
| F688-2RS | 8 x 16 x 5                                | 18 x 1.1                                   |
| F689-2RS | 9 x 17 x 5                                | 19 x 1.1                                   |
| F695-2RS | 5 x 13 x 4                                | 15 x 1                                     |
| F696-2RS | 6 x 15 x 5                                | 17 x 1.2                                   |
| F698-2RS | 8 x 19 x 6                                | 22 x 1.5                                   |
| F608-2RS | 8 x 22 x 7                                | 25 x 1.5                                   |

[Fitrun's manufacturer catalogue](https://www.fitrunbearing.com/wp-content/uploads/2022/09/miniature-ball-bearings-catalogue-pdf.pdf), printed pages 11, 13 and 15, supplies seven flange references. The F696 row prints an impossible 12 mm thickness inside a 5 mm bearing; its 1.2 mm flange reference instead follows the [SKDIN manufacturer table](https://www.skdin.com/products/bearings/ball-bearings/deep-groove-ball-bearings/f-series-flanged-miniature-bearings/). Neither supplier's load ratings or speed ratings have been assigned to the seller's products.

The flange is an integral step on the outer ring, on the positive-Z face. Its thickness is included in the overall bearing width. Preview and FreeCAD recipes use the same revolved cross section. Each bearing remains one purchased product; separately colored rings, balls, cage and seals are inspection geometry.

Ball count, ball diameter, concave raceways, cage and seal contours are representative. They do not describe manufacturing tolerances, contact mechanics, internal clearance or operating capacity. Only the supplied body dimensions and closure are marked as verified seller-option parameters; flange references remain editable and are excluded from verified numeric seller filters.

## Catalog ownership and reused executions

The package owns all eleven current records in `presets.json`: the eight
F-series selections above and the existing SMB MF105 2Z, MF106 2Z and MF63 2Z
executions used by the actuator assemblies. Their qualified IDs remain
`flanged-ball-bearing:smb-mf105-2z`, `flanged-ball-bearing:smb-mf106-2z` and
`flanged-ball-bearing:smb-mf63-2z`. They reuse Motion → Bearings & seals →
Ball bearings; no additional package or browse family is introduced.

Runtime code reads that complete catalog without appending products or changing
titles. The actuator helper selects those same records and presents their
original supplier designation in purchasing lists. Curated catalog titles retain
the bore, body diameter and overall width. SMB source URLs, manufacturer drawing
links, flange dimensions, dated availability observations and fidelity limits
remain attached to their own records. The catalog ownership refactor preserved
every current record's ID, name, parameters and source metadata, together with
the existing Assembled/Exploded geometry and physical procurement boundary.

# Laboratory terminal

This catalog contains 19 identified supplier models and five spring test clip references for bench power supplies, instruments, test leads, speaker wiring and temporary wire connections. Select a model by connection type, banana diameter, contact count, mounting method or a published fitting dimension. Physical dimensions are fixed; changing a filter does not resize a part.

## Included models

| Connection                   | Supplier executions                                           | Useful fitting dimensions                                                            |
| ---------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Stackable banana plugs       | Pomona 1325-2; 1330-2 double                                  | 4 mm contact family; double plug centres 19.05 mm                                    |
| Panel banana sockets         | Pomona 1581-2; 5935-0                                         | 4 mm and 2 mm contact families; distinct panel cutouts                               |
| Miniature solder banana plug | Pomona 5936-2                                                 | 2 mm contact; 17.8 mm handle plus 9.6 mm exposed section                             |
| Binding posts                | Pomona 3760-2; 4243-0 double                                  | 4 mm banana sockets and cross-wire holes; double centres 19.05 mm                    |
| Quick wire post              | Pomona 4995-2                                                 | Spring cap and 2.35 mm wire opening; no banana socket                                |
| Recessed panel socket        | Pomona 72913-2                                                | 4 mm contact behind insulating mouth; 12.08 mm panel drilling                        |
| Speaker spring terminals     | CLIFF FE6935; FE6930                                          | 2 and 8 independent contacts; 13 mm contact pitch; mounting holes 34 and 58 mm apart |
| Spring binding posts         | CLIFF SPT1 CL681580; SPT2 CL681570; SPT3 CL681560             | 4 mm banana sockets; M3, short M4 and long M4 fittings respectively                  |
| Lever wire splices           | WAGO 221-412; 221-413; 221-415                                | 2, 3 and 5 wire entries connected to one common electrical potential                 |
| Pluggable screw terminals    | Phoenix Contact MSTB 2,5/2-ST-5,08 1757019; 3-ST-5,08 1757022 | 2 and 3 female contacts at 5.08 mm pitch; mating header is not included              |

The spring test clips add a nominal 55 mm modular clip, a six-way block on an insulating base, and a 101.3 mm mounting-ear clip. The six-way block retains independent contacts in red, black, white, yellow, blue and brown.

The specified colour is part of the selected execution. No colour-only duplicates inflate this catalog. Supplier packaging quantities are not the number of models or a bill of materials.

## Installation datums and model states

For panel terminals the mounting front face is Z = 0; the head points toward positive Z and the rear hardware toward negative Z. Mounting nuts and insulating washers are illustrated in a reference installation pose. Their positions do not define an adjustable panel thickness. For cable banana plugs the exposed pin points toward negative Z. Speaker terminals and wire splices use the base plane with their release controls toward positive Z.

**Assembly** shows independent housings, conductors, levers, caps and mounting hardware. **Exploded** applies a rigid inspection translation to the same components. It does not resize them or create additional procurement items. The complete supplier product remains one purchased assembly.

Female banana sockets and the front of wire entry channels are open volumes. Metal sockets have visible walls, rather than a solid coloured cylinder covering their mouths. Springs, screws and moulded details are simplified where the source does not dimension them.

## Source evidence

The original 19 geometries are reconstructions from official dimensional drawings or an official CAD catalog's dimension table, supported by product illustrations. They are labelled **source dimensions**, not manufacturer CAD. No supplied STEP geometry or EasyEDA community geometry is represented as an original manufacturer model.

Pomona drawings are linked per model in the catalog, with SHA-256 values for the downloaded drawing revision. The principal references are [banana plugs and jacks](https://www.pomonaelectronics.com/products/banana-plugs-jacks-and-hardware/banana-plugs-and-jacks) and [binding posts](https://www.pomonaelectronics.com/products/banana-plugs-jacks-and-hardware/binding-posts). Source drawings define the exposed plug lengths, socket openings, mounting diameters and double-terminal pitch. Internal contact splits, thread helices, washer teeth and housing radii are reconstructed or omitted. Where a drawing leaves the outer diameter or an overall assembly dimension unspecified, that modeled dimension is not exposed as a verified catalog filter.

CLIFF [FE6935](https://www.cliffuk.co.uk/products/springterminals/FE6935.pdf), [FE6930](https://www.cliffuk.co.uk/products/springterminals/FE6930.pdf), and [SPT series issue 4, April 2025](https://www.cliffuk.co.uk/products/springterminals/singlespringterminals.pdf) provide contact and mounting dimensions. The multi-pole products retain the red/black identification pattern. FE6930 has four columns and two rows, with 11 mm between rows. The spring action and contact cages are image-based reference shapes. A body outline is not a verified rectangular panel cutout.

WAGO dimensions follow the **HIGH** detail table in the official embedded CAD catalog: 221-412 width 13.00 mm, 221-413 width 18.60 mm, 221-415 width 29.80 mm, each 18.30 mm deep and 8.15 mm high. These legacy CAD dimensions differ from later product datasheets. The selected source revision is stated in each model; no mixture of revisions is used to resize an individual model. Native STEP download was not recovered from this portal in this update. Wire pitch, channel diameter, lever cavities and the common bus are reconstructed and are not verified search dimensions. The portal's “number of potentials” table is not used to imply electrically isolated contacts: these are commoning splice connectors.

Phoenix Contact [1757019](https://www.phoenixcontact.com/en-us/products/pcb-plug-mstb-25-2-st-508-1757019) and [1757022](https://www.phoenixcontact.com/en-us/products/pcb-plug-mstb-25-3-st-508-1757022) provide 5.08 mm pitch and 18.3 mm depth × 15 mm height, with widths 10.16 and 15.24 mm. The keyed outline, screw cages and mating socket details are reconstructed from product illustrations.

## Spring test clips

Find these under **Connectors & interfaces → Laboratory terminals**, using `test clip`, `spring clip`, `Xinmao` or `HENGCHANG` in search. These photo labels help find the supplied examples; they do not establish a verified manufacturer or SKU. The five selections remain fixed reference assemblies, with no attached wires.

| Selection                               | Source dimensions                                                                                                                                                               | Reconstructed details                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Spring test clip · 55 mm                | User nominal 55 × 35 × 18 mm; annotated photo shows 53.7 mm length, 34.8 mm rear housing and 39.2 mm lever envelope                                                             | Modeled base 55 × 18 mm; lever envelope 39.2 mm, side locating pegs, pivot, spring, mounting slots, jaw mechanism and solder tag       |
| Spring test terminal block · 6 contacts | Six independent contacts shown on a common insulating board                                                                                                                     | Board 132 × 65 × 3 mm, hole pattern, clip centres and assembly arrangement; these dimensions are omitted from verified catalog filters |
| Spring test clip · 101 mm mounting ears | Base length 101.3 mm; rear housing 52.7 mm; lever envelope 53.9 mm; approximately annotated width 21.6 mm, holes Ø4.8 mm at 86 mm centres and 12 mm jaw; M4 contact termination | Pivot, coil spring, inner linkage and moulded contours; contact thread represented by a smooth nominal bore                            |

X is across the clip or bank, Y follows its length, and Z points up from the mounting surface. The bank board bottom is Z = 0 and its clips start at Z = 3 mm. Housing nominal sizes exclude solder-tag projection and side locating pegs. Reported assembly dimensions include those features. The small clip's supplied nominal 35 mm listing height differs from the pictured 39.2 mm lever envelope; the supplier revision and whether the listing excludes the lever are unconfirmed. The 9.6 mm underside annotation is not a pivot height or a verified mounting pattern.

Each clip contains a C-shaped insulating housing, a ridged lever, a fixed brass conductor and termination, a moving brass jaw, a pivot pin and one continuous compression spring. The six-way model has no common conductor between poles. Assembly and exploded views use the same components; exploded spacing is an inspection pose.

Evidence comes from the two [supplied AliExpress references](https://www.aliexpress.com/item/4001315701627.html) ([second listing](https://www.aliexpress.com/item/4000167641521.html)) and the user's product photographs. The pages could not be retrieved during this update, and the association of each photographed execution with either listing is unconfirmed. Original photos are retained in `lib/reference-images/`, with hashes in [clip-evidence.json](lib/clip-evidence.json). The dimensioned single clips are labelled **source dimensions**. The six-way block is labelled **envelope** because its board and mounting pattern are reconstructed. Seller photo labels “50A” and “100A” are not verified electrical ratings.

## Downward-contact clip executions

The two additional selections are **Spring test clip · 55 mm downward contact** and **Spring test terminal block · 6 downward contacts**. Use the **Contact exit → Downward solder tab** filter or search `downward`. The brass blade passes through the mounting surface; the entire clip is not rotated to obtain this orientation. The original rear-tab executions remain separate selections.

The supplied blue-clip dimensional photograph is rotated relative to the library mounting datum. In mounting orientation it gives approximately 35 mm housing height and a 41 mm lever envelope. Its 52 mm side dimension differs from the underside 24.5 + 30.5 = 55 mm annotation, and the photograph explicitly allows approximately 3 mm measuring variation. The reference keeps the nominal 55 mm compact base. Its 18 mm width is inherited from the previous compact reference and is not independently dimensioned in these new photographs.

The paired underside holes are 9.6 mm apart across X. Their 3.2 mm modeled diameter and Y = 3 mm position are reconstructed, so the hole diameter is not published as a verified filter. The front mounting slot is retained. The explicitly annotated Ø4 mm hole belongs to the brass solder tab.

The tab is a continuous 7 × 1.6 mm brass blade with an estimated 14 mm projection below the clip mounting plane and a hole centred 9 mm below it. Its exact projection, section and exit position are not supplied dimensions. The clip has a real through slot around this blade. On the six-way board, each blade passes through a separate 8 × 3 mm opening; the board bottom is Z = 0, clip bases are Z = 3 mm, and contact tips reach Z = -11 mm. Allow access below the board when placing this execution in a project. These positions define the reference model and must be checked against the ordered hardware.

Original new photographs are retained as `bottom-tab-dimensions.png` and `bottom-tab-clip.png` alongside the earlier evidence. Contacts are independent and no wires are included.

## Housing reconstruction

The compact rear-tab and downward-tab executions use a square L-shaped side outline. The base rail is approximately 10 mm high and the head starts near the middle of the nominal 55 mm base, with a nearly vertical leading edge and rounded upper corners. The underside has large moulding pockets, cross ribs, a divided mounting chamber and local mounting supports. Three locating pins and opposite blind sockets follow the side photographs. The compression spring is seated on top of the thicker base.

The 101.3 mm execution has a different housing: long inclined cheeks extending toward the front mounting ear. Its slope is preserved instead of applying the compact L profile. Contact access remains open between the cheeks, with only the narrow far-end bridge illustrated in the reference photos.

The approximately 10 mm compact rail, pocket depths, rib sections, peg positions, corner radii and slope endpoints are photo reconstructions. They are not added to verified dimensional filters. Mounting and contact openings pass through the complete modelled material thickness.

## Panel cutouts and engineering limits

- Pomona 1581 and 3760 use a 9.53 mm circular cutout with flats 8.89 mm apart. A plain 9.53 mm hole loses the locating flats.
- Pomona 4243 uses two 9.53 mm round holes on 19.05 mm centres.
- Pomona 5935 uses a 5.21 mm hole for its hex nut execution. The drawing's alternative 4.98 mm press-in hole is not this selected mounting method.
- Pomona 4995 uses a 7.94 mm round hole. Pomona 72913 uses a 12.08 mm hole.
- CLIFF SPT2 and SPT3 use a 7.2 mm hole with a 2 mm locating relief, not just a circular drill. SPT1 uses the separate M3 fitting; a panel clearance diameter is not asserted.

Cutout filters describe the primary diameter. Consult the linked drawing for flats, locating reliefs, panel thickness, tolerances, solder access and insulation spacing. Source dimensions do not certify the reconstructed mechanism as a production mating gauge. Electrical ratings, creepage, spring force and endurance are not inferred from appearance. Choose the ordered supplier revision and verify its actual drawing before releasing fabrication.

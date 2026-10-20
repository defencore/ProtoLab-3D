# Laboratory terminal

This catalog contains 19 identified supplier models for bench power supplies, instruments, test leads, speaker wiring and temporary wire connections. Select a model by connection type, banana diameter, contact count, mounting method or a published fitting dimension. Physical dimensions are fixed; changing a filter does not resize a part.

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

The specified colour is part of the selected execution. No colour-only duplicates inflate this catalog. Supplier packaging quantities are not the number of models or a bill of materials.

## Installation datums and model states

For panel terminals the mounting front face is Z = 0; the head points toward positive Z and the rear hardware toward negative Z. Mounting nuts and insulating washers are illustrated in a reference installation pose. Their positions do not define an adjustable panel thickness. For cable banana plugs the exposed pin points toward negative Z. Speaker terminals and wire splices use the base plane with their release controls toward positive Z.

**Assembly** shows independent housings, conductors, levers, caps and mounting hardware. **Exploded** applies a rigid inspection translation to the same components. It does not resize them or create additional procurement items. The complete supplier product remains one purchased assembly.

Female banana sockets and the front of wire entry channels are open volumes. Metal sockets have visible walls, rather than a solid coloured cylinder covering their mouths. Springs, screws and moulded details are simplified where the source does not dimension them.

## Source evidence

All 19 geometries are reconstructions from official dimensional drawings or an official CAD catalog's dimension table, supported by product illustrations. They are labelled **source dimensions**, not manufacturer CAD. No supplied STEP geometry or EasyEDA community geometry is represented as an original manufacturer model.

Pomona drawings are linked per model in the catalog, with SHA-256 values for the downloaded drawing revision. The principal references are [banana plugs and jacks](https://www.pomonaelectronics.com/products/banana-plugs-jacks-and-hardware/banana-plugs-and-jacks) and [binding posts](https://www.pomonaelectronics.com/products/banana-plugs-jacks-and-hardware/binding-posts). Source drawings define the exposed plug lengths, socket openings, mounting diameters and double-terminal pitch. Internal contact splits, thread helices, washer teeth and housing radii are reconstructed or omitted. Where a drawing leaves the outer diameter or an overall assembly dimension unspecified, that modeled dimension is not exposed as a verified catalog filter.

CLIFF [FE6935](https://www.cliffuk.co.uk/products/springterminals/FE6935.pdf), [FE6930](https://www.cliffuk.co.uk/products/springterminals/FE6930.pdf), and [SPT series issue 4, April 2025](https://www.cliffuk.co.uk/products/springterminals/singlespringterminals.pdf) provide contact and mounting dimensions. The multi-pole products retain the red/black identification pattern. FE6930 has four columns and two rows, with 11 mm between rows. The spring action and contact cages are image-based reference shapes. A body outline is not a verified rectangular panel cutout.

WAGO dimensions follow the **HIGH** detail table in the official embedded CAD catalog: 221-412 width 13.00 mm, 221-413 width 18.60 mm, 221-415 width 29.80 mm, each 18.30 mm deep and 8.15 mm high. These legacy CAD dimensions differ from later product datasheets. The selected source revision is stated in each model; no mixture of revisions is used to resize an individual model. Native STEP download was not recovered from this portal in this update. Wire pitch, channel diameter, lever cavities and the common bus are reconstructed and are not verified search dimensions. The portal's “number of potentials” table is not used to imply electrically isolated contacts: these are commoning splice connectors.

Phoenix Contact [1757019](https://www.phoenixcontact.com/en-us/products/pcb-plug-mstb-25-2-st-508-1757019) and [1757022](https://www.phoenixcontact.com/en-us/products/pcb-plug-mstb-25-3-st-508-1757022) provide 5.08 mm pitch and 18.3 mm depth × 15 mm height, with widths 10.16 and 15.24 mm. The keyed outline, screw cages and mating socket details are reconstructed from product illustrations.

## Panel cutouts and engineering limits

- Pomona 1581 and 3760 use a 9.53 mm circular cutout with flats 8.89 mm apart. A plain 9.53 mm hole loses the locating flats.
- Pomona 4243 uses two 9.53 mm round holes on 19.05 mm centres.
- Pomona 5935 uses a 5.21 mm hole for its hex nut execution. The drawing's alternative 4.98 mm press-in hole is not this selected mounting method.
- Pomona 4995 uses a 7.94 mm round hole. Pomona 72913 uses a 12.08 mm hole.
- CLIFF SPT2 and SPT3 use a 7.2 mm hole with a 2 mm locating relief, not just a circular drill. SPT1 uses the separate M3 fitting; a panel clearance diameter is not asserted.

Cutout filters describe the primary diameter. Consult the linked drawing for flats, locating reliefs, panel thickness, tolerances, solder access and insulation spacing. Source dimensions do not certify the reconstructed mechanism as a production mating gauge. Electrical ratings, creepage, spring force and endurance are not inferred from appearance. Choose the ordered supplier revision and verify its actual drawing before releasing fabrication.

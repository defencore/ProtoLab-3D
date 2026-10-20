# 18650 battery holders

Find **Electronics → Power & motor control → Batteries & holders → Battery holders**.
In **Part type**, choose **18650 battery holder** for purchased products or **Cylindrical cell holder** for editable trays to print.

## Models

| Model | Cells and connection | Body length × width × height, mm | Geometry |
| --- | --- | --- | --- |
| BeiLaMoo BH18650*2S-W | 2S1P, wire leads | 77.70 × 40.21 × 21.54 | Source-dimension reconstruction |
| BeiLaMoo BH18650*3S-W | 3S1P, wire leads | 77.70 × 59.69 × 21.54 | Source-dimension reconstruction |
| BeiLaMoo BH18650*4S-W | 4S1P, wire leads | 77.98 × 78.84 × 21.54 | Source-dimension reconstruction |
| MPD BK-18650-PC4 | Two independent cells, PCB pins | 77.70 × 40.21 × 21.54 | Original manufacturer STEP |
| MPD BK-18650-PC6 | Three independent cells, PCB pins | 77.70 × 59.69 × 21.54 | Original manufacturer STEP |
| MPD BK-18650-PC8 | Four independent cells, PCB pins | 77.98 × 78.84 × 21.54 | Original manufacturer STEP |

The body sits on Z=0. X follows cell length; Y spans the rows. PCB pins extend to Z=−3.2 mm on MPD models. Body dimensions in the catalogue exclude pin extension; the preview bounding size includes all visible components. Wires are omitted from every preview and FreeCAD export.

## Contacts and wires

All models include a detailed black housing and two separate metal leaf-spring contacts per cell. Cells and enclosure fasteners are not included. The MPD contacts remain independent; the number of slots does not establish series wiring.

BeiLaMoo lists its wire-lead versions as 2S, 3S and 4S with 150 mm, 22 AWG leads. The library models only their housings and metal contacts. External wires, solder joints and internal bus routing are omitted. The catalogue retains the supplier's wire-lead termination description as product information.

The maker's product text specifies series connection, while its reused photograph contains a parallel marking. Confirm the ordered electrical execution. The library models the stated series catalogue variants; it does not certify the continuity of a delivered holder or assign a contact-current rating.

## Geometry evidence and mounting

MPD models retain every source STEP solid with only a rigid transform: rotate X by +90°, then translate Z by −3.2 mm. Housing, contacts, pins, openings, mounting recesses and small source offsets are preserved. Colours are illustrative. Each model records the official source hash and original solid indices.

The MPD drawings specify Ø3.20 mm mounting holes and 2-56 screws. The hole coordinates below are measured from the actual source CAD, relative to the outer body centre:

| Model | X coordinates, mm | Y coordinates, mm |
| --- | --- | --- |
| PC4 | −27.81, +27.81 | −9.65, +9.65 |
| PC6 | −27.81, +27.81 | −19.29, 0, +19.29 |
| PC8 | −27.95, +27.66 | −28.955, −9.651667, +9.651667, +28.955 |

Use every X/Y combination. The PC8 longitudinal offset is intentional source geometry. The manufacturer specifies 65–68 mm button-top cells for these MPD holders; use the linked drawing to select the purchased cell execution.

BeiLaMoo publishes matching outer dimensions but no original STEP was found. Its models use the MPD case and leaf contacts as an explicitly declared geometry reference. PCB tails are clipped at the body underside and two wire entrances are inferred from product photographs. The inherited mounting pattern and fine moulding details are **not verified BeiLaMoo interfaces**. Measure the purchased holder before drilling its enclosure mounting holes. These models are not labelled manufacturer CAD.

**Separate components** lifts the contacts for inspection. The holder remains one purchased product in a design project. Separate visible solids are not a fabrication bill of materials.

## Sources and reproducibility

- [BeiLaMoo two-cell series holder](https://www.beilamoo.com/sdp/1074412/4/pd-5180803/21007225-2439217/Two_18650_In_Series_Battery_Holder_with_Wire_Leads.html)
- [BeiLaMoo three-cell series holder](https://www.beilamoo.com/sdp/1074412/4/pd-5180803/21007228-2986068/Three_18650_In_Series_Battery_Holder_with_Wire_Lea.html)
- [BeiLaMoo four-cell series holder](https://www.beilamoo.com/sdp/1074412/4/pd-5180803/21007231-2986068/Four_18650_In_Series_Battery_Holder_with_Wire_Lead.html)
- [MPD BK-18650-PC4](https://www.batteryholders.com/part.php?pn=BK-18650-PC4)
- [MPD BK-18650-PC6](https://www.batteryholders.com/part.php?pn=BK-18650-PC6)
- [MPD BK-18650-PC8](https://www.batteryholders.com/part.php?pn=BK-18650-PC8)
- [User's four-slot reference](https://epicentrk.ua/ua/shop/mplc-trimac-akumulatoriv-18650-na-4-sloti-4s-plastikovij-186504-1f14a247-9321-6038-89ff-6714afd567b8.html)

`scripts/prepare-18650-holders.py` reproduces the six baked assets from the three official MPD STEP files without fetching network content. It records source hashes, normalization, declared proxy operations, mounting geometry and native/preview mesh validation. The model uses the same baked BReps in FreeCAD and tessellations in the preview.

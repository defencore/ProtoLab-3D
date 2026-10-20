# PY prototyping boards

Select a purchased, empty soldering perfboard through **Board model**. This
family has six fixed supplier executions, with actual open holes in both the
preview and FreeCAD export. No wires or electronic components are included.

| Model | Outline | Copper sides | Grid | Edge lands per end |
| --- | --- | --- | --- | --- |
| PY-10*10CM 2.54MM, Nikom A066069 | 100 × 100 mm | Two | 35 × 37 = 1295 holes | 30 |
| PY-7*9CM, Nikom A066023 | 90 × 70 mm | One | 30 × 24 = 720 holes | 15 |
| PY-3*7CM, Nikom A066031 | 70 × 30 mm | Two | 24 × 10 = 240 holes | 8 |
| PY-4*6CM, Nikom A066037 | 60 × 40 mm | Two | 20 × 14 = 280 holes | 12 |
| PY-5*7CM, Nikom A066092 | 70 × 50 mm | One | 24 × 18 = 432 holes | 10 |
| PY-6*8CM, Nikom A066016 | 80 × 60 mm | Two | 27 × 22 = 594 holes | 20 |

All models use a 2.54 mm hole pitch. X is the board length, Y is its width,
the outline centre is X=Y=0, and the finished board underside is Z=0. The
single-sided board has exposed copper on its underside. The double-sided
board has pads on both faces. Surface colours are illustrative.

## Source evidence

- [Nikom A066069: PY-10*10CM 2.54MM](https://www.nikom.biz/ua/product_A066069.html)
  publishes a 100 × 100 mm double-sided glass-fibre board. The
  [selected supplier photograph](https://www.nikom.biz/LA06606980065.jpg)
  shows 35 columns, 37 rows, four corner mounting holes and 30 exposed edge
  lands at each end. The photograph is the evidence for the pad counts.
- [Nikom A066023: PY-70x90 mm single-sided](https://www.nikom.biz/ua/product_A066023.html)
  publishes 90 × 70 × 1.5 mm, a 2.54 mm pitch, 0.8 mm holes, 720 holes,
  3 mm mounting holes and 30 edge lands at 4 mm pitch. Its
  [photograph](https://www.nikom.biz/LA06602333395.jpg) shows the matching
  30 × 24 grid and 15 edge lands per end. PY-7*9CM is the library selection
  name for this 70 × 90 mm execution.
- [Nikom A066031: PY-30x70 mm double-sided](https://www.nikom.biz/ua/product_A066031.html)
  publishes 70 × 30 × 1.5 mm, 240 holes, 0.8 mm grid drills and 1.2 mm
  mounting holes. The [selected photograph](https://www.nikom.biz/LA06603133397.jpg)
  shows the 24 × 10 grid and eight edge lands per end.
- [Nikom A066037: PY-40x60 mm double-sided](https://www.nikom.biz/ua/product_A066037.html)
  publishes 60 × 40 × 1.5 mm, 280 holes, 0.8 mm grid drills and 1.5 mm
  mounting holes. The [selected photograph](https://www.nikom.biz/LA06603730021.jpg)
  shows a 20 × 14 grid and 12 edge lands per end.
- [Nikom A066092: PY-50x70 mm single-sided](https://www.nikom.biz/ua/product_A066092.html)
  publishes 70 × 50 × 1.5 mm, 432 holes, 0.8 mm grid drills and 3 mm
  mounting holes. The [selected photograph](https://www.nikom.biz/LA06609239342.jpg)
  shows a 24 × 18 grid, octagonal exposed pads and ten edge lands per end.
  The pictured edge lands are spaced approximately 4 mm apart, despite the
  repeated 2.54 mm edge-pitch entry in the supplier table. The reconstruction
  follows the photograph; the edge pitch is not a verified catalogue attribute.
- [Nikom A066016: PY-60x80 mm double-sided](https://www.nikom.biz/ua/product_A066016.html)
  publishes 80 × 60 × 1.6 mm, 594 holes, 0.8 mm grid drills and 2 mm
  mounting holes. The [selected photograph](https://www.nikom.biz/LA06601633391.jpg)
  shows a 27 × 22 grid and 20 edge lands per end.

These supplier pages describe generic PY boards; no factory CAD or tolerance
drawing was available. The geometry is an explicitly declared reconstruction,
not original manufacturer CAD. Supplier photographs are linked and hashed,
and are not embedded as product textures.

## Reconstructed installation details

The 100 × 100 mm source does not publish thickness or drill diameter. The
model assumes **1.5 mm finished thickness and 0.8 mm grid holes**. These values
are not published catalogue filter attributes for that model. Its mounting
hole diameter is assumed 3 mm from the photograph.

All models use centred regular hole grids. The original mounting centres are reconstructed
from the photographs: 94 × 91.44 mm for the 100 × 100 board and 83 × 63 mm
for the 90 × 70 board. All four mounting holes remain clear of the pad grid.
These coordinates are installation approximations; verify the delivered
board before drilling a mounting plate.

The smaller boards are separate photographed executions, rather than scaled
copies of either original model. Their reconstructed mounting-centre pitches
are 66.04 × 26.6 mm (3 × 7 cm), 55 × 35 mm (4 × 6 cm), 66 × 44 mm
(5 × 7 cm), and 75.5 × 55 mm (6 × 8 cm). Their published mounting-hole
diameters are retained independently. Check the actual board before making
matching fixed holes; generic PY products can vary between batches.

The 3 × 7, 4 × 6 and 6 × 8 cm source pages explicitly label the mounting
measurements as **diameters**, in both their tables and descriptive text:
1.2, 1.5 and 2 mm respectively. However, their selected photographs show
larger corner openings relative to the 2.54 mm grid. The photographs may
depict another execution or be reused catalogue images. These three models
retain the written supplier-table bores; they are not photograph-verified
mounting fits. Confirm the actual bore on the delivered board before
choosing screws, spacers or the mating mounting-hole pattern.

Pad outer diameters are 1.8 mm for the 100 × 100 board and 2 mm for the
90 × 70 board and the 70 × 50 mm board. The smaller double-sided models use
1.8 mm outer pads. The 70 × 50 mm pads are octagonal as in its photograph.
Edge lands have rounded ends. Their dimensions are inferred,
and all exposed copper is modelled at an authored 0.035 mm thickness within
the finished board thickness. The reconstruction omits plating barrels,
silkscreen, minor edge bevels and solder mask relief. It does not define
connected electrical traces or an electrical current rating.

## Native and preview implementation

One analytic perforated FR4 solid is accompanied by one compound of separate
copper pad solids per side. A double-sided board therefore has three document
components, and a single-sided board has two. The compound grouping does not
join neighbouring pads electrically or physically. Grouped components keep
large grids responsive without thousands of separate document objects.

The offline script `scripts/prepare-prototyping-boards.py` builds the analytic
faces with circular inner wires, extrudes them, and bakes their tessellations
for the shared CAD renderer. It verifies all native solids, all preview mesh
boundaries, every grid and mounting hole centre, analytic substrate volume,
and an independent STEP export/import round trip. Native FreeCAD exports
restore the same BRep geometry used to create the preview.

Run the baker with explicit model IDs to rebuild only selected assets, for
example `py-3x7cm py-4x6cm py-5x7cm py-6x8cm`. Existing models and their native
assets retain their original geometry and selection IDs. The focused tests
also run the actual production macros in Simple and Full modes when
`FREECAD_PYTHON` is set, then check grouped component labels, all hole centres,
STEP solids and FCStd save/reopen grouping.

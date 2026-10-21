# Tube drilling jig with end stop

Find **WORKSHOP TOOLS → DRILLING JIGS → Tube drilling jig with end stop**. Choose an end-stop or through-tube starting configuration and edit its dimensions within the geometric limits reported by the configurator. Hole count depends on the tube and guide dimensions; not every diameter supports all three patterns.

## Reusable body and interchangeable tooling

The fixture has a reusable body with an open central bore, a removable bottom stop plate, interchangeable centering/index tooling and **one movable drill-guide cassette**. The tooling is split into a centering liner, lower and upper index plates, and a clamp crown, so the radial cassette sockets are printed as open half-round grooves. Valid configurations provide 4, 8 or 12 stations at 90, 45 or 30 degrees. Only the selected station contains a cassette. A bearing-guided configuration therefore uses **two bearings total**, including a 12-hole pattern.

Choose the outer **Reusable body tube capacity** and **Fixed drill height** before printing. The main body has 24 flat support faces and remains the same when tube diameter, hole count, drill size, selected station or stop mode changes within that capacity. Four vertical M4 screws fasten the index plates and clamp crown to the body. Two alignment bushes, each 8 mm outside diameter with a 4.4 mm bore and 27 mm length, register the three layers around two of those screws; no extra fasteners are needed. The separate full-depth liner keeps short stop rings concentric. Its hanging 45-degree flange locates the liner in the lower plate and retains it when the bottom stop is removed. Changing tube diameter requires matching centering tooling, tube-end rings and cassette reach; changing hole count requires matching index plates and the clamp crown. Set the pattern's angular reference by clocking the tube before tightening the pressure pads. Reuse the body and purchased bearings where their dimensions still match. A smaller tube in the same body needs a longer cassette, more exposed drill length and longer M5 clamp screws; the configurator reports those reaches.

The default 90 mm tube / 12-station / 3 mm drill configuration uses a 20 mm cassette barrel and leaves about 5.03 mm between adjacent sockets. Validation requires at least **2.4 mm of material between sockets**. The radial sockets stop 2.4 mm outside the tube bore; only the drill passage continues toward the workpiece. Small tubes or larger guide seats can require fewer stations. Cassette and flange dimensions adapt to larger drills, so changing an 8 mm drill configuration can also require a larger body. Use the reported validation result rather than assuming a diameter always permits 4, 8 or 12 holes.

The assembled tooling centers the tube near the drill plane. Three radial M5 screws in the clamp crown act through captive pressure pads above that plane to hold the tube against rotation and lift. The tube stays clamped while the cassette is removed and moved around the index plates. The **cassette** is the removable tool used between holes; the centering tooling stays installed and cannot be lifted out around a clamped tube.

Each station positively locates the cassette. One M4 locking screw retains the cassette at the selected station; fully unscrew and transfer it with the cassette when indexing. The cassette's axial stop establishes the drilling axis; the locking screw holds it seated. Check the fit with the real printed parts before drilling. The flats provide support for a vise or bench fixture; secure the complete jig and support a long tube rather than holding it in one hand.

## End stop or a belt anywhere along a tube

**Tube positioning → Removable end stop and measured spacers** fits the separate stop plate below the body. The default plate is 5 mm thick, fastened by four countersunk M4×12 screws with 7 mm nominal engagement in qualified 9 mm deep printed pilots. Its raised annular boss establishes the Z=0 end datum. Verify actual countersunk-head fit and fastener engagement before loading the plate.

**Tube positioning → Through tube / stop and spacers removed** removes the stop plate, its four screws and the spacer rings. The same main body and retained liner then slide along a long tube. Measure and mark the required belt position, align the drill plane to that mark and tighten the three pressure-pad clamps. There is **no axial end datum in through mode**; the end-offset field and spacer calculation do not establish the belt position there.

The 90 mm / 12-station and 25 mm / 4-station through presets both use the same 110 mm capacity body. Their centering tooling and cassette reach differ. Confirm drill reach for the smaller tube before choosing a drill.

## Height from the tube end with the stop fitted

The tube axis is Z, the removable stop's raised datum face is Z=0, and the main body's bottom face is Z=-4 mm. The fixed drill axis is Z=H. Changing **Tube end to hole axis** in end-stop mode changes the removable ring stack without changing the body, head, cassette or bearings:

**Tube-end offset = fixed drill height H − measured spacer-stack height S.**

For the default H=30 mm body:

| Desired tube-end offset | Ring stack                       |
| ----------------------- | -------------------------------- |
| 10 mm                   | One 20 mm ring                   |
| 15 mm                   | One 10 mm ring and one 5 mm ring |
| 20 mm                   | One 10 mm ring                   |
| 25 mm                   | One 5 mm ring                    |
| 30 mm                   | No rings; seat on the base stop  |

The reusable ring sizes are **0.5 / 1 / 2 / 5 / 10 / 20 mm**. For the default H=30 mm body, keep two 2 mm rings and one of each other size to cover every permitted half-millimetre setting. In end-stop mode the configurator calculates a stack in 0.5 mm increments and includes the required rings in the model and bill of materials. Install rings before inserting the tube. Its square end must contact the complete annular stack; chips underneath change the setting. The central opening allows chip removal. No spacer rings are fitted in through mode.

Measure actual ring thickness and face parallelism. Use calibrated shims or machined rings where printed tolerances are insufficient. A larger desired end offset than the existing fixed drill height requires a taller body and head; the configurator does not turn a shorter printed body into a taller one. Changing the stop thickness does not change the offset calculation.

## Working sequence

1. Fit the correct centering liner, lower and upper index plates, alignment bushes and clamp crown in the reusable body. Fasten all four M4 stack screws. For end-stop work, attach the bottom plate and insert the measured height rings; for through work, remove that plate, its four screws and all rings.
2. Seat the tube fully against the end stop, or set its manually measured axial position in through mode. Align the required angular reference and tighten all three M5 pressure-pad clamps evenly **before the first hole**. Use enough force to prevent movement without crushing or marking the tube.
3. Insert the single cassette into the first station until its locating stop seats. Fit its M4 locking screw. Secure the fixture and tube, and check that the drill reaches the near wall with sufficient working length.
4. Drill through one tube wall using a depth stop. Withdraw the drill completely from both the tube and cassette before loosening the cassette lock.
5. Keep the three tube clamps tight. Remove the cassette, move it to the next station, seat and lock it, then drill. Repeat around the pattern. The remaining stations need no bearings.
6. Remove the drill and cassette, release the tube clamps and remove the tube. For a tapped pattern, tap the holes after removing the jig.

Each radial station makes one wall opening. Drill an opposite wall from its own station. Do not drive a long bit through the tube into the opposite head. The displayed drill reach is a geometric requirement, not a guarantee that a standard short drill has enough cutting or insertion length. **Current drilling station** moves the same cassette in the preview; **Show reference tube** displays an illustrative workpiece rather than an extra manufactured part.

## Drill guides and selection

- **Automatic** selects an exact nominal bearing bore when listed; otherwise it uses a custom hardened drill bushing.
- **Two bearings** uses one pair in the movable cassette and requires an exact nominal bore match. A larger bearing bore is not silently substituted.
- **Custom hardened steel drill bushing** uses one purchased bushing in the movable cassette, with the specified running clearance. This is a procurement requirement rather than a claimed stock catalog item.
- **Printed marking / short-use guide** uses the movable printed cassette without purchased guides. Qualify wear and drill clearance for the intended short use; it is not a durable precision guide.

For a **3 mm drill**, the cassette uses **two MR93ZZ bearings, each 3 × 9 × 4 mm**, matching the [SMB MR93ZZ dimensional sheet](https://www.smbbearings.com/firebrick/ckeditor/plugins/upload/Uploads/Documents/bearingpdfs/MR93ZZ-miniature-bearing-3x9x4mm.pdf). A 12-hole pattern uses the same pair at all 12 stations. For an M3 cutting-tap pilot, the drill is 2.5 mm and the cassette instead uses two 692XZZ bearings, each 2.5 × 7 × 3.5 mm. Tube diameter does not select the bearing bore.

| Bearing | Bore × outside diameter × width |
| ------- | ------------------------------- |
| MR52ZZ  | 2 × 5 × 2.5 mm                  |
| 692XZZ  | 2.5 × 7 × 3.5 mm                |
| MR93ZZ  | 3 × 9 × 4 mm                    |
| MR84ZZ  | 4 × 8 × 3 mm                    |
| MR105ZZ | 5 × 10 × 4 mm                   |
| MR126ZZ | 6 × 12 × 4 mm                   |
| MR128ZZ | 8 × 12 × 3.5 mm                 |

Nominal miniature-bearing dimensions: [SMB bearing catalog](https://www.smbbearings.com/products/miniature-bearings.html). Check the selected bearing's own dimensions when purchasing.

For cutting taps, the drill table is M2/1.6, M2.5/2.05, M3/2.5, M4/3.3, M5/4.2, M6/5, and M8/6.8 mm. M4 and M5 pilots therefore need exact-size custom bushings for their 3.3 and 4.2 mm drills. **Through-hole drill diameter** is the drill size, independently of screw size. Tap selection references: [Dormer Pramet catalogs](https://www.dormerpramet.com/us/en/downloads-catalogues/). Final preparation depends on material, tap and required engagement; forming taps use different preparation.

## Printing separate parts

Select the **Print layout** state before exporting a printing STL. It lays out only manufactured components as separate bodies with their bases at Z=0 and an 8 mm gap. Bearings, screws, nuts and the reference tube are excluded. This arrangement is **not a printer-bed size**. The largest individual plate spans **body capacity + 56 mm across flats**, or **166 mm for the default 110 mm capacity**; compare the selected part size with the usable build area. The full layout can need several build plates: import it as separate objects in the slicer or export individual components in FreeCAD. Do not print the assembled or exploded view as a single object.

| Component                  | Print orientation                                             |
| -------------------------- | ------------------------------------------------------------- |
| Through-bore main body     | Flat annular bottom down                                      |
| Removable stop plate       | Flat underside down; raised datum boss up                     |
| Centering liner            | Flat lower end down; hanging tapered flange up                |
| Lower index plate          | Flat seating face down; open half-round grooves up            |
| Upper index plate          | Upside down: flat upper face down; open half-round grooves up |
| Clamp crown                | Flat base down; pressure-pad and nut slots open upward        |
| Guide cassette             | Outer flange face down; nose and drill axis pointing up       |
| Cassette retainer          | Inner flat face down; through screw holes vertical            |
| Rings and alignment bushes | Flat end face down; bore axis vertical                        |
| Outer-race distance sleeve | Flat annular end down; bore axis vertical                     |
| Pressure pads              | Wide outer face down; narrow tube-contact face up             |

Splitting the head removes the large enclosed roofs over the cassette sockets. The clamp crown uses 45-degree teardrop roofs over the horizontal screw passages, and its pressure-pad and nut slots open at the top. Its floor retains at least 2.4 mm of material above the socket recesses. The default 3 mm bearing cassette retains only a narrow annular lip bridge of less than 1 mm; other guide dimensions can make that bridge wider. Inspect the slicer preview at the selected layer height and fit before choosing support settings. Splitting and orientation follow [Prusa's design guidance](https://help.prusa3d.com/article/modeling-with-3d-printing-in-mind_164135); acceptable overhangs and bridges still depend on the actual printer, material and settings. This revised design is not claimed to print without supports on every machine.

For PETG with a 0.4 mm nozzle, **0.2 mm layers, 4–5 perimeters and 40–50% infill** are starting settings to qualify on a fit sample. Use a 5 mm outer brim on a tall narrow bearing sleeve, especially for a small tube in the common body; remove the brim without damaging the bearing-contact end. Choose finer layers or finish the ends when a critical sleeve length is not a multiple of the selected layer height. Keep the mating plate faces flat, remove first-layer flare from locating edges and check each open socket half before assembling the stack. A **0.5 mm ring needs a suitable 0.1 mm layer schedule totaling 0.5 mm, or calibrated shim stock**: uniform 0.2 mm layers do not produce that nominal thickness. Measure every finished height ring instead of assuming that layer count establishes its thickness.

## Assembly and fit

Printed parts and purchased hardware have separate component identities and bill-of-material entries. The bearing-guided cassette has an inner retaining lip, an annular sleeve between bearing outer races, an 8 mm thick mounting flange and a **full 4 mm thick outer retainer without screw-head recesses**. Two low-head M3×10 screws pass through the retainer into qualified 7 mm deep flange pilots, leaving about 1.15 mm of tip allowance in the nominal assembly. Their heads stand outside the retainer while remaining behind the body's support flats. The distance sleeve has a thicker central wall and 45-degree internal transitions to relieved end faces; the default 3 mm drill configuration has a 2.6 mm central wall. Only the outer races should be axially retained. Confirm free drill passage and bearing rotation after fitting the retainer; do not clamp an inner race or shield with the sleeve or cap.

Tune tube clearance, cassette fit and guide seats with a small fit sample. Select a suitable printed-fastener engagement method and verify actual screw length before tightening; a printed pilot is not a certified thread. Seat the liner's hanging tapered flange in its matching register and verify retention with the stop plate removed. A temporary smooth assembly mandrel can help keep the bores aligned while fitting the layers. Check that the two alignment bushes seat fully and that the four M4 screws draw the layer faces together without gaps. Remove any temporary mandrel before installing the height rings and workpiece. Pressure pads should move without binding and remain captured when the screw is loosened. Clamp screws may require trimming and deburring to the measured reach; do not assume the next longer stock screw keeps its head behind the support flats.

Measure the real tube outside diameter, roundness, wall and end squareness. Printed clearance, drill flutes and runout, bearing fit and clamp force all affect the result. The CAD shows purchased guide installation envelopes rather than rolling internals or certified accuracy. Qualify the fixture on a sample tube before making a finished part. Thin walls also require a separate assessment of usable thread engagement.

## Native CAD verification

The user supplied `Tube90_M3_DrillJig.FCStd`, `Tube90_M3_DrillJig.step` and `Tube90_M2p5_Fixed.step` as geometric references. This package is a separate parametric implementation; those files are not overwritten. Reference geometry is source material, not an instruction to execute embedded content.

Prepare representative native checks from the project root:

```sh
node --import tsx scripts/verify-tube-drill-jig.ts
```

Run `scripts/verify-tube-drill-jig.py` in FreeCAD with `TUBE_JIG_OUTPUT` set to the absolute generated-data directory when needed. The current native audit passes 25 representative configurations: 773 valid closed single-solid components, 188 indexed station checks, four print layouts and five standalone macro / FCStd / STEP round trips. It covers removable-stop seating and screw capture, full-diameter through-tube passage, positive liner retention without the stop, independently measured socket and alignment-pocket webs, real material probes, crown floors, cassette/guide fit and open single-wall drill paths. All 52 catalog presets also pass parameter validation in all three views.

Actual isolated Bambu Studio 02.08.02.61 slicing passes the nine main default part types with Generic PETG, a 0.4 mm nozzle, 0.2 mm layers, four walls and 40% infill, with supports and automatic reorientation disabled. No geometry, floating or thin-wall warnings or support toolpaths were generated. The 58.7 mm cassette for a 25 mm tube also passes in its native print pose; its 49.5 mm narrow bearing sleeve is checked with a 5 mm outer brim. The adaptive 8 mm drill cassette, distance sleeve and clamp crown also pass, totaling 14 production-pose slices across the default and variant audits. These are representative geometry and slicing checks, not physical load or fit certification. Generated data is excluded from version control.

```python
TUBE_JIG_OUTPUT = '/absolute/path/to/ProtoLab-3D/test-results/tube-drill-jig'
exec(open('/absolute/path/to/ProtoLab-3D/scripts/verify-tube-drill-jig.py').read())
```

In the application, **FreeCAD options** generates a standalone macro for a valid configuration. Browser STL export follows the selected view: use **Print layout** for separated manufactured bodies. Assembled and exploded views also include purchased envelopes and, when enabled, the reference tube. For a single printed part, select and export that component in FreeCAD.

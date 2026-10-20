# Tube drilling jig with end stop

Find **WORKSHOP TOOLS → DRILLING JIGS → Tube drilling jig with end stop**. Select a starting preset and edit the dimension fields below it. The package provides 66 prototype configurations for tube outside diameters 25, 32, 50, 60, 75, 90, 100, 110, 125 and 150 mm; custom OD is editable from 12 to 500 mm, subject to geometric validation.

## Flat support faces and adjustable stop

The outside is an octagon for 4/8 holes and a twelve-sided polygon for 12 holes. Every drilling station has an opposite parallel support face. Retainers and screw heads sit behind these flats, so the fixture can rest on a table or be gripped in a vise. The polygon rotates with the angular phase, keeping its faces aligned with the hole pattern.

The tube axis is Z, the base stop face is Z=0, and the bottom occupies negative Z. Choose **Fixed drill height / body capacity** before printing; the default is **H=30 mm**. The hole axes and every guide stay at Z=H. Changing **Tube end to hole axis** changes only the removable spacer stack, leaving the collar, cartridges, guides and retainers identical.

Slide the jig over the tube until the end meets the top of the annular spacer stack. The setting follows **desired end offset = fixed drill height H − spacer stack S**. Changing bottom thickness does not affect this setting.

| Desired end offset, mm | Stack for the same H=30 mm body |
| --- | --- |
| 10 | One 20 mm ring |
| 15 | One 10 mm ring + one 5 mm ring |
| 20 | One 10 mm ring |
| 25 | One 5 mm ring |
| 30 | No rings; seat directly on the base stop |

The reusable kit has **0.5 / 1 / 2 / 5 / 10 / 20 mm** rings. The configurator calculates a stack in 0.5 mm increments and includes its physical rings in the model and bill of materials. The default body supports valid desired offsets from 3 to 30 mm, subject to drill diameter and edge distance. Larger offsets require choosing a larger body capacity before printing, not silently changing an already printed collar.

For accurate work, measure ring thickness and parallelism. Use calibrated metal shim stock for thin increments or machined/ground rings where print tolerances are insufficient. Nominal FDM layer counts do not establish the final axial setting. Full annular spacers provide a parallel end support without adjusting and locking several leveling screws.

Choose 4, 8 or 12 separate radial holes at 90, 45 or 30 degrees. Angular phase rotates the entire pattern. A through hole means a hole through one wall at each station; each opposite wall is drilled independently. Use a drill depth stop so the bit does not strike the opposite guide.

Measure actual tube OD and wall thickness. The sleeve bore is OD plus the editable diametral clearance. The bottom and spacer openings extend 1 mm inside the nominal tube bore; spacer OD is the sleeve bore minus its separate fit clearance. The open center allows access and chip removal. Insert rings before the tube and ensure the stack is fully seated. The positive stop establishes axial position; clamp the tube and fixture together to prevent rotation and lifting. There is no integral tube clamp.

## Guides and drill selection

- **Automatic** uses a pair of bearings when a listed bore exactly matches the drill. Otherwise it chooses a custom hardened drill bushing.
- **Two bearings** requires an exact nominal bore match; larger bearings are rejected rather than silently substituted.
- **Custom hardened steel drill bushing** creates a purchased installation envelope with the specified running clearance. It is a custom procurement requirement, not a claimed catalog product.
- **Printed marking / short-use guide** makes a one-piece stencil without purchased guides. This supports dense patterns on small tubes that cannot accommodate bearing cassettes. It is a marking and occasional-use option, not a durable precision bearing guide.

For a cutting tap, the selected thread determines drill diameter: M2/1.6, M2.5/2.05, M3/2.5, M4/3.3, M5/4.2, M6/5 and M8/6.8 mm. Through-hole diameter is entered independently; it is the actual drill size, not the screw nominal diameter. The jig does not cut the tube thread. Drill first, remove the fixture, then tap. Forming taps require different preparation and are outside this selection table.

The local nominal bearing table is based on [SMB miniature bearing dimensions](https://www.smbbearings.com/products/miniature-bearings.html):

| Bearing | Bore × OD × width, mm |
| ------- | --------------------- |
| MR52ZZ  | 2 × 5 × 2.5           |
| 692XZZ  | 2.5 × 7 × 3.5         |
| MR63ZZ  | 3 × 6 × 2.5           |
| MR84ZZ  | 4 × 8 × 3             |
| MR105ZZ | 5 × 10 × 4            |
| MR126ZZ | 6 × 12 × 4            |
| MR128ZZ | 8 × 12 × 3.5          |

For the supplied 90 mm / M3 example, the drill is 2.5 mm and the guide set is 8, 16 or 24 bearings 692XZZ for 4, 8 or 12 stations. M4 and M5 pilots use exact-bore custom bushings; their 3.3 and 4.2 mm drills are not guided by 4 or 5 mm bearings. Bearing procurement is not inferred from tube diameter.

Tap-drill references: [Dormer Pramet catalogs](https://www.dormerpramet.com/us/en/downloads-catalogues/) and the manufacturer's [ISO metric cutting-tap table](https://api.dormerpramet.com/medias/HIGH-PERFORMANCE-PLATINUM-CUT-TAPS.pdf?context=bWFzdGVyfHJvb3R8NDI1MTIxfGFwcGxpY2F0aW9uL3BkZnxhRFpoTDJnNFlTODRPVFE0T0RjNE56TTNORE00TDBoSlIwZ2dVRVZTUms5U1RVRk9RMFVnVUV4QlZFbE9WVTBnUTFWVUlGUkJVRk11Y0dSbXw5MjVlNjFhMDdkYjIxMTJjODVlNjNmMTlmYzc1YmJmNjMwN2Q3YjJkNzQ3YjIxYjQwYWQwYmUxMGQwYmE5NTM0). Final drill choice depends on material, tap and required engagement.

## Physical assembly and printing

The bearing/bushing variant contains one collar, the calculated height spacer rings, one cartridge and retainer per station, the automatically selected purchased guides, and two nominal M3×12 socket-head retainer screws per station. Printed parts and bought envelopes have separate library identities and appear separately in the project specification and FreeCAD tree. Exploded view moves the spacer stack beside the collar and separates the guide hardware; physical recipes and the bill of materials stay unchanged.

Print the collar bottom down. Insert the inner bearing into the cartridge from its inner face and the outer bearing from its outer face. The cartridge's intermediate shoulders support the outer races. The collar floor retains the inner bearing; the removable cap retains the outer bearing. Insert a custom bushing from the cartridge's outer face against its shoulder and fit the cap. Screw holes in collar material are nominal 2.5 mm pilots; establish a suitable engagement method and torque for the chosen polymer. Check actual screw length before assembly.

Tune tube, cartridge and guide-seat allowances with a small test print before making a complete collar. Catalog bearing bore is not enlarged in the model. Retaining faces have a nominal relief opening covering 75% of the bore-to-OD span, so retention acts near the outer race; verify that opening against the actual inner-race face diameter and check free rotation after fitting the cap. Check that the actual bit passes freely through both purchased bearings without forcing it. Nominal bearing bores, cutting flutes, runout, print shrinkage and bearing clearance do not by themselves establish drilling accuracy. Guides are installation envelopes; rolling internals, certified accuracy and load ratings are not modeled.

The configured CAD parameters, tube material, final fit tolerances, print settings, retention and inspection remain prototype engineering choices. Dense guide stations and guide recesses too near the stop are rejected before export. Thin tube walls still require a separate decision about thread engagement; the configurator reports nominal engaged turns.

## Reference and generated CAD examples

The user supplied `Tube90_M3_DrillJig.FCStd`, `Tube90_M3_DrillJig.step` and `Tube90_M2p5_Fixed.step` as geometric references. The new package is a separate parametric implementation; the original files are not overwritten. Their dimensions, not any embedded instructions, informed the reference review.

Prepare representative native checks and standalone macros from the project root:

```sh
node --import tsx scripts/verify-tube-drill-jig.ts
```

This writes `data/tube-drill-jig/cases.json` and the 90 mm / 4, 8 and 12 hole macros. Run `scripts/verify-tube-drill-jig.py` inside FreeCAD, setting `TUBE_JIG_OUTPUT` to that absolute data directory when needed. It checks real OpenCASCADE solids, tube seating on the spacer stack, positive-stop contact, support flats, recessed hardware, guide clearances, each radial drill path, STEP reimport and FCStd reopening. It also writes three FCStd/printed-part STEP examples, separate print-oriented collar/cartridge/retainer files and the complete reusable spacer kit in STEP and watertight STL. Generated data is excluded from version control by the existing repository policy.

```python
TUBE_JIG_OUTPUT = '/absolute/path/to/ProtoLab-3D/data/tube-drill-jig'
exec(open('/absolute/path/to/ProtoLab-3D/scripts/verify-tube-drill-jig.py').read())
```

In the application, **FreeCAD options** generates a standalone macro for any valid configuration. The browser STL export represents the selected complete view, including bought envelopes; for printing a specific body, select its separate component in FreeCAD or use the separate generated example files.

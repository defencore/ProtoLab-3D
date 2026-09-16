# Ball screw and nut references

The library contains **131 nut configurations across nine families**: 129 have dimensional sources and two are explicitly unverified listing examples. These generate **230 ball screw assembly presets** (219 sourced, 11 examples) and **131 standalone nut presets** (129 sourced, two examples). Assembly and standalone entries share nut dimensions; they are not 361 distinct supplier products.

| Family | Sourced nut configurations | Unverified examples | Reference                                                |
| ------ | -------------------------: | ------------------: | -------------------------------------------------------- |
| SFU    |                         27 |                   0 | Every row in the supplied SFU dimensional table          |
| SFK    |                         10 |                   1 | Wangong miniature nut table and supplied length options  |
| SFS    |                         12 |                   0 | Wangong SFS table and manufacturer shaft reference       |
| SFE    |                         20 |                   1 | DLY SFE nut table, preserving each suffix and length     |
| DFU    |                          2 |                   0 | Wangong double-nut table                                 |
| SFI    |                         12 |                   0 | LIMON circular, six-hole flange drawing                  |
| DFI    |                         10 |                   0 | LIMON double-nut lengths and counterbored flange drawing |
| SFH    |                         30 |                   0 | Complete TBI 23.07 SFH table, printed page C44           |
| SFY    |                          6 |                   0 | Wangong large-lead table; TBI four-hole mounting drawing |

The eleven SFK listing options each offer shaft lengths of 100–550 mm in 50 mm increments. Ten options have manufacturer nut dimensions, producing 100 sourced assembly presets. The remaining option produces ten clearly labeled examples. Nut dimensions and listing length options come from separate references; interchangeability with the photographed seller's product is unverified.

Two listing codes require this distinction:

- **SFK602 / SFK0602:** the listing says SFK602 without a matching dimensioned drawing. The example interprets it as a 6 mm shaft with 2 mm lead and uses provisional nut dimensions.
- **SFE3210:** no matching manufacturer dimension table was found. Its 32 mm shaft and 10 mm lead example has a provisional nut envelope.

Neither example carries catalog verification. The listing alias **SFK0825** is presented alongside the manufacturer's **SFK082.5** designation for the 8 mm shaft / 2.5 mm lead reference.

Published shaft diameters take precedence over designation digits. Some SFS and SFH models use 15, 31, 38 or 48 mm shafts. The decimal circuit-turn values and number of rows are recorded separately; they do not establish the shaft's helix-start count. SFH mounting uses six holes for nominal sizes through 32 and eight for nominal sizes 40/50. SFY uses the four-hole 60° pattern. SFI/DFI use the selected circular flange with counterbores; their optional flange with flats is recorded as an unselected alternative.

Source verification covers the dimensional fields identified on each preset. Accuracy class, machined end journals, shaft starts, motion position and unsourced internal details remain editable prototype settings. The lubrication thread Q is shown as a specification; its nominal diameter does not verify the modeled blind pilot bore. Raceway clearances, loaded-ball spacing, return routing, double-nut spacing and manufacturing fits are representations for layout and prototyping. Load ratings are transcribed reference specifications, not calculated assembly performance.

For a sourced preset, numeric filters match verified dimensions. Combine family, shaft diameter, lead and—for miniature assemblies—shaft length to narrow the results. The two uncertain listing examples remain available under the examples filter.

The inspection cutaway removes the housing in front of a plane 0.001 mm from the shaft axis. The same plane is used in the preview and FreeCAD export to avoid coincident periodic CAD faces. Complete assemblies retain their configured dimensions.

Sources are linked from each preset:

- Supplied SFU drawing (original reference, not bundled)
- [Wangong SFK](https://www.wangong.net/product/ball-screw/mini-type-sfk-series-ball-screw.html), [SFS](https://www.wangong.net/product/ball-screw/high-speed-low-noise-sfs-series-ball-screw.html), [DFU](https://www.wangong.net/product/ball-screw/double-nut-dfu-series-ball-screw.html), [SFY](https://www.wangong.net/product/ball-screw/big-lead-sfy-series-ball-screw.html)
- [DLY SFE](https://www.deliyalinearmotion.com/ball-nut/sfe-nuts.html)
- [LIMON catalog, mounting drawings on PDF page 13](https://image.makewebeasy.net/makeweb/0/WRl0sbTiz/Document/Ball_Screw_catalogue.pdf?v=202012190947#page=13)
- [TBI 23.07, SFH on PDF page 198](https://i0528.tbimotion.com.tw/storage/pdf/TBIMOTION_GeneralProduct_23.07%28CH%29.pdf#page=198), [SFY on PDF page 208](https://i0528.tbimotion.com.tw/storage/pdf/TBIMOTION_GeneralProduct_23.07%28CH%29.pdf#page=208)

The former TBI 22.05 English PDF URL returned 404 during verification; the accessible 23.07 manufacturer catalog is used. Its SFH table ends at nominal size 50, so larger dimensions from other nut families were not assigned to SFH.

The LIMON DFI1605-4 row prints an overall length of 10 mm, which conflicts with its double-nut construction. It is excluded until a consistent source dimension is available.

## Validation

FreeCAD 1.0.2 passed 266 native configurations: all 131 nut presets in complete and cutaway states, three extreme shafts, and a left-handed assembly with machined journals. Every expected component was a valid closed solid; envelopes, sampled ball clearance and STEP round trips passed. The final cutaway audit uses the consistent 0.001 mm inspection offset. The 135 unchanged complete-geometry cases retain their original checks, with Python AST equivalence verified after excluding the added defensive validity guard.

Eight fresh preview/native comparisons cover miniature, maximum-diameter, high-lead and internally recirculating nuts. Their maximum volume difference was 0.221% and maximum envelope difference was 0.0242 mm. These checks verify the prototype representation and export consistency, not manufacturing accuracy or load performance.

## Repeating native validation

Prepare cases with the project's Node runtime, then execute them using Python bundled with an installed FreeCAD runtime. A normal Python installation without FreeCAD's native libraries is insufficient. The verifier opens no GUI document and checks each expected solid, its envelope, sampled ball-to-race clearance and a STEP export/import round trip. Selected assemblies also receive checks for overlaps between every pair of solids.

```sh
node --import tsx scripts/verify-ball-screws.ts --output /tmp/ball-cases.json
/Applications/FreeCAD.app/Contents/Resources/bin/python scripts/verify-ball-screws.py /tmp/ball-cases.json --output /tmp/ball-results.json
```

Use `--state assembled`, `--state cutaway` or `--state shaft` on the generator to limit the cases; `all` is the default. `shaft` includes three extreme shaft configurations and one left-handed assembly with machined journals. For independent workers, generate `--shard 0/3`, `--shard 1/3` and `--shard 2/3` into separate files and give each verifier a separate output path. Pass `--freecad-lib /path/to/FreeCAD/lib` to the verifier when FreeCAD's native module directory differs from the macOS default. Results include the FreeCAD version and a SHA-256 hash of each generated script.

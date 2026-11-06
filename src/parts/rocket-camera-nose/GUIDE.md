# Removable rocket camera nose

## Centered camera and common cage (2026-11-01)

The current **`rocket-camera-nose:structural-90-86`** and **`rocket-camera-nose:ov9281-90-86`** share one continuous PETG case, the same two PETG cage halves and the same rear plate. Swap the purchased camera and its two formed TPU cartridge pieces. Both optical axes are X=Y=0; neither single-camera execution uses protective glass or an optical bayonet. `dual-90-86` remains the separate 106-occurrence, glass-backed dual-camera execution. The earlier single-OV geometry is superseded deliberately, with its library and preset IDs retained.

Revision 014 replaces the captured-key candidate with an open 45-degree guide and opposed broad X bearings, removing the undercut retaining lip. The front/rear supports, axial seat, source electronics and library identities remain. Current 014 source-bound native, software and offline slicing checks pass as recorded below; the completed 013 captured candidate and 012 clean-cover results remain frozen historical evidence. Horizontal base printing with low automatic supports remains the selected preparation, verified against fresh 014 offline toolpaths. Physical support removal, fit and flight/load qualification remain separate.

### Function, contradiction and selected concept

Retain the complete electronics package in a 90/86 mm aluminium tube within 240 mm overall. Assemble and wire the equipment on the bench, close a self-supporting cassette, then insert it camera-first. Pi/UPS contacts remain TPU; PETG carries structural loads. Devices remain replaceable when the cage opens. Preserve purchased board geometry and placements because the delivered PCIe lead has only 13 mm free beyond the adapter edge. The user specifies a 15 kg vehicle, 250 m/s and possible parachute deployment shock. Peak acceleration, impulse, temperatures and material/process allowables remain unknown.

The ideal final result assigns mounting, restraint and alignment to existing structural material. Fewer screws simplify assembly but can reduce positive retention; adding stock improves stiffness while consuming bore, service access and printability. The selected transformation separates rigid location/stops from compliant device contacts and separates bench wiring from case insertion. Two broad PETG halves capture shaped TPU forms without depending on thin snap arms or friction alone. A common rigid camera interface accepts source-specific TPU cartridges, avoiding two separate case families. No numbered TRIZ matrix mapping or strength claim is implied.

The final006 open frame is the geometric baseline but retains many independent fasteners. A separate bolted hood adds another seam; a large printed thread consumes stock and needs locking verification. The selected continuous case removes that seam. Its 240 mm nominal height fits within the manufacturer's [P2S 256 × 256 × 256 mm build volume](https://blog.bambulab.com/the-icon-redefined-meet-the-p2s-a-completely-reengineered-version-of-the-ultra-productive-p1-series/). This is individual-part envelope compatibility, not a slicer result or a claim that the separated preparation layout fits one plate.

### Datums, source identity and physical composition

Z=0 is the tube end and +Z points forward. The rounded case now occupies **98 mm insertion + 142 mm forward housing = 240 mm**; both objective fronts remain at Z142 and TPU shrouds at Z141.5. `noseLength=140` remains the main-profile reference, with the cap's 2 mm tip projection included once in the housing envelope. The original camera rear remains `[0,0,115]`; OV PCB rear remains `[0,0,123.2]`, rotated 180 degrees about Z with the fixed source focus execution retained.

`guided-profile.ts` owns the common meridian. The main ogive and circular end cap are internally tangent; concentric inner curves maintain 3 mm normal wall stock. The 25 mm `ogiveReferenceRadius` is a construction datum preserving the main circle, not a flat crown radius. The aperture remains R12. The exposed root is D90 from Z0..26, matching the aluminium tube without the former D94 collar. The **85.8 mm hidden shoulder in the measured 86 mm bore** uses the user's selected 0.2 mm diametral clearance; its 2.4 mm receiver wall leaves an 81 mm nominal bore. All legacy fits, including dual-camera clearance 0.4 mm, remain unchanged.

The selected transformation uses the former 2 mm objective projection allowance to round the housing while retaining the 240 mm envelope. Defining tangent analytic arcs and their inward normal offsets avoids an arbitrary flat annular cut or a cosmetic mesh fillet. The cap and root changes provide a smooth exterior geometry; no new aerodynamic drag or stability result is claimed. The common cage receives only the clearance changes needed by this profile; library IDs, quantities, source electronics and their placements remain unchanged.

Pi remains `[4.5,-2,46]`, UPS `[2,0,-44]` and adapter `[-9,3,-40]`, each rotated `[0,-90,0]`; SSD is adapter-relative `[-2.5,9.95,4]`. Reused entries are `raspberry-pi:raspberry-pi-5`, `waveshare-ups-3s:ups-module-3s`, `waveshare-pcie-m2-d:pcie-m2-d`, `m2-ssd:2280-reference`, three `li-ion-cell:molicel-p28a`, `gps-tracker:zx908`, `jhe42b-finder:jhe42b`, and either `board-camera-19:imx577-19x19-rear-mipi-m25` or `waveshare-ov9281-110:waveshare-21653`. Source dimensions are not scaled to fit. Generic SSD/tracker packaging, original camera barrel/thread depth and actual cable insertion/bend limits retain their component-guide limitations.

| Execution          | Physical occurrences | Printed bodies | Screws | Nuts | Washers / camera sleeves | Electronics / cells |
| ------------------ | -------------------: | -------------: | -----: | ---: | -----------------------: | ------------------: |
| `structural-90-86` |                   45 |             14 |     10 |    7 |                    2 / 2 |                  10 |
| `ov9281-90-86`     |                   39 |             14 |      8 |    7 |                    0 / 0 |                  10 |

The fourteen print IDs are `outer-shell`, `cassette-cage-base`, `cassette-cage-cover`, `pi-pocket`, `pi-pressure`, `power-carrier`, `adapter-cushion`, `ups-cell-cover`, `camera-pocket`, `camera-front-liner`, `aux-bed`, `aux-clamp`, `aux-pressure-plate` and `rear-retainer`. Five are PETG: case, two cage halves, accessory pressure plate and rear plate; nine contact forms are TPU. Each is a configuration-qualified `manufactured-detail` with its own manufacturing record. The rigid case/cage/rear-plate recipes and placements are identical between the two single-camera executions; only the purchased camera, two TPU camera forms and applicable camera-side hardware change.

### Cassette-to-housing supports (revision 014)

Wide front/rear bearings, a sliding guide and a transverse seat transfer cassette reactions into the existing housing while keeping rear installation and service possible. The 013 captured hexagonal guide assigned radial retention to a reentrant edge, leaving a locally thin retaining-lip risk. The ideal result removes that vulnerable function from the groove without adding hardware. Revision 014 uses an **open 45-degree trapezoidal keyway**, and assigns X reactions to opposed broad housing/cage bearing faces. Four existing tube pins retain the installed cassette; the key guides and limits clocking after running clearance closes.

This is functional reassignment and trimming within the same manufactured parts. A thicker undercut would consume bore and preserve a support-sensitive edge; a separate rail or extra screws would add interfaces. The selected open groove narrows monotonically from its mouth to its roof, without a hooked lip. Source electronics, both camera executions, 240 mm envelope, four anchors, parameter groups and four Model states remain unchanged. `guided-supports.ts` defines the common interfaces; no new family, preset, loose support or purchased product is introduced.

| Interface                      | Implemented geometry / fit                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Rear lateral bearings          | Opposed ±Y faces over X6.5..14.5 and Z-72..-60; cage Y±35.5, housing Y±35.7                                                                 |
| Front lateral bearings         | Same X range over Z54..66; bearing-station centers 126 mm apart                                                                             |
| Negative-X backplate / bearing | Nominal 7.5 mm stock, X-28..-20.5, rear to Z68; case bearing X-28.2 over Y-28..0                                                            |
| Open guide                     | Center Y-16; Z-89..68 (157 mm), including a 2 mm entry lead; key root 12 mm wide, tip 5.6 mm                                                |
| Groove and floor               | Authored groove envelope narrows from 13.0 mm to a 5.8 mm roof-bridge span; continuous 4.3 mm floor; no hexagonal undercut or retaining lip |
| Running fits                   | Approximately 0.212 mm normal to the 45-degree flanks (0.3 mm coordinate gap), 0.2 mm floor/flat gaps                                       |
| Opposed rear X bearing         | Positive-X anchor bosses now end at X30.7, 0.2 mm from cage X30.5; nut R35 and all source hardware stay fixed                               |
| Transverse axial seat          | Z68, Y-30..8; initial complete native contact measurement 106.3626 mm² in each camera setup                                                 |
| Forward positive-X bearing     | Housing X27.2 over Z96..104, 0.2 mm from the existing cage face                                                                             |

Focused native stock review confirms 7.5 mm main plate, 4.3 mm floor and approximately 4.68 mm outboard-mouth stock near the forward end; the open flanks have no retaining undercut. These are named local checks, not one universal wall value. The guide provides orientation and lateral reaction after clearance closes; it is deliberately not a radial latch. The opposed X faces replace the discarded undercut's restraint function. The seat opposes further +Z motion, and the four steel anchors provide serviceable retention after seating. With anchors removed, -Z remains the withdrawal direction. Running gaps are not preload, a calibrated fit or proof of torsional, shock or lifting strength.

The accessory keeper retains the 013 shortened 4 mm bridge ending at X30.5. Its gap to the new X30.7 rear bearing is now nominally 0.2 mm, rather than the former 0.5 mm. Fully wired insertion and the declared transient positions pass the source-bound 014 native paths against the new case. No hardware count or source board pose changes.

From an existing 012 set, reprint **`outer-shell`, `cassette-cage-base` and `aux-pressure-plate`**; from 013, only case and base native programs change. The eleven other print bodies retain their material. `test-results/rocket-camera-supports-review/reprint-delta-012-to-014.json` records the 014-to-013 exact program/pose comparison and its chain to the 013 native material-identity proof, including empty cover differences. Both camera setups still share twelve common prints and require only their own two TPU optical forms.

The earlier approximately 400 g assembled estimate remains obsolete after the added PETG. The 013 solid-volume and trial-extrusion estimates are historical, not a 014 mass measurement. Weigh the actual populated assembly again and update mass balance and inertial calculations; neither more material nor a geometric fit establishes a load rating.

### Camera restraint and thin-feature review

Both camera cartridges bear against the same integrated **4 mm PETG rear shoe at Z108..112**, with substantial connections to both cage halves. The original camera has a broad TPU rear bearing and two actual side M2.5 screws with compression sleeves/washers. OV9281 instead bears on **four solid D3 TPU buttons at the four outer PCB mounting annuli**, with a 3 mm chamber around rear components and authored D1.8 × 0.4 mm locating nubs. Its two auxiliary holes contain factory lens screws and are not extra mount seats. The front TPU liner supports the source-specific barrel; rear connector/latch access remains open. Air load reaches the cage through rear compression contact rather than relying on a front lip alone.

The [official rear photograph](https://www.waveshare.com/media/catalog/product/o/v/ov9281-110-camera-4.jpg) shows the four bare mounting annuli. The library preserves all six published D2.2 PCB bores and the source PCB unchanged. Only its conservative 1 mm rear-population reference is relieved by authored D3.4 contact-zone clearances. Neither D3/D3.4 nor the unknown actual pad outer diameter is claimed as a manufacturer dimension. Four D3 faces around D2.2 bores provide approximately **13.07 mm²** projected PCB contact, not a full-board pad. Measure delivered pad insulation, rear component heights, compression and screw projections before manufacture; no invented exact SMD profiles are used.

The rear disk retains a solid **3 mm core**, with no M4 cage-joint cross-cut through it. The relocated rear joint uses a shorter source M4×20 screw. The broad accessory keeper has a 5 mm stem, 3 mm retained head-bearing web and 3.3 mm stock ahead of its captive nut pocket and 3.05 mm below the nut-entry tunnel; use the sourced **M3×12 button screw** `bolt-screw:gvyntok-040-130-006` and M3 nylon-insert nut `nyloc-nut:gvyntok-a71fbd19aaf2`. Its axis is Y0/Z86.5. This deliberate tenth screw replaces the earlier unverified nine-screw trapped-plate concept. Systematic review must cover all fourteen prints and actual service openings; a nominal stock value away from a hole does not prove the remaining local web or strength.

### Common load paths and insulation

Four shared M4 tube/cassette anchors use existing M4×18 `bolt-screw:gvyntok-040-190-020` on +X and M4×25 `bolt-screw:gvyntok-040-190-022` on -X. Four metal locknuts belong to the case. Steel ends also enter broad cage lands after insertion; they do not apply PCB preload. Preserve opposed angles 0/180 and rows Z-20/-32 with matching tube holes. Two accessible cage joints close on PETG hard stops. The main 4.2 mm TPU divider retains 2.9 mm stock beside the PCIe routing opening and isolates UPS from adapter; corrected UPS sockets/header/BOOT keep service space. TPU contacts and broad supported lands retain electronics without pressing populated packages, GPIO pins or ribbon latches. Tracker/finder stay on the removable cassette under one broad keeper.

The lifting path is aluminium tube → shared anchors/fixed nuts → continuous PETG case. Cassette inertia reaches the case through broad contacts and anchor ends. The separate lower shackle remains the parachute attachment; a PCB, battery contact or TPU pocket is not a recovery anchor. For 15 kg, static weight is 147.10 N. An assumed equal split gives 36.77 N per anchor, nominal projected areas of 8 mm² in the 2 mm tube, 21.6 mm² across the 5.4 mm receiver bearing web and 14 mm² over the 3.5 mm engaged positive-X cage land and 30 mm² across the strengthened 7.5 mm negative-X land. Nominal static averages are 4.60 MPa in aluminium and 1.70 MPa in the shell. These are screens, not allowables or checks of tear-out, layer splitting, nut restraint, bending or creep.

For cassette mass `m_c` kg and acceleration `a_g` in g, equal pin load is `m_c × 9.80665 × a_g / 4`, and the smaller positive-X land gives nominal cage bearing `0.1751 × m_c × a_g MPa` (negative-X full-land average `0.08172 × m_c × a_g MPa`). Thread-root shear and bending require actual root diameter `d_r` and lever `e`: `4F/(πd_r²)` and `32Fe/(πd_r³)`. Fixed M4 nuts are `nyloc-nut:gvyntok-b7f8629b019c`, 5 mm overall/3.2 mm metal body; nylon is not a structural support. The strengthened negative-side guide has nominal 0.2 mm face and 0.2 mm radial screw clearance, so the shorter guide-supported lever cannot be assumed before contact. Actual printed materials, alloy/temper, preload, load sharing and lateral moments remain unresolved.

### Bench sequence, cables and printing

Fit captive hardware and replaceable TPU forms in the open cage. Assemble UPS/cells and adapter/SSD; install Pi and the selected camera. Apply the original camera's two side screws only for that execution, install the SSD retainer and tracker/finder keeper, and connect CSI/PCIe. Keep GPIO/UPS power leads disconnected or held clear while closing the cage against its hard stops. **Connect power on the bench after cage closure**, through the GPIO rear opening and shared 39×7 mm UPS working port. Restrain every lead and inspect positive device capture before inserting the fully connected cassette camera-first. Align the open key before insertion and advance the complete cassette from the open rear until its Z68 seat closes and both anchor rows align. All four tube screws must remain absent until it is fully seated; then fit them through the actual aluminium wall. Reverse for service: remove all four shared screws and withdraw along -Z without dismantling the wired equipment.

PCIe retains the nominal 40 mm lead, with measured 27 mm adapter-side allocation and 13 mm free; keep source mouths and contact orientation. The original camera retains a 100 mm CSI lead. The interchangeable OV route selects a **150 mm Pi-5-compatible 22-to-15-pin lead**: its modeled longest edge plus assumed ends requires approximately 106.13 mm, exceeding 100 mm by 6.13 mm. This uses the user's previously permitted longer lead. The active gross service-coil envelope is 12 × 17 × 14 mm. A wider 12 × 18.5 × 14 mm manufacturing relief occupies X-20.1..-8.1/Y-10..8.5/Z93.8..107.8; it is a cavity allowance, not extra cable volume. Its authored 60 mm parking capacity covers the approximately 43.87 mm longest-edge remainder; actual winding, restraint, insertion uncertainty and cable-specific bend limits need physical fitting. Do not procure a 15-to-15-pin cable for Pi 5. Final edge lengths, slack parking and actual insertion/bend/twist limits must be recorded against the frozen route. The dual execution retains its separate two 100 mm leads and ports.

Ethernet faces +Z on Pi's negative-Y side. Its service envelope uses a side approach followed by the final axial plug movement; the camera transition and both cartridges require complete corridor clearance. GPIO power uses public source pins 4 (+5V) and 6 (GND). `guided-power.ts` defines an authored D4 external wire path and analytic turn channel. A deliberate 10×10 mm rear access opening passes through the back plate at the source pin pair, replacing the old blind-channel floor locally; the opening extends through the strengthened backplate. The adjacent continuous lands and separate 4.3 mm guide-floor region remain deliberate structural paths, not a blind channel floor across the service port. The 8×8×10 mm mating reserve, wire and output plug remain fitting allowances, not identified purchased connectors or electrical ratings.

| Print                 | Preparation pose  | Nominal height / review                                     |
| --------------------- | ----------------- | ----------------------------------------------------------- |
| `outer-shell`         | Tip down          | 240 mm; rounded continuous case                             |
| `cassette-cage-base`  | Broad back on bed | 42 mm high; automatic low supports beneath the leading head |
| `cassette-cage-cover` | Rear up           | 233 mm; broad V/fan roots                                   |
| `aux-pressure-plate`  | Rear up           | 52.5 mm; local bridge target at most 4 mm                   |

Keep other TPU forms and the rear plate on their declared broad preparation faces. The keeper's former 22 mm shelf and cover's 34 mm fore shelf were removed; the merged 39 mm UPS-port roof and other local roofs require slicer/support review. The initial 013 unsupported horizontal base trial flagged a raised head about 67 mm long and 4 mm above the bed. The selected horizontal pose with low automatic supports remains for 014. Its 5.8 mm open-groove roof replaces the former 9 mm undercut roof. The completed 013 two-orientation comparison below is the historical selection basis; fresh 014 slicing now passes 17/17 jobs. Bridge sag, support removal and fit still require a physical trial. The 012 and 013 results remain tied to their frozen sources. Physical printing, support removal and material qualification remain separate. A closed solid or sampled layer screen does not establish a successful print or a support-free result. Actual nozzle, layers, material grade, shrinkage, bridge behavior and support removal remain process decisions.

### Reusing common prints and exchanging cameras

The two single-camera configurations share exactly **12 printed definitions and placements**: `outer-shell`, `cassette-cage-base`, `cassette-cage-cover`, `pi-pocket`, `pi-pressure`, `power-carrier`, `adapter-cushion`, `ups-cell-cover`, `aux-bed`, `aux-clamp`, `aux-pressure-plate` and `rear-retainer`. Only **`camera-pocket` and `camera-front-liner` are camera-specific TPU parts**. Print the common case/cage and other common parts once; choosing or exchanging the camera later does not require reprinting them. Stocking both complete camera cartridge pairs requires **16 unique prints total: 12 common + 2 original + 2 OV**. Exact recipe/placement comparisons and the 36 unchanged shared component definitions are recorded in `test-results/rocket-camera-interchangeable-review/camera-interchangeability-014.json` against the staged 014 source. The three-part 012-to-013 support upgrade above is separate from later camera exchange; after the upgrade, both cameras still reuse the same twelve common prints.

| Camera-dependent item    | Original 19 mm                                  | OV9281-110                                                   |
| ------------------------ | ----------------------------------------------- | ------------------------------------------------------------ |
| Purchased module         | `board-camera-19:imx577-19x19-rear-mipi-m25`              | `waveshare-ov9281-110:waveshare-21653`                       |
| Printed cartridge        | Original rear pocket + front liner              | OV rear pocket + front liner                                 |
| Camera mounting hardware | 2 M2.5 screws, 2 washers, 2 compression sleeves | None of those six loose items                                |
| CSI lead                 | 100 mm compatible with the delivered camera/Pi  | 150 mm Pi 5 compatible 22-to-15-pin FFC and its parking loop |

All shared cage/tube/SSD/accessory fasteners remain the same. Camera exchange is a bench operation with the cage opened, rather than passing a different bare camera into an already closed cartridge:

1. Support the entire nose assembly on the bench, power off, release the four shared tube/case/cage anchors and withdraw the cassette.
2. Disconnect or hold clear the power/auxiliary branches crossing the cover. Remove the auxiliary M3 keeper and both M4 cage joints; lift the cover with its accessory parts supported. Pi, UPS and adapter/SSD remain on the base, with the short PCIe connection preserved.
3. Release the camera CSI cable at the accessible connectors before lifting the complete old camera cartridge from the open base. Disassemble the original camera's side screw/tube/washer stacks on the separate module, not through the closed cage.
4. Seat the replacement camera in its correct rear TPU pocket. Fit the original camera's two side stacks on the bench when applicable; OV uses its four outer mounting annuli on the rear TPU buttons, with rear electronics relieved. Slide the matching front liner over the lens. The two cartridge shapes cannot be mixed between camera types.
5. Install the complete cartridge in the common base and connect the selected CSI lead along its route. For OV, park the 150 mm lead's remainder in the declared coil space; retain the 40 mm PCIe / 13 mm free budget without moving the boards.
6. Close the cage against its rigid stops, refit the two joints and accessory keeper, then connect power through the GPIO/UPS service openings. Bench-check the completed wiring and restraint before aligning the open guide, seating the cassette against Z68 and restoring all four shared anchors. Keep the four anchors absent throughout insertion.

The declared camera, liner and whole-module paths are included in the native assembly checks. Real latch operation, delivered ribbon/branch wiring, optical fit and camera-driver compatibility still need the actual equipment; mechanical interchangeability alone does not establish electrical or software equivalence.

### States and verification status

`assembled` is the canonical physical state. `cutaway`, `extracted` and `print-layout` provide implemented inspection/preparation placements without changing product identity or BOM quantity. Camera execution remains a selector/preset, not a Model state; no old/new toggle is added. Both single-camera presets retain IDs and reconcile to 98 mm insertion/3 mm wall/0.2 mm diametral clearance; dual retains 94 mm/2.4 mm and its independent geometry.

### Open-guide revision 014 verification status

The current `original-014/` and `ov9281-014/` reports under `test-results/rocket-camera-interchangeable-review/` both record **`passed-geometric-review` in FreeCAD 1.1.4**, with stable source guards. These checks use the new open groove and opposed X bearings directly; earlier 013 results are preserved separately rather than carried forward.

| Execution      | Native installation/service paths | Closed single-solid prints / STL / STEP | Zero-island screens | Contacts / isolation / retention groups |
| -------------- | --------------------------------: | --------------------------------------: | ------------------: | --------------------------------------: |
| Original 19 mm |                             50/50 |                              14/14 each |               14/14 |                                 6/15/15 |
| OV9281-110     |                             46/46 |                              14/14 each |               14/14 |                                 6/15/15 |

Both complete wired-cassette insertions pass 501 sampled positions. The revised Z68 seat has 106.3626 mm² actual opposing native contact. The fifteen electronics-isolation pairs and fifteen declared retention groups pass for each setup. These are source-bound geometric/contact and sampled-motion results; they do not establish continuous motion, a general six-degree-of-freedom escape theorem, preload, material strength or flight/shock capacity. No new sub-2 mm finite-area region is found in the targeted 014 stock review; existing named clearance patches remain subject to their earlier documented scope.

The new focused geometry tests pass for a broad continuous floor/flanking stock, two monotonic open groove flanks at multiple depths, positive running fit, opposed X bearings and the common axial seat. Both camera setups retain 12 identical common print definitions, two source-specific TPU forms, 45/39 occurrences, 10/8 screws, four tube anchors and all purchased board poses. Current unit programs/placements match the new stages exactly. The complete source-guarded batch passes **43/43 tests**, strict TypeScript, all five affected packages, eight actual preset/state bounds-and-identity checks and the production build. All 74 before/after source hashes match. Its manifest is `test-results/rocket-camera-supports-review/software/final014-1793540087765/manifest.json`, SHA256 `fe7aaa5a38e7c57183b8b438361754dcfd45c02e840605bca4758000d3b1653d`; companion reports retain stage equality and the twelve-common/two-camera-specific proof.

Actual offline **Bambu Studio 02.08.02.61 / P2S 0.4 slicing passes 17/17 checks** against the fresh 014 inputs: sixteen unique production parts plus the startup coupon. The base retains its horizontal 42 mm-high pose with low automatic supports. Its current prediction is **108.708 g / 13,580.08 s (about 3.77 h)**; the case predicts **269.751 g / 25,755.78 s (about 7.15 h)**. Both use `case-support-process.json`, have empty slicer `warning_message` and matching material/printer identification. Console diagnostics remain recorded separately. The 013 supported-orientation comparison is historical selection evidence; these new numbers are the actual 014 outputs.

Four editable unsliced trial projects cover the case, base, cover and startup coupon; they contain no generated machine program. Geometry and print poses are unchanged by this process selection. Inspect the 5.8 mm groove bridge and remove supports before fitting the hardware. No physical print, support-removal trial, assembled weighing or strength/flight qualification is claimed; all G-code from offline verification remains unapproved and no printer command was sent.

Current process source: `test-results/rocket-camera-interchangeable-review/slicer-audit-014/slicer-review.json`, SHA256 `f6d04f1c60ec08521d40e227125b9a81579f2e2aefd5422586b3ab9b9321cf9b`. STL, profile and trial G-code bindings and console diagnostics are retained.

Final source trace:

- `original-014/review-manifest.json`: SHA256 `7b790381e45484160dc7a5bc1b86b9416cc8a5812d51fcd4c8c81b39774018bf`. Assembled macro `361e8aae6a84252b351cb850c0bf2efc084fc313698b573f0de774e6772e6702`; printing macro `79c37a23e04d51e91f7a9c303839dde524511559dcc9d6710c85b26db6df4048`.
- `ov9281-014/review-manifest.json`: SHA256 `4c4c59fd911757279a299d15100b6eb90e3e0c060843583ae3b9f77500a0dbbb`. Assembled macro `a089a0e60e550b7d739a2b2289a2d0291ec08d8cb3bdf890dc5a7f110d87e7f8`; printing macro `d39d935336f6e6c23ed661fa9358b0e5a8fd1af69cf8eac289ab42ea0214a523`.
- `camera-interchangeability.json` now aliases `camera-interchangeability-014.json`, and `slicer-review.json` aliases `slicer-audit-014/slicer-review.json`. The previous alias contents are preserved in `alias-history/before-014/`; frozen 012/013 evidence is not rewritten. `alias-update-014.json` records the exact copies.

The following captured-key record and its completed checks are historical 013 evidence; 014 removes the undercut rather than qualifying it through the earlier results.

### Historical captured-key concept (revision 013)

This frozen record describes the superseded 013 captured-key candidate. Its reentrant key and 9 mm roof are replaced by the open 014 interface; its completed checks do not qualify the changed geometry.

The useful function is to transfer cassette inertia and lateral moments into the housing through wide structural interfaces at separated stations. The 012 clearance envelope and four retaining pins located the installed cage but did not provide these wide front/rear housing reactions. The ideal result reuses the existing case and cage material, retaining bench assembly and camera exchange. Closing the clearance improves restraint but makes insertion sensitive to print shrinkage; adding support stock improves the load path while consuming bore and complicating printing.

The selected transformation separates the functions in space: broad lateral bearing bands, an integral captured sliding key and a transverse axial seat, with positive pin retention retained. A tight full-length cylindrical press fit would rely on uncertain printed fit and friction. Separate spacer blocks or extra screws would add loose interfaces and obstruct installation. The chosen geometry is integrated into the existing `outer-shell` and `cassette-cage-base`; no purchased part, family, preset, field, Model state or loose support is added. `guided-supports.ts` is the common source for the interfaces in both single-camera executions.

| Interface                         | Implemented geometry / fit                                                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Rear lateral bearings             | Opposed ±Y faces over X6.5..14.5 and Z-72..-60; cage faces Y±35.5, housing faces Y±35.7                                                  |
| Front lateral bearings            | Same X range over Z54..66; bearing-station centers are 126 mm apart                                                                      |
| Strengthened negative-X backplate | Nominal 7.5 mm stock, X-28..-20.5, from the rear to Z68; clipped corners and service openings remain explicit                            |
| Captured guide                    | Integral case key from Z-89..68, 157 mm long, with a 2 mm lofted entry lead; no thin projecting cassette fin                             |
| Keyway floor and running fit      | 4.3 mm floor behind the open groove; 0.2 mm flat/tip clearance and approximately 0.212 mm normal flank clearance (0.3 mm coordinate gap) |
| Transverse axial seat             | Z68, Y-30..8; actual opposing native contact is approximately 102.60 mm²                                                                 |
| Positive-X forward bearing        | Housing face X27.2 over Z96..104, with a nominal 0.2 mm gap to the existing cage face                                                    |

These are running fits, not a press fit or measured preload. Contact begins after the applicable clearance closes. Side-bearing and guide reactions are intended to distribute lateral loads and limit clocking; the seat opposes further +Z motion, while the four steel anchors retain the cassette against withdrawal in use. With all four anchors removed, the captured guide remains open toward -Z for service. Actual shrinkage, surface finish, fit, creep, load sharing and stiffness require the delivered PETG and print process.

A transient insertion conflict also shortens the existing accessory keeper bridge from X31 to X30.5, leaving 4 mm stock and nominal 0.5 mm clearance to the positive housing boss. This alters `aux-pressure-plate`, without another screw or spacer. To upgrade a complete 012 set, reprint **only `outer-shell`, `cassette-cage-base` and `aux-pressure-plate`**. All eleven other print bodies retain their material. The cover's serialized clearance expressions change, but exact native differences in both directions are empty: only cutters in air were extended. `test-results/rocket-camera-supports-review/dfm/material-identity-013.json` records this distinction, unchanged purchased geometry/poses and the same 12-common/2-camera-specific kit.

The added CAD solid volume is approximately 64.98 cm³ of PETG stock; this is not filament or assembled mass. The earlier trial extrusion comparison indicated about 46 g extra; profile/support changes make that a process estimate, not a mass measurement. The earlier approximately 400 g assembled estimate predates these supports and must not be reused: weigh the actual populated cassette and housing, then update mass balance and load calculations. No lifting, shock or flight rating follows from the added material.

### Support revision 013 verification and manufacturing status

The `original-013/` and `ov9281-013/` reports under `test-results/rocket-camera-interchangeable-review/` both pass complete source-bound native geometric review in FreeCAD 1.1.4. This acceptance covers the declared geometry and sampled paths. The base retains its existing broad-back preparation pose; actual supported slicing determines the selected process below.

| Execution      | Native installation/service paths | Valid closed print solids / STL / STEP | Zero-island print screens | Contact / isolation checks |
| -------------- | --------------------------------: | -------------------------------------: | ------------------------: | -------------------------: |
| Original 19 mm |                             50/50 |                             14/14 each |                     14/14 |                       6/15 |
| OV9281-110     |                             46/46 |                             14/14 each |                     14/14 |                       6/15 |

Both complete prewired cassette insertions pass 501 sampled positions, with four tube pins absent until seating. The added sixth planar contact is the Z68 cage-to-case seat, measured at 102.6026 mm² in both complete audits. Existing camera bearing and cage closure stops remain; minimum nominal electronics-to-PETG isolation is 0.3 mm. Separate native location probes find blocking structural material in the intended independent lateral/positive-Z/angular directions with the pins removed, while sampled negative-Z withdrawal remains clear. These coordinate probes do not prove a general six-degree-of-freedom escape theorem, continuous sweep, preload or torsional/impact strength.

The final source-guarded software batch passes **43/43 tests across seven suites**, strict TypeScript, the nose package and four affected source packages, all eight actual preset/state dimension-and-identity checks and the production build. All 74 before/after source hashes match. The new actual-geometry tests cover the continuous groove floor/flanks, matching side-bearing faces and running gaps, opposing seat area, unchanged board poses/hardware and canonical identities. Live native unit programs/poses exactly match the two staged macros (45/45 and 39/39). The common-parts proof remains 12 identical shared prints plus two camera-specific TPU forms; source IDs, board placements and the 240 mm envelope remain unchanged.

**Selected base process: horizontal with automatic supports.** DFM compared the actual 013 native-derived base in Bambu Studio using supported horizontal and supported rear-down orientations. Both return `Success.` and empty `warning_message`; no geometry or preparation-pose change is required.

| Supported base trial                   | Predicted total filament |           Predicted total time |
| -------------------------------------- | -----------------------: | -----------------------------: |
| Horizontal, broad back down — selected |                108.143 g | 13,406.94 s (about 3 h 43 min) |
| Rear down — comparison only            |                164.215 g | 22,506.14 s (about 6 h 15 min) |

The selected horizontal process uses low supports beneath the leading head approximately 4 mm above the bed. The original 42 mm preparation height, case tip-down 240 mm, cover rear-up 233 mm and other print poses remain. The 9 mm groove-roof bridge still needs physical inspection for sag and fit. The exact result files are `test-results/rocket-camera-supports-review/dfm/slicer-comparison/x-minus-down/result.json` and `rear-down/result.json`; the refreshed complete audit at `test-results/rocket-camera-interchangeable-review/slicer-audit-013/slicer-review.json` passes **17/17 checks**: sixteen unique production prints and the 10 mm startup coupon. Its base record uses `case-support-process.json`, with matching PETG/printer identification and empty slicer `warning_message`. All records retain their console diagnostics; empty slicer warnings do not erase those diagnostics. All fourteen native print solids/STLs/STEP round trips and zero-island screens remain passed, but these checks do not establish support-removal success.

Remove supports before assembly and inspect the leading head, guide floor, bearing faces and bridge. **No physical print, support-removal or fit trial has been performed.** Predicted filament/time are slicer outputs, not weighed material or measured machine time. Trial G-codes remain unapproved; no printer command was sent. The 012 offline slicer pass below does not verify the changed base/case, and the existing 15 kg/250 m/s/unknown-deployment-g qualification limits remain.

Source trace:

- `original-013/review-manifest.json`: SHA256 `16c6f61024cad68985eec78292a5746a908c9d011a6f8e646f719424913840f2`. Assembled macro `0e11c6f4aa2ca152e6c562f02401063f3a92f5ac9db88715c78fc0aab5b57fda`; printing macro `438a39b5b86d94c7d8fda9f0d41faf730fd4cc27dc5ab7949a959a393383af39`.
- `ov9281-013/review-manifest.json`: SHA256 `da9b3d48f45620c63629daeb3634e1037d77f0b13eb5cb1000671ff866838350`. Assembled macro `cace1a0fccb7a6273aedc9bb344fd8fabce68c929201e7a3cf1db35429de1de2`; printing macro `9372d995a73022c4fadb3227a4704625082fc59a8a31d26cba05ef9484719f9f`.
- `test-results/rocket-camera-supports-review/software/final013-1793538499243/manifest.json`: SHA256 `738c8ce370959a30070bafac9e67d8408a57d15df638947d634c4a2ba6544e0a`; 74 unchanged source hashes. Its companion files record actual state bounds, stage equality and the common-parts proof.
- `slicer-audit-013/slicer-review.json`: SHA256 `6232e8e7e20f85a332904f41dc5265bf8b20df8d35d97e0b45f994837e6c2ba1`; 17/17 actual offline Bambu Studio 02.08.02.61 / P2S 0.4 checks, with source STL/profile/G-code bindings. The selected supported horizontal base preserves source 013 and its preparation pose.
- `test-results/rocket-camera-supports-review/dfm/material-identity-013.json` proves the three-part reprint delta; `location-probes-013.json` and `keeper-transient-gap.json` record the independent location/clearance checks. These checks retain their stated scope and do not qualify the 15 kg/250 m/s/unknown-deployment-g operating case.

The following completed 012 entry is frozen historical evidence from before the added supports. Its source hashes, counts and slicer results are retained, without being applied to 013.

### Completed clean-cover verification (final012)

The current **original-012 and ov9281-012** reports both pass full source-bound geometric review. The cover keeps the same library/occurrence identity, hardware, external envelope and rear-up 233 mm preparation pose. The two camera options still share 12 print definitions; only their two TPU cartridge parts differ.

The auxiliary support is now one continuous shelf rooted in the existing UPS spine through a 45-degree fan. The shelf measures 5.7 mm along X at three positions across its span; the fan has 4 mm X stock and approximately 2.828 mm normal stock. Straight-sided panels make a coherent opening. Only nonfunctional R6 round-pad intrusions over the empty Pi-pressure window are trimmed; source pressure lands, board clearance and all other 011 thin-feature repairs remain. The verified visual candidate, actual-material rays and independent DFM review support this consolidation, without asserting a new material-strength or aerodynamic rating.

| Execution      | Native installation/service paths | Valid closed print solids / STL / STEP | Zero-island print screens | Contact / isolation / retention groups |
| -------------- | --------------------------------: | -------------------------------------: | ------------------------: | -------------------------------------: |
| Original 19 mm |                             50/50 |                             14/14 each |                     14/14 |                                5/15/15 |
| OV9281-110     |                             46/46 |                             14/14 each |                     14/14 |                                5/15/15 |

Each whole-cassette insertion passes 501 sampled positions. Rear camera bearing, hard-stop contacts and the 0.3 mm minimum nominal electronics-to-PETG separation remain verified. The source-bound paths are discrete native checks, not continuous-sweep or load tests. The current cover is one valid closed native solid with 219 faces; its geometry remains analytic rather than a conversion of preview triangles.

The final software batch passes **38/38 tests**, including the new clear-window, continuous-shelf and fan-normal-stock probes, plus all previous weak-skin/board/cable checks. Strict TypeScript, all 9 nose presets and the purchased OV package, all 8 preset/state dimension-and-identity checks and the production build pass. No bound source changes during that run. Current native unit programs/poses match the fresh 012 stages exactly (45/45 and 39/39). `camera-interchangeability.json` now aliases `camera-interchangeability-012.json`: 12 common prints, 2 camera-specific TPU alternatives per option, 16 unique prints for both options and unchanged shared hardware. The dual execution retains 106 placements and 105 original native programs; only the earlier approved purchased-OV rear-reference refinement differs.

Actual offline Bambu Studio/P2S slicing passes **17/17 jobs** for source 012: 16 production uniques plus the 10 mm startup coupon. The recorded P2S 0.4, PETG/TPU and 0.2 mm/six-wall trial profiles remain explicit. Case/cover use autosupport trial profiles; the 39 mm UPS working-port roof is retained. Console diagnostics remain in the report; these are unapproved trial G-codes, no printer command was sent, and successful generation does not prove physical printing, support removal, fit or strength. The earlier 011 material/thermal/harness/load qualification limits and aerodynamic scope still apply.

Source trace:

- `original-012/review-manifest.json`: SHA256 `5efe8dd48bec677953d36e6310d0b3860836dd3081e5fe14470694c4ddbaed92`. Assembled macro `fc307fb01925affae470c77ed053242c34a7d84560823e26b874c928ce2c8e3e`; printing macro `356c95e8a895cc3e0fd5051f5b89d7cfd8816f7acaa2139c933043bac834ef18`.
- `ov9281-012/review-manifest.json`: SHA256 `3420284d70efcff719738b14b3b25111d78d90e61056a30a7588e2321b9a8151`. Assembled macro `2e22c5a8600b213b7838b718ff566382563bc47fd403a41c462bd9812b5daa01`; printing macro `f00c02e99d618a2d5af7e5548878abe234bf28f9a566225631a13c4368eef139`.
- `software-final-1793508245588/manifest.json`: SHA256 `4b1c1d9b1a5796843b9b2c95281fe01ecff4c9d8db089c138bd1ab83b84cbcbd`; before/after source maps match.
- Current `slicer-review.json`: SHA256 `02fd12461c6dccb90d6b2521f7d70144bafe79e47a35339e22fa36b76520c163`; source copy remains at `slicer-audit-012/slicer-review.json`. `camera-interchangeability-012.json` and its current alias retain the component/recipe comparison.

### Completed thin-feature verification (final011)

This is the frozen 011 baseline before the clean-cover revision; it is not acceptance of the changed 012 source.

The final `original-011/` and `ov9281-011/` source-bound reports under `test-results/rocket-camera-interchangeable-review/` both record **`passed-geometric-review` in FreeCAD 1.1.4**. All source guards are unchanged. These are the current reinforced configurations; 005 is preserved below as the earlier rounded baseline. Intermediate 006–010 staging attempts are not a final native acceptance.

The localized-stock audit found features that closed-solid and retention checks alone did not qualify. The following actual corrections retain the purchased geometry, board poses, hardware, IDs and 14 prints per camera:

| Printed unit          | Corrected functional stock / load path                                                                                                                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adapter-cushion`     | The 0.5 mm rail connection becomes a continuous 3.8 mm-wide bridge at Y23.0..26.8; the positive locating rail and its source-hole locator remain. Three real-material regression rays check this connection.                                                                           |
| `pi-pocket`           | GPIO-side return extends to Y34 with a 3.3 mm bypass; lower/upper bars span Z3..10 and 65..75. Residual 0.3/0.71/0.75 mm skins are removed or reinforced; an intentional connector opening replaces a central film. Four broad source-qualified pads/outer rails remain the load path. |
| `power-carrier`       | Open the detached PCIe backing film and remove the 0.05 mm feather. The nominal 4.2 mm main divider remains, with 2.9 mm continuous UPS-side stock beside the routed opening. The cutter retains native analytic curves; its retraced zero-area tail is omitted.                       |
| `cassette-cage-cover` | Rear disk-retaining sectors have 3 mm axial stock. Unsupported rear/nut lips are removed; the lower auxiliary PETG stop grows from 1.5 to 3.5 mm. One 39×7 mm UPS working port replaces four openings with fragile 1 mm separators.                                                    |
| `aux-bed`             | Buzzer floor grows from 1.5 to 3 mm. GPS retains its actual bare-PCB edge contact, while the free tongue is replaced by a tapered 3.5 mm root and 45-degree continuation; no module is moved.                                                                                          |

The Pi support still has named 1.630 mm cable-adjacent and 1.714 mm MIPI-pocket patches; these are supported clearance regions, not mounting necks. This is a feature-specific stock review, not a claim that every local dimension exceeds 3 mm or that an unmeasured filament is shock-qualified. Actual probes now protect the 3.8 mm adapter bridge, 3.3 mm GPIO bypass, 2.9 mm routed divider, 3 mm buzzer floor and full rear-retaining sector from regression.

| Execution      | Installation/service paths | Printed solids / STL / STEP | Planar contacts | PETG-isolation pairs | Retention groups |
| -------------- | -------------------------: | --------------------------: | --------------: | -------------------: | ---------------: |
| Original 19 mm |                      50/50 |                  14/14 each |             5/5 |                15/15 |            15/15 |
| OV9281-110     |                      46/46 |                  14/14 each |             5/5 |                15/15 |            15/15 |

Both complete cassette insertions pass 501 sampled positions, within full motion sets of 10,678 original and 9,874 OV placements. Minimum measured electronics-to-PETG clearance is 0.3 mm. Source-to-TPU camera rear bearing remains 282.795 mm² for the original and 13.069 mm² at OV's four mounting annuli; TPU-to-PETG shoe contacts remain 308.891/288.574 mm². Cage hard stops measure 97.892/84.542 mm². These are sampled geometric/contact checks, not continuous sweeps or preload, force, fatigue or shock proofs.

All 14 print bodies are valid, closed single native solids, all 14 STLs are closed, all 14 STEP round trips pass, and dense 0.2 mm sections show **zero new print islands** in each configuration. The case retains 71 native faces with genuine cylinders and four surfaces of revolution; the routed cutter uses analytic native curves rather than faceted CAD walls. Largest STEP relative-volume difference is 8.265×10⁻⁶ within the recorded policy. The no-bridge-credit screen still flags 10 original/9 OV units; source-specific bridge/support findings remain for slicer review.

Actual offline slicing also passes **17/17 checks in Bambu Studio 02.08.02.61** for **Bambu Lab P2S 0.4**, using vendor-derived PETG/TPU trial profiles, 0.2 mm layers, six wall loops and a Textured PEI assumption. These cover **16 unique production prints: 12 common + 4 camera alternatives**, plus one 10 mm startup coupon. Case and PETG cover use autosupport trial profiles; the **39 mm UPS-port roof span is retained**, not declared support-free. Console diagnostics are retained. These are successful offline toolpath-generation trials: no printer command was sent, the trial G-codes are not approved machine programs, and no physical print, support-removal, fit or strength test is implied.

The final software batch passes 38/38 affected tests, strict TypeScript, all 9 nose presets, the purchased OV package, both presets in all four dimension/identity states and the production build. Current unit programs/poses match the two fresh staged macros exactly (45/45 and 39/39). The 25 core/gear/custom-composition tests pass, with exact tested SDK hashes retained. The current common-parts report confirms **12 identical shared print definitions/placements and only 2 camera-specific TPU alternatives**; all 36 other shared components match. Changing between the two cameras does not require reprinting the final common case/cage or relocating boards.

Source trace:

- `original-011/review-manifest.json`: SHA256 `1c7a7c8ab68cfc0fe02d651bc84a920056b979ab643e59583db3d3859dddc910`. Assembled macro `89cff8d403474ed786a7a4064de51bfcbe644d6e302f846271f8c7eb888cd9ba`; printing macro `994db009cf19c7c74b62051c358c52f046e91683dde2a99ce764cef5bec20b35`.
- `ov9281-011/review-manifest.json`: SHA256 `048677eda51a2be393c372b1b92faf3fd805a5f97e9d8509a094e2dd08e16e10`. Assembled macro `74547afd7092c5c864c892efea81d6a096dfac5284c37e5ffdefca49d07e725f`; printing macro `c41904bda536bb24e007727bd60270aba272001a8641400886716c77ebc96863`.
- Software/source guard: `software-final-1793506383195/manifest.json`, SHA256 `a147b1ad2f1d129e664d54f8c411685ffad81a98dbae2517776ce6b4655be2bd`; no bound source changed during the run.
- `slicer-review.json`: SHA256 `4d71d61da6fc31701d2d148233ea77866ae820fb558c07af161f48bd97cbddc4`; printer/material/profile/STL/G-code bindings and diagnostics are retained. `camera-interchangeability-011.json` records the 12-common/2-alternative proof; `core-curve-loft-test-report.json` records the 25 SDK tests.

### Completed rounded verification (final005)

This is the frozen rounded 005 baseline before the adapter-cushion reinforcement. Use the completed final011 results above for the current reinforced source.

The final `original-005/` and `ov9281-005/` source-bound reports under `test-results/rocket-camera-interchangeable-review/` both record **`passed-geometric-review` in FreeCAD 1.1.4**. These verify the frozen005 rounded cap, flush D90 root and 85.8 mm shoulder. Source guards are unchanged; counts remain 45/39 occurrences and 14 prints, with no new library families, presets, states or fields.

| Execution      | Installation/service paths | Printed solids / STL / STEP | Planar contacts | PETG-isolation pairs | Retention groups |
| -------------- | -------------------------: | --------------------------: | --------------: | -------------------: | ---------------: |
| Original 19 mm |                      50/50 |                  14/14 each |             5/5 |                15/15 |            15/15 |
| OV9281-110     |                      46/46 |                  14/14 each |             5/5 |                15/15 |            15/15 |

Each complete cassette insertion passes 501 sampled positions; the full motion sets check 10,678 original and 9,874 OV placements. Source-to-TPU rear bearing is 282.795 mm² for the original and 13.069 mm² over OV's four actual mounting annuli. The common rear shoe contacts remain 308.891/288.574 mm² across base/cover. Minimum measured electronics-to-PETG clearance is 0.3 mm. All 15 six-direction retention groups pass. These are declared geometric contact, isolation and sampled path checks, not continuous-sweep, preload, pull-out-force or shock proofs.

All 14 print bodies in each setup are valid, closed single native solids; exported STLs are closed and STEP round trips pass. The rounded case has 71 native faces, including 11 cylindrical faces and 4 surfaces of revolution; native arcs are retained independently of preview/STL tessellation. Largest STEP relative-volume difference is 8.265×10⁻⁶ and bounds difference is below 10⁻⁶ mm within the recorded policy. Dense 0.2 mm layer screens show **zero new print islands on every part**.

The no-bridge-credit screen still flags 10 original/9 OV parts for slicer review. Maximum sampled lateral reaches include 1.449 mm on the rounded case, 15.352 mm on the cage cover, 7.002 mm on the cell cover and 6.416 mm on the keeper. Review actual bridge/support strategy and removal access; zero islands is not zero supports, a toolpath result or a successful print trial. Material, temperature, cooling, fit, preload and harness qualification remain separate.

The source-guarded software batch passes 38/38 tests, strict TypeScript, all 9 nose presets, the purchased OV package and the production build. New geometry probes verify the flush D90 root, 85.8 mm shoulder, varying cap height rather than a flat annulus and 3 mm wall along representative cap normals. Both presets pass all four state dimension/identity checks: assembled 98×90×240 mm; extracted 158×90×490 mm; all 14 print nodes grounded, individually inside the nominal 256 mm P2S envelope, with the case 240 mm high. Current exported programs/poses match both fresh staged macros exactly (45/45 and 39/39). The unchanged 16 focused SDK tests retain their tested source hashes. The dual execution retains all 106 placements and 105 unchanged programs; only the previously approved source-OV rear-reference refinement differs.

Source trace:

- `original-005/review-manifest.json`: SHA256 `8d80f8c655071b1f0b908b170d269a19fe3cc9a910f7f0ac848e94e7fcd50971`. Assembled macro `f119af19a52284a2370ffd6772beb79912caf794101bb3e800a7b559204146a6`; printing macro `29666497b7d847df5205922c83374729e3fdef6be0fba0aa4f8b404190d1af52`.
- `ov9281-005/review-manifest.json`: SHA256 `617e9cd5a71c8644ebc725c49b4ab156335c2232f43c916530f867bb3e9a2b4f`. Assembled macro `fe10e8e6eecdccb63e58a7d82e8710fc721b61d9a1e7304458191a1ed6fe951e`; printing macro `63563f81bad40c779c7df55975b94be71c4685a3eb1ceabaabbbb1aaaa56dd1d`.
- Software/source guard: `software-final-1793502604933/manifest.json`, SHA256 `365f03a65145241603d850fc0c51c95dfeae5745ad329e2a06b84150ca6248d5`; its before/after maps contain no changed source files.

After the 005 run, only the OV catalog description was corrected from 100 mm to 150 mm and from pending checks to the completed prototype checks. `catalog-prose-amendment/source-amendment.json` records the exact JSON diff and the sole permitted presets hash change: `84cdbd4062fac206934839025a1d685cead4f73ae870ae9a82d8dc502c30417f` → `799ff18ce219e822199cb62ee43b4df4c142811a64372a424f09f02ea3ed0ead`. IDs, numeric parameters, all other bound source files, serialized components and native unit programs/poses remain identical for both variants in assembled and print-layout states. The original 005 reports and source bindings were not rewritten.

### Aerodynamic scope

The smooth rounded profile is a **plausible subsonic candidate**, an engineering inference from its continuous geometry and [NASA's general nose-shape guidance](https://www.nasa.gov/wp-content/uploads/2016/02/sl_video_instruction_book.pdf), not an aerodynamic optimum established for this camera opening. Using [NASA's ideal-air relation](https://www.grc.nasa.gov/www/k-12/airplane/isentrop.html), `M = V/√(γRT)` with γ 1.4 and R 287.05 J/(kg·K), 250 m/s is approximately **Mach 0.735 at 15°C** or **Mach 0.817 at −40°C**. These are conditional temperature cases, not a supplied launch atmosphere.

The actual 24 mm aperture has nominal 0.5 mm radial clearance around the 23 mm TPU sleeve and is **not verified airtight**. It must not be treated as a sealed aerodynamic window. No CFD, measured Cd, angle-of-attack pressure/drag analysis, leakage/roughness sensitivity or whole-vehicle CG/CP stability check has been performed. The calculations, source links and explicit limits are recorded in `test-results/rocket-camera-interchangeable-review/aerodynamic-review.json`; 15 kg lifting, 250 m/s flight and deployment-shock qualification remain unresolved.

### Frozen baseline verification (final004)

The following completed checks apply to the former 238 mm case with its flat-cut crown, D94 collar and 85.6 mm shoulder. They do not verify the rounded revision above. The baseline source and prototype kits remain historical evidence.

The final `original-004/` and `ov9281-004/` reports under `test-results/rocket-camera-interchangeable-review/` both record **`passed-geometric-review` in FreeCAD 1.1.4**, with unchanged source guards. These results apply to the frozen 45-occurrence original and 39-occurrence OV baseline, not to the rounded revision or other candidates.

| Execution      | Completed installation/service paths | Printed units | Planar contact checks | PETG-isolation pairs | Retention groups |
| -------------- | -----------------------------------: | ------------: | --------------------: | -------------------: | ---------------: |
| Original 19 mm |                                50/50 |         14/14 |                   5/5 |                15/15 |            15/15 |
| OV9281-110     |                                46/46 |         14/14 |                   5/5 |                15/15 |            15/15 |

Both complete cassette insertions pass 501 sampled positions. The complete motion matrices evaluate 10,678 original and 9,874 OV placements, including cage closure, camera cartridges, fasteners/nuts/tools, Ethernet and the connected cable allowances. These are exact native interference checks at the declared intermediate positions, not a mathematically continuous sweep. The minimum measured electronics-to-PETG clearance is 0.3 mm; this nominal geometric gap is not a manufacturing or vibration tolerance. All 15 retention groups pass the declared six-direction geometry probes, which do not measure pull-out force or shock capacity.

Original source-to-TPU rear bearing is 282.795 mm². OV contact is 13.069 mm² at the four actual PCB mounting annuli, with rear components relieved. The rear TPU pedestal bears on the common PETG base/cover over 308.891/288.574 mm² at Z112; both cage hard stops also have positive measured face contact. These contact areas establish the intended geometric load path, not allowable pressure, preload or deformation.

Every print is a valid closed single native solid; all 14 STL exports are closed and all 14 STEP round trips pass in each configuration. Sampled 0.2 mm layers show **zero newly born print islands** for every part. The largest STEP relative volume difference is 7.951×10⁻⁶ and bounds difference is below 10⁻⁶ mm within the recorded comparison policy. The case retains 73 native faces, including cylinders, cones and surfaces of revolution, rather than native facets copied from preview triangles.

Zero islands does not mean zero supports. The conservative no-bridge-credit screen still flags 10 original and 9 OV prints for slicer review. Largest sampled lateral reaches include 15.352 mm on the cover, 7.002 mm on the cell cover and 6.416 mm on the accessory keeper. The earlier 4 mm keeper local-bridge target does not describe every remaining screened overhang. Resolve the actual bridges/supports, support access, print orientation and material settings in the chosen slicer, then print and fit the prototype; no actual support volume, toolpath or support-removal strength test is reported.

The final software batch passes 38/38 affected tests, strict TypeScript, all 9 nose presets and the purchased OV package, plus the full production build. Both presets pass all four preview states against reported dimensions and retain canonical identities/BOM quantities; all 14 preparation nodes are grounded and individually fit the nominal 256 mm P2S envelope. Then-current native unit programs/placements exactly match the final004 staged macros (45/45 and 39/39). The 16 earlier focused smooth-loft/Manifold tests retain identical tested core/test hashes. The dual execution retains all 106 placements and 105 unchanged native programs; only the approved purchased OV rear-reference refinement differs, with its PCB, six bores and identity unchanged.

Source trace:

- `original-004/review-manifest.json`: SHA256 `9e080c6105ecf70ef3f990be8b51bf41ca40b633b08b431828eebdc1a7c9e568`. Assembled macro `77e12e6a238273c1e229c778d3066c14fb36cda952feb2b0ae70a0a1c2477bf6`; printing macro `7335edc3c4217b52ae8e7a8d39f5345c4a52518f4aae2f000f0c0f969b0143d0`.
- `ov9281-004/review-manifest.json`: SHA256 `d7bcc510ba17f80244f69a37870a75ca09a642831550163d851eb82e6f7e2e77`. Assembled macro `70a6ee398b5cc65cd59b298fd772a1670cf581f276b00553555972d6f741483a`; printing macro `cdd81a765a1c83b1d66c1c03288a0636c309c957235e139b3aa850e19e7cda92`.
- Software/source guard: `software-final-1793500584047/manifest.json`, SHA256 `6e6736661415e4b7746c51fceec1f63d5b0d04c7bf004b864f2b332ce1904b83`; its before/after source maps have no changed files.

Actual fit, complete wiring, cooling, material/process capability, fastener locking/preload and lifting/flight/shock/vibration strength require physical qualification. Unknown peak acceleration and print allowables prevent a shock rating. Method references are the [TRIZ Body of Knowledge](https://www.aitriz.org/triz/triz-body-of-knowledge), [MATRIZ terminology](https://wiki.matriz.org/docs/triz/glossary-6146/) and [Prusa modeling guidance](https://help.prusa3d.com/article/modeling-with-3d-printing-in-mind_164135).

## Historical final006 guided cassette (2026-10-31)

This section records the superseded final006 **`rocket-camera-nose:structural-90-86` original-camera execution**. Its source-bound results apply to that frozen 97-occurrence source, before the centered common-cage redesign. At that historical revision both OV9281-only and dual-camera executions had separate glass/window arrangements; the later interchangeable single-OV revision intentionally supersedes the former. Verification of the new source is recorded separately from the previous 83-occurrence/15-print reports. The assembly declares 97 physical occurrences: 17 printed parts, two machined camera compression sleeves and 78 purchased/standard units. Exports are prototype geometry, not a qualified manufacturing release.

### Function, acceptance criteria and concept

Mount the UPS and cells, Pi 5, adapter and SSD, original camera, tracker and buzzer on one open cassette. Connect and restrain their leads on the bench, then install the complete cassette camera-first along its guides. A board or its fragile ribbon must not act as a handle or be forced past an internal housing bridge. The measured tube remains 90/86 mm. The nominal axial allocation becomes **98 mm insertion + 140 mm nose + 2 mm exposed objective = 240 mm**. The extra 4 mm insertion contains the rear retainer inside the previous overall envelope after removing the unused 6 mm glass crown.

The baseline had separate sliding electronics trays, a Pi/NVMe stack that did not accommodate the delivered PCIe lead, hidden nut/tool conflicts, support-sensitive thin details and an unused window mechanism. The ideal result is for the cassette's existing strong members to provide mounting, cable management and guidance while the case provides the aerodynamic surface and tube attachment. More structural material improves rigidity but consumes the available bore and makes access harder; tighter restraint improves retention but makes staged internal wiring unsafe. Separate the functions in space—PETG structural paths and thick replaceable TPU contacts—and in time—bench assembly before enclosure insertion. Trim the unused optical mechanism and transfer the accessory mount to the removable cassette.

Patching the old independent trays retains blind wiring; a closed thick cage consumes bore and support access; two bolted flat side plates remain an alternative if a one-piece frame cannot be manufactured cleanly. The selected open ladder/backbone provides bench access with fewer internal obstructions. This is a proportionate TRIZ functional-separation decision, not a claim of novelty or a numbered contradiction-matrix result.

### Shared datums and purchased interfaces

Millimetres; +Z points toward the objective and Z=0 is the tube end. Source boards retain their local coordinates and fixed dimensions.

| Item or feature         | Design datum / intended interface                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pi 5                    | Origin `[4.5,-2,46]`, rotation `[0,-90,0]`; populated face points -X and Ethernet faces +Z at the negative-Y side                                         |
| UPS 3S                  | Origin `[2,0,-44]`, rotation `[0,-90,0]`; cells and corrected sockets face +X                                                                             |
| PCIe TO M.2 Board (D)   | Origin `[-9,3,-40]`, rotation `[0,-90,0]`; flat board rear faces the UPS, SSD faces farther -X                                                            |
| SSD 2280                | Adapter-relative translation `[-2.5,9.95,4]`, no relative rotation; source SSD fixing reference retained                                                  |
| Camera                  | Optical-axis/body-rear datum `[0,2.5,L-25]`; objective front `Z=L+2`                                                                                      |
| TPU lens sleeve         | Ends at `Z=L+1.5`, nominally 0.5 mm behind the objective front; the sleeve guides/protects the barrel rather than carrying the camera by its focus thread |
| UPS/adapter TPU divider | X=-9..-4.8, 4.2 mm thick; 0.2 mm nominal clearance to the current UPS component extremum X=-4.6                                                           |
| PETG open backbone      | Broad 6 mm stock at X=-16.5..-10.5, with side beams, populated-component windows and guide fins                                                           |
| Receiver                | OD85.6 / ID80.8; guide running space and retention belong inside the actual ID80.8 bore                                                                   |

Reuse `raspberry-pi:raspberry-pi-5`, `waveshare-ups-3s:ups-module-3s`, `waveshare-pcie-m2-d:pcie-m2-d`, `m2-ssd:2280-reference`, `board-camera-19:imx577-19x19-rear-mipi-m25`, three `li-ion-cell:molicel-p28a`, `gps-tracker:zx908` and `jhe42b-finder:jhe42b`, plus explicitly selected standard hardware. Preserve each applicable preset ID in composition and exports. Source evidence remains in those packages' guides; the source Pi PCB and all fixed purchased dimensions are not resized to obtain a fit.

Use the public `pi5Interface` for the actual PCB/package bounds and mounting references, and `adapterInterface` for the card, connector and routing opening. The UPS's four sockets, auxiliary header and BOOT button are on its **battery-holder face**, as corrected in the 2026-10-31 library revision. Its pockets require corresponding reliefs and additional space for real mating plugs; the old opposite-face holes are not valid references.

### Restraint, access and load paths

The open PETG ladder carries the installed modules into the receiver through broad guide reactions, a defined end stop and positive rear retention. The hood and tube connection must carry vehicle lifting/aerodynamic loads independently of PCB holes, battery contacts and soft pockets. Two R40.8 guide fins enter R41.2 recesses cut into the receiver wall. The fixed case has no inward C lips or forward stop that the larger upper cargo would have to pass. A separate rear plate bolts to two integral frame bosses at X=-11.5/Y=+/-32 using M3 x 12 screws; four flush M3 x 10 radial locks join that plate to the receiver. Thus guidance and positive axial retention have separate functions.

The Pi uses **four separate wide TPU shoes**, with 3.194 mm front mounting-seat depth normal to X, instead of fragile connecting rails. Reserve the source GPIO, middle USB and other populated envelopes. All board screws and nut-loading/tool paths are accessible before the cassette is enclosed. The UPS retains its fitted TPU support concept with four short M3 stacks and reliefs matching the corrected connectors. Its component side is separated from the adapter by the continuous TPU divider, with a deliberate channel for the backside PCIe route.

Two M3 x 20 combined clamps at Y/Z=0/-89 and -12/7 retain the adapter/carrier arrangement and capture the PETG backbone between the rear PETG retainer and front TPU carrier; four additional adapter nuts must not be placed across the short ribbon or source components. The adapter's bare rear bears through TPU, while a 5.9 mm deep TPU perimeter cushion and 5.4 mm PETG rear retainer supply positive capture. The retainer bearing face at X=-16.5 and carrier rear tabs at X=-9 bracket the backbone; the screws pass through intact crossbars rather than oversized floating pockets. Two short D2.3 locating stubs project 0.9 mm from the cushion into diagonal source D2.7 adapter holes. They locate the board in its plane while broad faces carry preload. The back of the cushion remains flat for printing. Do not rely on uncontrolled TPU compression to establish board spacing or a vibration rating.

The existing common TPU tracker/finder bed and strap move onto a **flat removable PETG bridge carried by the cassette**, fitted after the Pi. No fixed accessory cross-bridge remains in the housing insertion path. Retain access to JHE42B's entire sound/control face and connector end, ZX908's ports/antenna and the common retaining fastener. Generic tracker/SSD envelopes and undocumented contact lands still require delivered-hardware checks.

There is **no protective glass, tip-window bayonet, retaining ring, optical gasket or conical glass seat in this execution**. The stronger plain PETG nose throat supports a rear-open TPU camera pocket extending around the objective. The sleeve's inward transition must grow continuously from the body pocket; a disconnected annulus appearing part-way through a print is not acceptable. The TPU cheeks extend rearward to Z108.2 and enclose the two M3 keeper bores at Z112; the central rear remains open for the MIPI latch. Side M2.5 camera screws remain bench-accessible. Verify the actual focus barrel and optical clearance; the lens entrance pupil is not measured.

### Short PCIe lead and camera cable

The manufacturer's package lists a nominal **40 mm 16-pin PCIe lead**. The user measured **13 mm protruding beyond the adapter PCB edge when connected**; assign the other 27 mm to the already-seated adapter-side portion rather than budgeting the whole 40 mm a second time outside the board. These are host assembly cable data, not editable supplier-board dimensions.

At the final datums the source-derived Pi PCIe mouth is `[-0.786,-0.005,6.13]`; the adapter-edge cable emergence is `[-8.2,0,2.5]`. Native circular bends take the ribbon through the adapter's existing slot and along its bare back. The modeled adapter-side route is 25.327 mm against its measured 27 mm allocation; the 1.673 mm residual is unresolved seating/route allowance, not a measured insertion depth. The free segment plus the assumed 2.5 mm Pi insertion requires **11.986 mm from 13 mm**. Total budget is **38.986 mm from 40 mm**, leaving **1.014 mm**. The slot bends have R1.6 and the free quarter-turn R3.63; permissible radii remain unspecified by the cable supplier. Check the delivered cable, terminal insertion and matching triangle/contact orientation before committing a print batch.

The separate **100 mm CSI route** uses CAM1, passes outside the USB packages at X=-14 and turns into the camera's rear latch. Longest ribbon-edge routing plus 10 mm total end allowance requires **95.980 mm**, leaving **4.020 mm**. Minimum modeled centerline radius is 6.050 mm. These authored smooth routing reserves do not establish ribbon developability, twist, fatigue or optical performance.

The user supplies Pi power through **GPIO 5V/GND**. The public source interface exposes pin 4 (+5V) and pin 6 (GND); an authored 8 x 8 x 10 mm external mating allowance starts at their actual tips. The reinforced D4 power passage is at Y=28.5/Z=22 through the backbone. A D3 bundle route goes around the PCB's positive-Y edge to that passage. Its plug and wire sizes are fitting assumptions, not identified purchased components or an electrical/current-capacity validation. Additional UPS/adapter/tracker/finder leads must be fitted and restrained on the bench.

With the hood removed, an 18 x 20 x 35 mm Ethernet service envelope starts at `[-12.5,-29.75,91.55]`. The camera pocket and frame clear this corridor; the hood is removed axially rather than rotated around connected cables.

### Bench assembly and receiver installation

1. Load the frame's captive nuts through their open side tracks. Fit the UPS cells and prepare its corrected TPU cradle/cover, then mount the UPS on the open cassette with its short fastener stacks.
2. Seat the Pi in the four TPU shoes, install its source-aligned fasteners and inspect the middle USB/GPIO clearances with tools still accessible.
3. On the bench, insert the NVMe module in the adapter socket and install its independent retaining screw. Mount this adapter/SSD subassembly with the adapter flat side toward the UPS and the TPU divider between them. This avoids trying to feed a long SSD through the rear frame crossbar.
4. Fit the TPU cushion, its diagonal locating stubs and rear PETG retainer; tighten the two combined clamps that capture the frame. Confirm SSD component and cooling clearance.
5. Connect the PCIe lead with the required contact/triangle orientation. Route it through the adapter opening/backside passage, then into Pi without consuming the measured free length in an extra fold.
6. Fit the camera and TPU lens sleeve; install the side screws and connect the 100 mm CSI lead. Connect and restrain UPS, adapter and Pi power wiring while all ports are visible.
7. Fit the removable accessory bridge, common TPU bed, tracker, buzzer and strap. Connect their power and secure the complete bundle to the cassette.
8. Bench-check the assembled electronics and inspect every fastener, latch, supported PCB land and cable bend before enclosure installation.
9. Leave the hood and its four screws off. Insert the **complete populated cassette camera-first** along the wall grooves, with the hood/body captive nuts retained. Load the four cap nuts, fit the rear plate and its two axial screws, then install its four flush radial locks. Fit the hood axially and install its four locks. Insert the complete unit into the tube and install the four body anchors. Do not reconnect internal flex cables through the receiver. Reverse the sequence for full service; removing the hood alone gives Ethernet access.

**Changed tube drilling:** body anchors are now at 0/180 degrees in two rows, Z=-20 and -32, instead of the old 0/99/180/261-degree single row. Two new aft-row tube holes are required; the old 99/261-degree holes do not match this execution. Radial rear-cap screws are fitted on the bench before the receiver enters the tube.

### Manufacturing and verification gates

In **For 3D printing**, hood and TPU camera pocket are nose-down; the PETG ladder, power carrier, adapter cushion/retainer, Pi shoes, camera keeper and accessory bridge/bed lie on their broad negative-X faces. The UPS cover lies on its positive-X sheet, and the receiver, rear plate and clamp strap use their flat Z faces. All 17 parts are separated by 8 mm and grounded at Z=0; split them onto suitable material-specific beds in the slicer. Use continuous substantial roots, steep inward transitions and component windows instead of overhanging nut shelves, thin isolated legs or inaccessible internal supports. The final print poses are taken from the actual implementation; **For 3D printing** must contain only the configured manufactured printing parts, grounded on Z=0 with separation. No universal support-free or stiffness claim follows from these design intentions.

Before accepting the new source, check every printed unit is one connected valid native solid; actual populated fit; corrected UPS plug access; guide/end-stop/retainer engagement; full camera-first insertion and reverse service path; USB/nut/tool sweeps; both short PCIe edges and the 100 mm CSI route; source analytic CAD and representative STEP/FCStd exports; preview/nominal dimensions; canonical identities across all inspection states; and actual print-layer/bridge/support findings. Record checks with their source revision. Historical fit, window, dense-layer and print-kit passes above do not verify this redesign.

The reported **15 kg complete vehicle** and **250 m/s airspeed** remain load-development inputs. Startup acceleration, deployment shock, temperatures, selected PETG/TPU process properties, creep, cooling, actual cable contacts and connector insertion dimensions remain unresolved. No lifting, flight, vibration, thermal or cable-life rating is asserted by this design record. Method references: [TRIZ Body of Knowledge](https://www.aitriz.org/triz/triz-body-of-knowledge), [MATRIZ terminology](https://wiki.matriz.org/docs/triz/glossary-6146/), [Prusa printing-oriented modeling](https://help.prusa3d.com/article/modeling-with-3d-printing-in-mind_164135).

### Completed source-bound verification (2026-11-01)

The final `test-results/rocket-camera-nose-guided-rebuild/final-006/` audit reports `passed-geometric-review` in FreeCAD 1.1.4. Its manifest SHA256 is `8deb805916d67c9aa9787fb282050018662d239e92d53f8fb30f18116278bba3`; the assembled macro is `0562ec57243d176dfa8f298a812dc948aee07ce98368fc7ca472df39a6059366`, and the actual print-layout macro is `5ae2e9e4fb0147d6170ad7f7f369cd53c77252574625c08cf03ce922895a5c22`.

- All 97 physical occurrences have valid closed native geometry. Every one of the 17 printed parts is one connected solid; browser meshes, grounded print poses, native-derived STL and STEP material equivalence pass. No new floating print islands were found in the 0.2 mm layer screen.
- All 102 sampled module, screw, nut and tool paths pass. The complete wired cassette traverses 501 insertion positions with the hood off, followed by 361 hood-fitting positions. These are exact native checks at the reported increments, not mathematically continuous sweeps or cable-fatigue tests.
- Opposed nominal bearing areas are 754.04 mm2 at the retainer/frame, 187.60 mm2 at the carrier/frame, and 501.32 mm2 at the cap/frame. These establish geometric contact and retention paths, not allowable loads.
- The long TPU carrier-wall overhang in the central 70 mm region fell from 318.50 mm2 to zero at the formerly failing layer. Full-layer flagged area fell from 663.77 to 211.53 mm2; remaining connected nut-pocket roofs are about 33.38 mm2. Other local holes/bridges remain. Check supports and bridging in the chosen slicer; no universal support-free claim is made.
- The hood uses 24 native faces including two true surfaces of revolution; the receiver uses 103, backbone 415 and TPU carrier 159. Circular features remain native cylinders/cones, independent of browser tessellation.
- The six affected regression suites pass 38/38 tests, zero skipped. Strict TypeScript, affected package checks and the full production build pass. OV9281's 93 native units and the dual variant's 106 retain exactly the baseline component programs and poses.
- The prototype kit contains 17 individually centered, grounded STL files, the full 97-occurrence FCStd, printed-part and assembly lists. FCStd save/reopen preserves every checked library/configuration identity, face count and volume. The archive and round-trip report live beside the final audit.

Physical fit, complete branch wiring, cooling, electrical protection, actual cable minimum radii/contact insertion, screw-locking performance, process capability and all flight/lifting/shock/vibration strengths remain qualification work. Passing CAD checks does not release the design for the specified 15 kg vehicle or 250 m/s operation.

## Historical glass-backed and alternative executions

The following records describe earlier original-camera and single-OV revisions, the separately retained dual-camera execution and other packaging executions. Their counts, assembly sequences and verification hashes do not qualify the guided redesign above.

For the revised original-camera `structural-90-86`, use the [centered common-cage design record](#centered-camera-and-common-cage-2026-11-01). The earlier glass-backed construction, 94 mm insertion, component counts and assembly instructions below are retained historical records; they are not the current redesign's instructions or verification. The single-OV record below is historical; the dual-camera execution remains separate.

Select `structural-90-86` for the PETG structural frame and fitted TPU electronics mounts in a measured **90/86 mm tube**. The nominal installed length remains **240 mm**: 94 mm insertion, 140 mm nose to the window seat and a 6 mm dome crown. Positive Z points toward the glass; Z=0 is the tube end. That historical structural configuration declared **83 physical occurrences and 15 printed details**. Earlier short TPU and rigid tandem/sandwich presets remain available.

## Continuous support and isolated electronics

The frame now has a continuous 3 mm curved PETG skin with sloping service-aperture roofs, connected columns and broad rooted bearings. Three nominal wall-bearing sectors follow the actual hood cavity at 0/180/270 degrees, Z=32..100. This defines a geometric lateral load path; printed fit, stiffness and load capacity remain unqualified.

Full-depth TPU dovetails replace the former thin retaining lips. Pi has a 3 mm backing, deep edge channels, D8 PCB seats and tapered haunches. A broad 45-degree matching scarf between the Pi feet and UPS tray replaces the inverted support shelf. The UPS cover uses a continuous **continuous front sheet (3.2 mm blank, 2.9 mm minimum at the holder relief)**, broad side cheeks and end diaphragms in place of the crossed lattice. A continuous **2.2 mm orthogonal TPU separator** isolates the computer and power-board regions. Boards and compression hardware are intended to bear through TPU rather than PETG; confirm delivered protrusions and printed clearances.

Pi remains X=-11.2/Z=31, adapter X=-16.7/Y=0.25/Z=31, SSD X=-20.7/Y=-9.7/Z=33.5 and UPS X=3.844/Z=-44. Four M2.5 x 16 through-bolts and M2.5 DIN 985 nuts retain the Pi/adapter stack through the real board bores. Compression stops preserve 5.53 mm between PCB faces. Two M3 x 25 UPS crosspins at Y=+/-34, Z=-44 use compression tubes and broad TPU washer seats. Remove both pins and tubes through the barrel service windows after withdrawing the frame from the tube, before removing the UPS tray.

Three broad sloped-root lugs and an M3/DIN 985 lock retain the hood. Four M4 x 12/DIN 985 body anchors remain at Z=-20, angles 0/99/180/261 degrees. The rear cap uses three flush DIN 7991 M3 x 16 countersunk screws and DIN 985 nuts at R38, angles 0/145.5/214.5 degrees, backed by raised cap seats and rooted frame bosses.

## Glass and camera

The glass flange has a 0.8 mm rear TPU gasket and a 0.4 mm front TPU gasket. A separate flat-printed PETG front seat bears on the hood's full conical crown. A separate rear load seat gives approximately **197 mm2 of annular backing** to the retainer. The load seat rests on a half-cone and half-rear landing in the frame; its other side opens for radial service. The retainer's rear skirt pilots in the load-seat counterbore and closes that release path with the hood installed. These are nominal contacts, with no specified preload or force rating.

The retaining ring has 4.8 mm bayonet ears with sloped roots. The installed cassette blocks its **2.4 mm rearward release travel**. Normal service turns the hood and retained glass group +30 degrees and lifts them forward; the rear load seat stays with the cassette. For glass replacement after the hood is off, support the glass, pull the retainer back 2.4 mm, turn it -45 degrees and withdraw it rearwards. Remove gaskets, glass and front seat in sequence. To remove the rear load seat, first remove the hood/window group, camera hardware, camera and empty TPU pocket, then slide the seat toward +Y. Reverse that order for assembly.

The rear-open camera pocket has **2.5 mm TPU side walls**, a 3 mm rear flange, 1.6 mm side-isolation flanges and a matched conical seat. Two M2.5 x 8 ISO 7380-1 button screws use 5.5 mm compression tubes and pressure washers, with 2 mm nominal thread engagement. The camera side-hole offset is the user's 7.5 mm; hole height and blind depth still need measurement. Procure a qualified reusable factory nylon locking patch for these screws. The ordinary catalog screw is a geometry reference only. The tiny printed drive plugs and blade slots are removed. The SSD's M2 retaining screw separately requires a compatible qualified factory mechanical patch.

Keep all camera metal clear of PETG. Disconnect the flex and remove both screw stacks through the straight ports before withdrawing the camera. Only then remove the empty TPU pocket with opposed plungers, depressing its grommets and folding the flanges through their ports. Qualify that elastic operation and repeated-service behavior on printed parts.

Camera rear remains Z=115 and objective front Z=142, entering the authored hollow dome by 2 mm. The D23/D17/6 mm glass envelope is user supplied; its 1 mm wall/flange construction remains an assumption. Actual thickness, material, focus and field of view require checking. The 110-degree housing-cone check is geometric, not an optical test or a window rating.

## Common finder bed and rear cables

ZX908 and standard JHE42B share **one flat TPU bed and one clamp strap with one M3 x 22 screw**, washer and nylon-insert nut. The bed has a 3 mm backing and shallow locating rims. Its broad PETG saddle resists rotation without the earlier large closed case or thin keys. Remove the screw fully through the lateral tool bore before sliding the holder out sideways; support the loose hardware and modules. Pi/UPS fastener stacks remain separate.

JHE42B uses a complete 23 x 17 x 17 mm reference including its battery. ZX908 remains the 35 x 20 x 4.5 mm user-reference PCB; no separate battery is specified. Confirm delivered dimensions and service faces.

Two D6 rear cable passages at X=-29, Y=+/-8 use a linked TPU insert with a 2.4 mm broad front bridge and tapered mouths. Frame tie slots provide strain relief. Keep the real bundle, disconnect and service loop clear of the lower parachute compartment. The nose stays fixed in the body tube during deployment; the parachute uses the separate structural shackle farther down the tube. Neither the cable closure nor the accessory holder is a recovery hardpoint.

## Cable and assembly sequence

The 100 mm CSI cable has a modeled edge-based requirement of **98.501 mm**, including assumed 5 mm reserves at both connector ends. The rear camera mouth is [1, 5.5, 114.5] mm; the bypass is X=8.8. The 11.5 mm ribbon uses a 12.5 x 1 mm clearance loft. Fit the actual ends, bends and twist; a smooth CAD route does not prove a flat FFC can follow it. Use a longer lead if necessary and secure its extra loop. PCIe, USB-C, insulation and cooling also require fitting.

1. Assemble the Pi stack and UPS cage outside the frame. Load the captive frame nuts and slide in Pi first, then UPS. Seat the matching scarf faces, install both crosspins/tubes and close the rear cap. Install the common finder bed, devices, clamp and its single screw after the main trays.
2. With the camera and pocket absent, slide the rear window load seat into its socket from +Y. Fit the pocket, camera and side hardware, then route the cable.
3. Assemble the glass group in the hood and engage its dogs. Fit the hood bayonet and M3 lock, verifying the retainer pilot seats in the rear load seat. Install the four M4 body anchors.

For Ethernet access, leave the body anchors installed, remove the main hood lock, turn the hood +30 degrees and lift it forward. Ethernet faces the nose end at Z=76.55. For full maintenance, disconnect wiring, remove the body anchors and withdraw the frame. Complete the six-stage common finder-holder removal first: screw/washer, clamp, devices and empty bed. This clears the clamp screw from the Pi USB withdrawal path. Then remove the rear cap and both UPS crosspins/tubes before withdrawing UPS and then Pi; the captive body-anchor nuts remain installed. Open covers and board hardware on the bench.

## Printing and qualification

Select **Model state > For 3D printing** for all 15 printed details, grounded at Z=0 with 8 mm nominal spacing. The bill of materials retains the complete assembly. The shared `lib/printing-poses.ts` sets the actual preparation poses:

- Hood, frame, rear cap and window rings/seats print rear-face down; TPU window gaskets print flat.
- Pi tray, UPS tray, camera pocket and rear cable insert rotate 180 degrees about X, nose/front end down.
- UPS cover rotates +90 degrees about Y onto its broad front sheet.
- The common finder bed rotates -90 degrees about Y onto its backing; the strap uses its flat preparation face.

The redesign reduces support-dependent surfaces using broad slopes and continuous sections. **It is not a claim that every part is fully support-free.** Small local bridge/washer-seat and aperture regions require a slicer check and representative print trials. The geometric audit samples actual 0.2 mm layers, with a 0.4 mm nozzle assumption and a 45-degree adjacent-layer reach criterion, without bridge credit. It is not a toolpath simulation, material test or support-removal test.

Current source-bound fit, service, dense-layer and print-export results belong to `test-results/rocket-camera-nose-printability-current/`; use that revision's manifest and reports for the final source hash and status. The `41daa593...` flat-bed kit and `c60398ca...` wall-supported package are preserved **historical evidence**, not checks of this revision. The old five-part `rocket-camera-nose-updated-prints.zip` is a historical partial update, not the current 15-part kit.

The user inputs are 250 m/s maximum airspeed and 15 kg full vehicle mass. Peak acceleration and measured glass material/thickness remain unknown. CAD fit and layer geometry provide no 250 m/s, 15 kg, vibration, impact or deployment-load rating. Qualify the selected PETG/TPU, orientations, temperatures, hardware, delivered glass, physical fits and service cycles before use. See [the detailed design and evidence notes](../../../docs/rocket-camera-nose.md) for library sources, load-case estimates and historical report hashes.

## OV9281-110 camera variants

The single-OV instructions below describe its superseded glass-backed revision. Use the common-cage section above for current `ov9281-90-86`. The dual-camera execution retains the arrangement below.

The `ov9281-90-86` and `dual-90-86` presets add Waveshare SKU 21653 from the independent `waveshare-ov9281-110` library package. Both retain the 90/86 mm tube, 140 mm window-seat datum, 94 mm insertion and 240 mm overall installed envelope. The original 19 mm camera preset remains available.

The OV-only crown has a 28 mm nominal end radius. The dual crown has a 36 mm nominal end radius and two forward windows, with the original camera at X=-15/Y=-5 and the OV9281 at X=15/Y=-0.5. This broader top accommodates the offset 25 x 23.86 mm PCB and its thick TPU carrier. Aerodynamic drag is not validated. The upper optical deck is a separate stout PETG part, recessed for two M3 retention screws; its front face directly backs both window retaining rings. It lifts away after the hood/window group is removed, giving access to each camera. The PCB carrier has four M2 through fasteners and separate nuts; specify a serviceable factory patch rather than assuming a plain thread cannot loosen. The old camera keeps its side M2.5 hardware. No adhesive or permanent potting is specified.

For these presets Pi 5 and its NVMe cradle move forward 8 mm. The UPS stays in its original region. The Ethernet corridor remains nose-facing; the OV pocket has an open service-side edge and all four PCB mounting holes remain retained. Each camera has its own calculated 100 mm lead: OV9281 uses CAM1, and the original camera uses CAM0 in the dual preset. The OV lead widens from 11.5 mm at Pi to 16 mm at the 15-pin camera end. Route budgets measure both ribbon edges, include a 3 mm straight OV entry (5 mm at the rear-entry original camera) and a further 10 mm total insertion allowance. These are authored routing envelopes, not a developability or cable-fatigue proof. With only about 1 mm spare, check the delivered connector insertion, contact side, allowable bend radius and actual cable length before fabrication. A Pi 5 compatible 22-to-15-pin adapter FFC is required for OV9281; a 15-to-15-pin lead does not fit Pi 5 directly.

Manufacturer FOV is 110 degrees diagonal, 93 horizontal and 70 vertical. The OV objective sits at Z=140 mm within the separate D23/D17 optical window. Its entrance pupil, the 14 mm square holder envelope, connector dimensions, rear components and delivered glass need measurement. No optical or simultaneous two-sensor driver qualification is implied by mechanical fit. The existing second camera has no identified sensor model.

The new housing prints with its broad optical face down, the removable deck front face down and the OV TPU pocket rear face down. The upper frame grows inward along a continuous 1:1 roof rather than using a floating horizontal shelf. Small holes, local bridges, body bayonets and the unchanged lower cassette still require slicer review. Select **For 3D printing** to see the separate fabrication parts.

Verification for these new presets is under `test-results/ov9281-camera-variants`; the previous print kit and previous 19 mm camera qualification reports apply to their exact earlier configuration only. Nominal CAD fit is not a 15 kg lifting, 250 m/s pressure, deployment shock or flight release.

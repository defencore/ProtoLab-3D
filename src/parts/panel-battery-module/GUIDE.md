# Panel battery module

A panel-mounted 3S or 4S enclosure with a hook-in cell lid, a recessed spring-return sliding bolt and a soft extraction sling. The lid releases by hand. The XT60E-F stays on the fixed front strip; the white right-angle balance header mounts directly on the main holder board and faces the left side wall. Internal threaded hardware is M3; the host panel uses M4 bolts and two printed rear clamp strips.

## Purchased interfaces

| Item                 | 3S                                  | 4S                           |
| -------------------- | ----------------------------------- | ---------------------------- |
| Holder               | MPD BK-18650-PC6                    | MPD BK-18650-PC8             |
| Original holder body | 77.70 × 59.69 × 21.54 mm            | 77.98 × 78.84 × 21.54 mm     |
| Main donor perfboard | PY-10×10, trim to 100 × 70 × 1.5 mm | PY-10×10, 100 × 100 × 1.5 mm |
| Balance header       | 4 contacts, nominal 2.54 mm         | 5 contacts, nominal 2.54 mm  |
| Reference cells      | Three, 68 × 18.3 mm                 | Four, 68 × 18.3 mm           |

MPD supplies independent contacts; wire the series links separately. Its original CAD is retained. MPD specifies protected button-top cells 65–68 mm long; check actual diameter, wrapper and spring fit. Rigid reference cells engage small original retention-clip regions, recorded separately in the native report. Enclosure clearance does not qualify that elastic purchased-cell fit.

Two printed M3 rails retain the holder's original end-wall tops. Do not enlarge its fixing seats or drill extra holder holes. Apply gentle retention without bending the thin molded wall.

The white header is an **authored XH-style reference at nominal 2.54 mm pitch**, with a shroud and mating guides. Measure the delivered header/cable pair, including pitch, shell, keying and pin order. The right-angle housing and pin-bend dimensions are inferred, not an identified manufacturer's model. Original JST XH uses 2.50 mm pitch and requires its own verified interface.

Sources: [MPD PC6 product/CAD](https://www.batteryholders.com/part.php?pn=BK-18650-PC6), [PC6 drawing](https://www.memoryprotectiondevices.com/datasheets/BK-18650-PC6/BK-18650-PC6-datasheet.pdf), [PC8 drawing](https://www.memoryprotectiondevices.com/datasheets/BK-18650-PC8/BK-18650-PC8-datasheet.pdf), [XT60E-F source](https://www.aksotronik.com.pl/gniazdo-xt60e-f-zenskie-przykrecane.html).

## Mounting and board preparation

Dimensions are millimetres. Z0 is the front panel seating plane. The body/opening centre is X16, Y0; the holder/lid centre is X0, Y0. The main-board centre is X−5, Y0, so its stock spans X−55 to +45. Template hole coordinates use their stated drawing datum; assembly coordinates are included separately in CSV.

| Interface                  | 3S                       | 4S                       |
| -------------------------- | ------------------------ | ------------------------ |
| Body                       | 152 × 90                 | 152 × 120                |
| Front flange               | 176 × 114 × 4            | 176 × 144 × 4            |
| Panel cutout               | 152.8 × 90.8, R5.4       | 152.8 × 120.8, R5.4      |
| Four Ø4.5 panel holes      | X −65.5 / +97.5; Y ±50.5 | X −65.5 / +97.5; Y ±65.5 |
| Cell opening               | 81.70 × 63.69            | 81.98 × 82.84            |
| Four Ø3.4 main-board holes | X ±41.5; Y ±31.5         | X −47 / +41.5; Y ±45.72  |
| Holder-rail M3 axes        | X ±50; Y ±21.845         | X ±52; Y ±31.42          |

The rear tray lies at Z−36. Leave rear wiring/assembly access and room to raise the lid's right edge by 17°, withdraw its left hooks by 4 mm and lift it clear. Select the actual host-panel thickness, 1–6 mm. The model selects M4×12 for 1–2 mm and M4×16 for 2.5–6 mm, with two printed rear strips and recessed nuts. Additional gaskets change the fastening stack.

The prepared main board shows installation-critical features only; unused stock perforations and copper pads are omitted. Check delivered PY stock before cutting. Drill Ø1.8 mm for holder blade tails at X−36.65 / +36.25, with Y−19.3 / 0 / +19.3 for 3S, or Y−28.95 / −9.65 / +9.65 / +28.95 for 4S. Drill the four Ø3.4 main-board holes above. No holder-fixing holes are needed; its blade-tail pattern is not a 2.54 mm grid.

Cut two **left-edge U reliefs** in the main board: each has a Ø10 round end and a 10 mm-wide straight entry from stock edge X−55 to the circle centre. For 3S the circle centres are X−50, Y±21.845; for 4S X−52, Y±31.42. Cut out the complete entry and round end, rather than drilling closed holes. These openings clear the left holder-rail posts. The two additional integral tray lands support the board near the connector; they need no PCB holes or screws.

Solder the **right-angle** balance header directly to the main board at **X−50.5, centred about Y0**, on nominal 2.54 mm pitch, facing −X. Drill Ø1.1 vertical tail holes at Y+3.81 / +1.27 / −1.27 / −3.81 for 3S, or Y+5.08 / +2.54 / 0 / −2.54 / −5.08 for 4S. Pin 1 is the highest-Y end. The header requires no carrier, separate board or mounting screws. Its nominal shroud face lies flush at X−60.

The left shell has an open-bottom connector notch, Y±12 and approximately Z−33 to −15; the rear tray closes its bottom. This avoids a roofed side window during printing. Release the four M4 host-panel mounts and withdraw the whole module to connect the balance lead from the side. Cells can instead be removed through the lid for separate charging. Qualify the delivered right-angle header, matching cable housing and soldered footprint; keep the joints insulated and avoid transmitting cable loads into them. No pigtail is included.

## Print and assemble

The current module has **9 printed occurrences**: bezel, lid, rear tray, sliding bolt, latch-channel cover, two holder rails and two rear panel strips. Use the supplied Print layout poses. Bezel front, lid top, left-rail top and panel-strip contact faces print down; the sliding bolt and right rail print on their sides. The tray and latch cover use their lower flat faces. The right rail's lowered U-shaped bridge clears the latch. Nominal shell walls/floor are 3 mm, flange 4 mm and lid 3.2 mm. Small removable supports are permitted; remove them fully from the spring pocket, slider channel and hook seats.

The supplied reference profiles use removable normal automatic supports for **frame, lid and latch-slider only**, with support on the model allowed. The other six pieces use supports disabled; no brim or raft is used. Keep the supplied orientations. Remove support before assembly:

- Frame: clear the horizontal spring guide through the rear-open latch pocket, plus the accessible grip recess and ledges.
- Lid: clear the two short patches beneath the hook feet and the exposed keeper ledge from the underside.
- Slider: clear the small patch beneath the exposed rounded thumb-button edge.

Use the corresponding `process-frame-guide.json`, `process-lid-hooks.json` and `process-slider.json` profiles with the controlled overrides. The PETG reference audit estimates about 0.93 g of support for 3S and 0.92 g for 4S. Actual support removal and surface fit still require a physical print check.

Fit-test actual M3 inserts and captive nut seats in PETG. Two nominal Ø4.6 × 4 mm heat-set inserts use Ø4.2 pilots for the stationary latch cover. M3 nuts recess into tray, rails and XT60 seats; M4 nuts recess into the rear strips.

1. Assemble the latch before the holder rails and rear tray. With the bolt and cover absent, slide the measured spring onto the fixed rear Ø6 × 4 mm guide through the open channel. Use a small smooth tool to hold it at its normal released length of 5 mm; do not compress it solid. Insert the bolt from the rear in its **locked/neutral X position**, then ease the spring against its flat seat to the 9 mm installed length while holding the bolt neutral. Keep the bolt held while closing the channel with the printed cover and two rear M3×10 countersunk screws into inserts; release it after the cover is secured. The cover's integral stop bar retains the neutral end of travel; test the mechanism only with this cover secured. Check the full 4 mm stroke and free return without cells. Printed shoulders limit travel; initial setup uses tools, routine release uses fingers.
2. Prepare the main board, solder its balance header, and complete accessible insulated wiring. Mount the board with four M3×6 screws in its printed pilots. Check the delivered balance lead through the side notch before proceeding.
3. Seat the holder with blade tails through the board. Load M3 nuts from the top of each rail before closing the enclosure; the pocket floors carry the clamping load. Fit both rails using four rear M3×30 screws. Confirm gentle retention and full seating.
4. Mount XT60E-F with two M3×12 countersunk screws and recessed nuts.
5. Join tray and shell with four M3×40 screws and captive tray nuts. Secure the flange through the host panel using four M4 bolts, rear strips and recessed nuts.
6. Fit two nominal 8 mm-wide × 3 mm-thick soft strips beneath the lid ribs, each holder-width minus 7 mm long. Qualify gentle foam preload with actual cells; do not force the lid over an oversized stack.

For bolt or spring replacement, remove cells, the rear tray and right holder rail to reopen the straight rear assembly path. The cover screws remain stationary during routine lid release.

The latch uses a nominal **Ø8 mm × 10 mm free-length compression spring, 0.4 mm wire**. Six total coils, approximately four active coils and closed unground ends are reference assumptions. Installed spring length is 9 mm with the lid locked and 5 mm at full release. Using the [Acxess Spring solid-height method](https://www.acxesspring.com/solid-height.html) for closed, unground ends, the conservative reference is `(6 + 1) × 0.4 = 2.8 mm`. This is a calculation assumption, not an identified spring SKU: measure the delivered spring and preserve clearance from coil bind. The thumbpad top is Z3.7, below the fixed bezel's Z4 face. Return force and life are not rated: qualify actual spring return against printed PETG friction and repeated use. Clear the guide surfaces rather than increasing spring force to overcome binding.

## Sling and cell replacement

Use one soft polyester sling, nominal **12 × 0.4 mm**, with a flat sewn join and no hard buckle or knot. Measure its actual thickness. It runs at X0, under each cell and over the existing inter-row walls. Follow the scalloped route; do not cut purchased plastic or trap the ribbon against contacts.

The loop passes through one central **14 × 4.5 mm lid slot**, unanchored. Smooth slot edges and fit the length so the loop folds through freely. It is a cell-extraction aid, not a locked-module carrying handle: pulling it while closed can tension cells.

1. Slide the recessed thumbpad 4 mm toward the fixed connector strip and hold it retracted.
2. Raise the lid's right edge at the finger reliefs, tilting about its left edge by approximately 17°. The two left hooks remain under the bezel during this first movement.
3. Feed/compress the soft loop through its slot, leaving the sling with the cells. Do this before sliding the lid sideways; the slot is only 2 mm wider than the ribbon.
4. Move the tilted lid 4 mm toward the connector strip to withdraw the left hooks, then lift it clear. Only now gently pull the sling and remove cells by hand.
5. Refit cells with the original ribbon route. Feed the loop through the lid, engage both left hooks, hold the slider retracted while lowering the right edge, then release it. Confirm the bolt fully engages and both hooks retain the lid.

The Open lid view combines a 17° tilt, 4 mm hook withdrawal and 35 mm lift after feeding the flexible loop through. It is a service position, not a rigid-loop passage simulation. Verify actual fabric handling, wrappers, spring fit and repeated closure physically.

## Electrical nodes and fabrication files

Wire independent contacts into the selected series circuit with suitable insulated conductors. Pin 1 is the highest-Y header end in the generated top view. The authored assignment is:

| Pack | Pin 1 onward       |
| ---- | ------------------ |
| 3S   | B−, B1, B2, B+     |
| 4S   | B−, B1, B2, B3, B+ |

Verify each node and the mating lead; shell keying alone does not establish polarity. No BMS, fuse, charger or wiring is modeled, and no pack current/protection rating is assigned. Keep power paths on suitable conductors rather than isolated perfboard pads.

Generated CAD exports, drawings, validation reports and delivery ZIPs belong under the ignored `test-results/panel-battery-module/` directory. Regenerate SVG/DXF/CSV templates there using `scripts/export-panel-battery-templates.ts`. Print SVG at 100% without fitting, and measure the 50 mm calibration bar. Delivery kits contain the current native validation and slicer evidence tied to the actual file hashes. Select PETG profiles for the actual printer; generated machine G-code is excluded.

The final native audit passes 16 configurations and 710 component occurrences, four macro/FCStd/STEP export sets and 18 individual print-part exports. All 18 final STL slices pass using the recorded PETG, 0.4 mm nozzle, 0.2 mm layers, four walls and 40% infill settings, with the six supported parts described above. Final slices have no warnings or geometry issues. The unsupported baseline and actual support-coverage report are retained separately: the baseline's slider warnings do not qualify it for printing. These checks do not establish physical print quality, purchased-cell fit, actual spring return or fabric handling.

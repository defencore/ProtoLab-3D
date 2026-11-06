# Servo motor catalog

The **Servo motor** catalog under **MOTORS & ACTUATORS → SERVOS → Servo motors** contributes fifteen fixed supplier configurations: Waveshare ST3215-HS and ST3025; KST X10 Mini Pro-A and Pro-B, X10 V8.0, X10 Pro-A and Pro-B; Power-HD T60-BHV and TDS-2; Futaba HPS-H701; Hitec HSB-9380TH and D954SW; CHASERVO HV3609; and TowerPro MG996R / MG90S. Search the library for **servo**, **servo drive** or a model name.

The configurator selects a manufactured servo by published characteristics. It does not resize the case, change mounting dimensions or adjust an electrical rating. These fifteen `servo-motor` models appear inside the grouped **Servo motors** selector alongside the bus, CNC-feed and QFS2025 servo catalogs, giving nineteen choices in the current library. Search by model or manufacturer, then use the **Dimensions**, **Electrical performance** and **Construction** filters to narrow the choices. Select a result to load its fixed geometry. Filtering alone keeps the current preview; **Clear filters** restores all choices.

Numeric filters use inclusive minimum and maximum bounds; either bound may be left blank. For example, a maximum case width of 10 mm returns the five KST variants. A missing specification appears as **Not published**, never zero. A model with an unknown value is excluded only when a filter for that characteristic is active. The catalog browser uses the same published attributes.

## Dimensions and performance

Dimensions are millimetres. Case dimensions follow each manufacturer's stated datum. CHASERVO's nominal 40 mm height reaches the spline-root plane; other case heights exclude the output shaft and optional horn. Total height includes the bare output shaft and, for ST3215, its fixed rear pivot. X10 V8.0 also includes its lower mounting lug. Unverified total heights are excluded from numeric filters even when an illustrative shaft appears in the preview. The preview reports the actual envelope for the selected state and accessories.

| Model               | Case length × width × height | Bare total height | Main mounting and output dimensions                                                                                                                                     |
| ------------------- | ---------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Waveshare ST3215-HS | 45.22 × 24.72 × 29           | 36.3              | Output axis 10.11 from a short end; front/rear mounting pitches 20.7/24.45 × 20.5; Ø6 smooth output envelope. Optional Ø19.2 disc pair with four Ø2.5 holes on Ø14 PCD. |
| KST X10 Mini Pro-A  | 30 × 10 × 28.5               | 32                | 42 mounting span; 36 upper mounting pitch; three transverse Ø3 holes; Ø4.94 major output spline with 25 simplified teeth.                                               |
| KST X10 Mini Pro-B  | 30 × 10 × 28                 | 31.5              | 42 mounting span; 36 mounting pitch; two vertical Ø3 holes; Ø4.94 major output spline with 25 simplified teeth.                                                         |
| KST X10 V8.0        | 30 × 10 × 35.5               | 45.2              | 42 mounting span; 36 upper pitch; lower transverse hole centred between the upper pair, 35.2 below; lower lug extends 6.4 below the case.                               |
| KST X10 Pro-A       | 30 × 10 × 33.5               | 37                | 42 mounting span; 36 upper pitch; three transverse Ø3 holes; lower hole 24.5 below the upper pair.                                                                      |
| KST X10 Pro-B       | 30 × 10 × 33.5               | 37                | 42 mounting span; 36 mounting pitch; two vertical Ø3 holes.                                                                                                             |
| Power-HD T60-BHV    | 40.7 × 20.5 × 38.7           | 44.2              | 49 × 10 mounting pattern; Ø5.9 smooth output envelope.                                                                                                                  |
| Power-HD TDS-2      | 41 × 20 × 29                 | 34                | 49 × 10 mounting pattern; nominal Ø5.8 smooth output envelope.                                                                                                          |
| Waveshare ST3025    | 40 × 20 × 40                 | Not verified      | Front face M2 pattern 36 × 16; rear transverse pitch 15. No projecting RC-servo ears or verified ear pitch; hole depths and shaft envelopes are illustrative.           |
| Futaba HPS-H701     | 40.5 × 21 × 37.8             | Not verified      | 49.5 × 10 mounting pattern; nominal Ø6 / 25T output. Undimensioned shaft projection and ear details remain illustrative.                                                |
| Hitec HSB-9380TH    | 40 × 20 × 38.5               | Not verified      | 53.9 ear span; 49 × 10 mounting pattern, Ø4.5 cutouts; 27.5 lower ear elevation and 2.5 ear thickness; Ø6 / 25T output.                                                 |
| CHASERVO HV3609     | 40.5 × 20 × 40               | 44.2              | 55 ear span; 49.5 × 10 mounting pattern; Ø5–4 open slots; output axis 10.15 from a case end; Ø6 / 25T spline.                                                           |
| Hitec D954SW        | 40 × 20 × 37                 | Not verified      | 53 ear span; 48 × 10 mounting pattern, Ø4.5 cutouts; 26.5 lower ear elevation and 2.5 ear thickness; Ø6 / 25T output.                                                   |

Torque and speed filters use each model's stated reference voltage; they do not interpolate performance at a requested supply voltage. Supply limits, weight, motor type, control interface and spline count are also searchable where published. Torque is a published output or locked-rotor figure, not guaranteed continuous torque.

| Model                      | Torque / speed reference voltage | Published torque, kgf·cm | No-load speed, s/60° | No-load current, A             | Stall current, A               |
| -------------------------- | -------------------------------- | ------------------------ | -------------------- | ------------------------------ | ------------------------------ |
| Waveshare ST3215-HS        | 12 V                             | 20                       | 0.094                | 0.24; test voltage unspecified | 2.4; test voltage unspecified  |
| KST X10 Mini Pro-A / Pro-B | 7.4 V                            | 7.2                      | 0.09                 | Not published numerically      | Not published numerically      |
| KST X10 V8.0               | 7.4 V                            | 9.5                      | 0.12                 | Not published numerically      | Not published numerically      |
| KST X10 Pro-A / Pro-B      | 7.4 V                            | 10.5                     | 0.12                 | Not published numerically      | Not published numerically      |
| Power-HD T60-BHV           | 7.4 V                            | 50                       | 0.089                | 0.3 at 7.4 V                   | 2.5 at 7.4 V                   |
| Power-HD TDS-2             | 7.4 V                            | 22                       | 0.10                 | 0.4 at 7.4 V                   | Omitted: ambiguous source unit |
| Waveshare ST3025           | 12 V                             | 40                       | 0.117                | 0.38; test voltage unspecified | 4.4; test voltage unspecified  |
| Futaba HPS-H701            | 7.4 V                            | 40                       | 0.07                 | Not published                  | Not published                  |
| Hitec HSB-9380TH           | 7.4 V                            | 34                       | 0.14                 | 0.25 at 7.4 V                  | 2.1 at 7.4 V                   |
| CHASERVO HV3609            | 7.4 V                            | 36 holding               | 0.09                 | Not published                  | 4.95 at 7.4 V                  |
| Hitec D954SW               | 7.4 V                            | 29                       | 0.12                 | 0.5 at 7.4 V                   | 5.2 at 7.4 V                   |

The [Waveshare product listing](https://www.waveshare.com/product/modules/motors-servos/st3215-hs-servo-motor.htm) publishes 240 mA no-load current and 2.4 A locked-rotor current without stating their test voltage. Its 12 V torque/speed reference is not assigned to those currents. KST provides a current-versus-torque graph but no numeric current ratings used by this catalog. The TDS-2 V1 sheet labels stall values **1900 / 2400 mAh**, a charge unit; the catalog does not reinterpret them as amperes. Model cards and source details retain these conditions. Other published voltage points remain in the read-only specifications.

ST3025's published 380 mA and 4.4 A currents also have no stated test voltage. Futaba publishes no numeric current ratings used here. CHASERVO separately publishes **holding torque** and **output torque**: at 7.4 V these are 36 and 24 kgf·cm. The torque filter uses the holding figure with that condition attached. Its 4.95 A stall current is not a continuous rating, and its no-load current remains unknown.

## Geometry sources and discrepancies

Fixed dimensions include source measurements and fixed approximations where the drawings omit detail. `catalog.verifiedParameters` identifies the selected `model`; it does not claim that every modeled surface is dimensioned by the manufacturer. Private geometry evidence lists the individually verified dimensions and notes the approximations.

### Waveshare datums

The [official ST3215-HS wiki](https://www.waveshare.com/wiki/ST3215-HS_Servo_Motor) supplies the shared [ST3215 drawing](https://files.waveshare.com/upload/0/08/ST3215-2D.zip) and [STEP model](https://files.waveshare.com/upload/5/59/ST3215-3D.zip). The drawing title is **SCS215**, dated 2022-06-08. Local copies preserve the drawing image (original reference, not bundled), drawing PDF (original reference, not bundled) and original STEP (original reference, not bundled).

The drawing separates a 29 mm main case, 32 mm raised-face envelope and 37.25 mm span between the outside disc faces. The original STEP rear pivot projects 0.55 mm beyond the lower disc, so the complete disc assembly spans 37.8 mm. With discs removed, the modeled shaft-to-pivot envelope is 36.3 mm. The wiki's nominal 35 mm listing is not used as the rectangular case height.

The output axis is X=Y=0; Z=0 is the main case rear plane. The near case end is X=-10.11. Measured from that short end, output-face mounting rows are at x=18.41 and 39.11; rear-face rows are at x=18.41 and 42.86. Both use y=±10.25. ST3215 has face pilots and a rear pivot, without conventional projecting RC-servo ears. The preview and export now use the original STEP surfaces, including mounting bores, moulded contours, shaft splines and both supplied discs. Nominal drawing dimensions remain searchable catalog metadata; the preview envelope follows the native surfaces (about 45.2234 × 24.7234 mm in X/Y).

### Original ST3215 STEP integration

The supplied `ST3215.step` and the archived manufacturer file are byte-identical: SHA-256 `58e38e4dc49f97df738c5f229f9aa8a7dce64a0a1d01335486a52d53e6017e8a`. The original file is unchanged. Its eight solids are the middle case, front cover, rear cover/pivot, motor, circuit board, output gear/shaft, front disc and rear idler disc. The coordinate transform is `X=x+25.5, Y=-z, Z=y+24.1`.

The source rear cover has an invalid internal annular cavity touching another boundary. Rebuilding its cavity shells and translating only that cavity by **0.00001 mm** along negative source Y yields a valid solid. External surfaces stay unchanged and the volume change is below 0.000001 mm³. The STEP also contains overlapping components; these source overlaps are preserved and recorded separately from new intersections. It is a manufacturer reference assembly, not an interference-free production assembly.

[`scripts/import-st3215.py`](../scripts/import-st3215.py) reproducibly generates the private `native.json` from the pinned original. Browser meshes use 0.02 mm linear and 0.15 rad angular deflection. FreeCAD macros embed compressed native BREP, preserving CAD surfaces without needing a local file or network download. Preview tessellation is not used to reconstruct the exported CAD surfaces. Colors are display choices.

### KST X10 Mini Pro

The [KST product page](https://kstservos.com/products/x10-mini-pro-digital-metal-gear-servo-8-0kgf-cm-0-08sec-for-competition-gliders-and-large-scale-gliders) links its [July 2023 technical drawing](https://cdn.shopifycdn.net/s/files/1/0570/1766/3541/files/X10_Mini_Pro_Technical_Specifcation.pdf?v=1693965183). The supplied PDF was checked against these values and is preserved as a local PDF (original reference, not bundled) and drawing image (original reference, not bundled). Both mounting versions are included. The shared table says 30 × 10 × 28 ±0.2 mm; the specific Pro-A drawing labels **28.5 mm**, which the A model preserves. Pro-B uses 28 mm.

Pro-A has three transverse mounting holes. Its lower hole is 21.5 mm below the upper pair and horizontally offset 14 mm from one upper hole. The upper hole centres are placed symmetrically within the 8 mm ears; that inferred placement is excluded from the verified geometry dimensions. Pro-B has two holes through horizontal ears, with their top surface 6.1 mm below the case top and 1.9 mm ear thickness. The case centre is X=Y=0 and bottom Z=0; both output axes are 6.6 mm from a short case end.

### KST X10 V8.0 and X10 Pro

The linked [X10 product page](https://kstservos.com/products/x10-10-8kg-torque-servo-micro-digital-metal-gear-glider-servo-motor) currently identifies **V8.0**. Its technical PDF (original reference, not bundled) and drawing image (original reference, not bundled) specify a 35.5 mm case, 3.3 mm shaft projection and 6.55 mm output-axis offset from the short end. The lower lug extends 6.4 mm below the case, giving a 45.2 mm bare envelope. Its lower hole is horizontally centred and 35.2 mm below the upper pair. The symmetric upper-hole placement within the 8 mm ears, lower lug's outer radius and retaining bore are fixed approximations. V8.0 travel is ±50°.

The [X10 Pro product page](https://kstservos.com/products/x10-pro-digital-metal-gear-servo-11-5kgf-cm-0-10sec-for-f5j-competition-gliders-and-large-scale-gliders) provides A and B mounting variants. The technical PDF (original reference, not bundled) and drawing image (original reference, not bundled) show a 33.5 mm case, 3.5 mm shaft projection and 6.6 mm output-axis offset. Pro-A's lower hole is 24.5 mm below the upper pair and 14 mm horizontally from one upper hole. Its 8 mm ear height and symmetric upper-hole placement are approximate. Pro-B's horizontal ear top is 6.1 mm below the case top, with 1.9 mm thickness. Both travel ±60°.

All five KST configurations use coreless DC motors, hardened steel gears and a potentiometer according to the visible manufacturer specifications. Their 25-tooth splines and undimensioned casing details are simplified installation geometry. Torque and speed filters use the 7.4 V column; all four voltage points remain in the specifications. Current graphs are linked without inventing numeric ratings.

### Power-HD drawing limits

[T60-BHV V1 specification](https://www.chd.hk/UploadFiles/Att/2025041613344325.pdf) page 3 supplies its installation drawing, preserved as a local image (original reference, not bundled). The mechanical table calls the interface nominal **5.80 mm / 25T**, while the dimensioned spline tip is **5.90 (+0.02/-0) mm**. The model uses the drawing's 5.9 mm tip envelope. Mounting cutout diameter and throat shape are fixed approximations because the source does not dimension them.

[TDS-2 V1 specification](https://www.chd.hk/UploadFiles/Att/2024111314082653.pdf) page 3 is preserved as a local image (original reference, not bundled). It does not dimension the shaft-axis offset or mounting cutout diameter and throat. These fixed illustrative values are excluded from the verified geometry dimensions.

Both Power-HD models use case-centred X/Y and case-bottom Z=0. Their four mounting cutout centres are `(±mountPitchX/2, ±mountPitchY/2)`. Ear thickness is derived from the published upper and lower elevations. Positive `outputAngle` is counterclockwise around +Z; no PWM-to-angle mapping is simulated.

### Waveshare ST3025

The [ST3025 manufacturer wiki](https://www.waveshare.com/wiki/ST3025_Servo) supplies the 40 × 20 × 40 mm nominal dimensions and electrical specifications. Its [installation drawing](https://www.waveshare.com/img/devkit/accessories/ST3025-Servo/ST3025-Servo-details-size.jpg) specifies front face M2 holes on a 36 × 16 mm pattern and a 15 mm rear transverse pitch. The model uses a separate geometry family without conventional projecting RC-servo ears. Undimensioned hole depths, shaft projection and illustrative horn details are fixed approximations and do not become verified numeric filter values. ST3025 does not reuse ST3215's source STEP or supplied disc accessory.

### Futaba HPS-H701

The [Futaba product page](https://www.rc.futaba.co.jp/products/detail/I00000346) and [manufacturer instruction sheet](https://www.minicars.se/internt/artiklar/internal_documents/HPS-H701.pdf) give the 40.5 × 21 × 37.8 mm case, 76 g mass and 49.5 × 10 mm mounting centers. [Futaba UK](https://futaba.uk/products/fut05102721-3) also identifies the Ø6 / 25T spline, brushless motor and dual ball bearings. The instruction sheet specifies rated 6–7.4 V and operating 4.8–8.4 V; the UK listing's 4.8–7.4 V range is retained as a source discrepancy. Manufacturer power instructions prohibit BEC, voltage regulators and dry batteries.

Shaft projection, shaft-axis offset, ear elevations, cutout diameters and total height are not dimensioned by these sources. Their fixed preview values remain illustrative. The ±90° pose control is an inspection range because no rated travel was found; it does not certify an achievable commanded angle.

### Hitec HSB-9380TH and D954SW

The current [HSB-9380TH v2.2 sheet](https://www.hiteccs.com/public/uploads/data_sheet/HCS_HSB-9380TH_Specsheetv2.2-1729882014.pdf) defines a 38.5 mm case height and 49 × 10 mm mounting centers. It supersedes older 38 mm and 0.17 s/60° at 6 V listings; v2.2 specifies 0.18 s/60° at 6 V. The [D954SW v2.2 sheet](https://www.hiteccs.com/public/uploads/data_sheet/HRC_D954SW_Specsheetv2.2_102-1729877827.pdf) defines a 37 mm case height and 48 × 10 mm mounting centers. Both drawings specify Ø4.5 mounting cutouts, 2.5 mm ear thickness and a Ø6 / 25T output. Their shaft axes are respectively +10.1 and +10 mm along the centered case's X axis.

Both sheets dimension a 4 mm spline above its collar but omit the collar elevation needed to establish an independently verified bare total height. Preview collar and shaft envelopes are fixed installation approximations, excluded from total-height filters. D954SW's sheet lists 66 g without a horn; an older product listing states 68 g. Current and performance values use the 7.4 V table column. Both servos normally travel ±60°; their maximum programmable total travel is 160° for HSB-9380TH and 175° for D954SW. The catalog's ±80° and ±87.5° geometric limits require corresponding servo programming in a physical installation.

### CHASERVO HV3609

The [official product page](https://www.chaservo.com/shop/hv-series-2/cha-hv3609-chaservo-hv3609-231) links an [October 2024 specification and drawing](https://www.chaservo.com/web/content/product.template/231/x_studio_downloads?download=1). The nominal 40 mm height reaches the spline-root plane, with a further 4.2 mm spline projection. The drawing supplies 55 mm ear span, 49.5 × 10 mm mounting centers, Ø5–4 open slots, 2.5 mm ear thickness and an axis 10.15 mm from a case end. Its ear top elevation is 30.8 mm, derived from 40−9.2; the lower elevation is 28.3 mm.

The current page lists 81 g and a 500–2500 μs pulse range, while the linked PDF lists 70 g ±10% and 900–2100 μs. The catalog uses the current page's mass and the PDF's explicit maximum travel of ±60°, with default travel ±50°. The wider page pulse range is not converted into an invented travel angle. The published performance separates holding torque, output torque and stall current; each retains its source condition.

## Pose, states and export

The only configuration parameters are `model`, `outputAngle`, `showHorn` and `hornStyle`. Case, mounting, shaft and horn dimensions remain fixed. ST3215 starts with the supplied disc pair, matching the original assembly. Other models start with a bare output shaft. **Include output horn** and **Horn form** select the supplied discs or an illustrative single arm; disabling the horn removes both supplied discs. The disc's four-fold pattern repeats every 90°, and its rear idler remains independent of front output rotation.

Output angles are geometric placement within ±180° for ST3215-HS and ST3025, ±50° for X10 V8.0, ±60° for KST Mini Pro, KST Pro and HV3609, ±55° for Power-HD, ±80° for HSB-9380TH and ±87.5° for D954SW. HPS-H701 uses an illustrative ±90° inspection range. Model changes clamp the angle and reset ST3215's supplied disc selection to a single illustrative arm for other models. These controls do not calculate torque, current or a PWM signal. Changing angle, horn visibility, horn style or inspection state preserves the selected manufacturer's model identity and source attribution. An illustrative horn remains identified as an approximation.

All fifteen models provide:

- **Assembled**: fixed casing and independently placed shaft/horn.
- **Exploded**: separate components for inspection; ST3215 separates all eight original parts, including the covers, motor and circuit board.
- **Case only**: the case and mounting features; ST3215 retains its three original housing solids and rear pivot.

Preview and FreeCAD use the same private geometry descriptions in the [Servo motor package](../src/parts/servo-motor/GUIDE.md). Named direct children become separate solid components in an `App::Part`; changing a component's Placement does not move its neighbours. STL exports the selected preview. **Copy for FreeCAD** and `.FCMacro` create native shapes; export STEP or save FCStd from FreeCAD. The selected model, state and pose apply to every export.

These models support installation layout, envelope comparison and mechanical prototyping. ST3215 preserves the supplied STEP internals and external mouldings; no missing parts or cables are invented. The other models remain external layout approximations, with omitted internals and simplified spline geometry. No electrical simulation is supplied.

## Repeat verification

The native audit report (generated local report) records the verified cases, kernel version and results. The focused tests cover all fifteen models: fixed catalog dimensions, unknown numeric values, actual mounting holes, manifold mesh topology, travel limits, accessory resets, output rotation, filter behavior, rejection of dimension edits and model source attribution after pose changes. The native validator checks selected models and optional accessories across inspection states for valid closed solids, component interference, independent placements and STEP/FCStd round trips. ST3215 component volumes, surface areas and placements are additionally compared with the original STEP. Source intersections are reported explicitly; no new intersections are accepted. Its trimmed source spline surfaces use a 0.005% STEP round-trip volume tolerance; other models retain 0.001%.

```sh
npm run parts:check
npm run typecheck:tests
node --import tsx --test tests/servo-motors.test.ts
node --import tsx scripts/verify-servo-motors.ts /tmp/protolab-servo-motors-cases.json
```

Run the native validator with a Python that can import FreeCAD. With the default macOS FreeCAD installation:

```sh
/Applications/FreeCAD.app/Contents/Resources/bin/python scripts/verify-servo-motors.py /tmp/protolab-servo-motors-cases.json /tmp/protolab-servo-motors-results.json
```

To regenerate the ST3215 assets, run `/Applications/FreeCAD.app/Contents/Resources/bin/python scripts/import-st3215.py` before preparing the verification cases.

For another installation, set `FREECAD_LIB` to its library directory and use its compatible Python executable. The validator checks named component counts, closed valid positive solids, preview/native bounds and volume, inter-component intersections, independent placements, source/configuration properties and STEP/FCStd round trips.

## TowerPro assembly references

MG996R and MG90S supplier identities previously embedded in recovery mechanisms are now independently selectable as `servo-motor:towerpro-mg996r` and `servo-motor:towerpro-mg90s`. Their source pages contain conflicting dimension tables and incomplete mounting/shaft evidence. Both retain explicit installation-reference badges and omit unknown mounting or spline characteristics from numeric filters. Existing mechanism-specific fit geometry is not silently replaced. See the [package guide](../src/parts/servo-motor/GUIDE.md#towerpro-assembly-components) for source conflicts, travel limits and completed consistency checks.

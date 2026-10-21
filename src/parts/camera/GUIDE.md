# Camera & vision module

A fixed supplier catalog under **ELECTRONICS & VISION → CAMERAS & VISION**. Select by camera class, interface, dimensions, mass, primary image channel, resolution, frame rate, field of view, shutter and published electrical characteristics. Dimensions are not editable.

The catalog contains **29 models**. The original selections cover RunCam Phoenix 2 SPV5, Caddx Ratel 2 / Baby Ratel 2, DJI O4 / O4 Pro camera modules, FLIR Lepton 3.5 / 3.1R with socket, Adafruit MLX90640 55° / 110°, Reolink RLC-510A / RLC-520A (5 MP, 4 mm versions), Raspberry Pi Camera Module 3 / Wide / AI / bare Global Shutter CS body, RealSense D435i and Luxonis OAK-D Lite AF.

## FPV camera additions

Five further models provide 14 mm nano, 19 mm micro, open-PCB and digital camera options. These are camera-only procurement units; harnesses, adapter brackets, menu boards and video transmitters are excluded.

| Model                                                                                                  | Width × height × axial depth | Source-defined installation detail                                                                                           |
| ------------------------------------------------------------------------------------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [RunCam Racer Nano 4](https://shop.runcam.com/runcam-racer-nano-4/)                                    | 14 × 14 × 20 mm              | M2 side pivot 14 mm behind the lens tip, 6 mm from the rear datum; nominal smooth Ø2 bores, no modeled thread.               |
| [RunCam Robin 3](https://shop.runcam.com/runcam-robin-3/)                                              | 19 × 19 × 19 mm              | Outer envelope from the official specifications; side-bore positions and lens/body split are approximate.                    |
| [Caddx Ant](https://en.caddxfpv.com.cn/products/ant.html)                                              | 14 × 14 × 15 mm              | Exposed PCB and Ø9 lens from the official dimension illustration; no invented closed housing or undimensioned mounting bore. |
| [Caddx Ratel Pro](https://en.caddxfpv.com.cn/products/ratel-pro.html)                                  | 19 × 19 × 28.5 mm            | Ø15 lens; 26.8 mm lens-to-body extent plus 1.7 mm connector projection. Side bores and housing profile are approximate.      |
| [Walksnail Avatar HD Nano Camera V3](https://caddxfpv.com/products/walksnail-avatar-hd-nano-camera-v3) | 14 × 14 × 16.8 mm            | Camera only; compatible Avatar VTX and coaxial cable required. Side-bore positions and lens outer diameter are approximate.  |

The [Racer Nano 4 manual](https://store-m8o52p.mybigcommerce.com/product_images/img_RunCam_racer_nano4/Racer%20Nano4%20Manual_EN.pdf), [Ant drawing](https://en.caddxfpv.com.cn/app/template/images/product_ant/img11.webp) and [Ratel Pro drawing](https://en.caddxfpv.com.cn/app/template/images/product_ratel_pro/img10.webp) are recorded as per-model evidence. Authored solids are reconstructed from these dimensions and product images; they are not manufacturer CAD. Undimensioned mounting offsets, internal details, wall thicknesses and optical profiles need verification against the purchased camera before making a rigid mount.

Analog entries retain TVL without invented pixel counts or progressive frame rates. Avatar's 1920 × 1080 output is available up to 60 fps, while 120 fps uses 1280 × 720. Its proprietary camera link has a separate interface filter. Kit supply voltage, transmitter power, and a 160° FoV with unspecified axis are intentionally not assigned as camera-only numeric filters.

## Supplied DM and UC references

Seven supplied-reference selections cover the DM and UC families:

| Family       | Lens variants | Primary image interface        | Supply listed in supplied table |
| ------------ | ------------- | ------------------------------ | ------------------------------- |
| DM256        | 4 mm, 10 mm   | PAL/CVBS                       | 4.5–18 V                        |
| DM384        | 9.1 mm        | PAL/CVBS                       | 4.5–18 V                        |
| DM640        | 9 mm          | PAL/CVBS                       | 4.5–18 V                        |
| UC256, UC384 | 9 mm          | USB/UVC; USB speed unspecified | USB 5 V                         |
| UC640        | 9 mm          | CVBS + UART control            | 4.5–18 V on five-pin connector  |

The source photographs, tables and drawings are linked from each preset and included in package exports. The manufacturer remains unspecified: NCZOBOE branding appears on the UC illustrations, without establishing that the DM family is the same product. The supplied detector arrays are 256 × 192, 384 × 288 and 640 × 512. Lens focal length, vertical FoV, pixel pitch, NETD upper bound and reported thermal rate have separate filters. The reported 50 Hz does not establish progressive CVBS or USB output throughput; no radiometric temperature capability is inferred.

The reconstructed models include the layered 21 mm housing, visible board edges, scalloped focus ring, slotted lens retainer, convex optical envelope, eight blind radial mounting bores, cross-recess screw heads, rear PCB components and five-pin connector contacts. UC256/UC384 include a hollow USB-C shield and tongue. UC640 uses the five-pin interface from its table column; USB functionality is not inferred from a shared illustration. Exploded mode separates the layers and optics. Undimensioned internals, offsets, connectors and lens profiles are illustrative.

**Dimension conflicts remain visible:** the CV256-4MM drawing is not verified as a DM256 drawing. Its 31.7 mm body / 36.4 mm total are used only as a shape reference for DM256 4 mm. Other DM models use an illustrative 27 mm body / 31.7 mm total; the photo caption does not establish axial length. UC models use the table's 29.8 mm body with an assumed 4.7 mm connector projection, while the separate drawing marks 27 ±0.5 mm. Consequently, all seven total depths are excluded from sourced numeric filtering. These envelopes must not be used as verified mounting templates. UC M2 holes are represented as nominal smooth 2 mm bores, 2.5 mm deep; DM reference bores use Ø2 × 2 mm from the distinct CV drawing. The 12 mm pitch is retained; axial hole offset is estimated.

## Geometry and datums

X is width, Y is height and Z is the optical/assembly axis. The camera looks toward +Z; the foremost envelope is Z=0 and the rear is negative. The IP turret is represented with its optic aligned to the base axis; its housing orientation is fixed. Exploded mode separates optical and rear elements along Z. The exact scope of each assembly is listed in its model details.

One component description produces both Three.js and native FreeCAD geometry. Housings, PCBs, lens barrels, retaining rings, optical windows and connector envelopes export as separate colored solids. Electronics, lenses and undimensioned mounting profiles are approximate. These are reconstructed CAD models, not manufacturer STEP imports or drilling templates. Mounting holes are only supplied where identified; source-defined hole diameters do not imply verified offsets when those offsets are undimensioned.

Camera Module 3 uses the mechanical drawings (25 × 23.862 × 11.3 mm standard; 12 mm Wide depth) rather than rounded product envelopes. Its four Ø2.2 holes use X ±10.5, Y 2 and 14.5 mm from the bottom edge. The Global Shutter selection represents a bare 38 mm board/CS body and excludes the protruding tripod foot, 39.5 mm rear protective cover, lens, adapter and cap.

Ratel 2 has an assumed 20 mm axial depth which is excluded from numeric filtering. Baby Ratel 2 uses the illustrated 11.5 + 9 mm overall depth and M2 datum 9 mm behind the lens tip. Other undimensioned side-hole offsets and body/lens splits are approximate. The DJI entries contain only the camera module; their complete air-unit mass and supply voltage are intentionally not assigned to the camera.

## Specification semantics

- Analog TVL stays separate from digital pixel resolution. PAL/NTSC field timing is not labeled as progressive sensor FPS.
- Resolution and FPS refer to the declared primary channel; RGB, stereo and depth channel conditions are listed separately. A maximum frame rate is not necessarily available at the maximum resolution.
- Horizontal and diagonal FoV are separate. An unspecified FoV axis is retained as a note, not guessed.
- Lepton requires multiple supply rails and a socket/host; the published module-only mass is not assigned to the socket assembly. Its power values retain operating, shutter-event and standby conditions.
- MLX90640 keeps its real 32 × 24 resolution and the manufacturer's practical 16 FPS statement. Subpage refresh and interpolated display resolution are not sensor FPS/resolution.
- Reolink 12 V DC and active PoE are separate power interfaces. Specifications refer to the cited 5 MP / 4 mm revision.
- Omitted current, mass, voltage or dimensions are unknown/unassigned, not zero.

See `lib/models.json` and the selected model's source link for provenance. Local Pi drawings are stored under `public/references/cameras/` and included in package references.

## Validation

Run camera geometry/filter tests, targeted generic camera export tests, package checks and TypeScript checks. `scripts/verify-cameras.ts` generates both-state native cases; run them with `scripts/verify-cameras.py` using FreeCAD Python. The audit verifies one closed positive solid per component, agreement with preview bounds/volumes, no component intersections, independent component movement and STEP/FCStd round trips.

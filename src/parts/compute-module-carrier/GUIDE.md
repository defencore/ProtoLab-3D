# Compute module carrier boards

Bare purchased carrier boards for **Raspberry Pi Compute Module 5**. Find this family under **Electronics → Single-board computers → Compute module carrier board**, or search for `CM5`, `CM5IO`, `carrier`, `CM5-IO-BASE-A`, `CM5-NANO-A` or `CM5-NANO-B`.

| Model | PCB X × Y | Mechanical source |
| --- | --- | --- |
| [Raspberry Pi Compute Module 5 IO Board, revision 2](https://www.raspberrypi.com/products/compute-module-5-io-board/) | 160 × 90 mm | [Official revision 2 KiCad design archive](https://pip.raspberrypi.com/categories/1098-design-files), including footprint coordinates and connector reference models. |
| [Waveshare CM5-IO-BASE-A](https://www.waveshare.com/product/cm5-io-base-a.htm) | 85 × 56 mm | [Manufacturer STEP archive](https://files.waveshare.com/wiki/CM5-IO-BASE-A/CM5-IO-BASE-A-3D.zip), file `CM5-IO-BASE-A-20250225.stp`, and dimensioned product drawing. |
| [Waveshare CM5-NANO-A](https://www.waveshare.com/wiki/CM5-NANO-A) | 55 × 40 mm nominal | [Manufacturer STEP archive](https://files.waveshare.com/wiki/CM5-NANO-A/CM5-NANO-A-3D.zip), STEP dated 2025-03-13, and [dimensioned drawing](https://www.waveshare.com/w/upload/c/c9/800px-CM5-NANO-A-details-size.jpg). Original CAD surfaces retained. |
| [Waveshare CM5-NANO-B](https://www.waveshare.com/wiki/CM5-NANO-B) | 56 × 41 mm drawing | [Manufacturer STEP archive](https://files.waveshare.com/wiki/CM5-NANO-B/CM5-NANO-B-3D.zip), STEP dated 2025-03-13, and [dimensioned drawing](https://www.waveshare.com/w/upload/e/e6/800px-CM5-NANO-B-details-size.jpg). Original board CAD surfaces retained; the standard board excludes the fitted GPIO header of the source execution. |

Select the board model rather than resizing it. Choose the compute module separately from the **Raspberry Pi single-board computer** family, which includes the 32 CM5 RAM, storage and radio variants. The carrier presets contain neither a CM5 nor a cooler, inserted microSD card, M.2 drive, case or loose cables.

## Mounting datum

The PCB centre is XY(0, 0), with X right and Y up when viewed from above. Z=0 is the PCB underside. Mounting bores pass through the PCB. The IO Board and BASE-A reconstructions omit connector solder tails and GPIO tails below the PCB; NANO models preserve the geometry supplied in their STEP files, subject to the explicit GPIO-header exclusion below.

- **Official IO Board:** eight carrier mounting bores and four separate CM5 bores, all diameter 2.7 mm. The CM5 outline is rotated 90 degrees and centred at (20, 17.5) mm. Its four mounting bores are (3.5, −6.5), (36.5, −6.5), (3.5, 41.5), (36.5, 41.5) mm.
- **BASE-A:** four carrier bores on a 58 × 49 mm pattern and four separate CM5 bores on a 48 × 33 mm pattern, all diameter 3 mm. The CM5 outline is centred at (−6.95, 0.65) mm. The underside CR1220 holder, microSD socket and FFC connectors require clearance below the board.

The IO Board and BASE-A reconstructions show the two board-to-board sockets at their source positions and use a nominal 1.5 mm connector stack: a fitted CM5 PCB underside is 1.5 mm above the carrier PCB top. NANO source files omit the actual socket bodies; no complete stack or fit claim is made for those references. Actual connector execution and module/cooler height must agree with the selected hardware.

## Geometry scope

The IO Board and IO-BASE-A are lightweight **source-dimension reconstructions**. The repository contains authored geometry recipes and measured numeric references for those two models. NANO models use retained manufacturer BREP geometry with separate browser tessellation. Downloaded STEP files, inspection exports and reports stay under ignored `test-results/`.

For the IO Board and BASE-A reconstructions, PCB outlines, bores and major connector envelopes follow the selected source revision. Connector cavities, individual GPIO contacts, colours and undimensioned details are illustrative. Small components, traces, solder fillets and pin tails are omitted from those two models. The official IO Board includes ten measured STEP envelopes and five KiCad footprint XY envelopes with approximate component heights; its nominal 1.6 mm PCB follows the general KiCad field, while the source stackup export is 1.51 mm. Source connector bodies are seated on the nominal PCB face. BASE-A corner radius 3.5 mm follows CAD tangent geometry rather than a dimensioned radius callout. NANO geometry retains source details rather than these reconstructed envelopes. Native CAD evidence and limits are recorded per preset.

The official IO Board design archive retains its original component model licensing and notes that some reference models are approximate. Its source payload is not redistributed in this package. NANO source attribution, hashes, exclusions and verification are described below; their native JSON assets contain the retained source surfaces.

**Board** shows the installation reference. **Exploded** separates the PCB and fitted components for inspection; the source-dimension models use connector envelopes. These inspection separations do not create separate procurement units.

## NANO product identities and evidence

- `compute-module-carrier:waveshare-cm5-nano-a` identifies the standard CM5-NANO-A board.
- `compute-module-carrier:waveshare-cm5-nano-b` identifies the standard CM5-NANO-B board with unpopulated GPIO header pads. CM5-NANO-B-M is a different supplier execution and is not substituted for it.

Both models are fixed purchased boards. The only configuration field is **Board → Carrier board model**. **Board** and **Exploded** are inspection states of the same product; project installation normalizes to Board. The board, fitted components and contacts form one procurement unit. The CM5, cooling hardware, inserted cards, loose GPIO header, cables, battery and enclosure are excluded from the modeled installation.

**Both NANO models are incomplete manufacturer-CAD engineering references.** The official STEP files do not contain all major physical connector bodies:

| Model | Missing or incorrect source geometry |
| --- | --- |
| NANO-A | Both 22-pin MIPI FPC connectors and both 100-pin CM5 board-to-board sockets. Some connector references contain small passive-component placeholders. The microSD socket is a simplified single body. |
| NANO-B | RJ45 Ethernet, mini HDMI, microSD, both 22-pin MIPI FPC connectors and both 100-pin CM5 board-to-board sockets. USB-A, USB-C and the 16-pin PCIe FPC are present; the audio jack is simplified. |

The published interface counts describe the real product, not CAD completeness. Missing body dimensions and placement evidence remain unresolved. **Reported preview/export bounds cover retained source shapes and do not establish the complete installed board envelope or enclosure fit.** No guessed connector envelopes or undocumented internals are added. Resolve those interfaces from exact manufacturer drawings/CAD or measured hardware before design release.

The full-source face inventory equals the face inventory of all source solids (A: 21,473 faces; B: 41,903 faces before header exclusions). The importer did not discard open-shell connectors; the omissions and mismatched references are in the supplied STEP files. Mechanical reference labels also differ from the schematic labels, so they do not establish an electrical BOM revision. The alternate Chinese wiki archives are byte-identical to the English files; the focused search found no complete official PCB/CAD release. The local evidence record is `test-results/cm5-nano-sources/physical-model-coverage-audit.json`.

The manufacturer drawing gives NANO-B as 56 × 41 mm, while its sales specification says 55 × 41 mm. The CAD agrees with the drawing at approximately 56.003 × 41.019 mm; it is preserved without scaling. NANO-A CAD is approximately 55.019 × 40.018 mm versus its nominal 55 × 40 mm drawing. Catalog PCB dimensions follow the dimensioned drawing; reported model dimensions include only modeled overhangs and underside components. NANO mounting features are retained in the source PCB geometry; no separate dimensioned mounting-hole coordinate table has been established for these models. Empty reconstruction data fields do not assert that the source PCB has no holes.

| Source STEP | SHA-256 |
| --- | --- |
| `CM5-NANO-A.step` | `6a39316c42b75bd57b7a01651c6174a1287a447e1d9f833862d5c544928ddd26` |
| `CM5-NANO-B.step` | `d06dc1f14b2095aef56fd06abfc7b5920c7c8fa508e7b9b330b8f560e49b79fe` |

Waveshare supplies these mechanical reference files through the linked product wiki. The source ZIPs contain no separate license notice. Preserve manufacturer attribution and any upstream notices if the sources are refreshed. Source CAD does not establish production tolerances, the current hardware revision or electrical suitability. No undocumented internal geometry is added.

NANO boards do not provide the four large module mounting bores of the larger IO boards. Their source outline, edge recesses and plated holes remain in the imported PCB. The NANO-A source represents its microSD socket as one simplified body; undocumented contacts are not reconstructed. Both standard boards exclude the complete source `PI1` GPIO header to match the unpopulated product drawings: NANO-A excludes source-solid indices 252–311 inclusive (60 solids), retaining 277 of 337 source bodies; NANO-B excludes indices 270–389 inclusive (120 solids), retaining 417 of 537. The 40 invalid insulator solids in the NANO-B source belong to that excluded header; every retained board solid must pass the native validity check. No native source repair is applied.

The PCB bounding-box centre is XY(0, 0), and its underside is Z=0. Import applies only a rigid translation; it preserves component placements, dimensions and native surface types. Source-solid indices connect every retained body to the original STEP. Browser preview triangles are stored separately from compressed native BREP in `lib/nano-a/native.json` and `lib/nano-b/native.json`.

The browser tessellation uses 0.015 mm linear and 0.2 rad angular deflection. NANO-A needed no preview cleanup. NANO-B's USB-C source body needed eight removed preview facets and two small patches (maximum patch diameter 0.440 mm, maximum sampled surface deviation 0.00230 mm). These are preview checks rather than a global surface-error bound; the native CAD is unchanged.

## Verification of retained NANO geometry

| Entry | Retained solids | Native faces | Completed checks |
| --- | --- | --- | --- |
| `waveshare-cm5-nano-a` | 277 | 20,363 | Board and Exploded: valid closed source solids, matching source bounds/volume/surface types, unchanged face counts, STEP and FCStd round trips. |
| `waveshare-cm5-nano-b` | 417 | 40,983 | Same checks in both states; the complete optional header exclusion contains all 40 invalid source insulators. |

Independent verification executed all four final production macros, checked library/model/supplier identity and incomplete-CAD evidence through FCStd round trips, and proved that their geometry recipes were byte-identical to the recipes already compared with the original STEP. The final metadata checks reuse those unchanged source/STEP comparisons; they do not claim that those expensive comparisons were repeated after metadata-only edits. Reports pin the current macro, geometry-recipe, native-asset and source hashes under `test-results/cm5-nano-verification/`.

The package check covers all four family presets. Focused tests cover source index accounting, native/preview separation, preview bounds, fixed controls, visible limitations, exact-ID lookup and project identity round trips. Browser inspection confirmed both NANO selections, their standard unpopulated GPIO execution and the visible incomplete-CAD notice. These checks do not resolve the missing connectors or certify complete board fit.

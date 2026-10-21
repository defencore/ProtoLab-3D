# Raspberry Pi

Fixed models, selected by board format and source revision.

## Compute Module 5

The catalog includes the **32 stocked CM5 order codes** in the official datasheet release 3, table 12: 2/4/8/16 GB RAM, Lite/16/32/64 GB eMMC, with or without Wi-Fi/Bluetooth. Select an order code or narrow the catalog with RAM, eMMC and wireless filters. Lite has no eMMC package; its removable storage socket is on a suitable carrier. The CM5 module has no USB, HDMI or Ethernet sockets of its own. RAM capacities share the same reference package geometry; populated eMMC capacities share an envelope. Radio and storage options change the visible fitted components.

CM5 uses authored geometry based on the [official datasheet](https://datasheets.raspberrypi.com/cm5/cm5-datasheet.pdf) and [CM5R5 STEP design reference](https://pip.raspberrypi.com/categories/1096-design-files). It is separate from the Pi 5 and CM4 models. Both detail modes are reconstructed; Full detail adds illustrative contacts rather than manufacturer surfaces. Large component XY envelopes and connector locations were measured from the STEP. Package heights, connector cavities, contacts and antenna copper remain simplified. The original STEP and research reports stay in ignored `test-results/cm5-research`.

| Mechanical interface | Reference |
| --- | --- |
| PCB outline | 55 × 40 mm, R3 corners; nominal thickness 1.24 mm ±10% |
| Mounting | Four Ø2.7 mm clearance bores for M2.5 screws; 48 × 33 mm pitch |
| Hole centers, PCB centered XY | (−24, −16.5), (+24, −16.5), (−24, +16.5), (+24, +16.5) mm |
| Underside 100-pin B2B centers | (−2.5, −17) and (−2.5, +17) mm; long dimension runs along X |
| B2B body envelopes | 21.52 × 2.97 mm; lower bound Z = −1.11 mm relative to module PCB underside |
| Carrier PCB top to module PCB underside | 1.5 mm with Amphenol 10164227-1001A1RLF; 4.0 mm with 10164227-1004A1RLF |
| Nominal processor top above carrier PCB top | 4.94 mm or 7.44 mm respectively |

The coordinate origin is the module PCB center in XY and nominal PCB underside in Z. The source STEP uses an uncentered lower-left origin; subtract (27.5, 20) mm from its XY coordinates. Mounting centers are also explicitly listed in datasheet appendix A. The source STEP hash is `6adc64e5f69b2799b65d56c94b3543bad136fa4191cadaba0aa0e49fa345598f`.

The datasheet gives approximately 4.6 mm bare module depth, while the product page rounds to 4.7 mm. Nominal PCB/SoC heights combined with the measured connector envelope produce a 4.55 mm reconstructed solid depth; reserve the supplier clearance rather than treating this nominal model as a tolerance specification. Bare module depth and assembled carrier stacking height are different measurements. Keep the wireless antenna region clear according to the datasheet; cooler, carrier, antenna lead and mating hardware are separate purchased items. CM4 electrical compatibility is not implied by the mounting pattern.

`tests/compute-module-5.test.ts` checks the ordering matrix, real open mounting bores, connector orientation, carrier stacking references and the four fitted-component populations. The existing Pi 5 source geometry and default remain unchanged.

## Working with FreeCAD

**Model detail → Lightweight** is the default. Raspberry Pi 5 exports **20 bodies instead of 2,689**: the exact original PCB (including its mounting holes) and 19 named connector/package bodies. Each interface is one simple solid; GPIO contacts are represented by one combined envelope. USB and Ethernet openings remain visible, but their small contacts, tabs and internal faces are omitted. Large package positions and outer connector bounds come from the pinned source CAD. The overall board assembly bounds stay unchanged; individual cavity geometry is approximate. This is deliberately labeled as simplified source-derived geometry, not a complete manufacturer model.

**Full detail** restores all original Pi 5 STEP components and remains available in the detail selector and the full-detail preset. Zero 2 W and CM4 also use lightweight defaults, omitting separate contact pads, socket tongues and contacts (8 and 7 exported bodies respectively).

Validation: `tests/raspberry-pi-detail.test.ts` guards component, triangle and macro-size reductions, source PCB preservation and evidence labels. `scripts/verify-raspberry-pi-lightweight.ts` prepares native checks; `test-results/raspberry-pi-lightweight-validation.json` records the six assembled/exploded FreeCAD, STEP and FCStd round trips.

| Model | PCB X × Y, mm | Geometry scope |
| --- | --- | --- |
| [Raspberry Pi 5 — bare board](https://www.raspberrypi.com/products/raspberry-pi-5/) | 85 × 56 | Official Raspberry Pi 5 STEP dated 2026-05-27 (portal release 2026-06-11); all 2689 source solids, unchanged surfaces. 85 × 56 mm PCB; full CAD envelope 88.5 × 57.2 × 18.976 mm. No cooler or microSD card. Manufacturer supplies this reference without a guarantee of physical accuracy or current revision. Colors illustrative. |
| [Raspberry Pi Zero 2 W — unpopulated header](https://www.raspberrypi.com/products/raspberry-pi-zero-2-w/) | 65 × 30 | 65 × 30 mm PCB. Unpopulated 40-pin footprint; no soldered header or microSD card. Port offsets and component heights are approximate. |
| [Raspberry Pi Compute Module 4 — wireless](https://datasheets.raspberrypi.com/cm4/cm4-datasheet.pdf) | 55 × 40 | 55 × 40 mm compute module. Two underside 100-pin connectors require a carrier; USB/Ethernet ports are not fitted. Carrier, heatsink and antenna cable excluded. Nominal module depth 4.7 mm; mating assembly height depends on carrier connector. |

Full-detail Pi 5 uses manufacturer CAD, preserving source surfaces in FreeCAD exports. Lightweight mode preserves only the original PCB surfaces and simplifies the component geometry. Other models remain dimension-based reconstructions with approximate undimensioned components and connectors. See [manufacturer CAD sources and limitations](../../../docs/manufacturer-cad.md).

Preview templates are shared by repeated instances; each CAD component retains an independent transform. Source models, licences, importer and validation reports are documented in the linked audit. Source CAD is revision-specific and does not certify manufacturing tolerances.

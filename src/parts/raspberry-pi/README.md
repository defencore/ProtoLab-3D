# Raspberry Pi

Fixed models, selected by board format and source revision.

## Working with FreeCAD

**Model detail → Lightweight** is the default. Raspberry Pi 5 exports **20 bodies instead of 2,689**: the exact original PCB (including its mounting holes) and 19 named connector/package bodies. Each interface is one simple solid; GPIO contacts are represented by one combined envelope. USB and Ethernet openings remain visible, but their small contacts, tabs and internal faces are omitted. Large package positions and outer connector bounds come from the pinned source CAD. The overall board assembly bounds stay unchanged; individual cavity geometry is approximate. This is deliberately labeled as simplified source-derived geometry, not a complete manufacturer model.

**Full detail** restores all original Pi 5 STEP components and remains available in the detail selector and the full-detail preset. Zero 2 W and CM4 also use lightweight defaults, omitting separate contact pads, socket tongues and contacts (8 and 7 exported bodies respectively).

Validation: `tests/raspberry-pi-detail.test.ts` guards component, triangle and macro-size reductions, source PCB preservation and evidence labels. `scripts/verify-raspberry-pi-lightweight.ts` prepares native checks; `data/raspberry-pi-lightweight-validation.json` records the six assembled/exploded FreeCAD, STEP and FCStd round trips.

| Model | PCB X × Y, mm | Geometry scope |
| --- | --- | --- |
| [Raspberry Pi 5 — bare board](https://www.raspberrypi.com/products/raspberry-pi-5/) | 85 × 56 | Official Raspberry Pi 5 STEP dated 2026-05-27 (portal release 2026-06-11); all 2689 source solids, unchanged surfaces. 85 × 56 mm PCB; full CAD envelope 88.5 × 57.2 × 18.976 mm. No cooler or microSD card. Manufacturer supplies this reference without a guarantee of physical accuracy or current revision. Colors illustrative. |
| [Raspberry Pi Zero 2 W — unpopulated header](https://www.raspberrypi.com/products/raspberry-pi-zero-2-w/) | 65 × 30 | 65 × 30 mm PCB. Unpopulated 40-pin footprint; no soldered header or microSD card. Port offsets and component heights are approximate. |
| [Raspberry Pi Compute Module 4 — wireless](https://datasheets.raspberrypi.com/cm4/cm4-datasheet.pdf) | 55 × 40 | 55 × 40 mm compute module. Two underside 100-pin connectors require a carrier; USB/Ethernet ports are not fitted. Carrier, heatsink and antenna cable excluded. Nominal module depth 4.7 mm; mating assembly height depends on carrier connector. |

Full-detail Pi 5 uses manufacturer CAD, preserving source surfaces in FreeCAD exports. Lightweight mode preserves only the original PCB surfaces and simplifies the component geometry. Other models remain dimension-based reconstructions with approximate undimensioned components and connectors. See [manufacturer CAD sources and limitations](../../../docs/manufacturer-cad.md).

Preview templates are shared by repeated instances; each CAD component retains an independent transform. Source models, licences, importer and validation reports are documented in the linked audit. Source CAD is revision-specific and does not certify manufacturing tolerances.

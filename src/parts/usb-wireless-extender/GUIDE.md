# Wireless USB extender

Find **Wireless USB extender** under **Electronics → Electronics & Vision → Flight Controllers**.
The exact entry is `usb-wireless-extender:speedybee-f405-wing-mini-usb`.
This is the separate SpeedyBee service accessory used with F405 WING MINI,
not the controller's FC/PDB/standard-shield stack.

## Supplied source

Geometry is transferred from the user's current FreeCAD project at
`/Users/x/Documents/ChatGPT/FereCAD MCP/new_project_v2`.
The authoritative installed shape is component **326** in
`revisions/2026-10-11_M5/assembly_current/current_world/world_326.brep`.
Its seven-solid construction comes from `scripts/current_platform_access_geometry.py`;
the later `scripts/current_assembly_stack_geometry.py` retains it by a rigid placement.
Source hashes, original native BREP, selected frames and license status are retained
in `lib/source-evidence.json`. The upstream folder is not modified.

The source records a user-confirmed **24.5 × 21.5 × 7 mm** complete envelope and
**16 mm** mounting pitch. These are project fitting data rather than manufacturer
CAD measurements. The PCB is modeled as 1 mm, with two Ø2.7 bores at
X=9.45, Y=±8. The resulting 2.8 mm edge offset is explicitly photo-derived and
unresolved. PCB thickness, connector bodies, individual chips, radio, button and
underside SMD geometry are inherited assumptions. No unprovided ratings or
undocumented electronic internals are added.

## Frame and seating

Local XY is the PCB center. PCB underside is **Z=0**, top is Z=1. The underside
SMD reaches Z=-1.5 and the tallest package reaches Z=5.5. The matching current
lower platform has its bottom at local Z=0, base top Z=3, and integrated USB
support tops Z=5. Install this PCB at platform Z=5, rotate **90°** around Z, and
translate its center to **(7, -18.493901834347574)**. The latest source assembly
puts the platform underside at world Z=155, hence PCB underside at world Z=160.
Keep that occurrence placement separate from the standalone product geometry.

The source USB body is deliberately preserved as a solid installation envelope;
no assumed hollow receptacle or contact geometry replaces it. The matching
platform includes source connector and wiring openings. The source's proposed
12 × 15 × 8 mm straight plug does not fit its original tube/cuff context. Short
or angled plug access and actual cable bend space remain unverified; the
standalone board does not imply that the complete upstream enclosure fits.

## Identity and states

`assembled` is canonical. `exploded` separates the same seven visualization
solids without changing the supplied accessory identity or quantity. Chips and
connector visualizations do not become separately purchased units. Loose cables,
screws, nuts and the authored platform are excluded. Confirm the ordered kit's
contents before counting this accessory in addition to a complete kit.

Native CAD uses boxes, true cylinders and Boolean bores directly. Browser
tessellation is independent. Source/native comparisons, validity, bounds,
surface types, interference and STEP/FCStd reports belong under ignored
`test-results/recovery-electronics-transfer/`. Source fidelity does not establish
electrical function, production tolerance or mounting load qualification.

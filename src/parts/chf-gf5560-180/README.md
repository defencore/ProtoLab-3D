# CHIHAI GF5560-180 worm gear motor

Find **MOTORS & ACTUATORS → DC & INDUSTRIAL MOTORS → CHIHAI GF5560-180 worm gear motor**.

22 source-table presets distinguish 6 V and 12 V High Torque windings, 12 V and 24 V standard windings, reduction ratio, no-load speed and rated speed. The requested **12 V High Torque / 1:1400 / 11 rpm** preset is the default. Performance values are catalog attributes rather than inert geometry controls. Original kgf·cm torque values are retained because the supplied N·m conversion columns contain contradictions.

External dimensions follow the supplied drawings: 55 × 60 × 19 mm body, Ø8 shaft, 21 mm projection, 7 mm D-flat thickness, four Ø3.6 mounting holes. All stock presets use the explicitly specified 15 mm flat and round shoulder. A full-length flat is available as a custom geometry option. Shaft dimensions and flat clocking are editable. The motor terminals project 2.1 mm beyond the body.

The casting, removable cover, fasteners, formed motor can, brush cap, terminals, worm, three compound gears, output gear, journal pins, spacers and output sleeve export as separate physical components. A lightweight fit model omits the hidden transmission. Cover-removed, mechanism-only and exploded states expose the reconstructed internals.

**Internal gear counts and production tooth profiles are not published.** The visible four-stage transmission is a reference reconstruction, not an exact ratio-specific gear set. Its spur pairs use common module 0.5 and pitch-circle centre distances; the worm contact pocket is illustrative, not a production hobbed wheel. No manufacturer CAD, load verification or kinematic simulation is claimed. Shaft clocking changes the output flat, not the transmission phase. Motor electromagnetic internals and threads are simplified.

Sources are links, with no reference images/PDFs stored in the repository:

- [CHIHAI GF5560-180 D-shaft gearmotor](https://www.chihaimotor.com/wgjs/765.html)
- [User-supplied product listing, dimension drawings and performance tables](https://www.aliexpress.com/item/1005006022832826.html)

Native checks: `node --import tsx scripts/verify-gf5560.ts`, followed by `scripts/verify-electronics.py` with FreeCAD Python. Checks cover valid separate solids, intersections, preview/CAD bounds and volume, and STEP/FCStd round trips.

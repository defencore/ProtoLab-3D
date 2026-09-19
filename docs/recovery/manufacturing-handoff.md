# Nose release: FreeCAD and manufacturing handoff

Reviewed configuration: diameter 90/86 mm, MG996R, two vertical 18650 cells (2S), and F405 WING MINI. Related LiPo 2S/3S layouts use the same mechanisms. This is a geometric prototype, not a released manufacturing drawing set.

## FreeCAD document

The assembly is an `App::Part`; each physical component is a separate `Part::Feature` with solid BRep geometry. Expand the tree to hide parts, move them through Placement, select them, or export individual STEP files. These are solids, not STL meshes, but they do not have a PartDesign feature history. Saved Configuration parameters allow regeneration.

The Manufacturing property group contains:

- PartNumber for custom parts; ShapeDigest identifies the exact exported BRep.
- Procurement: standard hardware, supplied OEM hardware, custom manufacture, or printing.
- OrderDesignation, Standard, and SupplierSource for procurement.
- Material, ThreadCallouts, and ThreadFeaturesJSON for drawings.
- DrawingStatus: unfinished fits and tolerances are not represented as verified.

Do not rely on the RR number alone: include ShapeDigest and Configuration. The envelope in a label is the bounding box in assembly coordinates, **not a stock size or a complete drawing**.

## Fasteners

The current 2S layout uses standard M2×4, M2×5 and M2×6 countersunk 90° screws, M2×6, M2×8 and M3×12 socket cap screws, and an M3×8 button head screw at the servo output **subject to confirmation of the actual servo thread**. LiPo layouts also use M2×14 screws. Countersunk nominal length includes the head; cap/button head lengths are measured under the head. `fasteners.csv` records actual quantities, drive sizes, and order codes from the exported FCStd.

Geometry sources and ordering examples reviewed on 2026-09-18:

- [Accu SSK-M2-4-A2](https://www.accu.co.uk/countersunk-socket-head-screws/5404-SSK-M2-4-A2), [Accu SSK-M2-5-A2](https://www.accu.co.uk/countersunk-socket-head-screws/5405-SSK-M2-5-A2), [SSK-M2-6-A2](https://www.accu.co.uk/countersunk-socket-head-screws/5406-SSK-M2-6-A2): supplier designation ISO 10642, M2×0.4, head diameter 4.7×1.35 mm, 1.3 mm hex drive. Do not substitute an older DIN 7991 head without checking its seat.
- [Accu SSCF-M2-6-A2](https://www.accu.co.uk/metric-cap-head-screws/3792-SSCF-M2-6-A2), [SSCF-M2-8-A2](https://www.accu.co.uk/metric-cap-head-screws/3793-SSCF-M2-8-A2), [SSCF-M2-14-A2](https://www.accu.co.uk/metric-cap-head-screws/3796-SSCF-M2-14-A2): ISO 4762, fully threaded, head diameter 3.8×2 mm, 1.5 mm hex drive.
- [Accu SSCF-M3-12-A2](https://www.accu.co.uk/metric-cap-head-screws/3820-SSCF-M3-12-A2): ISO 4762, head diameter 5.5×3 mm, 2.5 mm hex drive, M3×0.5.
- [Accu SSB-M3-8-A2-BL](https://www.accu.co.uk/socket-button-screws/155051-SSB-M3-8-A2-BL): ISO 7380-1, head diameter 5.7×1.65 mm, 2 mm hex drive.
- [SpeedyBee official documentation](https://support.speedybee.cn/?a=p&d=SBFWC2&l=en&s=1000): M2×3.5 upper screws and M2×3+3 / M2×6.5 standoffs are supplied with the board. These are OEM hardware; substituting a larger screw head may obstruct the pin headers.

A2 identifies material. Specify strength class, tightening torque, and retention method from the loads and the selected supplier's certificate. Stock availability can change.

**The eight Retaining shoulder studs are custom turned fasteners**, not standard shoulder screws: M2.5×0.45, 2 mm thread length, diameter 2.8×5.1 mm shoulder, and diameter 5.4×1.6 mm head. Their geometry determines bayonet operation. They are classified as MAKE_CUSTOM_FASTENER and cannot be replaced by standard screws without redesigning the lock. Rod retaining rings and springs also have custom geometry; no standard or catalog part number has yet been confirmed for them.

## Controller isolation

The 2S controller uses four provisional custom Ø6 × 4 mm bonded silicone/metal dampers. Each has a lower female M2 insert and a separate upper M2 stud, with 1.1 mm elastomer between the metal ends. M2×4 countersunk heel screws engage only the lower ends. These dampers are not selected catalog hardware: compound, dynamic stiffness, bonding, allowable deflection and shock retention remain unspecified. The complete board stack is centered and rotated 180° in its mounting plane to keep the PLS wire corridor clear of the battery collars; configure its sensor orientation accordingly.

## Threads and drawings

CAD includes right-handed helical surfaces, including internal threads: M2×0.4, M2.5×0.45, M3×0.5, M7×0.5 (plugs), and M8×0.75 (barrels). `threads.csv` lists each axis and nominal tool length in assembly coordinates. This is **not an automatically measured engagement length**: tools may extend beyond the part. The 0.04 mm radial internal CAD clearance does not establish a 6H tolerance class.

To prepare drawings:

1. Select one manufactured part in the tree and run [SelectedPartDrawing.FCMacro](SelectedPartDrawing.FCMacro). Three orthogonal TechDraw views appear in a new document; the source assembly is unchanged.
2. Specify manufacturing datums, dimensions, tolerances, surface finish, chamfers/fillets, thread runouts, and allowable cutter radii. Use standard thread callouts; a helical surface does not replace a callout.
3. Add an axial section for turned parts showing shoulders, grooves, thread lengths, and drill depths. For disks, show pitch circles, angular positions, thicknesses, and boss sections.
4. Specify the final gear module, tooth count, pressure angle, backlash, and manufacturing process. This parametric model's module depends on tube diameter; availability of a standard form cutter has not been confirmed.
5. After interface checks and calculations, update DrawingStatus, assign a revision, and release PDF/DXF drawings with STEP files and the parts list.

Before release, confirm actual MG996R spline/output-thread dimensions, board outlines and holes, tube and cell diameters, thread engagement and stripping resistance, bayonet studs, springs, and rods under the specified loads. Initial nose mass and parachute extraction resistance remain parameterized assumptions. An interference check does not establish strength.

## Reproducibility

Run `scripts/export-recovery-handoff.py assembly.FCStd output-dir` using the FreeCAD Python environment to generate components.csv, fasteners.csv, and threads.csv, and check independent component movement and the barrel STEP round trip. The lists are extracted from the FCStd and therefore correspond to that particular export.

The vertical 2S FC uses four custom bonded elastomer isolators with separate threaded metal inserts. These are provisional fabrication items, not catalog fasteners. Specify the compound, bond process and tested load/deflection limits before releasing their drawings.

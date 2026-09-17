# Rocket Release Mechanism

Parametric reconstruction from the user's photographs: two selectable drive layouts turn an internally geared release disk. The original uses four independent gearmotors with 20-tooth pinions and an 80-tooth ring. The single-servo layout uses a central 20-tooth pinion, four fixed-axis 40-tooth idlers and a 100-tooth ring, matching the user’s diagram. Eight curved keyhole slots retain fixed headed studs. Four guided compression springs separate the upper disk and its attached tube after all eight large holes align with the stud heads.

The default tube is **OD80 / ID76 mm**. Editable tube sizes and 90/86, 100/96 and 150/146 presets are included for both layouts (eight presets total). This is a custom mechanism, not a catalog product or an original source CAD model. Cylindrical gearmotor envelopes are installation references without a manufacturer claim.

`Release sequence` controls position, not elapsed time:

- 0–60%: the disk turns to its unlock angle; the upper tube rotates with it. The four-motor pinions follow the internal gear ratio 80:20. In the single-servo layout, the input turns in the opposite direction at five times the ring angle; a 14° unlock requires 70° of servo travel. Each idler turns at 2.5 times the ring angle.
- 60%: all eight keyhole openings align; axial position is still unchanged.
- 60–100%: the upper section moves axially. Spring pushers extend only through the selected spring travel; their lower stops keep them on the fixed carrier.
- After spring travel: the remaining axial displacement illustrates separated position. No ejection velocity or ballistic trajectory is predicted.

The single-servo option includes a central MG90S nominal body envelope, two mounting ears oriented 45° between the idler axes with spacers and screws, a supported D-shaft adaptor, one input pinion and four retained idler spindles. Its 20:40:100 tooth counts satisfy both centre-distance closure and four-axis assembly phasing; the input starts half a tooth pitch (9°) out of phase. Servo internals and the spline interface are simplified. Nominal body reference: [TowerPro MG90S](https://towerpro.com.tw/product/mg90s-3/).

The model includes a windowed carrier, tube sleeves, eight retaining studs, the selected drive assembly, shafts, bushings, pinions, spring guide sleeves, captive spring pushers and fasteners. Assembly, cutaway, tubes-removed and mechanism-only views share the same named component geometry in the preview and FreeCAD export.

The upper sleeve is secured to the release disk with four screws; both follow the same rigid motion. Carrier walls and support decks are separate export components. `tests/release-mechanism.test.ts` checks the release sequence, eight-point alignment and parameter effects. `scripts/verify-release.ts` prepares cases for `scripts/verify-electronics.py`, including preview/native geometry comparison, component intersections and STEP/FCStd roundtrips.

Dimensions, motor envelopes, spring wire and mounting details are reconstructed. Threads, motor internals and cutter fillets are simplified. Spring rate, required torque, drive synchronization, structural loads and flight performance have not been established. The images remain outside the repository.

To audit one drive layout: `node --import tsx scripts/verify-release.ts /tmp/release-cases.json central-servo` (or `four-motors`), then run `scripts/verify-electronics.py` with FreeCAD Python and that cases file.

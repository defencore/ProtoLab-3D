# CNC worktable details

All geometry here is a dimensioned fabrication design. The supplier page establishes surface classes, not the factory profile section or mounting pattern.

The authored machine selects a 0.05 mm radial inspection allowance for its mounting-thread CAD. Standalone presets keep zero allowance. Both modes retain the nominal metric thread designation; this inspection setting does not specify an ISO tolerance class or tap-drill size.

The metal default is ten individually machined aluminium 6061-T6 slats, 100 by 1800 by 25 mm, separated by 0.5 mm. Each has two longitudinal T-slots: 8.5 mm opening, 14 mm cavity, 8 mm cavity height and 14 mm total depth. Insert the matched nuts from the open ends. Six underside mounting rows are spaced 300 mm, at Y -750, -450, -150, 150, 450 and 750 mm; each row has two M6 blind threads at X -35 and 35 mm, 8 mm deep. Mount on machined ribs using bolts from below. All quoted coordinates use the individual slat's local frame.

The fixed ribs must leave the coolant floor below their bottom faces. Side/end tray walls are individual bent sheet details with inward mounting flanges. Keep their sealing hardware and floor outside the moving lower gantry tiebar's swept volume. A drain does not by itself validate circulation, filtering or sealing.

The chipboard, recessed-track and vacuum options are library fabrication components for inspecting supplier option classes. They do not replace the default mechanically clamped metal surface. Vacuum force must be checked against actual workpiece area and cutting force.

Assign tolerances and datum planes in the detail drawings. Machine the installed slat tops coplanar and inspect table-to-axis alignment. The model does not promise the supplier's positioning accuracy.

The installed wet-metal tray can select explicit `ribPassages` in its side walls. Each is a rounded through-wall cutting feature around one stationary structural rib; the JSON dimensions retain the bent lower corner, upper strip and end ligaments. The assembly selects six 100.4 x 100.4 mm openings with R20.2 corners around the real 100 mm/R20 ribs. Apply a continuous coolant-compatible sealant bead after alignment and leak-test all penetrations. The clearance model deliberately leaves a 0.2 mm installation gap and does not prove sealed containment, adhesion, pressure rating or coolant compatibility. Ordinary library examples select an empty passage list.

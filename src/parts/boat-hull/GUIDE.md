# Configurable boat hulls

Find **VEHICLE STRUCTURES → BOAT HULLS → Boat hull**, then **Browse presets**. The 17 starting configurations remain editable. Hulls, midship covers and crossbeams export as separately named solids (one to eight components), with assembly, body-only and exploded states.

## Forms and controls

| Control group        | Options                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Arrangement          | Monohull; catamaran; trimaran with shorter/shallow outriggers; catamaran with a short central pod |
| Longitudinal form    | Displacement-style fine ends; semi-displacement-style fuller stern; planing-style broad transom   |
| Bottom section       | Flat; single-chine V; double-chine V; round; arched with upright sides; soft chine                |
| Section dimensions   | Length, overall beam, depth, section wall inset, deadrise and chine breadth                       |
| Hull lines           | Maximum-beam station, transom breadth, keel rocker, sheer rise                                    |
| Bow and stern        | Plumb, raked or spoon stem; bow and transom setbacks                                              |
| Multihull dimensions | Outer-hull and centre-hull beam, outrigger length/depth, mirrored inward keel shift               |
| Crossbeams           | Straight, raised centre, lowered centre or omitted; section size and centre rise/drop             |
| Construction         | Removable midship covers; open shells                                                             |

Changing the longitudinal form also sets a suitable starting bottom section, stern breadth, rocker and stem. These remain separately editable. Switching to a multihull increases overall beam when necessary to leave room for the hulls. Invalid combinations report a validation message.

## Presets

Fourteen geometric design templates: single-chine V monohull, flat-bottom skiff, round displacement hull, arched bottom, shallow double-chine V, deep double-chine V, semi-displacement hull, canoe, symmetric catamaran, asymmetric catamaran, raised-bridge catamaran, lowered-bridge catamaran, trimaran, and central-pod catamaran.

Three hobby-model envelope references: **Pro Boat Recoil 2 18 in**, **Pro Boat Recoil 2 26 in**, and **Joysway DragonForce 65 V8**. Only their published overall length and beam are source-verified. Their contours, depth, wall inset and construction details are editable approximations, not manufacturer CAD. The supplied hull-type diagrams guide the generic forms; they provide no product dimensions.

## Geometry and export

All dimensions are in millimetres. X runs from bow (negative) to stern (positive), Y spans the beam, and Z points upward. Z=0 is a reference for the sheer curve, **not a waterline**. Midship depth is measured from the local sheer; overall height also includes sheer rise and covers.

Seven longitudinal stations define the hull, with faceted sections and matching explicit closed boundaries in the preview and FreeCAD. The wall control is a section inset, **not constant thickness normal to the surface**. Asymmetry shifts the two outer-hull keels toward the tunnel while preserving their gunwale extents; deadrise describes the symmetric parent section. Covers follow the midship sheer with illustrative 0.2 mm clearance. Crossbeams sit 0.2 mm above the highest local sheer across their width; a lowered bridge is raised at the sides to retain clearance. They are layout references without mounting hardware. End bulkheads close the shell; narrow ends are truncated instead of terminating at a singular point.

These are geometric layout models. Displacement/planing labels do not establish buoyancy, stability, drag or operating speed. The model omits structural qualification, watertight joints, fasteners, rudders, motors, strakes, sailing rigs and external keels. More detailed hull lines and engineering analysis are required for construction.

## Verification

All 17 presets in all three states are checked for closed oriented preview meshes, valid positive FreeCAD solids, independent components, no volumetric intersections, preview/CAD envelope and volume agreement, and STEP/FCStd round trips. Parameter tests cover arrangements, distinct sections, actual length/beam, changes to hull lines, selector transitions and rejected invalid combinations. See [vehicle validation](../../../docs/vehicle-frames.md).

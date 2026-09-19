# Aircraft airframes

Find **VEHICLE STRUCTURES → AIRCRAFT → Aircraft airframe**. Use **Browse presets** to choose one of 15 starting points, or select the airframe configuration and edit its dimensions.

## Configurations

| Configuration | Structure | Controls shown in orange |
| --- | --- | --- |
| Conventional | High, mid or low main wing; conventional, V or T-tail | Ailerons / flaperons / separate flaps; elevator and rudder, or ruddervators |
| Glider | Slender fuselage, tapered wing; selectable tail | Separate flaps and ailerons, elevator and rudder |
| Flying wing | Wing centre section with equipment bay, swept panels, optional tip fins | Elevons for pitch and roll |
| Delta | Triangular wing, fuselage and vertical fin | Elevons and rudder |
| Canard | Foreplane ahead of the main wing, rear vertical fin | Forward elevators and main-wing ailerons; fixed foreplanes can instead accompany elevons |
| Twin boom | Short equipment pod, two tail booms, H-tail | Ailerons, elevators and two rudders |
| Tandem | Forward and aft lifting wings | Forward ailerons, aft elevators and rudder |

Changing the configuration sets a coherent starting tail/control arrangement and adjusts proportions where needed. Dimensions remain editable. Wing position, longitudinal root station, sweep, dihedral, taper, thickness, tail dimensions, control chord and hinge clearance are exposed. Controls are shown in neutral position as separate solids; there is no linkage, servo motion or flight-control simulation.

The nine generic examples cover high/mid/low wings, a T-tail glider, flying wing, delta, canard, twin boom and tandem. Six hobby references are included:

| Hobby reference | Verified dimensions | Source |
| --- | --- | --- |
| Flite Test Simple Cub | Span 956 mm | [Manufacturer page](https://www.flitetest.com/simplecub) |
| ATOMRC Dolphin | Span 845 mm, overall length 710 mm | [Manufacturer page](https://atomrc.com/products/atomrc-dolphin-overseas-fpv-rc-plane-fixed-wing) |
| FMS ASW-17 | Span 2500 mm, overall length 1390 mm | [Manufacturer page](https://www.fmshobby.com/products/fms-2500mm-asw-17-ep-glider-pnp) |
| Flite Test Versa Wing | Span 965 mm | [Official build plans](https://s3.amazonaws.com/plans.flitetest.com/stonekap/FT-Versa-plans.pdf) |
| Flite Test Viggen V2 | Span 25.25 in (641.35 mm), overall length 39 in (990.6 mm) | [Official V2 build supplement](https://www.flitetest.com/articles/ft-viggen-v2-build-supplemental) |
| Flite Test Bronco | Span 1086 mm | [Official build article and plans](https://www.flitetest.com/articles/ft-bronco-build) |

These are approximate geometric references to hobby designs, not manufacturer CAD or exact replacement airframes. Only the dimensions above are verified. Fuselage contours, wing profiles, mounting stations, foreplanes, tail and control outlines, hatches and wall thicknesses are design assumptions. Source overall length is used for the body envelope even though omitted items such as propellers can contribute to a product's published length. Product stock status is not tracked.

The ASW-17 uses a low horizontal tail, as shown on pages 1 and 4 of its [official manual](https://www.horizonhobby.com/on/demandware.static/-/Sites-horizon-master/default/Manuals/FMM129P-Manual-MULTI.pdf). The separate generic glider demonstrates a T-tail.

## Geometry and export

Millimetres; nose is −X, span is Y, up is +Z. A lightweight polygonal symmetric section is illustrative, not a specified NACA or manufacturer airfoil. Use **Wing and control surface** for detailed profile design.

Fuselages use hollow lofted sections and an open hatch. Flying wings have a centre equipment bay instead of a conventional fuselage. Section insets do not imply constant normal shell thickness. Main wings and tail panels are trimmed to the body; control gaps are geometric clearances, not hinge designs. Orange controls and grey fixed surfaces remain independent named FreeCAD solids. Assembly, body-only and exploded states use the same geometry in preview and export.

Models contain 7–15 major solids in assembly, without electronics, motors, propellers, landing gear, spar joints, fasteners or linkages. They are suitable for layout exploration; structural strength, stability and flight performance are not calculated.

## Verification

`tests/aircraft-layouts.test.ts` checks wing placement, distinct body styles, controls and invalid combinations. `tests/vehicle-frames.test.ts` checks every preset and state for closed oriented meshes and matching dimensions. The native FreeCAD report in `data/vehicle-frames-validation.json` checks independent positive solids, intersections, preview/CAD agreement and STEP/FCStd round trips.

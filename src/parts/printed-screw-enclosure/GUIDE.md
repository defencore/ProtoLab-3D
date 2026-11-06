# Printed enclosure with captive nuts

## Function and requirements

`printed-screw-enclosure` is an authored empty rectangular body and removable lid. Four sourced M3 screws close the lid against the body rim; four side-loaded hex nuts bear against printed boss roofs. The template provides real counterbores or countersinks, closed nut pockets with accessible horizontal entry paths, and fixed hardware dimensions. It contains no board, connector, cable, gasket or thermal layout. Application loads, polymer, printer accuracy, torque and service life remain unspecified.

Acceptance criteria are two connected printed solids; four exact library screws and four exact nuts; positive nut roofs, pocket floors and residual lid material; accessible nut insertion before closing; free lid removal after screw withdrawal; matching preview/native dimensions; and unchanged canonical composition across inspection views. No IP, seal, impact, load or cycle rating is assigned.

## Design decision and TRIZ record

The baseline is an open box or a screw through a loose external nut. The ideal final result uses the case geometry to locate and retain the nuts while permitting ordinary screw service from above. The contradiction is that hiding hardware improves exterior access and appearance but can make nut installation and replacement impossible. Resources are the empty cavity before lid installation, the corner material, side-entry space, standard screw geometry and the assembly sequence.

Spatial separation assigns head seating to the lid and anti-rotation/bearing to the body bosses. Separation in time uses the open cavity to install or remove nuts before closing the lid. A permanently embedded nut avoids an entry slot but complicates replacement; an all-printed thread avoids bought hardware but changes wear and torque limits; a top-loaded nut pocket with a closed roof would be impossible to assemble. The selected side-loading arrangement retains roof material without trapping inaccessible hardware. No numbered TRIZ principle or matrix entry is asserted.

## Library identities and source fidelity

The physical assembly has ten occurrences: `base`, `lid`, `screw-1`…`screw-4` and `nut-1`…`nut-4`. The two printing details reuse `manufactured-detail` with independent local recipes. Presets `socket-80-60`, `countersunk-80-60` and `socket-110-75` are authored design examples, not supplier products.

Purchased hardware is reused exactly from existing library configurations:

| Function          | Qualified library reference      | Source dimensions used                                                                                          |
| ----------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Socket screw      | `bolt-screw:gvyntok-040-190-006` | DIN 912 M3 × 12; head Ø5.5 × 3 mm; hex socket 2.5 mm; pitch 0.5 mm; length under head                           |
| Countersunk screw | `bolt-screw:gvyntok-040-070-005` | DIN 7991 M3 × 12; head Ø6 × 1.7 mm; 90-degree cone; hex socket 2 mm; pitch 0.5 mm; overall length includes head |
| Nut               | `hex-nut:gvyntok-474adfbe1cd7`   | DIN 934 M3; 5.5 mm across flats; 2.4 mm height; right-hand 0.5 mm pitch                                         |

Sources: [DIN 912 screw](https://gvyntok.com/shop/bolty-i-vinty/vint-tsilindricheskij-din-912-kl-pr-8-8/vint-czilindricheskij-din-912-kl-pr-8-8-m3h12/), [DIN 7991 screw](https://gvyntok.com/shop/bolty-i-vinty/vint-potajnoj-din-7991/vint-potajnoj-din-7991-m3h12/) and [DIN 934 nut](https://gvyntok.com/shop/gajki/gajka-sh-g-kl-pr-6-0-din-934/gajka-sh-g-kl-pr-6-0-din-934-m3/). Their existing preset evidence links supplier drawings and identifies verified fields. Remaining small drive/profile details retain the original library reconstruction limitations; no additional manufacturer-CAD accuracy is claimed. No new purchased product is invented or resized.

## Layout and screw stack

The body floor datum is Z=0 and the rim is Z=`height`. The flat lid underside is installed at the rim and its top is Z=`height + lidThickness`. Each square boss overlaps two adjoining walls by 1 mm. Boss centers are inset by `wall + bossWidth/2 - 1` from the outside faces. The central interior remains open between all four bosses.

The selected screw head top is `headTop=height+lidThickness-headRecess`. DIN 912 total modeled length is nominal under-head length plus head height; DIN 7991 total length is the published overall length. Therefore `tip=headTop-totalLength`. Nut bottom is `tip + 2*pitch`, leaving 1 mm of nominal screw projection below the nut, beyond the modeled tip chamfer. The thread's axial origin and nut bottom differ by two whole pitches. Equal clocking of both occurrences preserves that mating phase; native checks below verify compatibility rather than inferring it from arithmetic alone.

The configurator reconciles lid thickness when the head style, wall thickness or head recess changes. Its lower bound is `wall + headRecess + headHeight`; its upper bound is `totalLength + headRecess - 2*pitch - nutHeight - wall`, also bounded by the schema. A head execution is unavailable when no supported lid thickness can satisfy both bearing webs. If increasing the wall makes the countersunk execution impossible, the selected head changes to the supported socket execution. Directly editing lid thickness still reports an invalid stack when outside its physical bounds.

The installed nut top coincides with the pocket roof, representing the seated axial bearing position. The pocket extends downward by `pocketClearance` beyond the nut. Validation requires roof thickness and material beneath the nut pocket to be at least the chosen wall thickness; this is a geometric minimum, not a strength margin. The load path is screw head → lid seating face → body rim, and screw thread → nut → boss roof → body walls/floor. Actual preload, torque and creep are unqualified.

For socket screws, the flat counterbore floor matches the head underside. Its radius includes `headClearance`. For the countersunk execution, the conical seat follows the selected 90-degree head profile; a free cylindrical access pocket above the cone includes the radial allowance. Enlarging the cone arbitrarily would change its axial seating depth, so that is not used here. The residual lid thickness below either head seat must be at least `wall`. Both hex-drive access axes remain open above the lid.

## Nut insertion and service sequence

The hex pocket has across-flats size `5.5 + nutClearance`. The source nut has its first corner at 30 degrees; the installed occurrence is clocked -30 degrees so its vertices are aligned along X. Its full Y extent is then the source across-flats size, not its larger across-corners size. The screw is clocked by the same angle to retain the mating thread phase. These are assembly placements; no purchased dimensions or source geometry are changed. The horizontal entry slot has the pocket's across-flats width and pocket height. Its far half retains matching hex flats. Validation keeps the pocket/slot width below the nut across-corners size to preserve useful anti-rotation corner overlap. This is no torque rating.

1. With the lid removed and the cavity empty, lower a nut into the cavity at its Y coordinate and at half the pocket's vertical clearance below its installed position.
2. Slide it horizontally along X from the cavity center into its corner pocket. There is no passage through the smaller screw bore or through a closed roof.
3. Repeat for the other nuts, then place the lid and insert the four screws from above. Starting the screws lifts the nuts through the remaining half-clearance to their bearing roofs.
4. Tighten only to a torque qualified for the actual printed material and boss geometry. Remove screws and lid before sliding nuts back into the cavity for replacement.

An installed component, board or wire can obstruct this side-entry path. Lay out the actual equipment and preserve nut service space before treating this template as a device enclosure. An inspection exploded view alone does not prove that service remains possible after equipment is added.

## Printing and model states

`assembled` contains the two printed parts and eight standard hardware occurrences. `exploded` separates those same definitions for inspection. `print` shows only the two printing details, body floor down and lid flat underside down on Z=0, with an 8 mm bed gap. Any STL fabrication export excludes all metal screws and nuts; canonical project composition always retains all ten occurrences.

Print the nut pockets and inspect the short roof bridges over the side entries. Review bridging, perimeter continuity, support removal, first-layer expansion and pocket accuracy in the slicer. No universal shrinkage allowance or clearance is assigned. Print and measure a nut trap/head-seat trial before using a larger enclosure, then verify fit with the actual hardware.

## Verification and unresolved evidence

Focused checks cover schema/preset validity, exact hardware references, roof and seat-web inequalities, physical composition, canonical recipes across inspection states, print-only exports and bed contact. Integrated native checks must execute the production-generated macros, inspect individual valid solids and circular/conical/hex surfaces, test the side-entry paths against the real body, and check STEP/FCStd geometry/identity round trips. Reports and exports belong under ignored `test-results/`.

Integrated verification on 2026-10-31 passed 23 FreeCAD 1.1.4 cases: three examples, minimum/maximum screw-hole and nut-pocket allowances in all three states, and both head styles assembled in Full mode. All ten installed components were valid single solids without positive-volume intersections. Each assembled case passed 41 lid removal positions after removing hardware, plus 21 side-entry and 11 seating-lift positions for each of four real nut solids. Native conical countersinks, exact hardware preset identities, the two-part print-only layout, STEP geometry and FCStd geometry/identity round trips passed. Evidence and reproduction scripts are under `test-results/printed-enclosures/` and `scripts/verify-printed-enclosures.ts` / `.py`.

No physical printing, tightening, load, impact, creep, sealing or service-cycle test is claimed. For a real enclosure, specify the polymer/process, equipment interfaces, acceptable lid flatness, loads, torque, thermal behavior and service sequence, then qualify the configured design.

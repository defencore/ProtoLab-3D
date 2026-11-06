# Printed self-centering enclosure

## Function and criteria

`printed-self-centering-enclosure` is an empty printed base and taper-guided lid. The name describes lead-in-assisted alignment, not a zero-play precision coupling. Presets `guided-80`, `guided-60` and `guided-100` are complete editable authored examples. Both physical pieces use separately configured `manufactured-detail` recipes and stable occurrence IDs `base` and `lid`. The library location is Enclosures & devices → General-purpose enclosures.

Known requirements are a complete empty box, separate lid, four real planar lead-in faces, a straight final locating section, relieved guide corners, a separate planar insertion stop, explicit finite clearance, axial service access and separately printable single-solid parts. No contents, mounting interface, load, printer, polymer grade, tolerance, temperature, life or sealing specification was supplied. Lay out actual boards, plugs, cables, heat paths and fastening before finalizing an application enclosure.

Acceptance criteria are two valid connected solids; positive floor/wall/pilot material; at least 1 mm of straight guide after the taper; at least 1 mm between the inserted tip and the base floor; positive side clearance; accessible Z insertion/removal; matching preview/dimensions/native CAD; and physical identities unchanged in assembled, exploded and print views. These minimums are geometric example guards, not material allowables.

## Concept selection and TRIZ record

The baseline is a flat lid on an unlocated butt seam. The ideal final result uses the existing printed rim to guide the lid into place and stop insertion without extra alignment pins. A tight final pilot improves nominal location but raises the risk of binding from print error. A longer/larger taper increases capture reach but consumes interior space and guide length. Available resources are the cavity opening, lid material, gravity/manual insertion and the lid's freedom to translate laterally during entry.

Separate the taper's entry-guidance function from the straight pilot's finite-clearance location and the planar shoulder's axial stop. The four outside guide corners receive true cylindrical relief notches to reduce corner interference; this does not eliminate all redundant contact or warpage sensitivity. Compared with a stepped straight pilot, the taper accepts greater initial offset. A conical or three-contact kinematic locator could behave differently but would change the rectangular opening and contact design. A loaded taper with no clearance could center more tightly but needs preload, friction and tolerance checks that this template does not claim. A screw or snap can retain the lid separately; the pilot is not a lock.

This uses functional/spatial separation of entry, location and stopping functions with an explicit fit resource. No numbered inventive principle or matrix mapping is asserted. Method references are the [TRIZ Body of Knowledge](https://www.aitriz.org/triz/triz-body-of-knowledge) and [MATRIZ terminology](https://wiki.matriz.org/docs/triz/glossary-6146/).

## Layout and measurable alignment limits

The base floor is Z=0; the opening and stop are at Z=`height`. Outside dimensions are `width` and `depth`; the floor and walls use `wall`. The lid's flat underside is local Z=0 and is installed at Z=`height`. A hollow rectangular pilot descends by `rimDepth`, while its closing plate extends upward by `lidThickness`. Overall assembled height is `height + lidThickness`.

The base opening is `width - 2*wall` by `depth - 2*wall`. The straight pilot outside is smaller by `2*clearance` in both dimensions. Its nominal lateral translation allowance is therefore **plus/minus clearance** in either X or Y after seating. The exact centered position is not fixed by the clearance fit.

The lower pilot has four 45-degree lead-in planes. `leadIn` is both their axial length and per-side reduction at the tip. The geometric initial tip reach is plus/minus **clearance + leadIn** in each lateral axis, provided the lid remains free to move and the opening is unobstructed. The taper alone provides `leadIn` of correction range beyond the final-play bound. Actual guidance depends on friction, corner contact, orientation and motion freedom; the geometric reach does not prove that gravity will always center a printed lid.

The straight guide length is `rimDepth - leadIn`, and the tip must remain above the base floor by the validated margin. Corner relief is cut with four native cylinders at the straight pilot's outer corners. Relief radius must be less than half the pilot-ring thickness to preserve continuity. The guide taper is a hollow rectangular frustum with six intentional planar outer faces and corresponding planar inner faces. It is not a tessellated circular surface or a mesh-derived CAD shape.

Centered pure Z insertion remains clear throughout the stroke: the tip is smaller than the final straight pilot, and that pilot is already smaller than the base opening by the selected clearance. The broad lid plane stops on the top of the base wall. With lateral offset, contact on the lead-in can correct the position if the lid can move; no elastic or dynamic insertion simulation is claimed. Four long faces can still bind on a warped print. Keep the guide short, measure all mating dimensions and qualify the process.

## Printing and assembly

Print the base with its floor down. In the print state, the lid's outer closing face is down and the pilot grows upward; its outer taper then shrinks toward the top. Review inner and outer taper overhangs, corner notches, seam strings and first-layer expansion. No universal printer compensation is assumed. Check that the pilot opening, rim and any future board/connector arrangement provide actual assembly and cable access.

Insert along -Z, keeping the lid free to translate laterally while the taper enters. Seat its planar shoulder on the base wall. Lift along +Z to remove. Reserve at least `rimDepth` plus handling clearance above the enclosure in a host assembly. The pilot can be withdrawn freely and supplies no retention, gasket compression or sealing rating.

`assembled` uses canonical installed placements. `exploded` lifts the lid completely clear. `print` rotates only its occurrence 180 degrees about X, puts its flat outer face at Z=0 and separates it from the base by 8 mm. Recipes, quantities and installed project identities stay unchanged. No physical-state variants are declared.

## Verification and remaining evidence

Focused tests validate all three examples/states, unchanged two-part composition/recipes, preview/declared envelope agreement, separate bed contact, nominal capture and final-play equations, and rejection of missing guide length, floor clearance or corner material. Native checks must execute the generated macro, inspect two closed single solids and true planar/cylindrical surfaces, sample the centered extraction path and verify STEP/FCStd geometry/identity round trips. Reports and exports belong under ignored `test-results/`.

Integrated verification on 2026-10-31 passed 15 FreeCAD 1.1.4 cases: all three examples and minimum/maximum clearances in all three states. Each case retained two valid single solids and matching dimensions, bed positions and STEP/FCStd round trips. Each assembled case passed 41 centered withdrawal samples and 168 representative guided entry poses from eight lateral directions. Those entry paths assume freely permitted lateral correction and no friction; they do not establish contact forces or unique final centering. Final play remains the stated per-side clearance. Evidence and reproduction scripts are `test-results/printed-enclosures/native-report.json` and `scripts/verify-printed-enclosures.ts` / `.py`.

No printing, automatic-centering reliability, insertion-force, stiffness, strength, wear, creep, temperature, fatigue or ingress test is implied. Actual contents, application mounting and retention still need design and verification.

## Source basis

[Protolabs Network enclosure design guidance](https://www.hubs.com/knowledge-base/enclosure-design-3d-printing-step-step-guide/) supports component-first enclosure layout, alignment features and process-dependent tolerances. It is design context, not dimensional evidence for the authored templates. Source access was verified in the task on 2026-10-31.

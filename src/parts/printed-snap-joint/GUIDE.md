# Printed cantilever snap joint

## Scope and interfaces

`printed-snap-joint` is an authored, two-piece latch calibration sample, not a purchased product or a rated fastening. Its presets `compact-24` and `long-32` define complete examples; edited dimensions remain custom configurations. The arm and receiver each use a separately identified `manufactured-detail` recipe, occurrence IDs `snap-arm` and `snap-receiver`, with a printing manufacturing route. The receiver's floor bottom is Z=0. The beam runs in +X, its width is Y and its elastic lift is +Z.

Established requirements are two separate printable solids, a real mating hook and catch, positive relaxed clearances, accessible release, consistent preview/native geometry and unchanged component identities in inspection states. Material grade, printer, layer settings, working force, environment, dimensional capability and required cycle life are unspecified. The examples assume small elastic deflection for a nominal beam screening calculation. Print and qualify actual samples before incorporating this latch into a working assembly.

## Concept selection and TRIZ record

Function: retain an inserted arm against withdrawal while allowing deliberate release. The baseline is an external screw or adhesive. The ideal final result is for the surrounding printed material to perform retention and release without extra hardware. The useful interactions are catch-to-hook bearing and side-rail guidance; harmful interactions are insertion interference, root strain and print error. The conflict occurs at the hook while it crosses the catch, and at the beam root during lifting.

Increasing hook engagement improves geometric retention but increases insertion deflection. Reducing clearance improves locating precision but makes printed mating errors more likely to jam the connection. Available resources include elastic polymer, integral geometry, open receiver space, the exposed release tab and the user's assembly motion. Functional separation assigns lateral guidance to the rails and retention to the catch. Separation in time allows the beam to bend during insertion and release, then return to its neutral shape when engaged. These are proportionate applications of the [TRIZ Body of Knowledge](https://www.aitriz.org/triz/triz-body-of-knowledge) and [MATRIZ terminology](https://wiki.matriz.org/docs/triz/glossary-6146/); no contradiction-matrix entry or novelty claim is asserted.

Alternatives considered alongside the screw baseline were a rigid tongue-and-groove, a captured dovetail and an annular snap. The tongue-and-groove aligns without axial retention; the dovetail remains withdrawable along its slide axis; an annular snap introduces circumferential strain and more difficult release. The cantilever was selected for direct release access, a visible load path and a simpler strain estimate. It still requires elastic-material and cycle qualification. The library's existing project latches and `linear-stage:dovetail` mounting reference do not provide this reusable physical pair.

## Geometry, assembly and printing

Clearance `c` is **per mating side**, not diametral: each rail is `c` from the arm; the hook bottom is `c` above the floor; the relaxed beam is `c` above the catch; and the hook's retaining face is `c` beyond the catch face. Hook depth must exceed `c`, leaving nominal positive engagement `e-c`. A 45-degree lead-in ramp is part of the actual hook. The open receiver has no roof. Its floor, rails and transverse catch form one connected manufactured body.

Insert in +X. The ramp lifts the beam while passing the catch, then the arm relaxes into the assembled pose. Pulling in -X brings the retaining faces into contact after the axial gap is taken up. To release, lift the tab in +Z until the hook clears the catch and withdraw in -X. The tab extends at least 2 mm past the receiver. The open top provides the lift path. Side rails guide the coupon; the sample is not a complete constrained structural joint, and upward release is intentional.

The `assembled`, `exploded` and `print` states contain the same two recipes and quantities. `exploded` separates inspection poses; `print` places the receiver floor down and rotates the arm onto its side, both on Z=0. In the arm's print pose its beam length and bending plane lie in build XY. Review perimeter continuity, extrusion width, first-layer expansion and surface finish in the slicer. All fit values require calibration; the supplied clearances are authored examples, not universal FDM tolerances.

The user strain-screening limit changes acceptance screening only. It is excluded from physical product identity and does not change either fabrication recipe.

Both beam-root fillets have radius `r >= t/2`. Their quarter-circle surfaces are box-minus-cylinder webs, retaining true cylindrical surfaces in native CAD. The root anchor, beam, webs and hook are fused into one arm. The free beam length `L` is measured from the fillet tangent to the hook's rear retaining face; the anchor block and fillet region are excluded from that free span.

## Engineering screening and verification criteria

The conservative nominal strain screen models a constant rectangular cantilever with lift `delta=e` applied at the hook. Combining `delta=F L^3/(3EI)` with `epsilon=F L t/(2EI)` gives `epsilon=3 t e/(2 L^2)`. It excludes root concentration, shear, friction, rail contact, print anisotropy and fatigue. The modeled root is filleted but no local-stress solution is claimed. Require `L >= 10t` and `L >= 10e` for this small-deflection screen and compare its result with the explicitly **user-assumed** strain limit. This limit is not a material property.

The default `L=24 mm`, `t=1.6 mm`, `e=1 mm` gives **0.417% nominal strain**. The long example gives **0.410%**. No modulus, holding force, insertion force or safety factor is assumed. The load path in retention runs from hook to catch, then through the receiver floor/rails to whatever attachment a final application provides; those attachments are outside this sample.

Because the release tab extends past the hook, its displacement exceeds the hook displacement. For a uniform beam loaded at its tip, with `Lt=L+e+releaseTab`, `tabLift=e*2Lt^3/[L^2(3Lt-L)]`. The default estimate is **1.34 mm** for a full 1 mm hook lift. This predicts a motion scale; visually confirm actual catch clearance. Local contact and a real printed beam can change the required movement.

Acceptance checks are: valid two-single-solid native output; no collision in the relaxed assembled pose; correct native root radii and hook/catch dimensions; positive clearance and engagement; accessible insertion and release envelope; two disjoint bed-contacting print components; canonical library recipes and quantities unchanged by display states; and matching STEP round trips. An undeformed hook intentionally collides with the catch during insertion, so rigid translation is not an elastic-motion simulation. Physical insertion force, printed deflection, local strain, fatigue, wear and creep remain unverified until tested. Validate the final attached application and its motion envelope separately.

On 2026-10-31, FreeCAD 1.1.4 executed production-generated macros for both examples and the minimum/maximum clearance configurations in all three states (12 cases). The arm and receiver remained valid single solids with 13 and 14 faces respectively. Checks passed for relaxed assembled nonintersection, both exact cylindrical root radii, separate bed-contacting print poses, STEP round trips and FCStd geometry/identity round trips. An isolated native hook intersects the catch on undeformed withdrawal, demonstrating positive capture. Raising that hook by its full depth clears the receiver during 41 sampled withdrawal positions. This checks the hook/catch envelope only; it does not deform the beam or establish the actual release force or strain.

Reproduce with `node --import tsx scripts/verify-printed-joints.ts`, then run `scripts/verify-printed-joints.py` with a FreeCAD-enabled Python interpreter. Reports and exports remain under ignored `test-results/printed-joints/`.

## Source basis and limitations

- [Protolabs Network snap-fit design guidance](https://www.hubs.com/knowledge-base/how-design-snap-fit-joints-3d-printing/), accessed 2026-10-31: root stress, fillet and build-direction guidance; no universal clearance. The root radius rule informs the sample. A constant-section beam is retained for a transparent screening model; a graded production arm may need a tapered design and a matching analysis.
- [Formlabs snap-fit guide](https://formlabs.com/blog/designing-3d-printed-snap-fit-enclosures/), accessed 2026-10-31: process/material dependence, orientation and prototype qualification. It is design guidance, not dimension evidence for these authored coupons.

The implementation adds no purchased hardware and claims no manufacturer-certified dimensions. Completed repository and native-kernel checks are reported in the task handoff and ignored `test-results/` reports; the criteria above do not imply that an unreported check has been performed.

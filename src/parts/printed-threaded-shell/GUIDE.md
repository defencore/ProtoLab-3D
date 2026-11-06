# Printed threaded enclosure component

## Physical definition and source basis

`printed-threaded-shell` defines one manufactured physical part, selected by `model`: `body` is an open can with a male threaded neck; `cap` is a closed female threaded lid. The complete pair is `printed-threaded-enclosure`. There is no purchased item or reference-only thread-tool occurrence. Stable examples are `body-36-p3`, `cap-36-p3`, `body-48-p4` and `cap-48-p4`. Full qualified IDs combine this family ID and the selected example ID.

All dimensions are authored design examples. [Formlabs, adding screw threads to printed parts](https://formlabs.com/blog/adding-screw-threads-3d-printed-parts/), reviewed 2026-10-31, supports considering larger printed threads and process/material-dependent wear and fit. It does not establish these dimensions or a universal clearance. The actual reference profile reuses the repository's native thread SDK, not a new supplier designation, standard tolerance class or gauge claim.

## Layout and parameter contract

Units are millimetres; axis is +Z. The body floor rests on Z=0; its overall height is `height`. The external thread begins at `height-threadLength`. The body outside radius below the shoulder is `diameter/2+wall`. Its internal cavity radius is `diameter/2-17*sqrt(3)*pitch/48-wall`, so the smallest wall at the external thread root is exactly `wall`; the lower body wall is thicker. The closed floor is `floor` thick.

The cap's opening is at local Z=0. Its cavity depth is `threadLength+roofGap`, roof thickness is `roof` and outside radius is `diameter/2+clearance+wall`. `clearance` is added to the female cutting tool's radius only; it is a radial offset rather than a diametral tolerance or normal flank offset. The cap and male share a single-start right-hand helix and nominal phase. The female cutter begins one complete pitch below the mouth, maintaining that phase while ensuring a full opening. A planar shoulder establishes the assembled axial stop before the neck touches the roof.

The editable 60-degree truncated reference profile has axial crest width `pitch/8`, external radial depth `17*sqrt(3)*pitch/48` and female-cutter depth `5*sqrt(3)*pitch/16`. Roots and thread ends are sharp reference geometry; no fillet, lead-in, compliant fit or standard runout is implied. The user must qualify and, where necessary, refine those features for the actual print process and loads.

`model` is a physical design selector, not an inspection state. Only fields affecting the selected part enter its physical configuration identity. Changing cap roof/allowance settings does not redefine a body, and changing body height/floor does not redefine a cap. Switching a custom cap to a body reduces an incompatible wall to the nearest permitted schema step that preserves the 5 mm minimum cavity radius, and raises an insufficient body height to retain its floor and 5 mm of cavity below the neck. Other user settings remain unchanged. Both components print separately: the can floor down and the cap closed face down, with the opening upward. Review helical overhangs, seam placement, extrusion width and support removal in the slicer; no support-free manufacturing claim is made.

## Preview and native CAD

Functional helices remain in both **Simple** and **Full**, including `buildExportGeometry` used by the generic Simple STL export. A smooth envelope would remove the operating principle, so this package deliberately retains its essential geometry regardless of the global detail policy. The preview/export mesh is a closed indexed radial boundary with 128 angular samples and at least 48 axial samples per pitch. This mesh is used only for display and printing. It is not converted to native CAD faces.

Native Python always uses the shared `nativeThreadPython`/`nativeThreadExpression` analytic helical sweep and native cylinders, Boolean fusion and cavity cuts. All shell geometry and assembly placements remain dimension-driven. The sampled mesh follows the same phase/profile definition; native comparison must account for tessellation and the native swept-surface construction rather than assuming exact equality of mesh vertices and CAD surfaces.

## Checks and remaining evidence

`tests/printed-threaded-enclosure.test.ts` checks all shell examples in both detail modes for closed mesh edge incidence, positive volume, physical helical relief and matching dimensions. It also checks the pair's helical phase relationship, positive analytical radial allowance, physical identities and separate bed poses. Package checks verify schemas and registration. Native kernel validity, actual mating interference, shoulder and roof clearances, STEP/FCStd round trips and mesh/native agreement are separate checks reported by the integrated task.

Author-run native smoke checks on 2026-10-31 executed all four example macros in FreeCAD 1.1.4: each body was one valid closed solid with 19 faces and each cap one with 18 faces. Mesh/native volume differences were 0.0400–0.0405%. Both assembled example pairs had zero intersection volume, including 49 paired rotation/translation samples from zero to four turns. This is a geometric check, not a material or torque test. The smoke report is under ignored `test-results/threaded-shell-audit/report.json`; comprehensive round trips and further configurations belong to the integrated verification.

The independent integrated enclosure sweep subsequently passed 12 cases including both size examples and the minimum/maximum female allowances, in assembled, exploded and print poses. It confirmed single solids, real helical mesh/native agreement below 0.041%, screw-motion clearance, axial capture and STEP/FCStd geometry and identity. Evidence is under `test-results/printed-enclosures/`; see the parent enclosure GUIDE for the explicit geometric-equivalence check used when helical STEP volume integration changes slightly.

No actual printer/material tolerance study, insertion-torque test, strip-load calculation, local stress analysis, wear/creep/fatigue test, pressure test or ingress test has been performed. This is an authored engineering prototype, not a released container or a rated fastening. The parent enclosure must define equipment interfaces, loads and environment before application use.

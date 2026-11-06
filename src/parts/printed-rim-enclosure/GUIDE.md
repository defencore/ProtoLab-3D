# Printed rim enclosure

## Function and requirements

`printed-rim-enclosure` is a complete empty base/lid template with three distinct perimeter seam sections. It is an authored design, not a purchased enclosure. The six presets provide two editable examples of each construction: `stepped-80`, `stepped-60`, `groove-80`, `groove-60`, `labyrinth-80` and `labyrinth-100`. The physical parts are separate `manufactured-detail` configurations with stable occurrence IDs `base` and `lid`. Library location is Enclosures & devices → General-purpose enclosures.

Known requirements are a floor and four connected base walls, a separate closing lid, implemented recess/overlap geometry, explicit mating clearance, a positive planar insertion stop, axial assembly/disassembly and separate printable parts. Width, depth, shoulder height, wall/floor, closing plate, rim engagement and rim thickness are editable. No application contents, loads, polymer grade, printer, thermal environment, dimensional accuracy, retention force or sealing requirement was supplied. This empty template must be adapted around actual components, mounting datums, connector bodies and mating plugs, cables, service access and heat paths before it becomes a device design.

Acceptance criteria are two individually connected single solids; positive wall/floor/roof material; clearance on both sides and at the end of every mating projection; no body intersection during vertical insertion; correctly separated bed-contacting fabrication poses; matching native CAD, preview and dimensions; and invariant canonical physical composition in inspection views. The 1.2 mm minimum recess-side material is a sample geometry guard, not a universal printable or structural wall recommendation.

## Concept and TRIZ record

The baseline is an unsupported butt seam with external screws or adhesive. The ideal final result uses surrounding printed material to align the enclosure halves and overlap the seam without extra locating hardware. Useful interactions are rim-to-skirt lateral guidance and shoulder bearing; harmful interactions are print-error binding, consumed internal opening and the withdrawal space needed by overlap. Reducing clearance improves location but worsens assembly robustness; increasing overlap improves guidance/barrier geometry but consumes space and removal travel. Available resources are the perimeter wall material, the empty lid volume, the insertion direction and printed recesses.

Separate the planar axial stop from lateral mating surfaces and expose the fit allowance for calibration. The three alternatives retain the same base-envelope interface while implementing different geometry:

| Construction      | Physical seam                                                                           | Benefits and remaining limits                                                                              |
| ----------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Stepped rabbet    | Base lip at the cavity side; lid skirt outside that lip                                 | Simple printable open recess and broad outer stop; limited inner guidance, no latch                        |
| Tongue and groove | Central tongue in the base wall enters a real recessed perimeter channel in a thick lid | Guidance on both sides of the tongue; thicker lid and more material, no axial retention                    |
| Labyrinth         | Outer skirt plus a separate inner lid rib surround the base lip                         | Two-sided overlapping path and an open lid cavity; reduced access opening, no gasket or leak qualification |

A taper-guided lid is available separately as `printed-self-centering-enclosure`; an integral snap or screw closure adds retention but needs strain or hardware checks. No contradiction-matrix entry, numbered principle, novelty or strength claim is asserted. Method references are the [TRIZ Body of Knowledge](https://www.aitriz.org/triz/triz-body-of-knowledge) and [MATRIZ terminology](https://wiki.matriz.org/docs/triz/glossary-6146/).

## Layout, dimensions and fit

X is width, Y is depth and +Z is lid removal. The base bottom is Z=0; the base floor and walls have thickness `wall`. The planar shoulder is Z=`height`. A raised rectangular rim projects `rimDepth` above the shoulder. The lid's local underside is Z=0 and its canonical placement is Z=`height`. The total lid height is `rimDepth + clearance + lidThickness`, so total assembled height is `height + rimDepth + clearance + lidThickness`.

`clearance` is Cartesian **per mating side**, and also the axial clearance between the rim top and its recess roof. The shoulder remains in nominal contact; clearance does not lift the entire lid away from that stop. With wall `t` and rim thickness `r`, the stepped/labyrinth lip starts `t-r` inward from each outer wall. Its inner face coincides with the base cavity wall. The outer lid skirt has thickness `t-r-clearance`. The central tongue is inset `(t-r)/2`; its groove widens by `clearance` on both its inside and outside surfaces. The groove-side shoulders must retain at least 1.2 mm. The labyrinth's additional inner rib lies `clearance` inside the base opening and has thickness `r`; that rib reduces the clear access opening.

Switching rim construction automatically increases wall thickness and, when needed, the envelope/shoulder height to preserve the new section's minimum material and opening. Other dimension edits remain subject to the relational checks rather than silently changing unrelated controls.

The tongue-and-groove lid is physically thicker than a simple flat cover and closes the central cavity at its underside. The stepped and labyrinth lids enclose an additional raised lid cavity above the shoulder. These differences are actual material geometry, not renamed inspection states.

All mating walls are parallel to Z. With positive lateral gaps, every intermediate centered Z insertion pose has the same or less overlap than the seated pose. The open upper direction provides the assembly path. Keep at least the full rim engagement plus handling space free above the lid in a host installation. Reverse the translation to disassemble. These seams provide alignment/overlap; none supplies a latch, axial lock, gasket compression or IP rating.

## Manufacturing, assembly and state semantics

Print the base with its floor down. Print the lid with its flat outer closing face down so the recesses, skirts and ribs grow upward. Review first-layer expansion, stringing, removal of brim material from mating surfaces, sharp corner response and warpage in the slicer. Select walls, perimeters, infill and material for the eventual load path rather than assuming the example thickness establishes strength. Measure the actual printed rim and socket before printing a full loaded device.

`assembled` seats the lid on the shoulder. `exploded` translates it clear along +Z. `print` rotates only the lid occurrence 180 degrees about X and places it beside the base with an 8 mm bed gap, both on Z=0. Local recipes, quantities, manufacturing identities and canonical installed placements remain the same. No `physicalStates` are declared.

Install actual contents before closing the lid; ensure no board, connector, cable or fastener occupies the mating rim. Confirm finger/tool access and unobstructed lid entry/withdrawal. Add independently checked fastening when the application requires retention. A labyrinth overlap only lengthens a potential ingress path; it does not establish environmental protection.

## Verification and remaining evidence

The focused tests check every example in every implemented state, two valid registered component configurations, unchanged fabrication recipes, preview/declared bounds, separate Z=0 print poses, distinct seam recipes and relational rejection of lost wall/opening material. Native checks must execute the production-generated macros, inspect two valid closed solids, verify planar surfaces, clearance, intermediate extraction poses and STEP/FCStd geometry/identity round trips. Store reports and exports under ignored `test-results/`.

Integrated verification on 2026-10-31 passed 24 FreeCAD 1.1.4 cases: all six examples and minimum/maximum default-model clearances in all three states. Checks covered two valid single-solid parts, no assembled intersection, 41 axial removal positions per assembled case, separated bed contact, matching dimensions, STEP geometry round trips and FCStd geometry/identity round trips. Reproduce with `node --import tsx scripts/verify-printed-enclosures.ts` followed by `scripts/verify-printed-enclosures.py` in a FreeCAD-enabled Python. Evidence is under ignored `test-results/printed-enclosures/`.

No physical printing, fit, insertion-force, strength, warpage, creep, thermal, durability or leakage test is implied. Actual components and loads remain unresolved. The design is an empty adaptable template until those interfaces are established and the configured enclosure is verified.

## Source basis

[Protolabs Network enclosure design guidance](https://www.hubs.com/knowledge-base/enclosure-design-3d-printing-step-step-guide/) supports component-first layout, locating lips/lugs and process-dependent fit decisions. It does not establish these authored dimensions, a universal clearance or an environmental rating. Source access was verified in the task on 2026-10-31.

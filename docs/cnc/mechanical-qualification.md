# CNC mechanical qualification — current precision design

Reviewed on 15 October 2026. The implemented machine is a reinforced, independently dimensioned DIY design for D16T/duralumin and other nonferrous prototypes. Its complete finished-part tolerance target is **0.05 mm, or ±0.025 mm**, at the drawing datum and reference temperature. The provisional finishing load is 100 N; 300 N is a sensitivity case. Steel needs a separately accepted light-cut process. These are requirements and assumptions, not demonstrated performance.

The initial thin-plate, generic-screw and stepper arrangement has been replaced. The current design has actual source precision drives, linear feedback, steel load-bearing sections and a compact central Z head. It is still **unreleased for manufacture and powered operation**: CAD validity and finite clearance checks do not establish a working cutting process, joint stiffness, safe wiring or finished-part accuracy.

## Implemented structure and manufacture

| Load path         | Current actual design                                                                                                           | Manufacturing or release condition                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Fixed bed         | Two rounded 300 x 100 x 10 mm S355J2H RHS members, 2400 mm long; separate 30 mm lower flanges                                   | Machined datums, certified ordered section/radii, qualified no-slip flange transfer and foundation      |
| Worktable         | Six 1100 mm rounded 100 x 100 x 8 mm steel ribs, end inserts and compression sleeves; ten 40 mm aluminium T-slot slats          | Datum continuity, end-joint restraint, slot/bolt contact and workholding qualification                  |
| Moving portal     | 1375 x200 x200 x12.5 mm rounded beam, front datumY95; short100 x300 x8 mm RHS posts,25 mm Al flanges, separate integral T links | Machined end-face seating, cap/contact stiffness, tie preload, lower-link force transfer and squareness |
| Fixed Z tower     | One 380 x 550 mm U blank, 20 mm web and two 12 x 80 mm fins at X±183                                                            | One EN AW-6082-T651 billet; R5 roots, source rail/encoder datums and residual-stress inspection         |
| Moving Z saddle   | One 226 mm-wide U blank, 30 mm web and retained 80 mm fins; height follows the actual spindle/gauge                             | Central nut boss and explicit rear pockets machined from the same billet; six-millimetre front skin     |
| Z drive load path | Central X0/Y178 screw, 90 x 63 x 30 mm integral nut boss, actual BK15/BF15 feet on 5 mm steel shims                             | Source end drawing, fit land, tapped ligaments, flange/support alignment and preload                    |
| Z motor support   | Removable 380 x 110 x 20 mm top bridge, three real columns, separate structural and source thermal plates                       | Mount stiffness, access, source cooling condition, brake and servo commissioning                        |

The fixed tower bottom stays220 mm above the table. The central Z arrangement removes the former eccentric nut arm and remote lower-support platforms. The X encoder uses a separate1105 x12 x60 mm backing plate attached to the flat rear beam band; its whole vendor spar bears on that plate. The authored X nut bracket has an explicitR35 outside-corner relief. Actual native minimum clearances are17.58 mm to the shaft bore,12.96 mm to the nearest M6 flange-tap envelope,6.10 mm to the complete74 mm flange and32.07 mm to the upper rear anchor. Supplier geometry and generic bore-edge validation remain unchanged.

The stock sections use declared rounded corners, not sharp rectangular tube proxies. Selected steel/aluminium grades remain conditional on delivered certificates and actual stock availability. One-piece U blanks need stock allowance, tool access, machining sequence, datum inspection and residual-stress control. Long 2400 mm bed datums need suitable equipment or a released alignment process; this 1500 mm-travel machine cannot machine them all in one setup.

## Mass evidence and foundation

The preceding compact-Z/solid-cheek snapshot measured **381 actual frame/spindle-mount leaves**, deduplicated to72 native Simple macros. All measured shapes were single, valid, closed, finite positive-volume solids. This snapshot is preserved under `reinforced-structure/pre-boxed-portal/` and is historical after the boxed-portal/control redesign. With declared steel7850 and aluminium2700 kg/m³, its separately grouped frame/mount estimates were:

| Group                     | Estimated mass |
| ------------------------- | -------------: |
| Fixed frame/mount leaves  |      876.61 kg |
| Gantry-only frame leaves  |      266.63 kg |
| X-only frame leaves       |       36.12 kg |
| Z-only frame/mount leaves |        8.94 kg |

These are mutually exclusive groups, not cumulative axis masses or a complete-machine weighing. The corresponding earlier OEM/hardware calculation gave cumulative Y/X/Z estimates **354.30 /65.57 /16.95 kg** and sizing masses360 /70 /20 kg. Its per-leaf source assumptions remain in [precision drive selection](precision-drive-selection.md). The lighter portal must be recomputed from current source volumes before assigning new installed masses; historical sizing allowances are not a measured current mass.

The preceding boxed revision measured383 actual frame/spindle-mount leaves through71 native Simple macros (68 exact unchanged source/runtime records reused in that run). All were single valid closed positive-volume solids. Its mutually exclusive frame/mount groups were817.18 kg fixed,225.08 kg gantry,35.96 kg X and8.94 kg Z. This deliberately excluded other families, including the manufactured-detail control panel, worktable, standard hardware and bought equipment. These values precede the current foot/end-stock optimization and are not a current complete-machine mass comparison.

In that historical boxed revision, the enumerated gantry-only frame/mount group fell from266.63 to225.08 kg, including the added X-scale backing plate. Its narrower matched structural portal scope fell from252.34 to204.57 kg, excluding metrology accessories, standard hardware and purchased equipment. Exact row identities and density assumptions remain in `portal-redesign/mass-comparison.json`. The separately enumerated default control support changed from62.17 to6.76 kg (3 kW cradle variant8.33 kg); those records remain under `mounting/controls/`. They are historical CAD estimates, not current complete-machine masses.

Before the current end trimming, the 226 mm saddle was7.89 kg versus the original reinforced sidearm saddle's7.85 kg. Narrowing the central trial from240 to226 mm saved0.415 kg while retaining its R5 roots; a220 mm trial collided with eight real carriage bolt heads. With the smaller readhead adapter, the fabricated Z group decreased from9.16 to8.94 kg; the fixed tower decreased from17.93 to14.08 kg. Identical-ID native comparisons are in `reinforced-structure/compact-z/mass-comparison.json`. Its complete moving-Z estimate of16.95 kg versus17.14 kg describes that preceding snapshot. Current end-trimmed saddle evidence is separately recorded under `optimization/z-head/`; these historical masses must not be presented as current installed masses.

The current optimization compares the same actual fabricated details before and after:

| Matched scope                                                       |      Before |       After |           Reduction |
| ------------------------------------------------------------------- | ----------: | ----------: | ------------------: |
| Sixteen portal frame details, excluding standard/purchased hardware | 204.5702 kg | 198.9700 kg |           5.6002 kg |
| Default moving Z saddle, Simple CAD                                 |  7.89171 kg |  6.63983 kg | 1.25188 kg (15.86%) |

These density-based estimates use steel7850/aluminium2700 kg/m³. Do not add the reductions into a claimed installed machine mass: replacement M10 ties/nuts/washers are outside the portal scope. The fixed tower remains14.07719 kg. Exact configurations, original native volumes, executed scripts and hashes are under `optimization/portal/` and `optimization/z-head/`.

The portal keeps its primary beam/tiebar shapes and post-wall section. Narrower feet retain the actual guide/post/link bearing footprints; the thicker25 mm caps accompany shorter214 mm posts and cut M10 ties. An isolated axial-member comparison gives about1.19 times the former M8 bolt stiffness under its stated equal-material assumptions. It does not determine actual joint stiffness. Z keeps the rail/clamp/nut geometry and200 mm stroke while removing57 mm of end stock. Actual0.2 mm Simple slices at the clamp and guide rows retain their area and bending moments. Relocated M4 maximum-limit holes reduce moments in two nearby upper slices by up to0.66%; the record discloses this local change. Neither selected slices nor the axial-member proxy establish assembled torsion, joint behavior or the8 µm structural error allocation.

This is a heavy own design. The former 1006-piece thin-plate CAD and pre-central mass estimates are historical evidence, not current acceptance. Verify floor capacity, concentrated support reactions, leveling/foundation behavior and payload before installing the machine.

## What member screening establishes

The calculations use aluminium E=70 GPa and steel E=210 GPa. Actual delivered alloy, direction, temperature and assembled constraints remain unverified. The current formulas are in `src/parts/cnc-milling-machine/lib/qualification.ts`; broader independent portal/table/bed sensitivity evidence is retained under `test-results/cnc-milling/reinforced-structure/`.

| Independent case                  | 100 N displacement | 300 N sensitivity | Main assumption                                                                              |
| --------------------------------- | -----------------: | ----------------: | -------------------------------------------------------------------------------------------- |
| Moving U saddle, tool motion in Y |            1.09 µm |           3.26 µm | Rear-pocket section, ideal lower guide clamp and rigid spindle lever                         |
| Fixed U tower, tool motion in Y   |       0.71–1.64 µm |      2.12–4.91 µm | Separate clamped/free-rotation guide-row models over Z0/100/200                              |
| Central nut-boss strip, axial     |           0.035 µm |          0.105 µm | Short 21 mm strip; bore deduction, rigid interface; excludes local three-dimensional contact |
| One table rib, vertical           |            3.61 µm |          10.82 µm | Simply supported gross RHS section                                                           |
| Two equally loaded ribs           |            1.80 µm |           5.41 µm | Same support model and assumed equal sharing; slat deflection excluded                       |
| One slat plus two ribs            |            3.49 µm |          10.48 µm | Simplified 300 mm slat span and independent load sharing                                     |
| Previous solid-cheek portal, X    |    about1.7–1.9 µm |   about5.0–5.6 µm | Historical rigid-corner model; not the redesigned RHS-post/flange joint                      |

These are separate directions and poses. **Do not sum them into a claimed total accuracy or treat simplified support alternatives as rigorous bounds.** The proposed structural allocation is 8 µm for the complete loaded tool-to-fixture path, including guides, joints and supports. The member calculations do not prove that allocation. A coupled compliance model and actual loaded measurements are needed, particularly for the table, end joints, open U torsion and guide force distribution.

The selected beam's modeled rounded section after its front datum cut, before mounting holes, has area 7952.9 mm² and bending moments of area 47.17/40.79 million mm⁴. Its gross catalogue torsion value is not the machined, drilled value. The earlier 50–100% gross-J calculation is only a sensitivity exercise, not an established torsional range. Open-section Z warping, spindle offset and guide restraint also need a real three-dimensional load-path analysis.

Bed deformation changes with the gantry position and moving mass. A no-slip composite flange, a flange providing only its own bending contribution and an ineffective flange give different results. Common table/head sag can cancel part of a relative error, but local rib/slat flexibility, tube-wall contact, differential X reactions and joint slip remain. Record a position-dependent loaded tool-to-table map; do not subtract an ideal bed sag from the error budget without measurement.

HIWIN publishes HG20C radial stiffness for specified preload executions; the requested ZA reference is 460 N/µm. It is not lateral racking stiffness or complete mounted-machine stiffness. The central Y drive still transmits an off-center cutter load through separated guides. The Y feedback line is about 1060 mm from the opposite extreme cutter position: a 5 µm residual allowance corresponds to about 4.72 µrad yaw. A single scale does not observe that angular error.

## Threads, preload and real assembly

Positive modeled engagement and blind-hole tip reserve establish geometric fit only. They do not establish tensile/pull-out strength or a no-slip precision joint. Release bolt property class, delivered alloy strength, effective engaged thread excluding chamfer/runout, washer hardness, preload, tightening process and bearing-face flatness for each structural connection. Aluminium taps and the 8.5 mm nominal M6 support engagement need particular attention; a blanket one-diameter rule is insufficient.

[Bossard's engagement guidance](https://assets.eu.ctfassets.net/0vp0u5uh75zd/3wPlDC2XQOYT3XOdwCk6lz/9a9282ffd29746a7a7f6b0149509f1cf/052_Length_engaged_thread_Fastening_EN_01_2025.pdf) makes its trial-based values dependent on parent-material strength and screw class and requires a VDI 2230 calculation for exact design. Actual wall stock and load-bearing length matter. If the delivered material and required preload cannot justify a tap, specify a qualified insert, through-fastening or revised engagement on a released drawing; do not replace the calculated requirement with visual thread detail.

The configured 0.05 mm radial female-thread allowance separates ideal CAD flanks while preserving nominal callouts. It is an inspection-model allowance, not an ISO fit class. Source supports, nut adjustment and purchased matched sets need their maker drawings and prescribed assembly practice. Measured hand rotation, alignment and preload torque must precede powered travel.

## Feed, feedback, tool and thermal acceptance

The implemented Delta 750 W XY/braked-Z servos, HIWIN ground FDI sets, precision supports, R+W couplings and HEIDENHAIN feedback are described in [precision drive selection](precision-drive-selection.md). Source accuracy/preload executions and brake behavior are ordering/commissioning requirements until certificates and tests exist. A brake's static holding rating does not approve a dynamic stop. Linear feedback measures carriage motion, not cutter bending, spindle runout, workholding movement or angular error.

Default tool projection is 25 mm, selectable from 20 to 50 mm for geometry. A short, stiff qualified finishing cutter is necessary for the ±25 µm target. The root requirements use separate allowances for structure, position, thermal behavior, cutter, fixture and inspection uncertainty. Actual material expansion, coolant temperature, warm-up, spindle/collet runout and cutter wear must be included in each accepted process. Source spindle power and low feed do not establish steel-cutting torque or chatter stability.

Release the electrical design, protective bonding, overload protection, limits, following-error responses, STO/emergency-stop sequence, brake interlock, coolant/temperature alarms and guards. Current modeled controls and cooling units establish their recorded source envelopes, not a wired and validated safety system. Review the adopted [ISO 16090-1](https://www.iso.org/standard/81558.html) and [ISO 230-1](https://www.iso.org/standard/46449.html) requirements using their complete applicable editions; no compliance is inferred from public abstracts.

## Reproducible evidence and self-build handoff

The earlier1364-leaf assembly passed3390 Simple and3794 Full interference cases at its installed state and eight travel corners. Its raw source hashes `ebcb3da7515c4da9e45d0d12da0d7f235b9a5c4f226acc29a40a7658630ba29e` / `b9fb97acbcf3b654d12a6d6f377ea60e7983f2288d07e7f1070b57e40d9cd822` describe the preceding solid-cheek snapshot. They do not approve the redesigned portal, controls, metrology mounts or tray. Current complete-machine records retain exact runtime/configuration/source/CAD guards; use only records matching this revision. [Portal assembly](portal-assembly.md) describes the replacement joints and inspection sequence.

The current default assembly has1428 physical leaves. Both modes pass:3492 Simple and3849 Full native pair cases, zero installed/eight-corner collisions, and actual valid closed component solids. `assembly-native.json` retains exact source/runtime/configuration/CAD guards independently for each mode. Only a passed matching-source record supports the current revision. These finite poses do not establish continuous swept-volume clearance or joint strength.

The current portal fixture passes143 actual components,245 Simple/284 Full nearby pairs,11 structural and16 nut/washer/cap bearing contacts,8 hex-key and8 pre-beam socket paths, plus8 travel corners. All measured Common volumes are zero. Current Z evidence checks117 units per mode,8 positive bearing faces and the changed head/maximum-limit interfaces at Z0/100/200. It records457 Simple/460 Full positive-bounds cases, using261/262 fresh exact Commons and196/198 identical rigid-relative-pose reuses. All15 spindle/tool-gauge moving blanks are closed positive solids. Source/runtime/current-configuration guards and the preserved timeout attempt are under `optimization/portal/` and `optimization/z-head/`.

Earlier encoder/limit and tray fixtures remain bounded supporting evidence: their actual component counts, material-contact witnesses and executed source hashes are under `mounting/`. They must not be presented as acceptance of changed source. The retained readhead-ear fixture checks15 units per mode over9 poses and108 native pairs, including the actual added ear/head contact and six-millimetre M4 bores. The tray fixture records60 hanger-stack contacts; the bed/tray fixture records66 finite clearance cases. These scopes do not determine joint preload, sealing or finished-part accuracy.

The stock-slab auditor passes all six configurations: five Simple spindle executions and the default Full spindle, each at stock heights5/50/100/200 mm and9 XY positions, totaling216 finite poses. Exact source/runtime/configuration/CAD guards and results are in `workspace-native.json`. It translates actual native bounds before copying positive candidates, retaining the exact Common/topology tests. Its separate native equivalence proof compares12 actual installed shapes in36 poses (432 comparisons), including deliberate overlap and touching controls, under `workspace-broadphase/`. Fixtures, arbitrary holders and upward retract above200 mm stock are outside this envelope test.

The compact-head finite proofs establish fifteen actual moving-saddle configurations (five spindles at gauges 20/25/50 mm), native closure, actual height and six-millimetre skin witnesses. Eighteen actual nut/BK15/BF15-to-saddle cases cover Z0/100/200 in both modes with zero Common volume. The separate central-Z mounted-drive proof covers 34 installed components and 76 Simple/83 Full candidate pairs. Sixty-six actual bed/pad/tray/washer/foot checks cover the corrected rounded wall penetrations and both Y endpoints. These scopes complement the complete-machine checks; none establishes stiffness, wet sealing or machining accuracy.

Relevant artifacts are:

- `test-results/cnc-milling/reinforced-structure/compact-z/`: compact fixture source/configuration hashes, native records and current-source guards.
- `test-results/cnc-milling/reinforced-structure/frame-installed-mass.json`, `frame-volume-native.json` and its manifest: retained preceding fabricated-leaf estimates and density assumptions, superseded by the matched optimization scopes above.
- `test-results/cnc-milling/engineering/central-z-native-proof.json`: installed central drive fixture.
- `test-results/cnc-milling/engineering/precision-installed-mass.json` and `precision-drive-sizing.json`: OEM/hardware inputs, cumulative masses and drive calculations.
- `test-results/cnc-milling/assembly-native.json`, `Simple.FCStd` and `Full.FCStd`: separate complete-assembly execution records, source/checksum and finite installed/eight-corner interference coverage; only passed matching-source records support acceptance.
- `test-results/cnc-milling/assembly-simple-native.json` and `assembly-full-native.json`: separate actual run records retained behind the reconciled aggregate; Simple completion retains its guarded native log provenance.
- `test-results/cnc-milling/workspace-native.json`: six stock-envelope configurations and216 planned poses; accept only passed matching-source records, including default Full.
- Final assembly/workspace reports: only passed records matching the current geometry/runtime/CAD checksum may support a current claim. Earlier reports and whole-kernel diagnostics remain historical evidence.

Use the component tree or `scripts/export-cnc-build-draft.mts` to produce the current project, specification, procurement/manufacturing lists and separate macros. Regenerate it after changes; its old counts and CAD do not describe the compact redesign. A macro remains an editable inspection model. Produce released detail/assembly drawings, machining plans and inspection records before self-manufacture.

Software/build results describe their executed source revision. Optional native skips are not successful CAD executions; current native acceptance comes only from the guarded reports and explicit mounting proofs.

Acceptance must demonstrate the complete tool-to-fixture load response, bidirectional geometry/position, warmed-up thermal stability and representative D16T coupons at the center and workspace extremes. For every critical finished dimension, absolute deviation plus expanded measurement uncertainty must be at most 0.025 mm. Until that evidence exists, the design remains an engineering prototype with a target, not a certified or build-ready metal mill.

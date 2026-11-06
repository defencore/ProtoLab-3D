# Recovery electronics locating platform and disc

Library path: **Electronics → Electronics mounts → Module adapters → Recovery electronics locating platform and disc**. This family reproduces the user's current PEM recovery project. It does not replace the source design with the unrelated 20 mm module-adapter grid or configurable sliding PCB locks.

## Source and fixed physical models

The authoritative source is the current **R06** working assembly under `new_project_v2/revisions/2026-10-11_M5/assembly_current`, identified by its final `stack_contract.json`, `assembly_contract.json` and `native_assembly_audit.json`. The construction begins in `scripts/current_platform_access_geometry.py`; the later `scripts/current_assembly_stack_geometry.py` adds the lower platform's four edge notches and places the current search package. The earlier `search_platform_r06` and `search_platform_current` models are superseded. In particular, the current USB orientation is **90°** and its two supports are integral to the lower platform; separate source spacers 332/333 were retired.

The source folder was read without mutation. [Source provenance](lib/source-record.json) records the exact scripts, contracts and BREP hashes, original source designations/revisions, rigid localizations and source limitations. No license declaration was found in the inspected source instructions or current geometry sources; no additional license or manufacturer-CAD claim is assigned.

| Qualified library ID                                  | Physical detail                             | Source identity                                                                |
| ----------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------ |
| `recovery-electronics-mount:lower-platform-current`   | One integral lower platform                 | Source component 140; designation transliteration `PEM.03.03.001`, revision 06 |
| `recovery-electronics-mount:upper-clamp-disc-current` | One flat upper disc                         | Source component 248; designation transliteration `PEM.03.03.003`, revision 03 |
| `recovery-electronics-mount:gps-pad-159-current`      | One relieved compliant retainer             | Source 159; relief 0.072 mm³                                                   |
| `recovery-electronics-mount:gps-pad-161-current`      | One differently relieved compliant retainer | Source 161; relief 0.054 mm³                                                   |
| `recovery-electronics-mount:gps-pad-plain-current`    | One plain compliant retainer                | Same local physical geometry at source occurrences 160 and 162                 |

The original Unicode designations are preserved unchanged in the linked JSON source record; the table uses Latin transliterations.

The sole parameter group, **Component**, selects a fixed physical design. Each entry has one implemented `default` state. Model selections are separate physical products, not inspection poses. The two plain retainer occurrences reuse one model ID. The original ESKD designation, revision and source occurrence numbers remain linked source records; they are not replaced by library IDs.

The plates are authored manufactured prototypes. Their printing/cutting/drilling classifications are candidate routes, not approved manufacturing drawings. The lower platform needs a route capable of its integral walls and bosses; the upper disc can be cut from flat sheet. The pad presets explicitly use **reference** supply: the source lists unselected compliant consumable material, with material, contact pressure and compression unresolved. No purchased pad SKU, silicone grade, printing process or load rating is invented.

## Datums and geometry

Both plate models retain source X/Y at the tube axis and use their own underside as Z=0. The lower base is nominal **Ø81 × 3 mm** with **2 mm** locating walls. Its current four radial edge notches are 3.6 mm wide, beginning at R38.7, at 0°/90°/180°/270°. These reduce the actual bounding span to approximately 80.920 mm; the nominal circular stock diameter remains 81 mm. The upper disc is genuinely flat **3 mm** sheet, with no underside GPS feet, countersinks or bosses. Its two edge notches reduce its actual Y span similarly; its X span remains 81 mm.

Four **Ø3.3 mm** smooth through holes share **PCD72**, starting at **67.5°**, and remain source holes for candidate M2.5 posts. These are not M3 threaded holes. The lower platform's USB **Ø2.7 mm** through holes are 16 mm apart, with two integral **Ø4.5 × 2 mm** bosses joined to the locating wall by source ribs. The source's 9.45 mm X offset and mounting-hole locations derive from an approximately 2.8 mm photographic edge offset; they remain unverified against a delivered USB board.

Source locator inner sizes are **35.4 × 20.4 mm** for GPS, **26.4 × 17.4 mm** for JHE42B and **25.1 × 22.1 mm** for USB. The open wall sections, lower Ø18 wiring passage, buzzer wire slots, tie slots, upper 28 × 19 buzzer window, 24 × 2.5 wiring slot, two Ø5 passages and four relocated reserve holes are retained exactly. The locator geometry does not certify the actual device dimensions.

The GPS pad local frame is its 3 × 1 mm footprint centre, underside Z=0, height 8.7 mm. Exact source BREP surfaces are retained in `lib/pads-native.json`; only rigid localization is applied. The two tiny conforming reliefs are preserved rather than replaced with plain boxes. Their corresponding GPS contact geometry is itself an approximate source model. Retaining that source fit does not establish real compression or a safe contact land.

`lib/model.ts` exposes the analytic lower/upper source shapes, locator centres and hole axes. `lib/layout.ts` exposes source occurrence placements relative to the lower platform underside. In the current source, the lower underside is world Z155; the upper underside is Z168. GPS and JHE42B seating begins 3 mm above the lower datum; USB PCB underside is 5 mm above it, leaving 0.5 mm below the source's illustrative 1.5 mm underside SMD. GPS pad bottoms are at local Z4.3 and their tops touch the upper disc at Z13. Devices, pads and plates retain separate physical identities.

## Assembly, service and remaining evidence

Fit the devices into the lower platform's open locating walls. The USB board uses separate candidate M2.5×8 screws and underside nuts; the integrated bosses are not separate purchases. The four between-plate source posts are nominal M2.5×10 FF, AF5, with source occurrences 356–359. Their supplier, actual thread form and production identity are unresolved. Four candidate ISO 4762 M2.5×6 screws at source occurrences 372–375 enter from the upper disc, with nominal 3 mm engagement. The complete source's external M2.5×30 supporting posts are separate from this two-plate subassembly. Preserve access to both USB nuts and post fasteners before installing the upper disc.

The source uses four separate compliant GPS retainers between clear PCB edge lands and the flat upper disc. Material, preload, compression and the final installation order require a physical sample. Two purchased ties retain the buzzer through the existing source slots; their actual installed path is not modeled. Remove the upper disc and retainers before withdrawing GPS. Do not use the upper sheet as an invented rigid clamp directly against populated components.

The source explicitly leaves the selected USB cable unresolved: a nominal straight **12 × 15 × 8 mm** plug does not fit the surrounding tube/cuff. The recorded maximum straight length is approximately **6.474 mm** with the cuff, **6.174 mm** with 0.3 mm allowance, or **8.666 mm** for the bare tube. Use the chosen short/angled cable or verify access after removing the unit. The latest source buzzer top is world Z173, above the source tube end Z164.45; the mounting details are reproduced without silently changing that surrounding installation. Physical wiring, service clearance, material, tolerances, attachment loads, vibration and creep remain unresolved.

## Verification

The source comparison executed the current production macros for all five models. Every shape is one valid closed positive solid. The lower platform has **117 native faces**, the upper **28**, matching their exact current source models; native surfaces are cylinders and planes. Their symmetric geometric differences from source are **0 mm³**, with volume differences below 2.2×10⁻¹¹ mm³. The pad variants retain their source topology: **15 / 15 / 6 faces**, respectively, with zero symmetric difference. Plain source occurrences 160 and 162 have zero local symmetric difference and therefore reuse one physical definition. All five STEP and FCStd round trips passed, and the pinned source input hashes remained unchanged. Reports are under ignored `test-results/recovery-electronics-mount/`.

This is faithful reconstruction and source geometry verification. No TRIZ redesign, new mechanism, physical fit test, structural calculation or release qualification is claimed.

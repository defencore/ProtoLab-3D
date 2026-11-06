# Recovery electronics platform

Find **Recovery electronics platform** under **Electronics → Electronics mounts → Module adapters**.
Its fixed source layout is `recovery-electronics-platform:pem-current`.
It transfers the three modules and their mounting seats from the supplied
current FreeCAD project without changing their operating or retention principle.

The latest `assembly_current/stack_contract.json` with `final: true` is
authoritative. Older `search_platform_r03`–`r06` and `search_platform_current`
files have different seating details, USB orientation or separate spacers.
The shared `recovery-electronics-mount/lib/layout.ts` owns the current frames:
lower underside Z=0 corresponds to source world Z=155; upper disc underside
is Z=13. GPS and buzzer bottoms are Z=3, USB PCB underside Z=5. Source XY
rotations and centers remain unchanged. The latest four lower edge notches,
integrated USB supports, wiring passages and flat upper disc are retained.

## Physical definitions

| Source occurrence | Qualified library definition                          | Quantity |
| ----------------- | ----------------------------------------------------- | -------: |
| 140               | `recovery-electronics-mount:lower-platform-current`   |        1 |
| 248               | `recovery-electronics-mount:upper-clamp-disc-current` |        1 |
| 233               | `gps-tracker:zx908`                                   |        1 |
| 234               | `jhe42b-finder:jhe42b-project-reference-26x17x15`     |        1 |
| 326               | `usb-wireless-extender:speedybee-f405-wing-mini-usb`  |        1 |
| 159               | `recovery-electronics-mount:gps-pad-159-current`      |        1 |
| 161               | `recovery-electronics-mount:gps-pad-161-current`      |        1 |
| 160, 162          | `recovery-electronics-mount:gps-pad-plain-current`    |        2 |

The plain pad is one definition with two occurrences. The two tiny source
contact reliefs retain their own definitions. Modules remain complete units;
their chips and other visualization solids do not create extra procurement
rows. Standard JHE42B **23 × 17 × 17 mm** and JHE20B are separate products;
this assembly deliberately uses the upstream project's **26 × 17 × 15 mm**
occupied-box reference rather than substituting a different buzzer.

## Assembly and access scope

This is an engineering seating study. The source's supporting posts, USB screws
and nuts, upper screws and two buzzer ties are **excluded**, not replaced with
assumed catalog products. Their source positions and unresolved candidates are
recorded by the shared layout and mounting guide. The four separate GPS
retainers still require actual material and compression. No installed tie path
is inferred from slots alone.

The retained source installation sequence is: support the lower platform,
locate the GPS and buzzer in their walls, place the USB board on the two
integrated supports, install the actual chosen USB fasteners/nuts, arrange the
GPS compliant retainers at their clear edge lands, then install the flat upper
disc and chosen upper fasteners. The upper window leaves the project buzzer
protruding above the disc. Actual controls and sound outlet remain unmodeled.
Check nut/tool access before closing the surrounding structure.

The source USB straight-plug corridor does not fit its complete original
tube/cuff context. Short/angled cable access, removal sequence and actual wire
bends remain unresolved. Neither an assembled view nor source matching proves
retention, cable fit or a flight load rating.

`assembled` is the canonical layout. `exploded` adds inspection offsets to the
same nine occurrences; composition always returns source assembled placements.
Reported XY dimensions account for the disc edge notches rather than treating
the nominal Ø81 stock as an uncut 81 × 81 bounding box.

## Verification

Each owning package records its source hashes and geometry evidence. Plate and
pad native source comparisons belong to `test-results/recovery-electronics-mount/`;
GPS/JHE42B comparisons to `test-results/search-platform-components/`; integrated
library and native checks to `test-results/recovery-electronics-transfer/`.
The source folder remains unchanged. These checks distinguish exact geometry
transfer from unverified physical-module and installation assumptions.

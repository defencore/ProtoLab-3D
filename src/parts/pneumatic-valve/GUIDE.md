# Pneumatic valve

Path: Motion → Pneumatics & Gas → Valves & Air Preparation → Pneumatic valve.

## `pneumatic-valve:4v210-08-dc24v`

The selected supplier listing identifies the 4V210-08 5/2 execution, DC24V coil, Rc1/4 working ports and Rc1/8 exhaust ports. Manufacturer and ordered revision are unspecified. Geometry preserves the existing band-saw installation study: 22 × 85 × 32 mm body, 22 × 35 × 36 mm coil, 20 × 25 × 22 mm connector, three representative top bores and a manual-override cylinder. These dimensions, offsets, mounting faces and bore details are unverified. Exhaust ports, spool circuit, seals and mounting holes are not fully defined. Rc taper and qualified port geometry are not represented. The coil/connector are one complete valve procurement unit; external fittings, tube, silencer and mounting rail are excluded. Confirm the actual unit and interface drawing before using this model for mounting or pressure qualification.

Source: [selected supplier listing](https://prom.ua/ua/p2098352716-pnevmoklapan-elektromagnitnyj-4v210.html). Reviewed 2026-11-02.

The model selector preserves the physical execution and contains no editable dimensions. Only Assembled is implemented because no source-qualified separable inspection geometry is available. Analytic lines, cylinders and bores are preserved independently of browser tessellation. Installed band-saw occurrences reuse these definitions and retain their original placement; repeated instances do not create new product IDs.

Native CAD verification (2026-11-02), `pneumatic-valve:4v210-08-dc24v`: valid closed assembled shape with 4 solids and 27 faces, only planar/cylindrical surfaces; adopted bounds 25 × 120 × 58 mm. The combined STEP round-trip retained nine solids across all three control models. Integrated band-saw composition retains five valve, two AR2000 and one AFR2000 single-unit occurrences at the existing placements, including the unchanged pneumatic group offset. Reports and exports: ignored `test-results/pneumatic-control-verification/`. These checks establish adopted geometry consistency, not the unresolved supplier dimensions, gauge scope or pneumatic qualification.

## `pneumatic-valve:2vd0102-g1-4`

The selected [AMRtechnologi listing](https://prom.ua/p1913297936-drossel-obratnym-klapanom.html) identifies 2VD0102, G1/4 banjo one-way flow control, seller code 0891000003. The supplier photo shows a slotted adjuster, a hexagonal head, a waist with radial openings and two seals. The record is an engineering reference: its structured thread, material, temperature and pressure fields contradict its description, and no primary AZ cross-reference or dimensioned CAD/drawing was found. Numeric ratings and dimensions remain unknown.

The independent model is a coarse photo-based illustration with assumed Ø12 waist, 18 mm across-flat head and 30 mm length, not an installation envelope. These values must not define a mounting, thread, banjo, seal or pressure interface. The fixed model selector preserves this reference identity; no artificial variable dimensions or inspection states are added. Its explicit per-preset supply is reference, while the existing 4V210 execution retains its purchased profile.

The band-saw procurement table links two requested units to this qualified entry, but no flow-control geometry or installation position existed in the assembly. No occurrence or placement is invented by registration. Complete the source drawing, metering direction, banjo combination and installed interfaces before release.

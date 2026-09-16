# SRS airbag pigtail connectors

Fixed connector families in **Electronics & vision → Connectors & wiring**:

| Selection             | Published dimensional basis                                            | Scope                                                              |
| --------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| JST SQXW I / II / III | Female housing 26.05 × 13 × 10.55 mm; cover 26.05 × 13 × 6 mm          | Three illustrated mechanical keys and corresponding housing colors |
| Amphenol CA281A       | Length 5.2 + 22.3 = 27.5 mm; width 12.8 mm; height 6.5 + 6.7 = 13.2 mm | Right-angle family reference; rear body width 11.6 mm              |
| Amphenol CA282B       | Length 6.7 + 17.5 = 24.2 mm; width 14.9 mm; height 8.3 + 8 = 16.3 mm   | Straight family reference; body height 8.3 + 4 = 12.3 mm           |

Sources: [JST SQXW catalog](https://www.jst-mfg.com/product/pdf/eng/eSQXW.pdf), [CA281A](https://www.amphenol-auto.com/Uploads/file/20201019/1603095217709849.pdf), [CA282B](https://www.amphenol-auto.com/Uploads/file/20201019/1603095304291915.pdf). Manufacturer documents are linked remotely; PDF snapshots are not bundled.

The two-contact nozzle, cover, CPA, locking arms, wire comb and sockets are separate physical features. JST includes the dimensioned ferrite block. Amphenol interiors omit unmeasured ferrite/coil structures. Exposed straight lead length (0–150 mm) and insulation diameter (1.0–1.6 mm) are layout controls; zero lead length hides wires. Colors are illustrative, not electrical polarity. `exploded` separates components for inspection; offsets do not represent CPA actuation. JST's published CPA travel is 4 mm but no operating simulation is implied.

## Latch reconstruction

Each family now has its own retention geometry, following the front and side views rather than sharing one generic hook:

- **JST SQXW:** bowed side spring legs with outward retaining shoulders; stepped, ribbed CPA pressure pad, two outer guide fingers and a central profiled guide (catalog p. 2–3).
- **CA281A:** stepped service legs with outward barbs and tapered free ends; rounded transverse push-button CPA on the opposite side of the mating nozzle.
- **CA282B:** spring legs run along the mating axis, with outward shoulders and tapered tips; an upright rounded CPA tab has guide legs and raised grip ribs.

The latch roots join the housing, while their free ends have real clearance from the nozzle. Exploded offsets separate the complete CPA from the cover. Beam thickness, hook engagement and working clearance are still reconstructed, not dimensioned or mechanically validated snap-fit specifications.

## Evidence and limitations

These are reconstructions from public drawings, **not original manufacturer CAD**. Source dimensions are separate from reconstructed wall thicknesses, radii, key tolerances, latch details and contact interiors. JST publishes component dimensions, not the assembled stack-up; cover/CPA offsets are estimated. JST I/II/III have distinct illustrated key silhouettes, but the public catalog is insufficient to certify mating tolerances. Amphenol entries deliberately retain `XXXX XXXX` ordering suffixes and do not assert a particular key code or orderable SKU.

The supplied photos show related black/orange pigtails and separate retainers; they do not establish exact manufacturer identity or dimensions. No dimensionless retainer is presented as an exact part. These models support packaging/layout work, not fabrication or replacement of certified SRS hardware.

JST STEP/IGES links require an emailed application and acceptance of redistribution restrictions. No such application was submitted and no restricted CAD is bundled.

## Implementation

`lib/model.ts` supplies one constructive geometry definition for Three.js preview and FreeCAD solids. `presets.json` contains catalog evidence; `configurator.ts` exposes model selection and harness controls. `tests/srs-connectors.test.ts` checks catalog scope, geometry envelopes, contact openings and mesh topology. Native validation uses `scripts/verify-srs-connectors.ts` with `scripts/verify-electronics.py` and stores results in `data/srs-connectors-native-validation.json`.

## TE Connectivity AK II

The supplied brochure `1-1773944-9` (06-2018) provides two separately dimensioned connector families:

| Variant | Contacts | Length | Width | Height |
| --- | ---: | ---: | ---: | ---: |
| AK II, 90° | 2 | 21.0 mm | 13.0 mm | 14.9 mm |
| AK II, 90° | 3 | 21.5 mm | 15.0 mm | 15.4 mm |

Both have CPA locks, ferrite suppression and 0.35–0.50 mm² wires. The brochure specifies a socket for a Ø1 mm pin for the 2-way version. It does not fully dimension the nozzle, keys, latch or contact positions; these are illustrative. The 3-way contact arrangement is not certified. Colors do not specify coding or electrical pinout.

The brochure number is not an orderable connector SKU. Ordering codes depend on mechanical coding, harness and OEM. AK II+ appears in the family heading, but no distinct dimensioned AK II+ connector is supplied, so it is not duplicated as a separate geometry. The separate 1823640 retainer is not part of either connector model.

The source PDF is preserved at `public/references/srs-connectors/te-akii-akii-plus.pdf`. Both models support assembled and exploded views, and zero-length leads omit wires.

# Manufacturer CAD sources

Native geometry supplements the source-dimension catalog. A valid CAD solid and a sourced SKU are separate claims from a faithful replica. See the [whole-library evidence audit](model-fidelity-audit.md).

| Model | Original | Revision / coverage |
| --- | --- | --- |
| ST3215 / ST3215-HS | [Waveshare STEP archive](https://files.waveshare.com/upload/5/59/ST3215-3D.zip) | Supplied ST3215 mechanical file linked by the HS product. Eight solids. Rear cover internal void shifted 0.00001 mm to repair topology; exterior retained. Optional single horn is a constructed accessory. |
| Raspberry Pi 5 | [Official product information portal](https://pip.raspberrypi.com/categories/892-raspberry-pi-5) | No-graphics STEP, file dated 2026-05-27, published 2026-06-11. 2,689 solids, no cooler/card. PCB 85 × 56 mm; total source envelope 88.5 × 57.2 × 18.976 mm. |
| Adafruit Feather nRF52840 Express | [Adafruit 4062 CAD directory](https://github.com/adafruit/Adafruit_CAD_Parts/tree/main/4062%20nRF52840%20Feather) | Source product name: Rev D. The upstream filename says `52830`, but its directory, STEP product header and official guide identify 4062/nRF52840. 61 solids. CAD PCB 50.8 × 22.86 mm, height 6.99 mm; rounded sales-page values 51 × 23 × 7.2 mm are kept distinct. |

## Reproducibility

Run `scripts/import-electronics-cad.py` with FreeCAD Python and either `feather` or `pi5` followed by the original STEP path. Extract Pi 5 from `public/references/electronics/raspberry-pi-5-step.zip`; Feather is in `public/references/electronics/feather-nrf52840-rev-d.step`. Input SHA-256 values are pinned in the importer and repeated in the catalog, baked assets and generated FreeCAD macro.

The importer preserves source CAD surfaces. It groups geometrically equivalent, centered solids only after a bidirectional CAD subtraction check (combined residual volume below 1e-8 mm³). Instances retain their source transforms and independent CAD objects. It does not reconstruct holes, connectors or SMD components from estimated dimensions.

Browser preview uses triangulated surfaces with 0.015 mm linear and 0.2 rad angular deflection settings. OpenCascade produces a few microscopic mesh slivers/gaps on button and connector fillets. Preview-only cleanup records removed facets, collapsed edges below 0.002 mm, and hole patches below 0.5 mm diameter with sampled surface deviation below 0.015 mm. These are meshing checks, not a certified global Hausdorff error bound. Exact CAD export is not made from this mesh and does not contain these patches. Colors are illustrative; silkscreen graphics and manufacturing tolerances are not modeled.

Raspberry Pi explicitly supplies the STEP as guidance without guaranteeing accuracy or currency; a source CAD file does not certify every physical revision. Feather is explicitly Rev D, not an assertion that all later boards share its details.

MIT notices are retained beside each package's native geometry: `src/parts/raspberry-pi/lib/pi5/LICENSE.txt` and `src/parts/nrf52840/lib/feather/LICENSE.txt`.

## Source comparison

`scripts/verify-manufacturer-cad.py` executes a production-generated macro in a temporary FreeCAD document and compares each component with the pinned source STEP. It checks valid closed solids, bounding extents, volume, and boundary fingerprints. Where rounding or equivalent seam representations differ, it compares corresponding surface samples, unchanged BREP data with its source transform, or bidirectional solid subtraction. Surface sampling is not an exhaustive proof over every point of a curved surface. STEP and FCStd round trips are checked separately.

The case JSON contains `script`, `parameters` and `state` from the current production generator. Validation reports record the script and source hashes, comparison methods and tolerances; a different hash requires new verification. Older `electronics-native-validation.json` results describe the earlier procedural board models and do not certify these replacements.

For example, prepare Feather with:

```sh
node --import tsx scripts/prepare-manufacturer-cad.ts nrf52840 adafruit-feather-nrf52840 /tmp/feather-case.json
```

Then run with a FreeCAD-enabled Python interpreter:

```sh
python scripts/verify-manufacturer-cad.py nrf52840 feather public/references/electronics/feather-nrf52840-rev-d.step /tmp/feather-case.json data/feather-source-validation.json
```

For Pi 5, use family `raspberry-pi`, preset `raspberry-pi-5-full`, native folder `pi5`, and the STEP extracted from the retained official ZIP.

Recorded assembled-state checks:

| Model | Source comparison | STEP / FCStd |
| --- | --- | --- |
| Pi 5 report (`../data/pi5-source-validation.json`, generated locally) | 2,680 matching boundary fingerprints; 9 additional boundary/surface-sampling comparisons. Maximum source bounding-coordinate difference 0.0000001 mm. | Both passed; all 2,689 solids retained. Maximum STEP solid-volume drift 0.000103 mm³; summed solid-volume drift 0.000098 mm³. |
| Feather report (`../data/feather-source-validation.json`, generated locally) | 61 matching boundary fingerprints. Maximum source bounding-coordinate difference below 0.000000000001 mm. | Both passed; all 61 solids retained. Maximum STEP solid-volume drift 0.000754 mm³; summed drift 0.001685 mm³. |

STEP reparameterization changes numerical mass integration slightly, particularly on small filleted components. Compare corresponding solid volumes; the compound's integrated volume can differ from the sum of its solids. The verifier checks component bounds to 0.00001 mm and bounds per-solid volume drift by surface area times the stored CAD tolerance. Feather's source/restored maximum CAD tolerance is about 0.00984 mm; this is a source-file tolerance, not measured manufacturing accuracy. The recorded Pi run also passed the stricter per-solid relative-volume threshold of 0.000001 and aggregate drift below 0.001 mm³. These reports supplement the original-source provenance; they do not certify every physical production unit.

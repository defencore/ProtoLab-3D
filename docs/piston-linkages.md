# Pistons and connecting rods

Two independent packages appear under **TRANSMISSION & LINKAGES → PISTONS & CONNECTING RODS**. Each folder owns its configurator, presets, geometry, validation and FreeCAD recipe.

| Package          | Purpose                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| `piston`         | Hollow skirt pistons for compressor and engine layouts, plus pneumatic disks with an axial rod connection |
| `connecting-rod` | Small and large end eyes, shank, optional bushings and bearing shells, and a removable big-end cap        |

## Reference evidence

The three supplied images are preserved unchanged in `public/references/`:

- `piston-compressor-sizes.png` lists nominal sizes **42, 47, 48, 51, 65, 70, 80 and 90 mm**. These eight values are the only source-verified dimensions. The screenshot does not specify a running clearance or measured skirt diameter.
- `connecting-rod-anatomy.png` identifies a small-end bushing, rod body, bearing inserts, big-end cap and fasteners. It supplies no dimensions.
- `piston-rod-exploded.png` illustrates three piston rings, a hollow wrist pin, retaining clips and a split-cap connecting rod. It supplies no dimensions.

Catalog selection uses the explicitly named compressor family and verified nominal piston sizes. A pneumatic disk does not match a compressor listing merely by sharing its diameter. Select **Custom dimensions** to change the construction to engine or pneumatic. Heights, groove and ring sections, pin fits, clearances, rod dimensions and pneumatic examples are editable prototype settings. No supplier interchangeability or manufacturing tolerance is inferred from a nominal size.

For a piston with a wrist pin, **compression height** means crown-to-pin-axis distance; it differs from the total piston length. This terminology follows [MAHLE's piston descriptions](https://www.mahle-aftermarket.com/na/en/products-and-services/engine-components/light-vehicle/pistons/). A pneumatic disk instead uses an axial connection to its rod, as illustrated by [Festo's piston rod cylinders](https://www.festo.com/gb/en/c/products/actuators/pneumatic-cylinders/piston-rod-cylinder-id_pim215).

## FreeCAD and independent editing

Use **Assembled**, **Exploded** or the body-only state to choose the exported arrangement. Run **Copy Python** in FreeCAD's Python console, or download the macro. Expand the created assembly in the FreeCAD tree to select, hide or move its rings, pins, bushings, shells, cap and fasteners separately. The piston and rod modules generate separate components; they do not impose assembly constraints or simulate a complete engine.

Edit `src/parts/piston/` or `src/parts/connecting-rod/` without changing the other module. For a portable developer handoff:

```sh
npm run parts:export -- piston /tmp/piston-handoff
npm run parts:export -- connecting-rod /tmp/connecting-rod-handoff
```

Return and import one complete handoff with `npm run parts:import -- /tmp/piston-handoff --replace`. Folder discovery regenerates the library registration automatically.

## Verification

```sh
npm run parts:check -- piston
npm run parts:check -- connecting-rod
node --import tsx --test tests/piston.test.ts tests/connecting-rod.test.ts
node --import tsx --test --test-name-pattern='Piston|Connecting rod' tests/parts.test.ts
npm run typecheck:tests
npm run build
```

An optional native audit compares individual preview component envelopes with FreeCAD solids, checks for component interference, verifies independent movement, and round-trips representative assemblies through STEP and FCStd:

The recorded native audit (generated local report) contains **78 passing cases** in FreeCAD 1.0.2: defaults and all 20 presets in three states, plus four construction transitions in three states. The transition cases include a 20 mm engine piston and a compact rod changed to a split cap.

```sh
node --import tsx scripts/verify-piston-linkages.ts /tmp/protolab-piston-native.json
/Applications/FreeCAD.app/Contents/Resources/bin/python scripts/verify-piston-linkages.py /tmp/protolab-piston-native.json /tmp/protolab-piston-native-results.json
```

Use a FreeCAD-enabled Python on other platforms; `FREECAD_LIB` overrides the module path. Native FreeCAD remains optional and is not required by GitHub Pages builds. The checks establish valid prototype geometry, not operating pressure, combustion temperature, lubrication, fatigue life or seal performance.

# Piston

This independent package contains the compressor, engine and pneumatic piston configurator, reference presets, geometry and FreeCAD recipe. Edit `configurator.ts` for controls and defaults, `presets.json` for source records and examples, and `lib/piston.ts` for the assembly construction. `lib/solids.ts` provides private shape descriptions shared by the preview and Python generator. No other part package is imported.

## Geometry and dimensions

The body axis is Z; the hollow wrist pin runs along X. **Compression height** measures from the crown face down to the wrist-pin axis. **Overall body height** is independent. Running skirt diameter is the nominal size minus diametral clearance. Changing the piston type initializes a coherent dimension set scaled to the retained nominal size. The inner boss-face spacing is `running diameter - 2 × skirt wall - 2 × boss extension`; this is the available connecting-rod space.

Compressor and engine bodies have an open skirt, a continuous crown and two internal wrist-pin bosses. Select a flat or recessed crown. External grooves receive separate split rings with configurable side and back clearance. The transverse pin has a through bore; two separate C-clips locate its ends in recessed boss grooves. Pin bores, grooves and ring/clip profiles are simplified prototype geometry.

Pneumatic disks use an axial rod bore and separate circular-section O-rings. These are uncompressed seal envelopes, not production pressure-lip profiles or a squeeze calculation. The assembly dimensions include seals and rings that project beyond the running body diameter.

**Assembled**, **Exploded** and **Body only** views use the same component definitions. Preview direct children and FreeCAD components preserve the same order, names, positions and centering. The piston body is fused into one solid, while each ring, seal, pin and clip remains separately movable. A bounded cache retains at most 32 immutable component meshes; each displayed model receives its own geometry clone.

## Reference evidence

Eight presets transcribe nominal 42, 47, 48, 51, 65, 70, 80 and 90 mm listing options from `references/piston-compressor-sizes.png`. `variant: compressor` records the explicitly named product family. `nominalBore` is the only source-verified dimensional field, as a nominal listing label used for the layout. Catalog choices include the family so a pneumatic disk cannot qualify as a compressor catalog match merely by sharing its diameter. Switch to **Custom dimensions** to choose engine or pneumatic construction. The source does not establish a measured cylinder bore or running skirt diameter. All heights, clearance values, bosses, groove sections and pin dimensions are editable prototype estimates scaled from the default 65 mm example.

`references/piston-rod-exploded.png` supplies assembly anatomy without dimensions. The dished engine and pneumatic presets are unsourced prototype examples. No production alloy, tolerance, thermal growth, pressure rating, oil-drain drilling or sealing performance is inferred.

## Checks

```sh
npm run parts:check -- piston
node --import tsx --test tests/piston.test.ts
```

Focused tests validate all presets and states, closed outward component meshes, component and assembly bounds, open bores, crown continuity, export labels and invalid wall/pin configurations. Execute the generated macros in FreeCAD when changing construction; TypeScript checks alone do not validate the CAD kernel.

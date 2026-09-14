# Connecting rod

This independent package models a rod between two parallel Y-axis bores. The big-eye center is at the origin and the small-eye center is at Z = `centerDistance`. Center distance is independent of the outer length. Preview and FreeCAD retain this same origin and component order.

`configurator.ts` owns controls/defaults, `presets.json` owns prototype examples, `part.ts` owns assembly layout/validation and `lib/shapes.ts` owns private shape recipes. The package imports only the public SDK and installed modeling libraries. Copy this whole directory for a handoff.

The big end can be a one-piece eye or a removable split cap. Shank construction is solid, I-beam with front/back pockets, or H-beam with side pockets. The pockets stop short of both eye housings. Eye widths and wall thicknesses are independently editable.

`smallBore` and `bigBore` are the **finished working bores**. With inserts enabled, housing diameter is working diameter plus twice insert thickness and twice `fitClearance`. Removing inserts from the construction produces a plain working bore. The small-end bushing and upper/lower big-end bearing shells are independent physical components.

For split rods, cap bolt lugs, through bores and recessed seating faces are part of the manufactured rod/cap. Bolts and nuts remain separate components. Their threads are smooth envelopes. In assembled state, clearances avoid overlapping component volumes; exploded state separates the same items without changing their geometry. Body-only state exports only the manufactured rod body, so a split big eye is open.

The supplied anatomy and exploded illustrations contain no dimensions. Every preset is an editable **prototype example**, without catalog metadata or verified size claims. There are no oil channels, bearing locating tangs, forged blends, balancing targets or strength certifications.

Geometry caching is bounded and private; each displayed component receives its own mesh/material to keep state changes responsive and avoid disposal side effects.

```sh
npm run parts:check -- connecting-rod
node --import tsx --test tests/connecting-rod.test.ts
npm run typecheck:tests
```

Execute the emitted macro in FreeCAD after changing shape construction; a browser mesh test alone does not validate the CAD kernel.

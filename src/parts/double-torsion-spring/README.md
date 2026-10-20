# ProtoLab part package

This package follows the same editing and export workflow as every component in the library. Its stable ID and display name are defined in `index.ts` and `part.ts`.

## Package files

- `part.ts`: metadata, validation, preview geometry, FreeCAD recipe, and dimensions, directly or through private helpers.
- `configurator.ts`: catalog selection controls; scaffolded packages also define their parameter schema and defaults here.
- `presets.json`: complete preset parameters and source evidence.
- `product.json`: explicit product type, make or buy policy, process routes and release requirements.
- `lib/`: component-specific models, reference data and domain helpers; shared geometry and hardware belong to the documented SDK.
- `index.ts`: stable package ID, API version 2, display order and explicit library dependencies.
- [GUIDE.md](GUIDE.md): component-specific scope, sources, and engineering limitations.

## Edit and verify

Run commands from the project root. Replace `<part-id>` with the ID declared in `index.ts`.

```sh
npm run parts:check -- <part-id>
npm run typecheck
npm run dev
npm run build
```

Keep preview geometry, FreeCAD solids, reported dimensions, validation, and presets consistent. Keep component-specific helpers inside the package. Reuse the documented core SDK and explicitly declared library dependencies; all physical assembly components need library configuration identities independent of inspection poses. Folder discovery maintains the registry automatically.

## Export and handoff

```sh
npm run parts:export -- <part-id> <output-folder>
```

The handoff contains the package, SDK, workbench, and reference assets. Preserve `part-module.json` when returning it. Exported FreeCAD assemblies should have independent solid components with matching labels; configuration metadata does not create a PartDesign feature history.

Write instructions, labels, and comments in English. Keep this README applicable to all packages; document component-specific dimensions, procurement, and limitations in `GUIDE.md`.

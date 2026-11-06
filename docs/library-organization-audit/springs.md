# Springs organization audit

Historical section review, 2026-11-03, before curator integration. Some recommendations below were implemented in the same organization pass; use the [integrated review](../library-organization-audit.md) for completed changes and remaining work. Runtime counts describe that review snapshot. Raw snapshots and logs are optional local evidence under ignored `test-results/`; this document preserves the section findings in the repository.

Scope: all seven `SPRINGS` packages, 19 presets and six current browse entries. Source inspection and local preset ID/title uniqueness scan only. Root is the library curator; no source code or geometry was changed.

## Complete coverage

| Subgroup            | Package IDs                               | Decision                                                                                                                                                                               |
| ------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Helical springs     | `compression-spring`                      | Cylindrical, conical, barrel and hourglass coils already share the `profile` selector; diameter, wire, turns, hand, free length and compression are parameters. Retain one family.     |
| Helical springs     | `extension-spring`                        | Eye, hook, side-eye and straight-tail choices already share independent end selectors. Retain one family distinct from compression springs because load mode and mounting ends differ. |
| Helical springs     | `formed-wire`                             | Authored centreline/helix recipe engine, zero presets. Reusable physical definition used by assemblies, not a sourced spring article. Retain its ID and scope.                         |
| Torsion springs     | `torsion-spring`, `double-torsion-spring` | Existing shared `torsion-springs` catalog is appropriate. Twin coils and bridge differ mechanically, but the model chooser retains their original parameter schemas and IDs.           |
| Spiral springs      | `spiral-spring`                           | Strip thickness/width, turns, hand and gaps already parameterized; retain separate flat-strip family.                                                                                  |
| Disc & leaf springs | `disc-wave-spring`                        | Disc, wave and leaf forms already use one `form` selector and three presets. No extra per-form package is warranted.                                                                   |

## Immediate safe improvements

- Prefer the concise browse label **Formed wire** over **Configured formed wire**. Explain the structured centreline workflow in its description/guide, preserving the physical ID and recipe data.
- Spring preset names should identify actual dimensions consistently: compression `Cylindrical · Ø20 × 40 mm`; torsion `Hinge · Ø18 mm`; double torsion `Clamp · Ø18 mm`. Use **OD Ø40 mm · ID Ø20 mm** for disc/wave annuli, rather than an unexplained slash. Existing IDs and values remain stable.
- Keep **Free**, **Compressed**, **Extended**, **Wound** and **Unwound** as geometry states where already implemented. `spiral-spring` and `formed-wire` correctly omit invented inspection states. Do not present spring state as a purchased model.
- No package or preset ID rename is justified. All 19 local preset IDs and names are unique within each package; package IDs identify different physical definitions.

## Follow-up requiring affected validation

1. `disc-wave-spring` always emits exactly one physical piece for every form. `finish()` returns a one-piece model unchanged, making its current **Exploded** state ineffective. Its **Assembly** description and GUIDE claim separated components incorrectly. Reconcile saved states and canonical physical state before removing the no-op choice; verify configuration, composition and exports.
2. `disc-wave-spring` reuses `diameter`/`bore` for leaf length/width. Preserve keys but expose form-conditioned labels/fields so users do not read a leaf width as a bore. Keep `waves` conditional (already implemented). Its annular-width validation currently applies to leaf form too; review the real form-specific inequality before changing validation.
3. `formed-wire` exposes `mode: path` while the centreline field is hidden unconditionally. Assembly authors can provide its structured path, but a normal user cannot edit the path in this configurator. Clearly document the authoring workflow or implement an appropriate validated editor; do not invent supplier models to populate the empty chooser.
4. A common spring geometry API should not merge compression, extension, torsion, twin-coil, strip and freeform definitions merely because they all use wire or turns. Their free geometry, mounting interfaces, states and fabrication requirements differ. Existing grouping is proportionate.

## Evidence and verification limit

Reviewed all seven `part.ts` files, available configurators, presets, `formed-wire/GUIDE.md`, `disc-wave-spring/GUIDE.md` and `disc-wave-spring/lib/model.ts`, plus `src/core/assembly/mechanical/helpers.ts:finish`. The four physical deformation families implement state-dependent geometry; this inspection is not a load, fatigue, stiffness, print-fit or native topology certification. No package checks, geometry execution or FreeCAD round trips were run by this analyst.

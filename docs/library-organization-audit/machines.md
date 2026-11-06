# Machine tools section audit

Historical section review, 2026-11-03, before curator integration. Some recommendations below were implemented in the same organization pass; use the [integrated review](../library-organization-audit.md) for completed changes and remaining work. Runtime counts describe that review snapshot. Raw snapshots and logs are optional local evidence under ignored `test-results/`; this document preserves the section findings in the repository.

Scope: current worktree, source inspection only. No geometry, package or export checks were run by this analyst.

## Inventory and hierarchy

- Machines → Machine tools → Cutting machines → `automatic-band-saw` (6 presets).
- Machines → Machine tools → Cutting machines → `automatic-tube-saw` (7 presets).
- Machines → Machine tools → Milling machines → `cnc-milling-machine` (1 preset; existing browse family `cnc-milling-machines`).

Package IDs match their folders and are distinct; preset IDs are distinct within all three packages. Preserve these IDs. No semantic ID rename is warranted.

## Grouping decision

Keep the two saws as distinct physical definitions. They are not length or thread variants: the band saw has a pivoting bow, stationary motor, short shuttle and dropping shelf; the circular tube saw has a rising 500 mm circular blade, modular feed and powered take-away. The band-saw guide explicitly preserves the circular-saw concept separately. A future shared navigation catalog `Tube cutting machines` could join them without merging geometry, but the present two choices in Cutting machines are already clear and do not require another level.

The existing schemas already keep section shape, stock dimensions, cut length, pressure, and motion inspection inside their respective saw families. Manual/assisted/automatic feed remains the `automatic-tube-saw.feedMode` parameter, rather than separate packages. CNC spindle/controller choices similarly belong inside the CNC family. Do not move reusable purchased equipment under complete machines; their library dependencies correctly retain functional locations.

## Immediate safe metadata fixes

1. `src/parts/automatic-band-saw/presets.json`: normalize all six dimensional titles (`D120x4`, `80x80x4`, etc.) to `Ø120 × 4 mm`, `80 × 80 × 4 mm`, etc. Preserve preset IDs and numeric parameters. Example: `Round tube Ø120 × 4 mm · 50 mm parts`.
2. `src/parts/automatic-tube-saw/presets.json`: replace `80x80x4` and `100x60x4` with unit-qualified dimensional typography. The straight preset stores `cutLength: 250`; its title currently gives a 20–500 mm range, so prefer the actual configured length and leave capability ranges in the description. The mitre preset's `manual 45°` means manual angle setup while `feedMode` is automatic; use `45° mitre setup` to avoid implying manual feed. No parameters should change.
3. `src/parts/cnc-milling-machine/part.ts` and GUIDE heading: physical name `ProtoLab CNC / 800x1500x200` is not unit-qualified. Prefer `ProtoLab CNC milling machine · 800 × 1500 × 200 mm`. Existing browse family already supplies the generic navigation label. Preset title `ProtoLab CNC / D16T / 2.2 kW spindle` can use consistent `·` separators.
4. `src/parts/automatic-tube-saw/part.ts`: add `circular saw` / `circular tube saw` search keywords and optionally generic browse label `Circular tube saw`; the current `Automatic tube saw` does not distinguish cutting principle at a glance from the band saw.

## Parameter/state follow-up

- `cnc-milling-machine/configurator.ts`: hidden X/Y/Z pose parameters permit only 0/50/100 in validation; named endpoint states implement inspection. They are not product executions. Preserve IDs and clarify state labels consistently (`Assembled`, `Exploded`, `X minimum`, etc.) only after checking UI expectations.
- Saw process poses are implemented workflow snapshots and preserve their canonical composition; do not turn them into model variants or catalog articles.
- Band-saw inspection controls currently use group `Preview`, while CNC uses `Inspection pose`; normalize group labels later if desired, without altering keys or semantics.

## Evidence and limits

Reviewed each package's `part.ts`, `configurator.ts`, `presets.json`, `product.json` and GUIDE, plus `src/core/library.ts`, `library-navigation.ts`, `browse-families.ts`, and machine-category assertions in navigation tests. All three are manufactured assemblies with explicit composition. This audit establishes organizational findings only; no physical design, source fidelity, interference or native-CAD verification is implied. Any real geometry/schema consolidation requires the engineering review sequence and affected package/export tests.

# Catalog selection workflow

The configurator offers standard sizes beside the live model. Bolt selection follows metric thread, length, head and drive. Changing an earlier choice clears later constraints and previews the closest complete matching catalog configuration. Option counts use recorded source dimensions, and example presets do not enter the supplier result list.

Quick picks show four results per page with direct supplier or drawing links. Changing a size, clicking a result, or choosing a result in advanced search updates the model immediately. An external preset selection reconciles the quick filters. Loading unsupported custom sizes reveals **Custom dimensions**, where exact numeric settings remain available.

**Browse presets** opens a sidebar in place of the library and carries the active quick constraints into advanced search. Reopening it deliberately reseeds those constraints. Its selected state follows the current configuration; editing or selecting elsewhere cannot leave a stale result marked **Shown in 3D**. At narrow mobile widths the model stays above a separately scrollable result panel.

Some sourced screw/nut assemblies have a documented nut but an illustrative shaft length. They remain selectable as catalog references, while their unsourced length is displayed as editable custom geometry and cannot qualify a source-only length filter.

## Validation performed

- Browser: M2 → 8 mm → countersunk → cross drive narrows 62 → 6 → 2 → 1 supplier configurations and previews DIN 965.
- Browser: selecting M8 × 10 DIN 933 from advanced search updates the inline filters; repeating Browse presets carries the new criteria; selecting M3 elsewhere clears the old dock selection.
- Browser: visible internal hex-nut thread, D-shaped spur gear bore, and complete helical ball-screw axis.
- Browser: 390 × 844 and 1100 × 800 layouts keep the model visible during preset browsing; mobile configuration remains reachable. Temporary viewport overrides were cleared.
- Production build opened successfully under `/ProtoLab-3D/` without browser console errors.
- Focused automated checks cover cascading choices, source provenance, custom-size detection, external filter reconciliation, configuration round trips and matching every sourced preset.

Native CAD checks are recorded separately in [nut threads](nut-threads.md), [gear connections](gear-shaft-connections.md) and [assembly export](freecad-assemblies.md).

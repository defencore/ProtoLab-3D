# Catalog selection workflow

The configurator offers standard sizes beside the live model. Bolt filters cover metric thread, length, head and drive. Each choice preserves the other manual constraints; counts include all other active filters and the search query. Unavailable choices stay visible with zero counts, and individual chips let the user remove a constraint. A size selection previews the closest complete matching catalog configuration only when a real result exists. Option counts use recorded source dimensions, and example presets do not enter the supplier result list.

Quick picks start with every filter unset and show four results per page with direct supplier or drawing links. Changing a size, clicking a result, or choosing a result in advanced search updates the model immediately. Selecting a model preserves the filters the user actually set; its dimensions never become new constraints. A status identifies a preview outside the current results. Loading unsupported custom sizes reveals **Custom dimensions**, where exact numeric settings remain available. Switching Catalog/Custom mode and resetting model parameters preserves the user's search and filters.

Library navigation searches individual configurations rather than joining every article into one text. A structured size such as `M8 × 30`, `M8x30` or `M8 30` must match actual source dimensions in one article, rather than an unrelated supplier-code fragment. The query follows selection into the inline chooser or advanced search; name-only navigation does not impose an unmatched article query. The left navigation's own search survives opening and closing advanced search, and reselecting the same family with the same query preserves manual filters.

The unified **Spacers & standoffs** chooser offers **Catalog** body lengths from fixed supplier articles or **Range** with From/To bounds. It starts with any length; a model selection preserves that state. Catalog and Range remember separate explicit manual values. On the first switch, a valid explicit exact length may initialize the alternate mode. A selected model or the lower endpoint of a genuine interval never supplies that value. Later switches restore the remembered values. Custom-order ranges and editable prototype dimensions do not invent fixed catalog sizes.

**Browse presets** opens a sidebar in place of the library and carries the active quick constraints into advanced search. Reopening it deliberately reseeds those constraints. Its selected state follows the current configuration; editing or selecting elsewhere cannot leave a stale result marked **Shown in 3D**. At narrow mobile widths the model stays above a separately scrollable result panel.

Some sourced screw/nut assemblies have a documented nut but an illustrative shaft length. They remain selectable as catalog references, while their unsourced length is displayed as editable custom geometry and cannot qualify a source-only length filter.

## Validation performed

- Browser: M2 → 8 mm → countersunk → cross drive narrows 62 → 6 → 2 → 1 supplier configurations and previews DIN 965.
- Browser: selecting a different bolt in advanced search keeps the user's inline constraints and reports a preview outside those results; repeating Browse presets carries only those explicit constraints.
- Browser: visible internal hex-nut thread, D-shaped spur gear bore, and complete helical ball-screw axis.
- Browser: 390 × 844 and 1100 × 800 layouts keep the model visible during preset browsing; mobile configuration remains reachable. Temporary viewport overrides were cleared.
- Production build opened successfully under `/ProtoLab-3D/` without browser console errors.
- Focused automated checks cover independent facets, contextual counts, source provenance, custom-size detection, constraints independent of selection, real catalog length options, numeric commas/dots, single-article size queries, configuration round trips and matching every sourced preset.

Native CAD checks are recorded separately in [nut threads](nut-threads.md), [gear connections](gear-shaft-connections.md) and [assembly export](freecad-assemblies.md).

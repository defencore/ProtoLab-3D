# Library selection verification — 14 October 2026

The refactor separates browsing constraints from the configured product. Selecting a model never turns its dimensions into new filters. The library search and advanced-search constraints are controlled by the application, while each inline chooser retains its explicit manual constraints. Switching Catalog/Custom mode or resetting model parameters preserves those constraints.

Numeric filtering uses one finite-decimal parser and inclusive range matcher. All range controls accept decimal commas and dots, allow either bound to be omitted, and identify invalid or reversed bounds beside the input. Unknown source characteristics cannot satisfy an active filter. Custom dimension inputs preserve the typed decimal text; invalid parameters keep the last valid preview and disable export.

Active constraints have individually removable chips. Facet counts include the other active constraints and search query. Unavailable choices remain visible with zero counts, and an unavailable selected choice can still be cleared. Hidden advanced-search controls no longer compute facet counts.

The four physical spacer/standoff definitions share one navigation family. Their original part IDs, purchased/manufactured classifications and specification identities remain separate. Advanced search exposes the family's additional source facets and distinguishes **Catalog body length** from **Plain spacer / sleeve length**. Catalog and Range remember separate manual values; a genuine interval never becomes its lower endpoint when switching modes.

Editable sleeve proposals are distinct from the actual preview. Choosing 55 mm explicitly marks that configuration; filtering for 60 mm keeps the actual 55 mm in a separate preview card. Template identity requires the same part, material and supplier evidence, and custom dimensions do not acquire a fictitious stocked SKU.

## Automated coverage

The final focused suite passed **109 tests**, including numeric parsing, input accessibility, source characteristics, search, independent facets, selected identity, grouped navigation, actual rendered advanced-search controls and portable module isolation.

The invariant matrix covers all **203 physical definitions** and **18,819 presets**: 18,384 sourced configurations and 435 design examples. It checks 1,945 eligible field definitions and 10,374 distinct value groups, including:

| Assertion                                        |  Checks |
| ------------------------------------------------ | ------: |
| A published value matches its own model          | 132,649 |
| Unknown or inactive characteristics cannot match |  90,095 |
| Inclusive, open and exact numeric boundaries     | 215,883 |

The unchanged output contracts passed **610 tests** across every physical definition. They cover 29,018 preset/state parameter validations, finite binary STL output for all 418 authored default/state pairs, invalid-input rejection, and the complete LCH7 v3.2 console-command regression. The larger sampled preview-dimension suite was stopped before completion and is not counted as passed coverage.

Those checks exposed an erroneous empty-array call to `Group.add` in three recovery views with intentionally absent fabric. Resolved library instances now enter the group individually, while reference and recipe validation remains intact. Six focused assembly tests passed, and all six affected Simple/Full macro hashes remained byte-for-byte identical to the completed current native audit. This removes the warning without changing the modeled components or CAD scripts.

Native and syntax verification have their own finite scope and per-macro evidence in [Library script verification](library-script-audit.md). Native execution checks defaults/states and valid numeric boundaries; syntax compilation checks every preset in Simple and Full. These scopes do not claim native execution of every catalog SKU.

## Browser verification

- `M8 × 30` finds 14 matching bolt articles without inventing length constraints. Changing thread M8 to M6 preserves an explicitly chosen 30 mm length.
- Catalog/Custom switching and Reset parameters retain manual bolt filters. Closing and reopening Find presets retains its scope, query and manual constraints.
- A selected standoff family exposes catalog body length and per-end threads. Body length 10 mm plus end-A M3 finds 48 articles. The current 113x10 preview remains reviewable outside a later conflicting query.
- Catalog length 10 mm and Range 15–25 mm are remembered independently. Selecting another article leaves manual filters intact.
- Explicitly selected custom 55 mm is retained separately from a proposed 60 mm. Changing material removes the stale template association.
- Case width `10,0`–`10` finds five KST servos. An active stall-current constraint excludes their unpublished ratings and preserves the actual preview.
- Custom bore `3,2` remains valid and copies a numeric `3.2`. Invalid text disables copying. Simple/Full copies different, correctly labelled 113x10 macros; both copied macros compile.
- At the narrow responsive breakpoint, configuration remains reachable and retains existing constraints. The temporary viewport override was reset. The final production build has no browser console errors.

## Local evidence

Results are retained in the ignored `test-results/library-script-audit/` directory: `filter-matrix-2026-10-14.json`, `filter-tests-2026-10-14.log`, `filter-ui-2026-10-14.json`, `output-contracts-2026-10-14.log`, `empty-instance-macro-proof-2026-10-14.json`, `build-2026-10-14.log` and `packages-2026-10-14.log`. The copied Simple/Full macros are saved beside these reports. The production build, package validation, TypeScript and repository-language checks passed.

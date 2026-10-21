# DREMEC and Kosmodrom catalog coverage

The 13 October 2026 addition provides 4,444 fixed supplier configurations and four custom-order metal sleeve templates. Portable package snapshots contain the selectable models and their provenance; the larger research records and offline adapters are not imported into the browser.

| Package                        | Fixed choices / templates | Source coverage                                                  |
| ------------------------------ | ------------------------: | ---------------------------------------------------------------- |
| PCB spacer and standoff        |                     3,441 | 3,315 DREMEC ordinary articles and 126 Kosmodrom M3 products     |
| PCB standoff with metal insert |                     1,003 | Complete bought DREMEC polymer/brass units                       |
| DREMEC custom metal sleeve     |                         4 | Brass, steel, aluminium and stainless steel; customer dimensions |

Open the single **Fasteners & threads → Spacers & standoffs** entry. Its shared list includes 4,444 supplier articles, four custom-order templates and the existing three editable plain-spacer designs: 4,451 choices. Search by article/SKU or a size such as `M3 10`, `M3 × 10 mm` or `M2,5 10 mm`. A standalone search number means body length; it cannot match a hidden stud projection, opening depth or wrench width.

The primary filters are ends, thread at either end, body length, body form and material. Body length starts at **Catalog → Any catalog length** and lists sizes from actual fixed supplier articles, with counts under the other active filters. Qualified article-code lengths retain an explicit verification label. Editable prototype lengths and custom-order range points do not create catalog size options. **Range** accepts separate From/To bounds, including one-sided ranges. Catalog and Range remember their separate manual values when switching. The first switch may initialize the alternate mode only from a valid explicit exact length, including equal From/To bounds; a selected model or the lower endpoint of a genuine interval never becomes an exact catalog constraint. **More filters** adds construction, supplier, finish, separate end-1/end-2 thread designations, overall length, diameter/across flats and plain bore. Mixed metric/UNC/ST items remain discoverable; separate end selectors resolve exact combinations. Counts reflect all other active filters, unavailable alternatives have zero counts, and each applied filter has a remove button. Results load in groups of 24. Selecting another physical package within the family preserves the query and filters; the preview's actual article, supply policy and assembly classification remain intact. If the preview is outside the results, a status tells the user to select a result rather than displaying an excluded card among matches.

Supplier-qualified nominal dimensions inferred from article codes remain searchable with explicit qualifications. Unpublished overall dimensions are excluded from an overall-length fit filter; confirmed totals and arithmetic from known source spans are distinguished in the source notes. Custom sleeve filters match published custom-order ranges and selection applies the requested dimensions, without creating a stock identity. Each supplier card links to the actual source product or Ukrainian product family. **Copy for FreeCAD** and macro download retain the selected physical product identity, source properties and Simple/Full mode.

## Source boundaries

[DREMEC Ukraine](https://dremec.ua/shop/) lists 24 standoff groups and four custom metal sleeve families in the recovered two-page shop inventory. Its live shop was unavailable during the import. Standoff codes and dimensions come from the [manufacturer's official 2020 catalog](https://shop.dremec.de/api/downloads/Dremec_Katalog_Deutsch_doppelseitig.pdf), SHA-256 `747c189d30afb816825a33934aec4f08c1c3154543ba48338f489862ecb9fd55`. The adapter expands only explicitly listed lengths and permitted integer-mm ranges: 4,250 base codes plus 68 separately specified short-stud `k` codes. Optional ordering suffixes are documented without fabricating additional stocked combinations. Ukrainian variation IDs, current execution and stock are unconfirmed. [Import details](../src/catalog/dremec/README.md).

The [Kosmodrom M3 category](https://kosmodrom.ua/mizhplatni-stiyki-z-rizblennyam-m3) was read across all nine pages and 126 individual product pages. Every distinct supplier SKU retains its exact product URL, source hash, dimensions and linked drawings. The supplier's stated manufacturer is retained only when published. [Import details](../src/catalog/kosmodrom/README.md).

Published dimensions remain distinct from assumptions. Metric coarse and UNC pitch interpretations are identified as standard-derived. Unpublished female depths and stud projections use separately labeled installation envelopes; they are excluded from verified dimensions and manufacturing thread spans. Conflicting source dimensions remain visible in the model fidelity field and specifications. Published across-corner envelopes clip the hex body where required. Mixed UNC/metric ends have independent thread definitions. External ST studs retain published major/root diameters and remain nominal where pitch is unspecified.

Composite units expose the actual brass stud as a separate colored component when its projection is known. Unpublished internal insert dimensions do not generate invented hidden insert solids. Source-confirmed female depths meeting at the center retain two independent spans, without claiming a source-confirmed continuous through thread.

The four DH metal sleeves are made to customer dimensions. Only the steel default is the printed `324/2.1x10` example (outside diameter 4 mm, bore 2.1 mm, length 10 mm). Other templates use editable customer example dimensions. Outside diameter 4–36 mm and body length 1–60 mm are published custom ranges; the bore must be smaller than the outside diameter. Tolerances and edge breaks remain customer specifications.

## Reproducible snapshots

Refresh research records using the documented import scripts, then generate the portable snapshots explicitly:

```sh
node --import tsx scripts/sync-package-catalogs.ts pcb-standoff
node --import tsx scripts/sync-package-catalogs.ts pcb-standoff-insert
node --import tsx scripts/sync-package-catalogs.ts dremec-spacer-sleeve
npm run parts:sync
```

Use `--check` to compare without changing files. These three source-owned snapshots replace their catalogs authoritatively; they do not retain articles removed from the normalized source data. Other existing adapters retain their documented behavior. Sync validates the prospective schema, exact source identity, every configuration and dependency closure before writing, and saves previous snapshots for recovery.

## Verification

The final production build, test TypeScript compilation, repository language check and package validation pass. The registry contains 203 physical product packages and 18,819 presets; family grouping presents 200 navigation entries without deleting products. The three new portable snapshots reproduce their offline adapters exactly. Import regressions cover complete nine-page Kosmodrom enumeration, source interpretation and deterministic DREMEC table expansion. Sync regressions cover authoritative replacement, prospective fixed schemas, dependency closure and preservation of existing adapter behavior.

| Check                                                               | Simple |  Full | Result         |
| ------------------------------------------------------------------- | -----: | ----: | -------------- |
| Syntax compilation: all 4,448 new presets and three family defaults |  4,451 | 4,451 | All 8,902 pass |
| Native execution: three defaults and two valid editable boundaries  |      5 |     5 | All 10 pass    |
| Native execution: actual supplier SKUs and four sleeve materials    |     10 |    10 | All 20 pass    |
| Native execution: four-occurrence supplier project                  |      1 |     1 | Both pass      |
| Native execution: commands actually copied from the browser         |      1 |     1 | Both pass      |

The source-associated geometry tests also inspect 19 catalog/custom configurations in both preview modes. They check actual mixed UNC/metric ends, external ST envelopes, meeting female spans, missing female/stud dimensions, exposed brass, source-clipped KLS AF/H, exact supplier identity, complete source records and custom sleeve materials. Every native component is valid, closed and has positive single-solid volume. Separate composite components have zero overlap. Maximum measured bounding-size discrepancy in the 20 source-associated native cases is 0.005403 mm; this is CAD verification against configured dimensions, not supplier tolerance certification.

The separate per-end model regression executes 19 authored interface fixtures in both native modes (38 macros), including confirmed internal insert definitions that are not available in the current supplier tables. All seven tests pass; the final native run is preserved in fixture verification (local output: `test-results/standoff-catalogs/fixture-tests.log`).

The project tests retain four bought occurrences and five physical geometry components, preserving a complete composite unit as one specification identity. Their occurrence metadata retains exact catalog JSON, supporting PDF links, source hash, limitations and geometry evidence. An edited sleeve retains its material source and customer dimensions without inheriting a stale stock designation.

Local measured evidence is retained under ignored `test-results/standoff-catalogs/`: complete script audit (local output: `test-results/standoff-catalogs/library-scripts.json`), source-associated native cases (local output: `test-results/standoff-catalogs/source-native.json`), project native cases (local output: `test-results/standoff-catalogs/project-native.json`) and browser-copy native cases (local output: `test-results/standoff-catalogs/browser-copy-native.json`). The final script audit has 8,912 passes, no failures/timeouts, no active cases and no unresolved resume cache. It rechecks exact macro hashes after final provenance changes. Native geometry verification remains a finite representative scope; compiling every catalog macro does not imply native execution of every SKU or certify manufacturing tolerances.

The unified browsing regressions cover one navigation entry across engineering/product/supply/process views, all four physical selection markers, compound sidebar queries and the same query passed into the family chooser. Hidden geometry/identity fields no longer appear as advanced-search filters or contaminate search text. Per-end source thread aliases and five explicitly published Kosmodrom overall lengths are present in portable snapshots; they do not alter physical parameters or verified dimension claims.

The 14 October unified-chooser browser check confirms one navigation entry, `M3 10` finding 48 body-10 models, `brass M3 10` passed intact from the sidebar, and preserved query/construction across selection of the purchased insert unit `2183x15`. Four custom sleeve templates accept an 8 mm outside diameter, 55 mm body and comma-decimal 3.2 mm bore; selection applies those dimensions as Custom rather than retaining the printed stock-example designation. Ordered end, material, supplier and width constraints distinguish `213x10` (18 mm overall) and `213x10k` (16 mm overall). Both Simple and Full commands actually copied from the unified chooser execute successfully in FreeCAD. Current source-associated and project proofs were refreshed after the source-filter metadata changes; the 8,912-case audit is complete with zero failures/timeouts.

The length-filter follow-up verifies that selecting an 8 mm article with no filters leaves all 4,451 choices available. A selected 15 mm catalog constraint survives ordinary-to-insert selection; a 10–20 mm range survives selection of a 20 mm article and another click on the active mode. Each length mode retains its own explicit values; a genuine interval does not seed an exact catalog length. A reversed 25–20 interval reports an error, and Clear all restores unrestricted selection. Generic quick picks also start unset: selecting an M8 × 30 bolt through advanced search preserves the user's M2 filter and leaves length unset. The automatic preview-to-filter helpers were removed. All 54 focused family, catalog, search and quick-pick tests pass, along with test TypeScript, package validation, language checking and the production build. The browser observations are preserved in length-filter verification (local output: `test-results/standoff-catalogs/length-filter-browser.json`); no geometry or export script changed in this follow-up.

Reproduce the finite audit:

```sh
npm run audit:library -- --parts pcb-standoff,pcb-standoff-insert,dremec-spacer-sleeve --phase all --modes simple,full --jobs 2 --report test-results/standoff-catalogs/library-scripts.json
```

An unrelated existing `pillow-block-bearing / ucp204` hardware refresh row still lacks its current `housingStyle` and `insertOffset` fields, so the optional whole-library `sync-package-catalogs.ts --all --check` stops there. The three new catalogs pass their individual refresh checks; the complete application package check and build pass. No whole-library snapshots were rewritten or checks relaxed to bypass that source-adapter defect.

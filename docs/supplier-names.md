# Original supplier listing names

`Preset.name` remains the curated English title used by selectors and search. `Preset.catalog.name` records the original product listing title from supplier evidence. A product's supplier designation, SKU, manufacturer, source URL, and listing title are separate fields. The title is copied exactly, including its language and punctuation; a translated or normalized UI label is not evidence of an exact shop name.

The offline synchronization reads four compact Gvyntok hardware snapshots under `src/catalog/data/`. Pass `--gvyntok-fastener-inventory <path>` or `--promtehimport-inventory <path>` to include an external raw inventory. It matches the selected primary `catalog.sourceUrl` first. If no primary listing is recorded, an exact, unambiguous SKU match is allowed within the same supplier hostname. Other grouped SKUs never override a known primary listing. Conflicting titles, another supplier's identical SKU, category headings, drawings, and absent titles do not establish a product name.

```sh
node --import tsx scripts/sync-supplier-names.ts
node --import tsx scripts/sync-supplier-names.ts --check
node --import tsx scripts/sync-supplier-names.ts --write
node --import tsx scripts/sync-supplier-names.ts --check --gvyntok-fastener-inventory test-results/catalog/gvyntok-fasteners.json --promtehimport-inventory test-results/catalog/promtehimport-inventory.json
```

The default command reports coverage. `--check` fails if a title available in the reviewed source snapshots has not been synchronized. `--write` patches only `catalog.name` tokens in part snapshots, retaining existing compact or indented JSON formatting. Foreign source strings use Unicode escapes as machine evidence; decoding JSON yields the exact original text. No supplier pages are fetched and no geometry, identifiers, dimensions, curated titles, or source designations are changed.

`scripts/sync-package-catalogs.ts` also enriches the prospective catalogs before writing snapshots. A refreshed preset that still points to the same source URL retains its recorded title when the adapter supplies none. Its snapshot serializer escapes foreign source evidence. Runtime titles are read from package presets.

## Coverage recorded on 2026-10-28

| Reviewed source                        | Catalog records | Original titles recorded | Missing original titles |
| -------------------------------------- | --------------: | -----------------------: | ----------------------: |
| Promtehimport                          |           7,928 |                    7,928 |                       0 |
| Gvyntok                                |           4,165 |                    4,164 |                       1 |
| DREMEC                                 |           4,322 |                        0 |                   4,322 |
| FAULHABER shop                         |             950 |                        0 |                     950 |
| Other catalogs and supplied references |           1,751 |                        0 |                   1,751 |
| **Total**                              |      **19,116** |               **12,092** |               **7,024** |

The remaining Gvyntok record is `set-screw/m2-5-cone`: its primary source is a dimension drawing PDF without a product SKU or captured listing title. Its title is intentionally unresolved. Other missing records require an original listing capture or an explicitly entered supplier name; manufacturer model codes and curated UI titles are not automatically relabeled as exact shop titles.

Counts describe the current source snapshots, not current stock availability or a live check of supplier websites. Missing titles remain visible in the report. Complete procurement records still need the selected supplier's exact title, model, manufacturer, and ordering evidence.

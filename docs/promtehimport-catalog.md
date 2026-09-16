# Promtehimport catalog ingestion

The inventory covers all 19 supplier category URLs supplied for this project. Every available pagination link was enumerated; no page or product sample cap was used. The committed inventory contains 510 category pages and 11,977 distinct public product URLs.

Retrieval is complete for the September 13, 2026 snapshot: all 510 category pages and all 11,977 distinct product pages were retrieved successfully, with no failed or pending pages. Every temporary search-cache excerpt was replaced with the complete direct supplier page. The importer keeps a resumable source ledger and records the modeling decision for every enumerated product.

Read the current [machine-readable coverage](../src/catalog/generated/promtehimport-coverage.json), [per-product import decisions](../data/promtehimport-import-report.json), and [source dimension tables and inventory](../data/promtehimport-inventory.json). Counts distinguish retrieved pages, usable presets, unsupported shapes, conflicting dimensions, and pages that have not been retrieved. The total inventory count is not an imported-preset count.

## Import outcome

The complete snapshot produces 7,928 source-backed presets across 28 model families.

| Outcome                                | Products |
| -------------------------------------- | -------: |
| Imported and validated                 |    7,928 |
| Unsupported or unresolved construction |    3,545 |
| Missing required source dimensions     |      279 |
| Unresolved source conflicts            |      214 |
| Geometry outside the supported model   |       11 |
| Failed or pending source pages         |        0 |

The largest identified exclusions are automotive hubs/cartridges (590), tapered-bearing records without enough construction evidence (472), other needle constructions (333), specialized insert profiles (315), other housing forms (195), N/NR snap-ring variants (194), and unsupported cylindrical roller rib/row arrangements (165). Another 1,020 records lack an exact established geometry family; smaller groups and example URLs appear in the coverage ledger. The 11 geometry rejections are extended spherical-plain inner-ring profiles.

## Reproduce or resume

```sh
python3 scripts/import-promtehimport.py --workers 1
node --import tsx scripts/build-promtehimport-presets.ts
```

The default inventory is committed, so resuming on a new machine does not require the temporary cache. Successful new pages are cached under `/tmp/protolab-full-promtehimport-cache`. `--cache-only` rebuilds the source manifest without network access. `--refresh-categories` requests current pagination and product membership. `--refresh-web-cache` replaces temporary search excerpts with complete live product pages. `--request-delay` defaults to one second per worker; repeated connection failures stop the fetch loop with a resumable checkpoint.

An optional fallback imports saved text from exact public supplier pages:

```sh
python3 scripts/cache-promtehimport-web.py public-page-export.txt
python3 scripts/import-promtehimport.py --cache-only
node --import tsx scripts/build-promtehimport-presets.ts
```

That parser accepts only supplier product IDs already present in the inventory and rejects excerpts containing several product IDs. Translated URLs are matched to the same public product ID, with the actual evidence URL retained. Category filter values and URL-only dimensional guesses are never treated as product dimensions.

## Geometry and evidence rules

Each bearing family has its own model/configurator module. The data adapter assigns only supported constructions: a housed linear carriage does not become a cylindrical linear bushing, a specialty agricultural bearing does not become a generic ball bearing, and a long alphanumeric product code is not truncated into a different standard series. Full designations, suffixes, and aliases remain searchable.

Verified parameters identify values read from the supplier dimension table, named attributes, or explicit dimensional product titles. Source maxima used for a housing envelope remain visible as maxima in the evidence rows. Unresolved table/attribute conflicts are excluded. Precise inch conversions may agree with a summary rounded to two or more decimal places, in which case the exact table value is retained. Six explicitly listed supplier summary errors were reconciled against linked NSK reference dimensions; their original conflicting rows and the reconciliation remain in the source ledger. Supplier tables do not define the detailed cage, rolling-element count, raceway tolerances, or production internals; these remain illustrative model parameters. Only unverified internal parameters may be adjusted for valid geometry.

LMK and LMF mounting dimensions and ball circuit counts are cross-referenced to the linked HepcoMotion table only when the supplier bore and outside diameter match that reference. Supplier length remains unchanged, and the preset explicitly states that interchangeability is not asserted. These reference values are distinguished from supplier rows in the evidence ledger.

Examples include distinguishing overall tapered-bearing width T from inner-ring B, retaining sleeve seat d separately from bore d1, preserving UC inner/outer ring widths, and keeping a rod-end inner-member width separate from the larger overall stem envelope. Cylindrical NU/N/NJ/NUP rib construction and one-/two-sided seals are represented when the source designation identifies them.

## Inventory by supplied category

Products may appear in more than one category. The distinct total deduplicates those overlaps.

| Category                                                                                                  | Pages | Enumerated products |
| --------------------------------------------------------------------------------------------------------- | ----: | ------------------: |
| [Single-row radial ball](https://promtehimport.com.ua/radialni-odnoryadni-pidshipniki-c34/)               |   153 |               3,651 |
| [Self-aligning ball](https://promtehimport.com.ua/samovstanovlyuvalni-dvoryadni-kulkovi-pidshipniki-c35/) |     7 |                 158 |
| [Angular-contact ball](https://promtehimport.com.ua/radialno-uporni-kulkovi-pidshipniki-c36/)             |    49 |               1,176 |
| [Mounted units](https://promtehimport.com.ua/korpusni-pidshipnikovi-vuzli-c37/)                           |    21 |                 499 |
| [Thrust ball](https://promtehimport.com.ua/uporni-kulkovi-pidshipniki-c38/)                               |    17 |                 405 |
| [Tapered roller](https://promtehimport.com.ua/rolikovi-konichni-pidshipniki-c39/)                         |    88 |               2,099 |
| [Insert bearings](https://promtehimport.com.ua/pidshipniki-scho-zakriplyuyutsya-dlya-korpusiv-c40/)       |    24 |                 559 |
| [Spherical roller](https://promtehimport.com.ua/rolikovi-sferichni-pidshipniki-c42/)                      |    31 |                 722 |
| [Cylindrical roller](https://promtehimport.com.ua/rolikovi-cilindrichni-pidshipniki-c43/)                 |    36 |                 843 |
| [Needle roller](https://promtehimport.com.ua/golchasti-pidshipniki-c44/)                                  |    27 |                 626 |
| [One-way clutches](https://promtehimport.com.ua/obginni-mufti-c45/)                                       |     3 |                  56 |
| [Thrust roller](https://promtehimport.com.ua/uporni-rolikovi-pidshipniki-c46/)                            |     4 |                  75 |
| [Linear bearings](https://promtehimport.com.ua/liniyini-pidshipniki-c47/)                                 |     4 |                  85 |
| [Combined bearings](https://promtehimport.com.ua/kombinovani-pidshipniki-c48/)                            |     1 |                  12 |
| [Rod ends](https://promtehimport.com.ua/sharnirni-golovki-nakonechniki-shtokiv-c49/)                      |     5 |                  99 |
| [Spherical plain](https://promtehimport.com.ua/pidshipniki-kovzannya-c50/)                                |     7 |                 157 |
| [Double-row radial ball](https://promtehimport.com.ua/radialni-dvoryadni-kulkovi-pidshipniki-c51/)        |    24 |                 562 |
| [Adapter sleeves](https://promtehimport.com.ua/zakriplyuvalni-vtulki-c52/)                                |     4 |                  93 |
| [Oil seals](https://promtehimport.com.ua/salniki-c54/)                                                    |     5 |                 100 |

## Validation

The final snapshot passed 4,833 distinct macro/state checks in FreeCAD 1.0.2 with no failures. The recorded validation summary (generated local report) includes the preset and macro-manifest fingerprints.

The adapter validates every accepted configuration and preview envelope in each supported state. Regression tests check complete inventory accounting, preservation of supplier identifiers, construction mapping, URL deduplication, and source-aware preset matching. To validate every distinct supplier macro with a local FreeCAD installation:

```sh
node --import tsx scripts/verify-promtehimport-native.ts
/Applications/FreeCAD.app/Contents/Resources/bin/python scripts/verify-promtehimport-native.py --jobs 3
```

The Python runner checks valid positive-volume solids, the configured envelope, and source metadata. Each parallel worker owns a separate FreeCAD process and document. On another platform, run it with the Python runtime that loads FreeCAD and pass `--freecad-lib` when required. Native validation results are written to `/tmp/protolab-promteh-native-results.json`. Successful checks are cached by complete macro, dimensions, and FreeCAD version, so later catalog checkpoints validate newly added or changed configurations without repeating unchanged cases.

# Catalog import coverage

Generated: 2026-09-13. All counts below distinguish discovered products from usable geometry presets; source inventories retain their snapshot timestamps.

The library contains **74 part modules**, **12497 sourced presets** and **94 prototype examples**.

## Supplied drawings and motion components

The eight supplied images are retained in `public/references/` and linked from the matching presets. Added modules cover ball screw assemblies, standalone ball nuts, a jaw coupling and bevel gear pairs. Ball screw manufacturer tables supplement the images; each preset identifies its own source and verified dimensions.

- All 27 SFU dimension-table rows and all nine requested ball nut families are represented.
- Miniature SFK shaft lengths cover 100–550 mm in 50 mm steps. Repeated lengths and assembly/nut exports are distinct configurations, not additional source products.
- The D25 L30 coupling includes all 38 unique listed bore pairs.
- Four m0.5 pinions cover 11/13/15/17 teeth with a 2.98 mm bore. Six bevel pairs cover all 12 dimension-table rows.
- SFK602 and SFE3210 remain unverified prototype examples because the listing codes have no matching dimensioned drawing. DFI1605-4 is excluded from the LIMON import because its published L=10 conflicts with its double-nut construction.

See [ball screw source coverage](docs/ball-screw-catalog.md) and [gear reference mapping](docs/reference-gears.md) for source-specific dimensions and model limitations.

## Gvyntok

Every public category page in the five supplied sections was read. Coatings and materials with identical dimensions are grouped; every admitted supplier SKU remains searchable.

| Section | Source categories | Pages | Visible products read | SKUs represented by models |
| --- | ---: | ---: | ---: | ---: |
| Bolts and screws | 55 | 148 | 5901 | 5871 |
| Nuts and inserts | 82 | 83 | 958 | 638 |
| Washers and rings | 35 | 37 | 606 | 479 |
| Threaded rods | 10 | 10 | 186 | 186 |
| Pins, cotters and clamps | 7 | 10 | 272 | 236 |

Navigation badges have stale totals in a few categories. The importer checks against the actual visible result count and records discrepancies separately.

Dimensions are taken from linked supplier drawings and product rows. Where a listing supplies only a nominal size, an explicitly identified standard reference can supply additional dimensions; each preset describes that distinction and links to the reference. Nominal screw sizes and washer clearance bores remain separate. Unspecified chamfers, slit angles, collars and internal profiles are prototype settings.

### Products still without a supported model or verified size

| Standard / group | Unrepresented SKU rows |
| --- | ---: |
| Other supplier families | 184 |
| DIN 8140 | 111 |
| DIN 471 | 24 |
| DIN 935 | 22 |
| DIN 11024 | 20 |
| DIN 6926 | 19 |
| DIN 93 | 14 |
| DIN 6927 | 13 |
| DIN 1624 | 13 |
| DIN 937 | 11 |
| DIN 472 | 10 |
| DIN 929 | 8 |
| DIN 432 | 8 |
| DIN 434 | 7 |
| DIN 982 | 6 |
| DIN 928 | 6 |
| DIN 6330 | 5 |
| DIN 582 | 5 |
| DIN 11023 | 5 |
| DIN 440 | 4 |
| DIN 435 | 4 |
| DIN 315 | 3 |
| DIN 1587 | 3 |
| DIN 6923 | 2 |
| DIN 985 | 2 |
| DIN 6334 | 1 |
| DIN 9021 | 1 |
| DIN 436 | 1 |
| DIN 6799 | 1 |

## Promtehimport

All 19 supplied sections were enumerated: **510 category pages** and **11977 distinct product URLs**. **11977 product records** were processed. Import state: **source-fetch-complete**.

| Import status | Product rows |
| --- | ---: |
| imported | 7928 |
| unsupported-subtype | 3545 |
| missing-dimensions | 279 |
| source-conflict | 214 |
| model-rejected | 11 |

### Coverage by supplier section

| Section | Enumerated products | Imported presets | Pending pages |
| --- | ---: | ---: | ---: |
| [Single-row radial ball](https://promtehimport.com.ua/radialni-odnoryadni-pidshipniki-c34/) | 3651 | 2942 | 0 |
| [Self-aligning ball](https://promtehimport.com.ua/samovstanovlyuvalni-dvoryadni-kulkovi-pidshipniki-c35/) | 158 | 148 | 0 |
| [Angular contact ball](https://promtehimport.com.ua/radialno-uporni-kulkovi-pidshipniki-c36/) | 1176 | 380 | 0 |
| [Mounted bearing units](https://promtehimport.com.ua/korpusni-pidshipnikovi-vuzli-c37/) | 499 | 196 | 0 |
| [Thrust ball](https://promtehimport.com.ua/uporni-kulkovi-pidshipniki-c38/) | 405 | 337 | 0 |
| [Tapered roller](https://promtehimport.com.ua/rolikovi-konichni-pidshipniki-c39/) | 2099 | 1480 | 0 |
| [Insert bearings](https://promtehimport.com.ua/pidshipniki-scho-zakriplyuyutsya-dlya-korpusiv-c40/) | 559 | 128 | 0 |
| [Spherical roller](https://promtehimport.com.ua/rolikovi-sferichni-pidshipniki-c42/) | 722 | 657 | 0 |
| [Cylindrical roller](https://promtehimport.com.ua/rolikovi-cilindrichni-pidshipniki-c43/) | 843 | 549 | 0 |
| [Needle roller](https://promtehimport.com.ua/golchasti-pidshipniki-c44/) | 626 | 211 | 0 |
| [One-way clutches](https://promtehimport.com.ua/obginni-mufti-c45/) | 56 | 43 | 0 |
| [Thrust roller](https://promtehimport.com.ua/uporni-rolikovi-pidshipniki-c46/) | 75 | 52 | 0 |
| [Linear bushings](https://promtehimport.com.ua/liniyini-pidshipniki-c47/) | 85 | 72 | 0 |
| [Combined bearings](https://promtehimport.com.ua/kombinovani-pidshipniki-c48/) | 12 | 8 | 0 |
| [Rod ends](https://promtehimport.com.ua/sharnirni-golovki-nakonechniki-shtokiv-c49/) | 99 | 26 | 0 |
| [Plain bearings](https://promtehimport.com.ua/pidshipniki-kovzannya-c50/) | 157 | 117 | 0 |
| [Double-row radial ball](https://promtehimport.com.ua/radialni-dvoryadni-kulkovi-pidshipniki-c51/) | 562 | 458 | 0 |
| [Adapter sleeves](https://promtehimport.com.ua/zakriplyuvalni-vtulki-c52/) | 93 | 56 | 0 |
| [Oil seals](https://promtehimport.com.ua/salniki-c54/) | 100 | 68 | 0 |

### Most common remaining exclusions

| Reason | Product rows |
| --- | ---: |
| No exact geometry family for the source designation | 1020 |
| Automotive hub or cartridge construction requires a dedicated bearing model | 590 |
| Tapered-bearing designation lacks sufficient evidence to establish the exact ring construction | 472 |
| Needle-bearing subtype does not match the available drawn-cup construction | 333 |
| Insert bearing locking collar, bore or outer profile needs a distinct model | 315 |
| Housing style differs from the supported pillow, oval two-bolt or square four-bolt units | 195 |
| Outer snap-ring groove or retaining-ring assembly requires a dedicated bearing variant | 194 |
| Cylindrical roller rib or row construction is not represented by NU/N/NJ/NUP | 165 |
| Insert bearing has an eccentric or specialized locking construction | 97 |
| Missing width: T | 82 |
| Bearing with an adapter sleeve requires a separate assembly model | 79 |
| Missing housingDepth: A | 62 |

Discovered URLs without retrieved dimensions are not labeled as imported presets. Unresolved dimension conflicts and unsupported shapes are excluded. A small set of shop-summary conflicts is reconciled against explicitly linked NSK reference dimensions and labeled accordingly. The importer resumes from its saved cache.

## Presets by module

| Part | Sourced presets | Prototype examples |
| --- | ---: | ---: |
| Deep groove ball bearing | 2939 | 3 |
| Self-aligning ball bearing | 456 | 0 |
| Angular contact ball bearing | 240 | 0 |
| Double-row ball bearing | 31 | 0 |
| Double-row angular contact bearing | 259 | 0 |
| Cylindrical roller bearing | 606 | 2 |
| Spherical roller bearing | 600 | 0 |
| Tapered roller bearing | 1480 | 0 |
| Drawn cup needle bearing | 201 | 0 |
| Rod end bearing | 26 | 2 |
| Linear ball bushing | 41 | 0 |
| Square-flange linear bushing | 18 | 1 |
| Round-flange linear bushing | 13 | 1 |
| Thrust ball bearing | 337 | 0 |
| Two-bolt flange bearing | 19 | 1 |
| Four-bolt flange bearing | 71 | 1 |
| Pillow block bearing | 107 | 2 |
| Insert bearing | 128 | 0 |
| Drawn-cup one-way clutch | 11 | 0 |
| Ball-bearing sprag clutch | 32 | 0 |
| Cylindrical thrust roller bearing | 15 | 0 |
| Spherical thrust roller bearing | 39 | 2 |
| Combined needle / ball bearing | 2 | 0 |
| Combined needle / axial roller bearing | 6 | 0 |
| Spherical plain bearing | 117 | 0 |
| Adapter sleeve with locknut | 56 | 0 |
| Radial shaft oil seal | 68 | 0 |
| Wing screw | 117 | 0 |
| Swing eye bolt | 187 | 0 |
| Lifting eye bolt | 18 | 0 |
| Bolt & screw | 2560 | 8 |
| Set screw / grub screw | 459 | 4 |
| Thin hex nut | 25 | 0 |
| Wing nut | 9 | 0 |
| Lifting eye nut | 10 | 0 |
| Coupling nut | 14 | 0 |
| High hex nut | 14 | 0 |
| Square nut | 14 | 0 |
| Flange nut | 9 | 0 |
| Nylon insert lock nut | 32 | 0 |
| Domed cap nut | 14 | 0 |
| All-metal lock nut | 17 | 0 |
| Square washer | 8 | 0 |
| Conical spring washer | 7 | 0 |
| External tooth lock washer | 15 | 0 |
| Threaded rod / stud | 78 | 0 |
| Hex nut | 34 | 0 |
| Flat washer | 131 | 0 |
| Retaining ring / circlip | 127 | 3 |
| E-ring / three-lug retaining washer | 16 | 0 |
| Split spring lock washer | 24 | 0 |
| Slotted spring pin | 95 | 0 |
| Split cotter pin | 141 | 0 |
| Compression spring | 0 | 4 |
| Extension spring | 0 | 4 |
| Torsion spring | 0 | 3 |
| Double torsion spring | 0 | 2 |
| Flat spiral spring | 0 | 3 |
| Worm drive | 0 | 3 |
| Spur gear | 4 | 3 |
| Helical & herringbone gear | 0 | 3 |
| Bevel gear · layout model | 0 | 3 |
| Bevel gear pair · mounting layout | 6 | 0 |
| Straight gear rack | 0 | 3 |
| Profile linear guide | 8 | 0 |
| Round shaft guide | 0 | 2 |
| Ball screw assembly | 219 | 11 |
| Ball screw nut | 129 | 2 |
| Ball screw linear axis | 0 | 6 |
| Flexible jaw coupling | 38 | 0 |
| Open enclosure | 0 | 3 |
| L bracket | 0 | 3 |
| Round spacer | 0 | 3 |
| Utility wheel | 0 | 3 |

## Audit files

- [Supplier inventory](data/promtehimport-inventory.json)
- [Bearing mapping report](data/promtehimport-import-report.json)
- [Hardware mapping report](src/catalog/data/gvyntok-hardware-mapping-coverage.json)
- [Gvyntok source snapshots](src/catalog/data/)

Regenerate this report with `node --import tsx scripts/report-catalog.ts` after refreshing supplier data.

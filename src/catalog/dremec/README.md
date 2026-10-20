# DREMEC source catalog

The two indexed [UA shop pages](https://dremec.ua/shop/) ([page 2](https://dremec.ua/shop/page/2/)) enumerate 28 parent products: 24 standoff constructions and four metal spacer-sleeve groups. Direct UA requests reset their connections during this import, so local WooCommerce variation IDs, current stock and local size combinations are unconfirmed. Parent links are preserved exactly; dropdown sets are not multiplied into variants.

Dimensions and manufacturer order identifiers come from the [official DREMEC manufacturer PDF](https://shop.dremec.de/api/downloads/Dremec_Katalog_Deutsch_doppelseitig.pdf), modified 26 March 2020. The PDF SHA-256 is `747c189d30afb816825a33934aec4f08c1c3154543ba48338f489862ecb9fd55`. Printed pages and PDF page indices are recorded separately because the document uses two-page spreads.

`manufacturer-tables.json` preserves 162 actual size rows on printed pages 8-34, including blank-cell exclusions and the explicit continuous integer-length ranges. `standoffs.json` expands those rows into 4,250 configurations: 1,554 DII female/female, 1,527 DIA female/male and 1,169 DAA male/male. There are 4,207 configurations with complete principal dimensions and 43 with deliberately unresolved thread depth or stud length. Those counts do not mean exact manufacturing geometry is fully specified.

Each record retains its real manufacturer SKU, series, type, body form, material/finish, body length, across-flats width or round diameter, both end designations and source-defined thread spans. Metric, UNC4-40, mixed metric/UNC and external self-tapping constructions remain distinct. The `parameters` object uses the model vocabulary but is nullable source data, not a ready-to-run configuration with invented defaults. `null` means not published. Pitch, exact edge breaks, blind drill tips, DIN 76-B relief dimensions and metal-insert installation geometry remain unspecified. In particular, the two half-depths meeting at the midpoint are not relabeled as a confirmed continuous through thread.

The offline [preset adapter](../dremec-presets.ts) produces 4,318 selectable codes: 3,315 ordinary standoffs and 1,003 nylon/brass composite standoffs. This includes the 4,250 source configurations and 68 separately specified short-stud `k` codes. Metric coarse and UNC pitches are identified as standard interpretations and never marked as independently verified supplier pitches. External ST studs retain the actual source d1 major/d2 root diameters with pitch 0; no unspecified self-tapping helix is fabricated. Unknown holes/studs use explicitly unverified installation envelopes, while confirmed meeting female spans retain both end depths and annotations. Unpublished internal insert dimensions remain 0; actual published external brass stud spans are retained.

Printed page 6 permits a short 6 mm M3 stud only for series 213/214 and 413/414, with suffix `k`. Each affected default 8 mm-stud record retains that separate option; no suffix is silently omitted. Optional no-relief `oF` is retained as an ordering option rather than pretending its detailed relief geometry is specified. Catalog intermediate integer lengths are expanded only when their actual row publishes a range; discrete standard-length rows retain only their filled cells.

Optional bare-finish `bl` and stainless A2 material suffixes are retained without inventing combined options or local variation IDs. All nylon/brass composite lengths use the catalog's +/-0.2 mm tolerance; SW13 metal entries retain the declared `DIN2768-m` policy instead of an invented numeric tolerance. The UA hex nylon female/male and male/male titles say Polyamide 6.0 GV, whereas the 2020 manufacturer series says Polyamide 6.6. Those source differences are recorded explicitly, and equivalence to the current local product is unconfirmed.

`source-products.json` accounts for all 28 UA parents. The four metal sleeve groups publish a freely chosen bore and a manufacturer diameter/length range, not a finite fixed-variant table. The exact steel order example `324/2.1x10` is retained separately. No finite metal-sleeve cross-product is fabricated. Printed page 35 sign holders and page 37 nylon sleeves are outside the offered UA parents and remain excluded.

Rebuild without network access:

```sh
python3 scripts/import-dremec.py --snapshot-only
python3 tests/dremec-import.test.py
```

Retrieve the official source again, or rebuild from a saved PDF with Poppler installed:

```sh
python3 scripts/import-dremec.py --refresh
python3 scripts/import-dremec.py --pdf /path/to/Dremec_Katalog_Deutsch_doppelseitig.pdf
```

Extraction stops if source row counts or length-cell syntax change, preserving the previous saved snapshot. The source ledger distinguishes manufacturer availability evidence from unconfirmed UA variations and stock. The six offline regression checks cover blank cells, actual integer ranges, nullable dimensions, mixed end threads, M3 short-stud exceptions, nylon round/hex depth differences, unknown insert geometry and complete deterministic source accounting. Every saved source row is reparsed and checked against all corresponding configurations.

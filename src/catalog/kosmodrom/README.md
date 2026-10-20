# Kosmodrom M3 standoff source snapshot

The requested [M3 standoff category](https://kosmodrom.ua/mizhplatni-stiyki-z-rizblennyam-m3) contains 126 product identities across nine pages in this snapshot. All 126 individual product pages and all three linked PDF sheets were inspected. Category variants are individual SKU/product URLs; no additional linked category variations were discovered.

`source-products.json` retains technical descriptions and tables, original SKU/model identity, source-page SHA-256, published manufacturer and linked drawings. It omits account, checkout, price, stock and unrelated page data. Source-language labels are JSON escaped to preserve them without introducing literal Cyrillic repository text.

`m3-standoffs.json` contains normalized, nullable parameters and their evidence. `null` means not published or unresolved; it must not silently become a manufactured dimension or a default thread depth. Commercial TFF/TFM/TMM designation hints are stored separately and do not override explicit product tables. `coverage.json` verifies category/product/drawing coverage and summarizes missing parameters and source contradictions.

The linked KLS8-DBK and KLS8-DBL sheets publish E=5 mm across flats and H=5.5 mm corner width for M3, both with lower deviation -0.2 mm and upper deviation 0. They leave L, B and C according to customer requirements. The section drawings show blind female bores, but give no numeric thread depth. H is not treated as a regular-hex-derived value, and the corner/chamfer profile is not fully defined.

TFM-M3X8 explicitly specifies a 4.5 mm wrench width and 6 mm stud. Its 4.5 mm value is retained despite the linked generic DBL E=5 row; the generic H=5.5 is not applied to that variant. TFM-M3X25 lists 31 mm as distance between boards while its designation implies X25: the normalized body length is unresolved, with both values retained. TFM-M3X20/40/50 list overall lengths but do not explicitly publish body/stud lengths in their tables; these are not guessed. TMM products publish two 6 mm studs. Blackened TFM-B models are steel. Manufacturer is retained only when actually named by the product page.

No product in the category explicitly publishes M3 pitch. None of the female-threaded products supplies a numeric hole/thread depth. Source coverage is complete; that does not establish exact manufacturing geometry or engineering approval.

Refresh the public source and rebuild both snapshots:

```sh
python3 scripts/import-kosmodrom.py --refresh --snapshot-date YYYY-MM-DD
```

Reproduce from the temporary HTML/PDF cache without network access:

```sh
python3 scripts/import-kosmodrom.py --offline --snapshot-date 2026-10-13
python3 tests/kosmodrom-import.test.py
```

The cache defaults to `/tmp/protolab-kosmodrom-cache`. An incomplete fetch is reported explicitly and exits unsuccessfully. A failed/partial transfer is discarded before retrying. Product photos are not used to measure or invent dimensions.

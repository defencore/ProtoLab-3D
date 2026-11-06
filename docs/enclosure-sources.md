# Purchased enclosure catalog sources

Snapshot checked on **2026-10-31**. The library imports factual product identifiers, outside dimensions and explicitly published family options. Source links remain attached to every catalog record.

## Coverage

- **488 Altinkaya enclosure families**, covering 36 source subcategories. The source [enclosure overview](https://www.altinkaya.com/en/categories/enclosures) advertised **539** entries at import time.
- **One Grandado project box**, with a photographed **83 × 58 × 35 mm body**, excluding its mounting ears. The source photographs show an opaque white lid, while the retailer title and text call it a clear cover. The [retailer listing](https://gbr.grandado.com/products/2pcs-83x58x35-mm-waterproof-clear-cover-plastic-electronic-cable-project-box-instrument-enclosure-case-white) sells a two-box pack; one library configuration represents one box. Retailer SKU/GTIN: `8799352225248`.
- **51 accessory entries excluded** from the enclosure picker: PCB-holder modules and their parts, loose lids/covers, mounting plates, rubber protection, standalone operator panels, display profile sections/panels/supports, and rack panels/brackets. These are components, not complete enclosure choices. Seventeen have positive dimensions; the other 34 have no complete published outside envelope.

The imported Altinkaya families include DIN rail/panel, waterproof and flanged, hinged, diecast aluminum, handheld/pocket, wall, project, desktop/laboratory, rack, display, protective/storage, and RF shielding enclosures. Display profiles and loose display construction parts do not masquerade as complete enclosures.

## Dimension convention and variable families

Altinkaya uses **A / B / C** on its drawings; their physical meaning varies by family. The catalog stores `length = A`, `width = B`, `height = C`, maps these to X/Y/Z for reference placement, and labels them with the supplier axes. It does not silently rotate or sort their values. The [PR-040 product](https://www.altinkaya.com/en/products/pr-040-plastic-project-enclosure-2202), for example, publishes A=54, B=83, C=30 mm. An aluminum profile's C may instead describe the extrusion length.

**41 families** have variable published outside dimensions. Their source minimum provides the displayed reference envelope. `dimensionOptions` records the known, explicitly published outside sizes for exact filtering; `dimensionRanges` preserves only the minimum/maximum summary for display. Filtering must use the discrete choices before considering summary bounds. A 75 mm C filter therefore does not match AL-052's 50/100/150/200 mm sizes. The record retains `dimensionsSource` and an explicit reference-envelope note.

Examples:

- [EC-1624](https://www.altinkaya.com/en/products/ec-1624-ip67-hinged-plastic-enclosure-13000) offers C depths **53 and 112 mm**. Its reference C is 53 mm.
- [EC-2030](https://www.altinkaya.com/en/products/ec-2030-ip67-hinged-plastic-enclosure-14752) has source Type choices **80, 130 and 187 mm**, including an 80 mm option absent from its abbreviated C feature. Its reference C is 80 mm.
- [AL-052](https://www.altinkaya.com/en/products/al-052-aluminum-profile-enclosure-21495) lists C sizes **50, 100, 150 and 200 mm**. Its reference C is 50 mm.
- [1U aluminum rack enclosure](https://www.altinkaya.com/en/products/19-1u-rack-type-aluminium-enclosure-2420) publishes a C envelope of **66–456 mm**; the Length option labels describe extrusion sizes and must not be copied directly as the assembled outside C. Only its published outside endpoints, 66 and 456 mm, are currently available for exact size filtering. Intermediate assembled sizes require drawing confirmation.

Nominal Type depths are not automatically outside dimensions. EC-1722 publishes outside C=128 mm while its Type labels use 70/130 mm; only the corroborated 128 mm outside value is indexed. EC-3040 publishes outside C=159/200 mm while a Type label says 160 mm; its outside choices remain 159/200 mm. Additional EC-2030 80 mm and EC-912 70 mm options are corroborated by detailed D1 values that agree with the published outside C. Singleton outside values omit both `dimensionOptions` and `dimensionRanges`.

Filter matches identify a compatible family for further supplier configuration. They are not an orderable SKU or an assurance of a specific combination of material, lid, mounting accessories and size. Published `productCodes` are retained for search without inventing variant identities.

## Materials, covers and protection

Product detail specs supply the authoritative material and IP fields; listing cards omit many of these fields. Numeric IP values `65` and `66` are normalized to `IP65` and `IP66`. A rating in a product's own official name may also establish its IP field. An unclassified `V0` value is a flame classification, so it is not treated as a material.

`materialOptions` comes from explicit material choices when the supplier exposes them. A source composite such as `ABS / Aluminum` or `PC/ABS/V0` remains whole; a slash alone does not create independent material choices. `materialFamily` supplies a broader selection group while retaining the original detailed material.

`lidOptions` distinguishes clear, opaque and open options only where the source explicitly lists cover choices. Missing cover information remains unknown. Family-level clear/opaque options do not indicate which lid is currently being ordered.

The Grandado page claims waterproofing but does **not** publish a numeric IP rating. Its IP remains unknown. Grandado is stored as the source retailer, not asserted as the original manufacturer.

### Grandado photographed construction and dimension scope

The six original gallery images are authoritative for the observed construction. Every photographed lid is **opaque white**, despite the retailer's clear-cover title and text. The catalog therefore labels the represented option **Opaque white (pictured)** and keeps the original source URL, record ID and SKU. The title conflict remains explicit rather than creating an unpictured clear-lid variant.

The [dimension-annotated photo](https://images.nexusapp.co/assets/ee/c0/37/75844489.jpg) marks the rectangular **body** as 83 × 58 × 35 mm; its arrows stop at the body corners and exclude the mounting ears. The source record retains these body values with `dimensionScope: body-excludes-mounts`. The complete outside length including the ears is not published and must not be advertised as an exact 83 mm overall envelope. Width 58 mm and height 35 mm refer to the body. The same photo shows **4 mm callouts** at a lid clearance hole and a mounting-ear hole; no engineering drawing establishes screw thread, exact pitches or the full mounting footprint.

The [open-body photo](https://images.nexusapp.co/assets/4e/c8/cf/75844491.jpg), [gasket and hardware photo](https://images.nexusapp.co/assets/1e/66/d5/75844490.jpg), [screw close-up](https://images.nexusapp.co/assets/95/b3/25/75844492.jpg) and [closed reverse view](https://images.nexusapp.co/assets/7a/54/ad/75844488.jpg) show:

- **Four corner lid clearance holes** with recessed seats for four metal cross-head machine screws. Some gallery views show only two screws installed; the hardware view contains all four.
- **Four tall body corner posts**, integrated into the walls, each containing a visible brass threaded insert. The screw diameter, thread and length are not specified.
- **Two integral mounting ears**, centered on opposite short-end walls and projecting along the body's 83 mm axis, close to the bottom plane. Each ear is a broad, rounded triangular tab with one round mounting hole. There are no separate external feet visible.
- **Six short cylindrical floor bosses** with central holes. Their plan arrangement is a perimeter hexagon: one near the center of each short-end wall and two near each long-side wall. They are distinct from the four tall lid posts. The photos do not establish hole depth, thread or whether the holes continue through the bottom.
- A shallow tray-shaped lid with an inner skirt, rounded outer corners and a stepped peripheral sealing path that curves around the corner screw positions. A loose white cord gasket is pictured; its exact section and installed groove dimensions are not published.
- Rounded exterior vertical corners and softened lid/body edges. The side walls appear slightly drafted; no numeric fillet radii or taper angle are published.

Feature counts and relative arrangement are observed facts. Any model values for post size, boss pitch, corner radius, gasket section, ear projection or screw detail remain photographic approximations; the 4 mm callouts must not become an invented wall-thickness specification.

Internal clearances, wall thickness, gasket paths, bosses, precise mounting interfaces and production drawings are not inferred from outside dimensions. The package's reference geometry is for placement and comparison. Use the linked supplier drawing/CAD and selected variant to establish actual fit.

## Rebuilding the factual snapshot

Run `python3 scripts/import-enclosure-catalog.py` with network access, then `node --import tsx scripts/sync-enclosure-catalog.ts` to update the portable preset snapshot. Optional `--cache /path/to/cache` permits a repeatable local review of already retrieved public pages. Cached source HTML stays outside the repository. Verify the refreshed package with `npm run parts:check -- catalog-enclosure`.

The importer follows every linked overview category and all its result pages, deduplicates by the official product template ID, reads each product's public structured detail data, excludes accessory categories and incomplete envelopes, rejects named loose components even when their source category and positive envelope look like a box, and writes `src/parts/catalog-enclosure/lib/catalog-data.json`. It fails on an incomplete category result instead of silently producing a partial catalog. No prices, stock claims or source photographs are imported.

## Explicit accessory audit

Loose parts are excluded by their product role, even when the official site places them in enclosure categories. In particular, the three RT-072 PCB-holder pieces and five DE-195 cover/support pieces do not become small enclosure results. PT-340 is a recessed cabinet front panel; DM-030 is a separately sold indicator cover. EC-3545 is retained because its source description and product image identify a complete hinged, gasketed enclosure despite its abbreviated “Plastic Panel” title. The DM-034 warning-light shell and OP-010 photocell body remain specialized case bodies.

The complete excluded set for this snapshot is:

| Official product ID | Source product name |
| --- | --- |
| 32 | A-135 DE-060 T Mounting Part |
| 33 | DE-060 Profile Corner Support |
| 624 | DE-060 Aluminium Profile |
| 662 | DE-153 Aluminium Profile |
| 666 | DE-153 End Panels ( Single ) |
| 2342 | PT-340 Panel For Metal Cabinet |
| 2523 | RT-072-1 72mm DIN Rail Modular PCB Board Holder (End Section) |
| 2524 | RT 072-2 72mm DIN Rail Modular PCB Holder (Intermediate Part) |
| 2525 | RT-072-3 72mm DIN Rail Mounting Adaptor for PCB Holder |
| 2532 | RT-102 Bottom Lid |
| 2536 | RT-104 Bottom Lid |
| 2540 | RT-106 Bottom Lid |
| 2546 | RT-109 Bottom Lid |
| 2577 | RT-204 Bottom Lid |
| 2581 | RT-206 Bottom Lid |
| 2585 | RT-207-30 Bottom Lid |
| 2589 | RT-209-30 Bottom Lid |
| 3279 | RT-202 Bottom Lid |
| 3646 | DE-060-K Plastic Corner Metallic Gray |
| 3647 | DE-060-K Plastic Corner White |
| 5514 | PT-270-29 Hinged Lid Set |
| 7064 | RT-077-1 (107mm width) PCB Holder (End Section) |
| 7065 | RT-077-2 (107mm width) PCB Holders (17.5mm Intermediate Part) |
| 7066 | RT-077-3 (107mm width) PCB Holder (35mm Intermediate Part) |
| 7067 | RT-077-4 (107mm width) Modular PCB Holder |
| 7068 | RT-075 Wall Mounting Plate (Short) |
| 7069 | RT-076 Wall Mounting Plate (Long) |
| 7438 | DE-195 Flanged Aluminium Cover (High Version) (Black) Set |
| 7439 | DE-195 Aluminium End Panel + Screw (Set) Black |
| 7441 | DE-195 Inner Support Part ( Black ) |
| 7926 | DM-030 Led Indicator Cover (Transparent) |
| 9592 | RT-203 Bottom Lid |
| 10126 | RT-212-30 Bottom Lid |
| 12244 | DE-153 plexiglass panel |
| 12312 | DE-195 Flanged Aluminium Cover (High Version) (Black) |
| 12313 | DE-195 Upper Flanged Aluminium Panel + Screw ( Set ) Black |
| 12572 | DE-060-K Plastic Corner Part ( Dark Gray ) |
| 13335 | DE-153 End Panels ( Set ) |
| 15295 | RT-106-S Terminal Block End Cap |
| 21252 | RT-072 DIN Rail Modular PCB Board Holder - 72 mm |
| 21253 | RT-077 DIN Rail Modular PCB Board Holder - 107 mm |
| 22104 | HH-095 Rubber Protection |
| 25398 | RT-043-1 (43 mm width) PCB Holder - Side Cover |
| 25399 | RT-043-2 (43 mm width) PCB Holder - Spacer - 17.5 mm |
| 25401 | RT-043-3 (43 mm width) PCB Holder - Spacer - 35 mm |
| 25402 | RT-043-4 (43 mm width) PCB Holder - DIN Rail Connector |
| 25404 | RT-043 DIN Rail Modular PCB Board Holder - 43 mm |
| 28849 | 19" Steel Rack Blanking Panel |
| 28850 | 1U 19" Rack Blank Panel |
| 28870 | Rack cabinet cable management bracket – 1U |
| 28917 | 19" Rack Mounting Bracket |

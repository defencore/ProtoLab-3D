# Enclosures and devices catalog

The **Enclosures & devices** collection groups complete device enclosures by use. It separates purchased supplier enclosures, general-purpose shells and enclosures designed around a specific electronic platform. Reusable switches, boards, batteries, connectors and hardware stay in their own component collections.

## Current structure

| Subgroup | Library family | Configurations |
| --- | --- | --- |
| **General-purpose enclosures** | **Enclosures** | Purchased supplier models, editable shells, printed closure designs, Field DAQ, underwater housings and tube mounting details. |
| **Handheld controllers** | **Handheld LoRa controller** | Heltec V4 Straight, Palm and Palm Lock bodies, with independent antenna choices. |

The Enclosures entry is a shared catalog of twelve physical packages. Its model chooser retains each member's package ID, preset ID, source evidence, geometry and make or buy policy. Purchased `catalog-enclosure` articles remain distinct from authored `enclosure`, `field-daq-enclosure`, `grandado-tube-mount`, `jcg108-tube-fairing`, `underwater-pressure-enclosure` and the six `printed-*` definitions. The fairing remains an engineering reference. See the complete membership in [the library map](library-structure.md).

The Heltec family has one set of shared electronics and assembly interfaces. Its body and antenna configurations stay together in its configurator and preset browser. Reusable switches, boards, batteries, connectors and hardware retain their functional library locations.

## Selecting a purchased enclosure

Open **Enclosures & devices → General-purpose enclosures → Enclosures**, then choose the catalog/supplier and enclosure type. **Outside A (X), B (Y) and C (Z)** filters compare published dimensions in millimetres, preserving the supplier's axis order; set maximum values to limit the installation envelope. A/B/C do not consistently mean length/width/height across supplier categories. More characteristics expose material, mounting, cover type and exact IP rating where published. Facet counts reflect the other active filters. Missing source values never satisfy an active characteristic filter.

Use **Smallest outside volume** or individual dimension sorting to compare the remaining models. Volume is calculated from the published outside dimensions; it does not describe usable internal space. Variable-size families expose source ranges and use an explicitly identified reference envelope; sorting puts models without an exact scalar dimension last. The selected preview remains visible when a filter excludes it, until another model is chosen. Each article retains a direct source link.

The source catalog categories organize the models inside the shared Enclosures chooser rather than adding hundreds of sidebar entries. Related accessories are excluded from enclosure selection. A catalog product family may have selectable material or lid variants at the supplier; unspecified choices stay unpublished. Most 3D models are reference shells matching published outside envelopes. Grandado has a dedicated photo reconstruction with lid fasteners, base ears and internal PCB bosses. Its published 83 mm body length excludes the ears; the complete modeled 110 mm length is an estimate and does not become an exact source filter value. Unmeasured installation details require the supplier drawing or a sample. See [source coverage and import evidence](enclosure-sources.md) and the [catalog package guide](../src/parts/catalog-enclosure/GUIDE.md).

## Naming order

Use **device family → body model → antenna type → external position**. A preset's `name` is the canonical title in selectors and search results, following the [library naming conventions](library-naming.md).

For this family, the title pattern is:

`Heltec V4 · {Straight | Palm | Palm Lock} · {External SMA | Internal FPC}`

Append `· {Bottom | Top | Compact top}` only for External SMA. For example, **Heltec V4 · Palm · External SMA · Compact top** and **Heltec V4 · Palm Lock · Internal FPC**. Internal configurations omit the inactive external position even though the parameter retains its stored value.

| Axis              | Visible names               | Meaning                                                                                                 |
| ----------------- | --------------------------- | ------------------------------------------------------------------------------------------------------- |
| Body model        | **Straight**                | Tapered body with two guarded side buttons.                                                             |
| Body model        | **Palm**                    | Rounded palm profile with two guarded side buttons.                                                     |
| Body model        | **Palm Lock**               | Palm profile, recessed thumb-web second control and captive sliding safety with a recessed metal clamp. |
| Antenna type      | **External SMA**            | External antenna interface using the modeled SMA pigtail installation.                                  |
| Antenna type      | **Internal FPC**            | Adhesive-film antenna packaging reserve inside the lid; no purchased antenna is selected.               |
| External position | **Bottom · USB end**        | SMA mount beside USB.                                                                                   |
| External position | **Top · power end**         | Recessed keyed SMA seat near the power key.                                                             |
| External position | **Compact top · power end** | Same current recessed top seat; retained preset selection.                                              |

Body model and antenna type are independent library facets. External position is a conditional configuration control for External SMA. Battery dimensions, guard projection, button poses and blocker poses describe an individual configuration and do not become library facets.

Names describe physical differences, without chronological labels such as Original, Earlier, New or Latest. Keep actual supported platform revisions, such as Heltec V4, when they affect fit. Retain supplier designations in their source records; prototype titles do not claim manufacturer SKUs, antenna selection or production qualification.

## Expanding the collection

- Add a new electronic platform or device architecture as a separate part package with its own stable ID, product definition, geometry, evidence, parameters and guide. Place it in the subgroup matching its use, such as Handheld controllers. A genuinely different use can add a subgroup when it offers a meaningful navigation choice.
- Add a body around the same platform as a new `bodyModel` value and its presets when it shares the family's assembly interfaces and configurator. Name the grip or control difference directly, then reuse the independent antenna axis where supported.
- Add antenna or connector installation choices to their own axis rather than encoding them into body names. Only offer combinations that the geometry and assembly instructions support. A preset is a useful starting configuration, not a duplicate device family or an invented supplier article.
- Keep part IDs, preset IDs, parameter keys and values stable during naming changes. Preserve existing presets when adding alternatives. Public names may improve without migrating geometry or changing saved configurations.
- Introduce a shared browse-family group only when multiple actual device packages need it. Do not add a second family layer for the current single Heltec platform.

The [Heltec family guide](../src/parts/handheld-lora-controller/GUIDE.md) lists all seven starting configurations and the installation limitations. Exact supplier dimensions, provisional packaging reserves and physical release checks remain in the family evidence and guide rather than the name.

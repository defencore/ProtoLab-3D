# SRS Igniter — adjustable exterior layout

Located in **Electronics & vision → SRS Airbag** beside the SRS pigtail connectors.

The variant 2 preset uses the supplied drawing: maximum diameter 11 ±0.1 mm, total height 22.5 ±0.2 mm including contacts, and exposed pin length 7.3 mm. It replaces the earlier cylindrical placeholder; dimensions now refer explicitly to the entire exterior including pins.

Six editable dimensions control the housing, total height, cap diameter/height, collar and lower boss. Intermediate shoulder heights scale with the remaining housing height. Undimensioned proportions are approximate. Cap diameter 7.6 mm is from the earlier user description, not a dimension on the new drawing. The tolerance values are source notes, not clearance allowances.

The pins stay fixed when the body changes. The 4 mm center spacing follows the existing CA281A library reconstruction; Ø1 mm is illustrative. Amphenol identifies CA281A as an Ø11 mm VDA-AK1 / NFR 13-483 family, but its public sheet does not establish these male pin dimensions. No real connector compatibility is asserted. A keyed receptacle, retainer, latch seats and all internal construction are omitted.

Preview and FreeCAD export contain four closed exterior solids: housing, cap and two pins. These are layout volumes, not hollow functional components.

Reference: supplied drawing (original reference, not bundled).

Validation: `npm run parts:check -- srs-igniter` and `node --import tsx --test tests/srs-igniter.test.ts`.

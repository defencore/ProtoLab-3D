# Ball screw assembly

This folder owns this part's parameter schema, defaults, preview, FreeCAD recipe, validation and catalog presets. Edit or replace the folder without changing another part.

- `part.ts`: definition and local model behavior. Factory-based definitions use private helpers under `lib/`.
- `configurator.ts`: ordered catalog size selectors. The numeric/conditional parameter schema belongs to the definition in `part.ts` or its private factory.
- `presets.json`: complete catalog and example parameters, IDs and source metadata.
- `lib/`: private domain helpers and reference values. Edits here affect this package only.
- `index.ts`: API version, stable part ID and display order.

Only the generic geometry SDK under `src/core` is shared. Run `npm run parts:check -- ball-screw` to check this package and `npm run parts:export -- ball-screw <output-folder>` to prepare a runnable handoff with the SDK and available external source links.

## Custom journal retaining grooves

With **Machined · custom journals**, the fixed and support journals each have an optional retaining-ring groove. A groove diameter of zero disables that groove and preserves the cylindrical stock geometry. Width is axial; offset measures in +Z from the low end of that journal. Both faces must remain within the selected journal length, and the groove diameter must be smaller than the journal diameter. The drive journal has no retaining groove.

These are physical machining features in both Simple and Full, including screw-only exports. Stock presets leave both grooves disabled. A nonzero groove is a custom end execution, not a verified supplier end code. Specify groove tolerances, corner radius, end land and ring compatibility on the shaft drawing; the geometry does not establish a retention load rating.

## KAIYADE SFK and End Machine references

The complete supplied KAIYADE table (printed page 17) adds 15 separate nut references: SFK0401, 0601, 0801, 0802, 0825, 1002, 1004, 1202, 1204, 1205, 1402, 1602, 2002, 2502 and 2503. These retain their own load ratings and counterbores rather than replacing existing Wangong references. The 8 mm / 2.5 mm lead model is searchable as **SFK08025**, **SFK0825** and **SFK082.5**. Each KAIYADE reference has the supplied 100–550 mm length options in 50 mm increments. Length is overall shaft length, including journals.

Choose **End Machine · EK6/EF6 0802 reference** to apply the attached 0802 drawing to an 8 mm SFK shaft: fixed journal Ø6 × 30 mm, drive Ø4 × 8 mm, support Ø6 × 9 mm, and support retaining groove Ø5.7 × 0.8 mm. The groove starts 6.8 mm from the support shoulder. The fixed journal includes the nominal envelope of an M6×0.75 thread over its final 10 mm toward the drive journal; the thread form, fits and chamfers are not modeled. The named execution fixes these dimensions in preview and FreeCAD export. Choose custom journals to edit them.

Unmachined and End Machine variants are supplied for each 8 mm KAIYADE reference. Only SFK0802 has the dimensioned end drawing. End Machine variants for SFK0801 and SFK08025 reuse its nominal end envelope as a layout reference; these journal fields are not marked verified for those leads. Changing to Unmachined disables retaining grooves. The named execution rejects other shaft diameters.

The supplied dimension table (page 17), designation coding (page 9) and EK6/EF6 0802 drawing remain the dimensional evidence. No verified public copy of these attachments is available. The AliExpress listing could not be accessed for current variation verification. Source length/type options are transcribed from the supplied material and existing listing references; supplier interchangeability with the KAIYADE table remains unverified. Accuracy class, preload and manufacturing process are requested metadata rather than certificates.

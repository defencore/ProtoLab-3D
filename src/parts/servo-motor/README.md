# Servo motor

One catalog selector for eight fixed supplier configurations: Waveshare ST3215-HS, KST X10 Mini Pro-A and Pro-B, KST X10 V8.0, KST X10 Pro-A and Pro-B, Power-HD T60-BHV, and Power-HD TDS-2. `presets.json` owns the complete catalog, source evidence and read-only search attributes. Numeric characteristics filter models; they are not editable geometry.

`catalogSelectionOnly` enables the manufactured-model picker. `lib/catalog-fields.ts` declares 16 `catalogFilterFields` for dimensions, torque, speed, current, voltage and construction. Numeric filters use inclusive bounds; selecting a result loads its stored model, while changing filters alone leaves the preview unchanged. Field summaries and measurement conditions come from catalog attributes, not geometry parameters.

The only public parameters are `model`, `outputAngle`, `showHorn`, and `hornStyle` (the ST3215 single arm or supplied disc pair). States are `assembled`, `exploded`, and `body`. Model changes constrain the output angle to the selected servo's published travel. Case, shaft and mounting dimensions are fixed per model. Unknown retired dimensional parameters fail validation.

Private `lib/catalog-models.json` records each fixed geometry input and source evidence, including approximations for undimensioned details. `lib/models.ts` dispatches to private Waveshare, KST and Power-HD geometry families. Both Power-HD servos use the same geometry implementation with different fixed records. JavaScript meshes and FreeCAD shapes use the same dimensions and placements.

The Waveshare case has unequal front/rear mounting patterns and an optional supplied disc pair. KST A/B retain their distinct side/flat mounting arrangements and 25-tooth shaft geometry. Power-HD uses smooth shaft envelopes and illustrative mounting cutout diameters. Optional single arms are fixed illustrative accessories. These external installation models do not simulate internal mechanisms, torque or electrical operation.

Published torque and speed values are associated with a reference voltage. Current attributes carry their own test conditions, since the source may not state a voltage. Missing or ambiguous current values remain unknown and are excluded by a numeric current filter. All primary sources and discrepancies remain in the catalog specifications and geometry evidence.

Power-HD numeric currents use the 7.4 V datasheet column. Waveshare publishes current without a test voltage; its 12 V torque/speed reference is not assigned to current. KST has no numeric current ratings used here, and TDS-2 stall current is omitted because its V1 sheet uses the charge unit mAh. `verifiedParameters: ['model']` preserves manufacturer identity after pose, horn or state changes without certifying illustrative geometry details.

ST3215 uses `lib/waveshare/native.json`, baked from the unchanged manufacturer STEP by `scripts/import-st3215.py`. Eight native solids replace the former constructed casing/shaft/discs. Preview meshes and embedded compressed BREP share the same source and coordinates. A 0.00001 mm internal cavity repair makes the rear cover valid without changing external surfaces. Original overlapping components are preserved; validation distinguishes those source overlaps from new interference. The default ST3215 selection shows both supplied discs.

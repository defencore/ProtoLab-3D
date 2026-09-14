# Gears from the supplied images

The two saved images are anonymous user-supplied references. Their dimensions are transcribed data, not manufacturer certification. No price or manufacturing-tolerance claim is imported.

## Miniature spur pinions

The four presets use module **0.5**, **11 / 13 / 15 / 17 teeth**, and a **2.98 mm bore**, as shown in `public/references/spur-pinion-options.png`. Width **5 mm**, pressure angle **20°**, and tooth-thinning allowance **0.02 mm** are editable prototype assumptions. The image does not specify these values.

The new small-pinion layout option permits tooth counts below the unshifted rack-cutter undercut limit. It retains sampled involute flanks with radial root relief; it does not imply a manufactured profile shift or reproduce cutter undercut. The existing unshifted mode continues to reject those low tooth counts.

## Bevel mounting pairs

The six presets contain both members of every pair in `public/references/bevel-gear-dimensions.png`:

| Module | Pinion / wheel | Pinion bore interval | Wheel bore interval |
| ------ | -------------- | -------------------- | ------------------- |
| 1      | 20 / 40        | 6–8 mm               | 8–12 mm             |
| 1.5    | 15 / 30        | 6–10 mm              | 8–12 mm             |
| 1.5    | 18 / 36        | 8–12 mm              | 10–16 mm            |
| 1.5    | 20 / 40        | 8–12 mm              | 12–20 mm            |
| 2      | 15 / 30        | 8–15 mm              | 14–20 mm            |
| 2      | 20 / 40        | 12–16 mm             | 16–30 mm            |

All twelve table rows are retained in `src/catalog/reference-gears.ts`. The configurator exposes **D** outside diameter, **A** back-face mounting distance, **F** overall axial length, **G** large-end tooth-tip position, **Z** slant face width, **N** hub diameter, **H** hub / large-root position, and **L** small-end root position. Axial positions are measured from the back hub face.

The assembly origin is the intersection of the perpendicular shaft axes. Assembly and separated views export two independent solids. Pinion-only and wheel-only views center the selected part on its own bore axis. The bore can be adjusted continuously within the supplied interval; the image does not justify inventing discrete stock bore combinations.

Preset search compares requested bore values or ranges with those source intervals. For example, a 7 mm pinion bore finds the 6–8 mm reference. Results distinguish the source interval from the preset's selected bore; applying the preset retains the values shown in its review.

Both models include editable smooth radial set screw holes. Their diameter and thread detail are unspecified by the image, so the default 3 mm hole is not a source-verified parameter. Pressure angle and tooth thinning are also prototype settings.

The paired teeth retain the supplied envelopes with a faceted, tapered involute-like profile. They are not generated conjugate bevel tooth surfaces. The source has insufficient information for tooth corrections, root fillets, contact analysis, strength ratings or interchangeable manufacturing geometry. Linked rotation illustrates the tooth ratio; it does not certify transmission contact.

Both root annuli are planar at **H** and **L**. Local radial patches connect these planes to the raised tooth-end contours at **G** and **F**. Full flank samples retain the involute curvature; the module does not triangulate across unrelated teeth or stretch a tooth-tip height through the central face. The preview and FreeCAD share this boundary construction.

## Validation

The end-face repair has a [17-case native FreeCAD audit](../data/bevel-pair-native-validation.json). It covers all six catalog pairs, all four display states on the first two pairs, hex/D/keyway bores, maximum bores at 37° rotation, and 128 inside/outside root-plane probes. All checked assemblies have zero measured component intersection. Every case preserves valid separate solids through STEP and FCStd round trips. Preview tests additionally sample both planar annuli on both gears for every preset and check closed, consistently oriented triangles for all seven shaft profiles.

To reproduce a small native smoke check, run `node --import tsx scripts/verify-bevel-pair.ts`, then run `scripts/verify-bevel-pair.py --intersections` using a FreeCAD-enabled Python. The preparer's optional `--matrix` expands to every catalog state and all seven bore shapes.

The reference expansion was checked in native FreeCAD using 46 cases: all assembly and separated states, both bore endpoints for each individual bevel gear, linked 37° rotation, and the four miniature spur pinions. All generated solids and STEP round trips were valid. The maximum preview/native volume difference was 0.067%; all checked pair positions had zero component intersection. This sampled geometry check does not establish continuous conjugate contact or a load rating.

A separate 48-case preview check covered six bevel pairs, both bore limits, two rotations and both independent component exports. All meshes were closed and outward oriented. The automated gear test suites also retain the existing involute, helical, rack and generic bevel regressions.

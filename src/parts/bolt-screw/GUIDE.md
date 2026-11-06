# Bolt & screw

This folder owns this part's parameter schema, defaults, preview, FreeCAD recipe, validation and catalog presets. Edit or replace the folder without changing another part.

- `part.ts`: definition and local model behavior. Factory-based definitions use private helpers under `lib/`.
- `configurator.ts`: ordered catalog size selectors. The numeric/conditional parameter schema belongs to the definition in `part.ts` or its private factory.
- `presets.json`: complete catalog and example parameters, IDs and source metadata.
- `lib/`: private domain helpers and reference values. Edits here affect this package only.
- `index.ts`: API version, stable part ID and display order.

Only the generic geometry SDK under `src/core` is shared. Run `npm run parts:check -- bolt-screw` to check this package and `npm run parts:export -- bolt-screw <output-folder>` to prepare a runnable handoff with the SDK and reference assets.

## Source-qualified Accu button screw

`bolt-screw:accu-ssb-m2-5-10-a4` is the manually transcribed Accu
`SSB-M2.5-10-A4` execution. Its [supplier specification](https://www.accu.co.uk/socket-button-screws/8270-SSB-M2-5-10-A4)
and [technical sheet](https://www.accu.co.uk/api/product-datasheet?id=8270)
give M2.5×0.45, 10 mm under-head length, head diameter 4.7 mm
(+0/−0.2), head height 1.5 mm (+0/−0.14), 1.5 mm hex drive and
1 mm minimum socket depth. The model uses the maximum head dimensions and
minimum socket depth. Material is supplier-described marine A4; no strength
class, tightening torque, availability or purchase is inferred.

No supplier CAD is imported. Dome curvature, edge radii, under-head fillet,
actual threaded length/runout and tip chamfer remain authored reference
geometry. Check those details when they govern an interface. The existing
Gvyntok M2.5 button execution retains its own ID and dimensions: its linked
table begins at M3 and does not establish the missing M2.5 head dimensions.
Dimensions from the Accu execution must not be silently assigned to that
different supplier product.

This entry is owned locally by the package. The established merge-based
`sync-package-catalogs.ts` path retains unmatched source URLs and IDs; it is
not an authoritative replacement of this family. A refresh must preserve the
Accu record and all other existing records. No registry, family, parameter
schema or Model state was added for this execution.

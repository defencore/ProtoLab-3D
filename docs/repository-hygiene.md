# Repository artifacts

Keep generated CAD, STL/STEP exports, printer toolpaths, screenshots, validation reports, temporary package imports and recoverable backups under ignored `test-results/`. Source packages contain the reviewed native geometry and compact parameter data used to build the products. Record external URLs for reference drawings, photos and documents. Store private attachments outside the checkout and record their provenance and availability in the relevant guide.

Reviewed library-organization policy, section analyses, identity/grouping decisions
and their verification summaries belong in `docs/`, including
[Library organization](library-organization.md) and its
[section review](library-organization-audit.md). Preserve enough context, results
and remaining findings for a clean checkout; these documents must not depend on
ignored logs or snapshots. Raw generated validation output stays in `test-results/`.

Run `node scripts/check-repository-artifacts.mjs` to inspect both tracked files and the local filesystem. The check includes ignored files so an ignore rule cannot hide misplaced CAD or reference attachments. Output/cache trees must also remain untracked. Standard dependency, build and interpreter cache directories are excluded from the filesystem scan.

`data/` retains the reviewed library expansion manifest. Generate raw supplier inventories and per-product import reports under `test-results/catalog/` or another local directory outside the checkout. Compact catalog presets and reviewed coverage remain available from a clean checkout. Raw historical validation output records a previous run. Keep reviewed results and their limitations in the relevant documentation.

Part replacement backups live in `test-results/backups/part-modules/`; catalog snapshot backups live in `test-results/backups/catalog-snapshots/`. Imports use `test-results/.staging/` and remove their staging directory when finished. Existing backups are preserved for manual recovery.

The two recovery macros in `docs/recovery/` are authored utilities, so the guard explicitly permits them. Other generated FreeCAD macros belong with their exports in `test-results/`.

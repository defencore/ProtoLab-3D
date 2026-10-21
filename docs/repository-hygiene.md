# Repository artifacts

Keep generated CAD, STL/STEP exports, printer toolpaths, screenshots, validation reports, temporary package imports and recoverable backups under ignored `test-results/`. The browser library's reviewed native JSON, source tables, reference images and authored geometry remain in their source packages.

Run `node scripts/check-repository-artifacts.mjs` to inspect both tracked files and the local filesystem. The check includes ignored files so an ignore rule cannot hide misplaced CAD. Output/cache trees must also remain untracked. Standard dependency, build and interpreter cache directories are excluded from the filesystem scan.

`data/` retains three reviewed inputs: the supplier inventory, supplier import decisions and library expansion manifest. Historical validation results belong under `test-results/`; their presence there records a previous run and does not establish that current code has passed.

Part replacement backups live in `test-results/backups/part-modules/`; catalog snapshot backups live in `test-results/backups/catalog-snapshots/`. Imports use `test-results/.staging/` and remove their staging directory when finished. Existing backups are preserved for manual recovery.

The two recovery macros in `docs/recovery/` are authored utilities, so the guard explicitly permits them. Other generated FreeCAD macros belong with their exports in `test-results/`.

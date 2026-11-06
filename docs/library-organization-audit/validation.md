# Organization verification record

Historical validation of the integrated organization change, 2026-11-03: 341 physical packages, 20,514 presets and 225 browse entries. This page preserves the completed results in the repository; it is not a claim that the checks were rerun when these documents were relocated. See the [integrated review](../library-organization-audit.md) and [independent review](review.md).

## Completed checks

| Command or check                                                                                        | Recorded result                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run parts:check`                                                                                   | Passed: all 341 package boundaries, IDs, APIs, configurators and 20,514 default/preset configurations validated.                                   |
| `npm run typecheck`                                                                                     | Passed.                                                                                                                                            |
| `npm run typecheck:tests`                                                                               | Passed, including the final expectation updates.                                                                                                   |
| `npm run build`                                                                                         | Passed; existing large-chunk warnings remained.                                                                                                    |
| Targeted test command below                                                                             | 131 passed, one native-CAD helper test skipped, zero failed or cancelled; 132 tests total.                                                         |
| New organization test file                                                                              | Four tests passed: functional grouping, exact-ID/configuration links, localized search, and gear-type separation. Included in the final broad run. |
| Updated standalone-label and rendered-navigation test files                                             | Sixteen tests passed on their targeted rerun; included in the final broad run.                                                                     |
| Prettier check of central changed files and the integrated review                                       | Passed.                                                                                                                                            |
| `git diff --check`                                                                                      | Passed for the complete worktree.                                                                                                                  |
| Language check of the 68 task-changed files with `scripts/check-repository-language.mjs`'s `textIssues` | Passed: no issues.                                                                                                                                 |
| `npm run check:language`                                                                                | Failed with 26 existing language/README issues outside the edited files.                                                                           |
| `npm run check:artifacts`                                                                               | Failed with four existing file-location issues outside the edited files.                                                                           |

The final targeted test selection was:

```sh
node --import tsx --test --test-reporter=tap --test-concurrency=1 \
  tests/library-organization.test.ts \
  tests/library-labels.test.ts \
  tests/library-names.test.ts \
  tests/library-naming.test.ts \
  tests/library-browse-labels.test.ts \
  tests/library-catalog-families.test.ts \
  tests/library-categories.test.ts \
  tests/library-navigation.test.ts \
  tests/library-search.test.ts \
  tests/library-identity.test.ts \
  tests/library-identity-ui.test.ts \
  tests/catalog-family-options.test.ts \
  tests/enclosure-navigation.test.ts \
  tests/part-selection.test.ts \
  tests/configuration-identity-renames.test.ts \
  tests/eskd-identity.test.ts \
  tests/product-library.test.ts \
  tests/physical-library-composition.test.ts \
  tests/mechanism-catalog.test.ts \
  tests/printed-enclosure-library.test.ts \
  tests/printed-joint-library.test.ts \
  tests/panel-indicator.test.ts
```

The skipped test was **native supplier CAD helpers follow authored features when installation labels change** in `tests/physical-library-composition.test.ts`; it requires `FREECAD_PYTHON`. Its skip is not a native-CAD pass.

The first broad integration run found three assertions tied to former browse labels and standalone grouping. The expected labels were updated, and standalone metadata was exercised separately from shared catalog presentation. The final broad run passed with the counts above.

## Existing repository issues recorded by the checks

The 26 global language/documentation failures were literal Cyrillic in the Grandado packaging script, worm-fin search terms and configuration-link test fixtures, plus thirteen package README files that differed from the universal package README. None of the 68 files edited by that organization pass was implicated.

The four global artifact-location failures referred to:

- `data/rov-project-sources.json`
- `data/rov-research-audit.json`
- `data/rov-research-sources.json`
- `result.json`

The organization change did not move or rewrite those files. These dated results should be reassessed against the current worktree before being used as a current release checklist.

## Identity comparison and limits

The runtime inventory comparison retained all package IDs/order and per-package preset counts. Parsed original/current comparisons established that the 109 edited preset records changed only their visible `name`; IDs, numeric parameters, product overrides, catalog designations, source URLs/hashes and evidence remained intact. The independent reviewer also checked state IDs/labels, parameter keys/types/units/groups, catalog membership, unique browse labels and exact first/last model-ID resolution.

Native construction functions, physical composition and state semantics were not edited. No new FreeCAD topology, load, fit, motion or manufacturing qualification was performed. Outstanding identity migrations and meaningful-state corrections remain listed in the integrated review.

Optional raw logs, TAP output, inventory snapshots and task-local originals are retained under ignored `test-results/library-organization-audit/`. They are transient verification artifacts. The review scope, decisions, results, known failures and limits are preserved here without requiring those local files.

## Documentation preservation and standing organization role

The documentation follow-up on 2026-11-03 preserved all seventeen section reviews,
the independent review and this validation summary in `docs/`. The integrated
review links to those repository pages. `docs/library-organization.md` defines
the ongoing workflow, and `AGENTS.md` requires `library_organizer` involvement
before package creation and during every affected library task, coordinated with
`library_curator`.

Document checks passed for all 27 affected documentation files: 140 local links,
including five heading links, resolve; no required link points into
`test-results/`; no file is ignored by Git; and no literal Cyrillic was found.
Formatting and whitespace checks passed. Independent policy review found no
conflict in role ownership, reuse-before-creation, Package ID allocation,
parameterization or source preservation. The artifact policy was clarified to
distinguish raw historical validation output from reviewed documentation.

This follow-up changed documentation and agent instructions only. The application,
package, geometry and build results above remain historical results of the
organization implementation; they were not rerun for this documentation change.

## Code correctness follow-up, 2026-11-03

The repository code review assigned one agent both `library_organizer` and
`library_curator` responsibilities for shared selection, import and identity
behavior. The organization decision was to reuse every current physical
definition and its existing collection → section → subgroup → family placement.
No Package ID, preset ID, browse family, parameter key, parameter group or source
dimension was allocated, removed or moved. The changes correct shared contracts
rather than introduce duplicate products or alternative navigation branches.

The following defects were corrected:

- Shared parameter validation now rejects state IDs whose `availableWhen`
  condition is false. Default selection and module replacement choose an
  available state, including after invalid parameter combinations are repaired.
  Physical product normalization in ESKD, projects and BOM grouping evaluates
  availability using the actual configuration parameters. Inspection views
  continue to normalize to the applicable physical execution.
- JSON files, configuration links and saved local configurations share one import
  validator. Explicit `presetId` values retain the selected supplier execution
  when several presets have identical parameters; unknown or stale explicit
  identities are rejected. Existing version-one files without that optional
  field remain supported, together with the established import migrations.
  Invalid local entries are isolated instead of discarding unrelated valid
  saves. Application import/export and save/load retain the selected identity.
- Boolean catalog filters now accept source-verified parameter values as well as
  published attributes, consistent with catalog facets. Unknown values still do
  not match. The servo-current expectation includes the already registered
  TowerPro MG996R source; its current test voltage remains explicitly unknown.
- Project creation omits a stale preset reference when an edited configuration
  is treated as custom. Stored project configurations reject explicit preset
  references that disagree with their parameters. Empty project IDs are
  rejected. Project validation and supply-row generation index configurations
  and child occurrences instead of repeatedly scanning the full occurrence list.

The focused shared-contract run passed **47 tests**, with zero failures,
cancellations or skips:

```sh
node --import tsx --test --test-concurrency=1 \
  tests/part-selection.test.ts \
  tests/catalog-models.test.ts \
  tests/storage.test.ts \
  tests/configuration-link.test.ts \
  tests/assembly-bom.test.ts \
  tests/eskd-identity.test.ts
```

The full existing configuration round-trip contract also passed across the
current catalog and all available states. A second integration run passed
**18 tests** across `library-identity`, `library-organization`,
`configuration-identity-renames` and `catalog-family-options`, covering global
ID uniqueness, exact lookup, hierarchy/search agreement, retained source
identity, established migrations and catalog choices. The project owner separately ran its
focused project regressions. A local before/after measurement of the same
10,000 sibling occurrences reduced `validateProject` from 557.4 ms to 28.0 ms
and `supplyRows` including validation from 948.1 ms to 22.2 ms. Identity and BOM
quantity remained unchanged. These are single local measurements, not a
general performance guarantee.

This follow-up changes shared software behavior only. Native geometry and
engineering qualification were not changed or newly certified. The outstanding
package-specific identity migrations and state-modeling findings above remain
separate work; the shared availability correction does not implement missing
inspection geometry.

### Catalog package ownership follow-up

The complete ordinary test run exposed stale catalog assumptions and two package
contract defects. The existing enclosure model selector was incorrectly marked
`filterable: false`, which caused `parametersForPreset` to retain the previous
fixed product when another enclosure article was selected. The model field is
now an ordinary product selector; a regression switches between Grandado and a
different actual article in both directions.

The flanged-bearing package previously appended three SMB models and enriched
titles at runtime. Its eleven complete records now live in `presets.json`, with
the existing actuator helper selecting the same physical models. Six existing
ROV purchased-product packages likewise generated eight model records from
`lib/catalog.json` while leaving their owning `presets.json` empty. Those exact
records now live in their packages and are consumed directly by the shared
purchased-product reader. The existing normalization script writes the catalog
records together with its source metadata and native assets; metadata generation
was checked independently without regenerating geometry.

All current runtime catalog records were compared against their owning JSON
files. The eleven flanged-bearing and eight ROV records also compare exactly
against the pre-refactor runtime data, including IDs, names, dimensions, source
URLs, hashes, classifications and evidence. No package, model or browse identity
was created, removed or reassigned. ROV placements and native assets were not
changed. The six owning packages remain `metal-servo-horn`,
`metal-servo-bracket`, `qfs2025-servo`, `underwater-thruster`,
`ms5837-depth-sensor` and `underwater-pressure-enclosure` in their established
functional catalog locations.

The source-audit test now requires schema fields according to their actual
visibility and `optionalWhenHidden` contract. Hidden, unsourced WING MINI hole
pitch references are not inserted into unrelated flight-controller presets.
Electronics bounds tests compare published dimensions only when those values
exist; the BEC12S-PRO installation reference retains unknown catalog dimensions.
Count changes were traced to exactly one already-added execution each:
`bec:bec12s-pro`, `bolt-screw:accu-ssb-m2-5-10-a4`, and
`faulhaber-bx4:2250s024bx4-6855`. The fastener check separately retains all
5,871 imported supplier codes and the one Accu code, rather than treating the
new supplier as another imported inventory row.

The eight originally failing or directly added catalog regressions passed on the
final code across `catalog-data`, `catalog-enclosure`, `electronics`, `fasteners`,
`faulhaber` and `module-isolation`. Another 26 integration tests passed across
`module-isolation`, `miniature-bearings`, `prom-actuator-bearings` and
`rov-projects`, including closed preview envelopes, retained purchasing SKUs,
shared installed products, BOM quantities, configuration insertion and native
recipe source identity. The Python metadata generator matches the eight stored
ROV presets and its syntax check passes. Whole-worktree whitespace checks pass.
These checks preserve existing geometry; they do not add source-dimension or
application-load qualifications.

### Inspection allowance and ordered source identity

Independent curator review accepted the shared `catalogIdentityParameters`
contract replacing the CNC-only nut whitelist. The nut family normalizes its
documented, finite 0–0.2 mm `threadAllowance` only when both source/default
allowances are nominal zero and the source does not publish that field through
verified parameters, attributes, alternatives, ranges or discrete choices.
Published source data always takes precedence. Other geometry parameters still
require an exact match, and families without an explicit hook retain their
existing identity rules.

This normalization is used only to match the ordered source. It does not alter
input parameters, geometry, physical configuration keys, or inspection/nominal
design distinctions. Focused catalog tests cover input preservation, distinct
physical identities and every source-data guard; CNC handoff tests cover
retained source identity and inconsistent-source rejection. The review found no
blocking inconsistency in the shared hook, package API validation, or removal of
the local whitelist.

### Verification of the completed software changes

A clean parallel rerun covered all 355 ordinary test files: 3,063 tests,
2,968 passed, 95 optional native FreeCAD checks skipped, and no failures,
cancellations or pending tests. All skips are optional native checks gated by
`FREECAD_PYTHON`, which was not set for this run; no scope or catalog contract
was skipped. All nineteen failures from the initial full run were
resolved and exercised again in this clean rerun.

The complete catalog verification also passed: all 341 families completed all
five contracts, totaling 1,705 passes without skips, missing families or
duplicate completed coverage. Combined JavaScript results are 4,768 tests:
4,673 passed, 95 optional skips and zero failures or cancellations. Independent
raw TAP checks retained the complete saw and recovery results during bounded
parallel continuation. All owned verification coordinators and diagnostic
watchers exited after completion.

The four offline Python importer suites passed all 17 tests; all 174 Python
source files under `scripts/` and `tests/` parsed without generating caches.
TypeScript and the production build passed. Package validation checked all
341 packages and 20,514 presets in every available state. Portable workbench
TypeScript/Vite builds, including the Manifold runtime, passed. Repository
language, artifact placement and whitespace checks passed.

The additional TR8 review executed the unchanged native gear constructors and
STEP round trips; its source checkpoints, sampling reproduction, measurements
and limits are recorded in [the TR8 regression review](../tr8-regression-review.md).
The complete catalog still loads at application startup, as documented in
[the architecture](../architecture.md); this software correction does not claim
an asynchronous catalog or reduced total CAD download.

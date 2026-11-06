# Switches and buttons section audit

Historical section review, 2026-11-03, before curator integration. Some recommendations below were implemented in the same organization pass; use the [integrated review](../library-organization-audit.md) for completed changes and remaining work. Runtime counts describe that review snapshot. Raw snapshots and logs are optional local evidence under ignored `test-results/`; this document preserves the section findings in the repository.

Scope: all four current `SWITCHES & BUTTONS` packages, 47 presets, four direct navigation entries under Electronics. Root owns curator decisions. Source inspection and local preset uniqueness checks only; no package, geometry or native-CAD checks were run and no source files were modified.

## Complete coverage and grouping

| Package ID              | Presets | Assessment                                                                                                                                                                                                                                                                    |
| ----------------------- | ------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `panel-switch`          |      29 | Fixed purchased-model catalog already includes toggle, guarded toggle, rocker, rotary selector, panel and tactile button types. Preserve physical source variants; model, colour, mounting hardware and operating pose are separate controls.                                 |
| `panel-indicator`       |       1 | One Lehao AD16-16C provisional installation definition with independent visual lens colours. Do not create five supplier articles from appearance choices or infer voltage execution.                                                                                         |
| `panel-control`         |       3 | Editable engineering-reference controls: button, rotary knob and signal tower share a `form` selector. Keep separate from identified purchased switch and indicator products.                                                                                                 |
| `servo-toggle-actuator` |      14 | Authored assembly combining independently registered servo/switch units with made mounting/linkage parts. Rocker, parallel-shaft, two-switch, case-panel and guided-fork alternatives already share one configurable family. Keep separate from the purchased switch catalog. |

The four entries serve distinct selection needs; another shared catalog is unnecessary. No package is just a different thread/length duplicate. Keep `servo-toggle-actuator` with switch integration rather than hiding it inside a servo motor catalog. Its generic runtime browse label is already **Servo toggle actuator** while exact ST3215/ASW-07D identity remains in the physical configuration name.

All package IDs are distinct stable folder identities. All 47 local preset IDs and names are unique within their own packages (JSON scan). No ID rename or migration is justified. Preserve qualified references and original supplier designations.

## Immediate safe metadata improvements

1. `panel-indicator/presets.json` and `configurator.ts` both name the article **Lehao AD16-16C — provisional envelope**. The naming policy places evidence limitations outside titles. Use **Lehao AD16-16C panel indicator** consistently in both locations. Retain the existing prominent `validationNotice`, descriptions, source evidence, unknown voltage and colour qualifications; a shorter title does not establish dimensional fidelity.
2. Optional concise `panel-control.browseLabel`: **Panel control**. The current **Panel button, knob and beacon** is accurate but long. A label change must retain the three form choices and explicit reference classification, without moving the beacon into a purchased indicator family.
3. Standardize visible assembled-state labels **Assembled** in `panel-control` and `servo-toggle-actuator`, preserving the `assembled` state ID. Their current **Assembly** labels differ from the two sourced families. This is wording only, not a state implementation change.
4. `panel-control` uses the same `mount` dimension for a panel opening in button/beacon mode and a shaft bore in knob mode. Its static label **Panel opening diameter** is misleading for the knob. A neutral **Mounting diameter** plus a form-specific explanation is safer than renaming the key.

## Schema/state issues needing deliberate validation

- `panel-control/lib/model.ts` creates one component for `form === 'knob'`; the common `finish()` helper cannot separate a single piece. **Exploded** is therefore a no-op for that form. Make exploded availability conditional on non-knob forms with the shared availability/reconciliation contract and check saved state and project normalization before implementing.
- `panel-switch.position` offers Center for two-position models even though validation rejects it; `updateParameters` resets the pose on model changes. Add `availableWhen` to the Center option for three-position models so the chooser does not offer a known-invalid combination. Keep the stable `position` key/values and model-switch reset behavior. Guard/position reconciliation is already implemented and should be preserved.
- Appearance colours are deliberately `filterable: false`; Lehao yellow/blue/white and DS-225 requested cap colours do not establish orderable executions. Do not promote them into catalog identity or source-rated filters.
- The servo actuator's phase and manual ARM 1 controls are operating poses, while the `mechanism` selector changes construction. Existing conditional fields and update logic preserve that distinction; do not create new package IDs for each phase or fit size.

Evidence: each package's `part.ts`, `configurator.ts`, `presets.json`, `product.json` and GUIDE; `panel-control/lib/model.ts`; `panel-switch/lib/catalog.ts`; shared `src/core/assembly/mechanical/helpers.ts`; runtime metadata in `before.json`; `tests/panel-indicator.test.ts` documents deliberate single-preset colour semantics. This organization review does not certify switch forces, electrical ratings, panel fit, servo motion or manufacturing readiness.

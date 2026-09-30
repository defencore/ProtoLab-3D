# Verification — carriage optics and bolted common frame, 2026-09-26

This record concerns `automatic-band-saw`. The circular `automatic-tube-saw` is a separate package.

## Scope

The native audit in `tests/helpers/bandsaw-fit.ts` validates positive, closed, valid FreeCAD solids, then checks all potentially intersecting component pairs. Bearings, screws, nuts, pins, cylinders, library guides and motors are included. Only blade versus illustrative stock is excluded for the intentional cut. Welded/bent subassemblies are fused; removable fastening interfaces retain drilled bores.

The matrix contains 75 configurations: ready/loading, six optical-scan presets, six independent head/feed combinations, nine combined motion positions, six presets at feed/bottom, five small profiles at feed/bottom, and fifteen shelf angles each at widths 30 and 120. The bow pivots 0–35 degrees and the shuttle travels 155 mm. This includes the sensor bracket passing the stationary clamp and the last roller lying outside the shuttle sweep.

The software checks cover all 84 preset/state validations and render 19 representative combinations, including all 14 states for the default preset. They check finite geometry, unique names, bounds, preview-only threads, six library rail/block components and the library motor/ballscrew. Control tests cover fixed-stock/open-shuttle nose scanning, fresh capture, return before grip, home-only presence checks, encoder feed targets, axis hold, lower-switch interruption, measured standstill, discharge and tail reserve. The removed material encoder and motorised end-face gauge are absent from the contract.

## Executed results

- Native FreeCAD: 75/75 configurations passed, with no unapproved common volume over 0.05 mm³; every generated component was a valid closed solid.
- Band-saw and thread tests: 10 passed. The native Node test was skipped in that invocation and executed separately with the same generated audit helper.
- Focused control/kinematic checks: 6 passed, including the final home-presence assertions.
- TypeScript including tests and production build passed. The existing large-bundle warning remains.
- `parts:check`: 194 packages and 14,369 presets validated. `git diff --check` passed.
- Browser inspection confirmed the feed detail, adjustable clamps, optical bracket and common six-foot frame. No browser console errors were reported; the mechanism view was left open.

The full repository test suite was not run. Source hashes and per-case native results are in [VALIDATION.results.json](VALIDATION.results.json).

## Limits

These are sampled nominal geometry and process-contract checks. They do not establish continuous clearance, stiffness, fatigue life, cable/hose routing, installed optical performance or commissioned PLC safety. Delivered reducer/cylinder/retention drawings, bearing fits, shaft torque interfaces, bolt preload, guarding and load checks remain necessary for manufacturing release.

The ±0.20 mm requirement remains a cut-process target. The motor encoder measures its axis, not tube slip, screw lead error or clamp transfer. Qualify the optical datum, lead compensation, real kerf and repeated cuts. The BGS sensor may see the fixed datum wall while passing it; initial nose capture must occur beyond that wall, and stock-presence checks apply only at home. Enter the actual loaded stock length: this short axis cannot scan the entire 2 m bar to establish its tail position.

The default 2 m bar yields 30 production pieces of 50 mm after the facing cut, leaving approximately 423.5 mm. The operator removes the tail and separates the facing piece from the common box.

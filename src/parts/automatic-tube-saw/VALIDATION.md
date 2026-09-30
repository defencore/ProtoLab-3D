# Automatic tube saw verification — 2026-09-26

## Scope and checks

The resumed implementation includes standalone, operator-loaded assisted, and automatic-admission configurations; a deeply parked saw with a stationary angle-specific throat cassette; a translating complete discharge module; physical material-edge tracking; and separate facing-scrap and whole-remnant discharge sequences.

- TypeScript application/test checking passed.
- Package validation passed for 193 packages and 14,362 presets.
- Production build passed. Vite still reports the existing large-bundle advisory.
- Native FreeCAD run passed 26 tests without skips. It includes valid solids and blade/carriage clearance across 24 cutting poses, receiver level/tip poses, feed-carriage endpoints, stock support/admission-gate checks, a continuous parked-blade yaw envelope, and traction-nip clearance.
- Subsequent process tests passed for the facing-scrap route, retained stock clamp, standalone spindle-stop sequence, assisted loading, material identity, and qualified scrap passage.
- Additional native receiver checks passed for the assembled, sorting and remnant-reject poses.
- Browser verification covered separate modules, standalone hood-open configuration and assisted remnant rejection. No browser console errors were observed.
- The broader library run exposed two pre-existing inconsistencies: missing `threadMode` schema on threaded rods and mismatched roller/sensor selector names. Both were corrected and their configuration/catalog tests passed on rerun.
- The full-library geometry sweep was still running at handoff; a complete `npm test` pass is not claimed. Its log is `/tmp/protolab-resume-all-tests.log`.

## Reproduce

From the repository root:

```sh
npm run parts:check
npm run typecheck:tests
npm run build
node --import tsx --test tests/automatic-tube-saw.test.ts tests/saw-stock-control.test.ts tests/configuration.test.ts tests/library-names.test.ts
```

For native solid checks on this Mac:

```sh
env FREECAD_PYTHON=/Applications/FreeCAD.app/Contents/Resources/bin/python \
  PYTHONPATH=/Applications/FreeCAD.app/Contents/Resources/lib \
  node --import tsx --test tests/automatic-tube-saw.test.ts tests/saw-stock-control.test.ts
```

Qt requires host CPU-feature detection; the restricted execution sandbox could not initialize it. Native tests were run with host execution permission.

## Limits

The continuous clearance proof encloses every orientation of the parked blade in a conservative solid cylinder and checks that against the stationary cutting fixtures, conveyors and guards. It does not certify the complete machine's moving envelope under deflection, manufacturing tolerances or arbitrary component substitutions. The other native motion tests are sampled configurations.

The TypeScript sequences are acceptance specifications, not deployed PLC firmware. The upstream source must present one separated bar; a bundle singulator is not modeled. Supplier drawings, electrical/pneumatic schematics, safety validation and physical cutting/traction trials remain required for manufacture. See [GUIDE.md](GUIDE.md) and [CONTROL.md](CONTROL.md).

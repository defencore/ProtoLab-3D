# Clevis / fork end

This independent package owns four constructions: pushrod set-screw clevis, female threaded fork, male threaded fork, and a simplified cable fork terminal. Copy or hand off this entire folder; it has no imports from other parts.

- `configurator.ts` owns controls, defaults and ordered catalog filters.
- `presets.json` owns sourced records and editable prototype examples.
- `part.ts` owns validation, assembly layout, states, metadata and dimensions.
- `lib/shapes.ts` owns private CSG recipes, preview conversion and FreeCAD construction. Both representations consume the same component tree.

The native axis is Z. The body rear face is Z = 0, the fork tip is Z = `length`, and an optional male thread extends toward negative Z. The fork opens across Y, and its pin runs along Y. `pinOffset` measures from the tip to the pin center. `forkGap` is clear space between cheeks. The body retains actual rod/cable and transverse holes; bores are not dark decorative circles.

Assembled, exploded and body-only states use identical components. `includeHardware` controls the pin screw, locknut and (on clamped variants) set screws. Python returns a compound with direct component children and labels, so the application exports each removable item as a separate FreeCAD feature. The manufactured fork body is a single solid.

The supplied 25 × 7 mm pushrod image establishes body length, body diameter, 3 mm fork gap, 2 mm rod bore, M2.5 pin and two M3 set screws. Cable records establish only bore choices 1.5, 2, 3, 4, 5, 6, 8, 10 and 12 mm. Other dimensions are editable assumptions and are excluded from `verifiedParameters`. Threaded examples are unsourced prototype configurations.

Rod threads can be modeled or use a nominal envelope. The modeled option uses a sampled truncated 60-degree mesh and a matching FreeCAD helical sweep; it carries no thread-fit class. Hardware threads are smooth envelopes. Cable geometry is a fixed fork and barrel; the reference's swivel/adjuster and load rating are not reproduced. Color is a preview finish.

Validate after editing:

```sh
npm run parts:check -- clevis
node --import tsx --test tests/clevis.test.ts
npm run typecheck:tests
```

These checks inspect meshes and emitted Python. Execute the exported script in FreeCAD before relying on CAD kernel validity for manufacturing or fit.

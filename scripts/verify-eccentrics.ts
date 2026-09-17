/** Prepare native-CAD cases with independently measured preview bounds and volumes.
 * FULL=1 covers catalog variants, inspection states, eccentric orientations and offsets.
 * Run the resulting cases with scripts/verify-electronics.py in FreeCAD Python.
 */
import { writeFileSync } from 'node:fs';
import { Box3, Mesh, Vector3 } from 'three';
import { parts } from '../src/parts';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';

const selections = parts.filter((p) => p.id.startsWith('eccentric-'));
const failures: { name: string; error: string }[] = [];
const cases = [];
for (const part of selections) {
  const examples = process.env.FULL
    ? part.presets.map((preset) => ({
        name: preset.id,
        parameters: { ...part.defaults, ...preset.parameters },
        state: 'assembled',
      }))
    : [{ name: 'default', parameters: part.defaults, state: 'assembled' }];
  if (process.env.FULL) {
    for (const state of part.states!.slice(1).map((s) => s.id))
      examples.push({ name: 'default', parameters: part.defaults, state });
    examples.push({
      name: 'angle-90',
      parameters: { ...part.defaults, angle: 90 },
      state: 'assembled',
    });
    examples.push({
      name: 'custom-offset',
      parameters: { ...part.defaults, eccentricity: +part.defaults.eccentricity * 0.8 },
      state: 'assembled',
    });
  }
  for (const example of examples) {
    const name = `${part.id}/${example.name}/${example.state}`;
    try {
      const errors = validateParameters(part, example.parameters, example.state);
      if (errors.length) throw new Error(errors.join('; '));
      const model = part.buildGeometry(example.parameters, example.state);
      try {
        model.updateMatrixWorld(true);
        const components = model.children.map((child) => {
          const bounds = new Box3().setFromObject(child, true);
          let volume = 0;
          child.traverse((mesh) => {
            if (!(mesh instanceof Mesh)) return;
            const position = mesh.geometry.getAttribute('position'),
              index = mesh.geometry.index;
            for (let i = 0; i < (index?.count ?? position.count); i += 3) {
              const vertices = [0, 1, 2].map((j) =>
                new Vector3()
                  .fromBufferAttribute(position, index ? index.getX(i + j) : i + j)
                  .applyMatrix4(mesh.matrixWorld),
              );
              volume += vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
            }
          });
          return { name: child.name, min: bounds.min.toArray(), max: bounds.max.toArray(), volume };
        });
        cases.push({
          name,
          id: part.id,
          state: example.state,
          parameters: example.parameters,
          components,
          script: generateScript(part, example.parameters, example.state),
        });
      } finally {
        disposeModel(model);
      }
    } catch (error) {
      failures.push({ name, error: String(error) });
    }
  }
}
const output = process.argv[2] ?? '/tmp/protolab-eccentric-cases.json';
writeFileSync(output, JSON.stringify(cases));
writeFileSync(output + '.failures.json', JSON.stringify(failures, null, 2));
console.log(JSON.stringify({ cases: cases.length, failures, output }));
if (failures.length) process.exitCode = 1;

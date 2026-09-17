/** Prepare native-CAD cases with independently measured preview bounds and volumes.
 * Covers lock rotation, release, separated tube sizes and inspection views.
 * Run the resulting cases with scripts/verify-electronics.py in FreeCAD Python.
 */
import { writeFileSync } from 'node:fs';
import { Box3, Mesh, Vector3 } from 'three';
import { parts } from '../src/parts';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';

const selections = parts.filter((p) => p.id === 'rocket-release');
if (selections.length !== 1) throw new Error('Release module is not registered');
const failures: { name: string; error: string }[] = [];
const cases = [];
for (const part of selections) {
  const drive = process.argv[3] ?? 'four-motors';
  const presets = part.presets.filter((p) => p.parameters.drive === drive);
  if (!presets.length) throw new Error('Unknown drive layout: ' + drive);
  const defaults = presets[0].parameters;
  const examples = [
    ...[0, 30, 60, 61, 100].map((release) => ({
      name: `default-${release}`,
      parameters: { ...defaults, release },
      state: 'assembled',
    })),
    ...presets.slice(1).map((preset) => ({
      name: preset.id,
      parameters: { ...preset.parameters, release: 100 },
      state: 'assembled',
    })),
    { name: 'cutaway', parameters: { ...defaults, release: 30 }, state: 'cutaway' },
    { name: 'mechanism', parameters: { ...defaults, release: 100 }, state: 'mechanism' },
  ];
  for (const example of examples) {
    const name = `${part.id}/${drive}/${example.name}/${example.state}`;
    try {
      console.log('Preparing ' + name);
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
const output = process.argv[2] ?? '/tmp/protolab-release-cases.json';
writeFileSync(output, JSON.stringify(cases));
writeFileSync(output + '.failures.json', JSON.stringify(failures, null, 2));
console.log(JSON.stringify({ cases: cases.length, failures, output }));
if (failures.length) process.exitCode = 1;

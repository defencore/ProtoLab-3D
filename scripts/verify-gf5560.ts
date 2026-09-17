/** Prepare native-CAD cases with independently measured preview bounds and volumes.
 * Covers both shaft styles, inspection states, lightweight mode and a custom shaft.
 * Run the resulting cases with scripts/verify-electronics.py in FreeCAD Python.
 */
import { writeFileSync } from 'node:fs';
import { Box3, Mesh, Vector3 } from 'three';
import { parts } from '../src/parts';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';

const selections = parts.filter((p) => p.id === 'chf-gf5560-180');
if (selections.length !== 1) throw new Error('GF5560 module is not registered');
const failures: { name: string; error: string }[] = [];
const cases = [];
for (const part of selections) {
  const examples = [
    { name: '1400-11rpm', parameters: part.defaults, state: 'assembled' },
    {
      name: 'custom-full-flat',
      parameters: { ...part.defaults, shaftProfile: 'full-d' },
      state: 'assembled',
    },
    { name: 'cover-removed', parameters: part.defaults, state: 'open' },
    { name: 'mechanism', parameters: part.defaults, state: 'mechanism' },
    { name: 'exploded', parameters: part.defaults, state: 'exploded' },
    {
      name: 'lightweight',
      parameters: { ...part.defaults, detail: 'lightweight' },
      state: 'assembled',
    },
    {
      name: 'custom-shaft',
      parameters: {
        ...part.defaults,
        shaftDiameter: 6,
        shaftLength: 26,
        flatThickness: 5,
        flatLength: 18,
        shaftAngle: 90,
      },
      state: 'assembled',
    },
  ];
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
const output = process.argv[2] ?? '/tmp/protolab-gf5560-cases.json';
writeFileSync(output, JSON.stringify(cases));
writeFileSync(output + '.failures.json', JSON.stringify(failures, null, 2));
console.log(JSON.stringify({ cases: cases.length, failures, output }));
if (failures.length) process.exitCode = 1;

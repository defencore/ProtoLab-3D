/** Verify each of the ten supplier CAD executions through preview and FreeCAD export. */
import { writeFileSync } from 'node:fs';
import { Box3, Mesh, Vector3 } from 'three';
import { parts } from '../src/parts';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';

const selections = parts.filter((p) => ['faulhaber-am', 'faulhaber-bx4'].includes(p.id));
if (selections.length !== 2) throw new Error('FAULHABER modules is not registered');
const failures: { name: string; error: string }[] = [];
const cases = [];
for (const part of selections) {
  const seen = new Set<string>();
  const examples = part.presets
    .filter((preset) => {
      const sha = preset.catalog!.geometryEvidence!.sourceSha256!;
      if (seen.has(sha)) return false;
      seen.add(sha);
      return true;
    })
    .map((preset) => ({ name: preset.name, parameters: preset.parameters, state: 'assembled' }));
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
const output = process.argv[2] ?? '/tmp/protolab-faulhaber-cases.json';
writeFileSync(output, JSON.stringify(cases));
writeFileSync(output + '.failures.json', JSON.stringify(failures, null, 2));
console.log(JSON.stringify({ cases: cases.length, failures, output }));
if (failures.length) process.exitCode = 1;

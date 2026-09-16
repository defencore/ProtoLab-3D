/** Prepare native-CAD cases with independently measured preview bounds and volumes.
 * Run with scripts/verify-electronics.py using a FreeCAD-enabled Python.
 * PART_FILTER=id,id restricts a targeted rerun; output defaults to /tmp.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Box3, Mesh, Vector3 } from 'three';
import { parts } from '../src/parts';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import type { Parameters } from '../src/core/types';

const ids: string[] = JSON.parse(readFileSync('data/library-expansion.json', 'utf8')).parts.map(
  (p: { id: string }) => p.id,
);
const filter = process.env.PART_FILTER?.split(',');
const selections = parts.filter((p) => ids.includes(p.id) && (!filter || filter.includes(p.id)));
const fixtures: Record<string, Parameters[]> = {
  'machine-hardware': [
    { form: 'hinge', hingeAngle: 90 },
    { form: 'hinge', hingeAngle: 150 },
    { form: 'latch', latchTravel: 14.4 },
    { form: 'handle', handlePitch: 160, handleHeight: 45, handleWidth: 24, handleThickness: 14 },
  ],
  'landing-gear': [
    { form: 'fork', wheels: 'twin' },
    { form: 'braced', wheels: 'twin' },
    { form: 'folding', kneeOffset: 0 },
    {
      form: 'folding',
      wheel: 30,
      width: 8,
      axle: 3,
      rod: 6,
      forkWall: 2,
      clearance: 1,
      strut: 40,
      plate: 16,
      braceSpan: 25,
      kneeOffset: 5,
    },
    {
      form: 'folding',
      wheels: 'twin',
      wheel: 300,
      width: 80,
      axle: 30,
      rod: 65,
      forkWall: 15,
      clearance: 10,
      strut: 600,
      plate: 120,
      braceSpan: 350,
      kneeOffset: 60,
    },
  ],
  gearbox: [{ stages: 3, detail: 'detailed', form: 'planetary' }],
  'fluid-cylinder': [{ extension: 0 }, { extension: 100, detail: 'detailed' }],
  'linkage-mechanism': [
    { phase: 135 },
    { form: 'slider', phase: 270 },
    { form: 'pantograph', phase: 90 },
  ],
  'o-ring': [{ inside: 20, section: 3, mode: 'face', grooveWidth: 3.5, grooveDepth: 2.2 }],
};
const failures: { name: string; error: string }[] = [];
const cases = [];
for (const part of selections) {
  const detailed = part.parameters.some((p) => p.key === 'detail');
  const examples = part.presets.flatMap((preset) =>
    (detailed ? ['envelope', 'detailed'] : ['envelope']).map((detail) => ({
      name: `${preset.id}/${detail}`,
      parameters: { ...preset.parameters, ...(detailed ? { detail } : {}) },
      state: 'assembled',
    })),
  );
  examples.push({ name: 'default', parameters: part.defaults, state: 'exploded' });
  for (const [index, patch] of (fixtures[part.id] ?? []).entries())
    examples.push({
      name: `custom-${index}`,
      parameters: { ...part.defaults, ...patch },
      state: 'assembled',
    });
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
const output = process.argv[2] ?? '/tmp/protolab-expansion-cases.json';
writeFileSync(output, JSON.stringify(cases));
writeFileSync(output + '.failures.json', JSON.stringify(failures, null, 2));
console.log(JSON.stringify({ cases: cases.length, failures, output }));
if (failures.length) process.exitCode = 1;

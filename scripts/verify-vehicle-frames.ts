/** Prepare full component macros and independently measured preview envelopes. */
import { writeFileSync } from 'node:fs';
import { Box3, Mesh, Vector3 } from 'three';
import { parts } from '../src/parts';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';

const selections = parts.filter((part) =>
  ['aircraft-airframe', 'model-rocket-airframe', 'boat-hull', 'multicopter-frame'].includes(
    part.id,
  ),
);
if (selections.length !== 4) throw new Error('Expected four vehicle packages');
const cases = selections.flatMap((part) =>
  [
    ...part.presets,
    ...part.presets
      .filter((p) => part.id === 'multicopter-frame' && p.id.startsWith('layout-'))
      .map((p) => ({
        ...p,
        id: p.id + '-tube',
        parameters: { ...p.parameters, armStyle: 'tube' },
      })),
  ].flatMap((preset) =>
    part.states!.map((state) => {
      const model = part.buildGeometry(preset.parameters, state.id);
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
          return {
            name: child.name,
            min: bounds.min.toArray(),
            max: bounds.max.toArray(),
            volume,
          };
        });
        return {
          name: `${part.id}/${preset.id}/${state.id}`,
          id: part.id,
          state: state.id,
          parameters: preset.parameters,
          components,
          script: generateScript(part, preset.parameters, state.id),
        };
      } finally {
        disposeModel(model);
      }
    }),
  ),
);
const output = process.argv[2] ?? '/tmp/protolab-vehicle-cases.json';
writeFileSync(output, JSON.stringify(cases));
console.log(JSON.stringify({ cases: cases.length, output }));

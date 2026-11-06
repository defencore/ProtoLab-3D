/** Prepare GMP16 preview/native comparisons for scripts/verify-motors.py. */
import { writeFileSync } from 'node:fs';
import { Box3, Mesh, Vector3 } from 'three';
import module from '../src/parts/gmp16-gearmotor';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';

const part = module.part;
const cases = part.presets.flatMap((preset) =>
  [false, true].flatMap((showLeads) =>
    part.states!.map((state) => {
      const parameters = { ...preset.parameters, showLeads, outputAngle: showLeads ? 90 : 0 };
      const model = part.buildGeometry(parameters, state.id);
      try {
        model.updateMatrixWorld(true);
        const components = model.children.map((child) => {
          const bounds = new Box3().setFromObject(child, true);
          let volume = 0;
          child.traverse((mesh) => {
            if (!(mesh instanceof Mesh)) return;
            const positions = mesh.geometry.getAttribute('position'),
              index = mesh.geometry.index;
            for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
              const [a, b, c] = [0, 1, 2].map((j) =>
                new Vector3()
                  .fromBufferAttribute(positions, index ? index.getX(i + j) : i + j)
                  .applyMatrix4(mesh.matrixWorld),
              );
              volume += a.dot(b.clone().cross(c)) / 6;
            }
          });
          return { name: child.name, min: bounds.min.toArray(), max: bounds.max.toArray(), volume };
        });
        return {
          name: `${part.id}/${preset.id}/${showLeads ? 'leads-angle-90' : 'bare'}/${state.id}`,
          id: part.id,
          state: state.id,
          parameters,
          components,
          script: generateScript(part, parameters, state.id),
        };
      } finally {
        disposeModel(model);
      }
    }),
  ),
);
const output = process.argv[2] ?? '/tmp/protolab-gmp16-cases.json';
writeFileSync(output, JSON.stringify(cases));
console.log(JSON.stringify({ cases: cases.length, output }));

/** Prepare four boundary/representative DIN 915 macros for optional native FreeCAD QA. */
import fs from 'node:fs';
import { Mesh, Vector3 } from 'three';
import part from '../src/parts/set-screw/part';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';

const cases = part.presets
  .filter(
    (preset) =>
      preset.id.startsWith('reference-din915-') &&
      [2, 2.5, 6, 16].includes(Number(preset.parameters.diameter)),
  )
  .map((preset) => {
    const model = part.buildGeometry(preset.parameters, 'default');
    let volume = 0;
    try {
      model.updateMatrixWorld(true);
      model.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        const position = child.geometry.getAttribute('position'),
          index = child.geometry.index;
        for (let i = 0; i < (index?.count ?? position.count); i += 3) {
          const points = [0, 1, 2].map((j) =>
            new Vector3()
              .fromBufferAttribute(position, index ? index.getX(i + j) : i + j)
              .applyMatrix4(child.matrixWorld),
          );
          volume += points[0].dot(points[1].clone().cross(points[2])) / 6;
        }
      });
      return {
        id: preset.id,
        parameters: preset.parameters,
        previewVolume: volume,
        code: generateScript(part, preset.parameters, 'default'),
      };
    } finally {
      disposeModel(model);
    }
  });
const output = process.argv[2] ?? '/tmp/protolab-din915-cases.json';
fs.writeFileSync(output, JSON.stringify(cases));
console.log(`Prepared ${cases.length} DIN 915 native cases in ${output}.`);

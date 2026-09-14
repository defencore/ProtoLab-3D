/** Prepare one native extrusion case per supplied section, with preview occupancy probes. */
import fs from 'node:fs';
import { Mesh, Raycaster, Vector3 } from 'three';
import part from '../src/parts/aluminium-profile/part';
import { profileDefaults } from '../src/parts/aluminium-profile/configurator';
import { aluminiumProfileReferences } from '../src/parts/aluminium-profile/lib/catalog';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';

const cases = aluminiumProfileReferences.map((row, index) => {
  const p = profileDefaults(row.id, index % 2 ? 50 : 550),
    model = part.buildGeometry(p, 'default');
  model.updateMatrixWorld(true);
  try {
    let volume = 0;
    model.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const positions = child.geometry.getAttribute('position'),
        indices = child.geometry.index;
      for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
        const v = [0, 1, 2].map((j) =>
          new Vector3().fromBufferAttribute(positions, indices ? indices.getX(i + j) : i + j),
        );
        volume += v[0].dot(v[1].clone().cross(v[2])) / 6;
      }
    });
    const probes = [];
    for (let x = 0; x < 27; x++)
      for (let y = 0; y < 19; y++) {
        const px = ((x + 0.173) / 27 - 0.5) * row.width,
          py = ((y + 0.317) / 19 - 0.5) * row.height;
        const ray = new Raycaster(new Vector3(px, py, Number(p.length)), new Vector3(0, 0, -1));
        probes.push({ point: [px, py, 0], inside: ray.intersectObject(model, true).length > 0 });
      }
    return { id: row.id, parameters: p, volume, probes, code: generateScript(part, p, 'default') };
  } finally {
    disposeModel(model);
  }
});
const output = process.argv[2] ?? '/tmp/protolab-aluminium-cases.json';
fs.writeFileSync(output, JSON.stringify(cases));
console.log(`Prepared ${cases.length} aluminium section cases in ${output}.`);

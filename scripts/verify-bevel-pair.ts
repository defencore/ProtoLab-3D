/** Prepare focused preview/native checks for the bevel pair's faceted mounting geometry. */
import fs from 'node:fs';
import { Box3, Mesh, Vector3 } from 'three';
import bevel, { bevelPairValues } from '../src/parts/bevel-gear-pair/part';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import type { Parameters } from '../src/core/types';

type Side = 'pinion' | 'wheel';
const args = process.argv.slice(2);
const output =
  args.find((value) => !value.startsWith('--')) ?? '/tmp/protolab-bevel-pair-cases.json';
const matrix = args.includes('--matrix');
const stock = args.includes('--stock-bores');
const unknown = args.filter(
  (value) => value.startsWith('--') && !['--matrix', '--stock-bores'].includes(value),
);
if (unknown.length) throw new Error(`Unknown option: ${unknown.join(', ')}`);
if (matrix && stock) throw new Error('Choose either --matrix or --stock-bores.');
const inputs: { id: string; parameters: Parameters; state: string }[] = [];
if (stock) {
  // One pairing for each distinct pinion and wheel bore covers all ten stock members.
  for (const [index, pinion] of [8, 10, 12, 14, 15].entries()) {
    const wheel = [14, 15, 16, 18, 20][index];
    const preset = bevel.presets.find(
      (entry) => entry.id === `reference-bevel-m2-15-30-bore-${pinion}-${wheel}`,
    )!;
    inputs.push({
      id: `${preset.id}/assembled`,
      parameters: preset.parameters,
      state: 'assembled',
    });
  }
} else if (matrix) {
  for (const preset of bevel.presets)
    for (const state of bevel.states!)
      inputs.push({
        id: `${preset.id}/${state.id}`,
        parameters: preset.parameters,
        state: state.id,
      });
  for (const shape of ['round', 'hex', 'd', 'double-d', 'square', 'polygon', 'keyway']) {
    inputs.push({
      id: `bore-${shape}/assembled`,
      state: 'assembled',
      parameters: {
        ...bevel.defaults,
        pinionBore: Number(bevel.defaults.pinionBoreMin),
        wheelBore: Number(bevel.defaults.wheelBoreMin),
        pinionBoreShape: shape,
        wheelBoreShape: shape,
        pinionBoreSides: 7,
        wheelBoreSides: 5,
        pinionBoreAngle: 17,
        wheelBoreAngle: 29,
        pinionBoreKeyWidth: 1,
        wheelBoreKeyWidth: 1,
        pinionBoreKeyDepth: 0.5,
        wheelBoreKeyDepth: 0.5,
        rotation: 13,
      },
    });
  }
  inputs.push({
    id: 'maximum-bores/rotation-37',
    state: 'assembled',
    parameters: {
      ...bevel.defaults,
      pinionBore: Number(bevel.defaults.pinionBoreMax),
      wheelBore: Number(bevel.defaults.wheelBoreMax),
      rotation: 37,
    },
  });
} else {
  inputs.push({ id: 'default/wheel', parameters: bevel.defaults, state: 'wheel' });
  inputs.push({ id: 'default/assembled', parameters: bevel.defaults, state: 'assembled' });
}
// Smooth round bores leave uninterrupted annuli; radial screw bores are irrelevant to this defect.
if (!stock)
  inputs.push({
    id: 'planar-annuli/assembled',
    parameters: {
      ...bevel.defaults,
      setScrews: false,
      pinionBoreShape: 'round',
      wheelBoreShape: 'round',
    },
    state: 'assembled',
  });

function previewVolume(mesh: Mesh): number {
  const position = mesh.geometry.getAttribute('position'),
    index = mesh.geometry.index;
  let volume = 0;
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    const p = [0, 1, 2].map((j) =>
      new Vector3()
        .fromBufferAttribute(position, index ? index.getX(i + j) : i + j)
        .applyMatrix4(mesh.matrixWorld),
    );
    volume += p[0].dot(p[1].clone().cross(p[2])) / 6;
  }
  return volume;
}
const cases = inputs.map((input) => {
  const errors = validateParameters(bevel, input.parameters, input.state);
  if (errors.length) throw new Error(`${input.id}: ${errors.join(' ')}`);
  const model = bevel.buildGeometry(input.parameters, input.state);
  model.updateMatrixWorld(true);
  const sides: Side[] =
    input.state === 'pinion'
      ? ['pinion']
      : input.state === 'wheel'
        ? ['wheel']
        : ['pinion', 'wheel'];
  try {
    const components = model.children.map((child, index) => {
      const b = new Box3().setFromObject(child, true);
      let volume = 0;
      child.traverse((object) => {
        if (object instanceof Mesh) volume += previewVolume(object);
      });
      return { side: sides[index], bounds: [b.min.toArray(), b.max.toArray()], volume };
    });
    const annuli: { component: number; name: string; inside: number[]; outside: number[] }[] = [];
    const boreChecks: { component: number; name: string; point: number[]; material: boolean }[] =
      [];
    if (stock)
      for (const [component, side] of sides.entries()) {
        const get = (key: string) => Number(input.parameters[`${side}${key}`]);
        const radius = get('Bore') / 2;
        for (const z of [0.1, get('HubLength') / 2, get('BodyLength') - 0.1]) {
          const check = (name: string, x: number, y: number, material: boolean) =>
            boreChecks.push({
              component,
              name: `${side}/${z}/${name}`,
              material,
              point: new Vector3(x, y, z)
                .applyMatrix4(model.children[component].matrixWorld)
                .toArray(),
            });
          check('round opening', -(radius - 0.05), 0, false);
          check('round wall', -(radius + 0.05), 0, true);
          if (input.parameters[`${side}BoreShape`] === 'keyway') {
            const x = radius + get('BoreKeyDepth') / 2;
            check('keyway opening', x, 0, false);
            check('keyway depth', radius + get('BoreKeyDepth') + 0.05, 0, true);
            for (const sign of [-1, 1]) {
              check('keyway inner edge', x, sign * (get('BoreKeyWidth') / 2 - 0.05), false);
              check('keyway outer edge', x, sign * (get('BoreKeyWidth') / 2 + 0.05), true);
            }
          }
        }
      }
    if (!input.parameters.setScrews)
      for (const [index, side] of sides.entries()) {
        if (input.parameters[`${side}BoreShape`] !== 'round') continue;
        const values = bevelPairValues(input.parameters, side),
          get = (key: string) => Number(input.parameters[`${side}${key}`]);
        for (const front of [false, true]) {
          const inner = front ? get('Bore') / 2 : get('Hub') / 2;
          const outer = values.v.rootRadius * (front ? values.scale : 1);
          const plane = get(front ? 'BodyLength' : 'HubLength');
          for (const fraction of [0.35, 0.65])
            for (let angleIndex = 0; angleIndex < 16; angleIndex++) {
              const a = ((angleIndex + 0.17) * Math.PI) / 8,
                r = inner + (outer - inner) * fraction,
                normal = front ? 1 : -1;
              const point = (z: number) =>
                new Vector3(r * Math.cos(a), r * Math.sin(a), z)
                  .applyMatrix4(model.children[index].matrixWorld)
                  .toArray();
              annuli.push({
                component: index,
                name: `${side}/${front ? 'front' : 'back'}/${fraction}/${angleIndex}`,
                inside: point(plane - normal * 0.005),
                outside: point(plane + normal * 0.005),
              });
            }
        }
      }
    return {
      id: input.id,
      parameters: input.parameters,
      state: input.state,
      code: generateScript(bevel, input.parameters, input.state),
      components,
      annuli,
      boreChecks,
    };
  } finally {
    disposeModel(model);
  }
});
fs.writeFileSync(output, JSON.stringify(cases));
console.log(
  JSON.stringify({
    cases: cases.length,
    mode: stock ? 'stock-bores' : matrix ? 'matrix' : 'smoke',
    output,
  }),
);

import { cellTerminalServiceZones } from '../src/parts/rocket-release/lib/wing-cells';
import { controllerServiceZones } from '../src/parts/rocket-release/lib/wing-frame';
import { pythonShape, transform, rotate } from '../src/parts/rocket-release/lib/shapes';
/** Prepare recovery assembly CAD and preview metrology for FreeCAD verification. */
import { writeFileSync } from 'node:fs';
import { Box3, Mesh, Vector3 } from 'three';
import part from '../src/parts/rocket-release/part';
import { generateScript } from '../src/core/freecad';
import { pieces } from '../src/parts/rocket-release/lib/model';
import { disposeModel } from '../src/core/mechanical';
const out = process.argv[2] ?? '/tmp/recovery-cases.json';
const cases = [];
const noseDefaults = part.presets.find((p) => p.id === 'nose-90-86-st3215-compact')!.parameters;
const examples = [
  {
    name: 'wing-18650-2s',
    p: part.presets.find((p) => p.id === 'nose-90-86-mg996r-18650-2s-wing-mini')!.parameters,
    state: 'assembled',
  },
  ...[3, 2].map((cells) => ({
    name: `wing-${cells}s`,
    p: part.presets.find((p) => p.id === `nose-90-86-mg996r-tattu-${cells}s-wing-mini`)!.parameters,
    state: 'assembled',
  })),
  { name: 'locked', p: noseDefaults, state: 'assembled' },
  {
    name: 'battery-pack',
    p: part.presets.find((p) => p.id === 'nose-90-86-st3215')!.parameters,
    state: 'assembled',
  },
  {
    name: 'battery-separated',
    p: { ...part.presets.find((p) => p.id === 'nose-90-86-st3215')!.parameters, release: 100 },
    state: 'assembled',
  },
  { name: 'turning', p: { ...noseDefaults, release: 30 }, state: 'assembled' },
  { name: 'unlocked', p: { ...noseDefaults, release: 60 }, state: 'assembled' },
  { name: 'separating', p: { ...noseDefaults, release: 61 }, state: 'assembled' },
  { name: 'separated', p: { ...noseDefaults, release: 100 }, state: 'assembled' },
  {
    name: 'long-springs',
    p: { ...noseDefaults, springTravel: 12 },
    state: 'assembled',
  },
  {
    name: 'large',
    p: { ...noseDefaults, tubeOD: 150, tubeID: 146, release: 100 },
    state: 'assembled',
  },
  { name: 'cutaway', p: { ...noseDefaults, release: 30 }, state: 'cutaway' },
  {
    name: 'four-motors',
    p: { ...part.defaults, drive: 'four-motors', release: 100 },
    state: 'assembled',
  },
];
for (const { name, p, state } of examples.filter(
  (e) => !process.argv[3] || process.argv[3].split(',').includes(e.name),
)) {
  console.log('Preparing', name);
  const model = part.buildGeometry(p, state);
  model.updateMatrixWorld(true);
  const components = model.children.map((child) => {
    const b = new Box3().setFromObject(child, true);
    let volume = 0;
    child.traverse((mesh) => {
      if (!(mesh instanceof Mesh)) return;
      const pos = mesh.geometry.getAttribute('position'),
        idx = mesh.geometry.index;
      for (let i = 0; i < (idx?.count ?? pos.count); i += 3) {
        const v = [0, 1, 2].map((j) =>
          new Vector3()
            .fromBufferAttribute(pos, idx ? idx.getX(i + j) : i + j)
            .applyMatrix4(mesh.matrixWorld),
        );
        volume += v[0].dot(v[1].clone().cross(v[2])) / 6;
      }
    });
    return { label: child.name, min: b.min.toArray(), max: b.max.toArray(), volume };
  });
  disposeModel(model);
  cases.push({
    name,
    parameters: p,
    state,
    components,
    serviceZones:
      p.drive === 'wing-mini-nose'
        ? [...controllerServiceZones(p), ...cellTerminalServiceZones(p)].map((zone) => ({
            label: zone.label,
            expression: pythonShape(transform(rotate(zone.shape, 180, 'x'), 0, [0, 0, 56])),
          }))
        : [],
    script: generateScript(part, p, state),
    nativeLabels: pieces(p, state)
      .filter((x) => x.label.startsWith('ST3215 ·'))
      .map((x) => x.label),
  });
  writeFileSync(out, JSON.stringify(cases));
  console.log('Prepared', name, components.length);
}

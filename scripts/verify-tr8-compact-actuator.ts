/** Generate static pose, native macro and BOM evidence for the independent TR8 assembly. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Box3, Mesh, Vector3 } from 'three';
import part, { actuatorPieces, actuatorLayout } from '../src/parts/tr8-compact-actuator/part';
import { disposeModel } from '../src/core/mechanical';
import { generateScript } from '../src/core/freecad';
import { withGeometryMode, type GeometryMode } from '../src/core/geometry-mode';
import type { Parameters } from '../src/core/types';

const output = resolve(process.argv.find((arg) => arg.endsWith('.json')) ??
  'test-results/tr8-compact-actuator/cases.json');
const directory = resolve(output, '..');
mkdirSync(directory, { recursive: true });
const configurations: { name: string; parameters: Parameters; mode: GeometryMode; export: boolean }[] = [
  ...[-20, 0, 20].map((angle) => ({
    name: `tr8-${angle < 0 ? 'minus-' : angle > 0 ? 'plus-' : ''}${Math.abs(angle)}deg`,
    parameters: { ...part.defaults, outputAngle: angle }, mode: 'simple' as const, export: true,
  })),
  { name: 'tr8-107-12-neutral', parameters: { ...part.defaults, motorModel: '107-12' }, mode: 'simple', export: false },
  ...(process.argv.includes('--full') ? [-20, 0, 20].map((angle) => ({
    name: `tr8-full-${angle < 0 ? 'minus-20deg' : angle > 0 ? 'plus-20deg' : 'neutral'}`,
    parameters: { ...part.defaults, outputAngle: angle }, mode: 'full' as const, export: true,
  })) : []),
];
const cases = configurations.map((configuration) => withGeometryMode(configuration.mode, () => {
  const { parameters, name, mode } = configuration;
  const pieces = actuatorPieces(parameters, 'assembled');
  const model = part.buildGeometry(parameters, 'assembled');
  model.updateMatrixWorld(true);
  try {
    if (model.children.length !== pieces.length) throw new Error('Preview occurrence order differs from actuatorPieces.');
    const expected = model.children.map((child, index) => {
      const bounds = new Box3().setFromObject(child, true);
      let volume = 0;
      child.traverse((mesh) => {
        if (!(mesh instanceof Mesh)) return;
        const positions = mesh.geometry.getAttribute('position'), indices = mesh.geometry.index;
        for (let triangle = 0; triangle < (indices?.count ?? positions.count); triangle += 3) {
          const [a, b, c] = [0, 1, 2].map((offset) => new Vector3().fromBufferAttribute(
            positions, indices ? indices.getX(triangle + offset) : triangle + offset,
          ).applyMatrix4(mesh.matrixWorld));
          volume += a.dot(b.clone().cross(c)) / 6;
        }
      });
      return { id: pieces[index].component.id, libraryId: pieces[index].component.libraryId,
        label: pieces[index].label, min: bounds.min.toArray(), max: bounds.max.toArray(), volume };
    });
    const script = generateScript(part, parameters, 'assembled', undefined, undefined, mode);
    if (configuration.export) writeFileSync(resolve(directory, name + '.FCMacro'), script);
    return { ...configuration, id: part.id, state: 'assembled', expected,
      kinematics: actuatorLayout(parameters), dimensions: part.dimensions(parameters, 'assembled'),
      source: part.python(parameters, 'assembled'), script,
      ...(mode === 'full' ? { nominalSource: withGeometryMode('simple', () => part.python(parameters, 'assembled')) } : {}),
      billOfMaterials: part.composition!(parameters) };
  } finally { disposeModel(model); }
}));
writeFileSync(output, JSON.stringify(cases));
writeFileSync(resolve(directory, 'bill-of-materials.json'), JSON.stringify(part.composition!(part.defaults), null, 2));
console.log(JSON.stringify({ cases: cases.length, output }));

/** Prepare reproducible native verification and pose exports for the SFK0825 actuator.
 * --full adds detailed native geometry/mating and FCStd checks; STEP certification
 * is limited to Simple geometry. Full STEP remains diagnostic. See diagnose-sfk-step.py and
 * the separate full-step-diagnostic.json / full-step-mesh-diagnostic.json evidence.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Box3, Mesh, Vector3 } from 'three';
import part, { actuatorPieces, actuatorLayout } from '../src/parts/sfk-disc-actuator/part';
import { disposeModel } from '../src/core/mechanical';
import { generateScript } from '../src/core/freecad';
import { withGeometryMode, type GeometryMode } from '../src/core/geometry-mode';
import type { Parameters } from '../src/core/types';
import { parseDetailRecipe } from '../src/core/component-recipes';
import { stockBounds } from './actuator-stock-bounds';

const output = resolve(
  process.argv.find((arg) => arg.endsWith('.json')) ?? 'test-results/sfk-disc-actuator/inline-supports/cases.json',
);
const directory = resolve(output, '..');
mkdirSync(directory, { recursive: true });
const configurations: {
  name: string;
  parameters: Parameters;
  mode: GeometryMode;
  export: boolean;
}[] = [
  ...[-20, -10, 0, 10, 20].map((angle) => ({
    name: `sfk0825-${angle < 0 ? 'minus-' : angle > 0 ? 'plus-' : ''}${Math.abs(angle)}deg`,
    parameters: { ...part.defaults, outputAngle: angle },
    mode: 'simple' as const,
    export: [-20, 0, 20].includes(angle),
  })),
  {
    name: 'sfk0825-107-12-neutral',
    parameters: { ...part.defaults, motorModel: '107-12' },
    mode: 'simple',
    export: false,
  },
  ...(process.argv.includes('--full')
    ? [
        {
          name: 'sfk0825-full-neutral',
          parameters: { ...part.defaults },
          mode: 'full' as const,
          export: true,
        },
      ]
    : []),
];
const cases = configurations.map((configuration) =>
  withGeometryMode(configuration.mode, () => {
    const { parameters, name, mode } = configuration;
    const pieces = actuatorPieces(parameters, 'assembled');
    const model = part.buildGeometry(parameters, 'assembled');
    model.updateMatrixWorld(true);
    try {
      if (model.children.length !== pieces.length)
        throw new Error('Preview occurrence order differs from actuatorPieces.');
      const expected = model.children.map((child, i) => {
        const bounds = new Box3().setFromObject(child, true);
        let volume = 0;
        child.traverse((mesh) => {
          if (!(mesh instanceof Mesh)) return;
          const positions = mesh.geometry.getAttribute('position'),
            index = mesh.geometry.index;
          for (let triangle = 0; triangle < (index?.count ?? positions.count); triangle += 3) {
            const [a, b, c] = [0, 1, 2].map((offset) =>
              new Vector3()
                .fromBufferAttribute(
                  positions,
                  index ? index.getX(triangle + offset) : triangle + offset,
                )
                .applyMatrix4(mesh.matrixWorld),
            );
            volume += a.dot(b.clone().cross(c)) / 6;
          }
        });
        return {
          id: pieces[i].component.id,
          libraryId: pieces[i].component.libraryId,
          label: pieces[i].label,
          min: bounds.min.toArray(),
          max: bounds.max.toArray(),
          volume,
          ...(pieces[i].component.id === 'base'
            ? {
                positiveStockBounds: stockBounds({
                  kind: 'transform',
                  child: parseDetailRecipe(String(pieces[i].component.parameters.recipe)),
                  translation: pieces[i].component.placement.translation,
                  rotation: pieces[i].component.placement.rotation,
                }),
              }
            : {}),
        };
      });
      const script = generateScript(part, parameters, 'assembled', undefined, undefined, mode);
      if (configuration.export) writeFileSync(resolve(directory, name + '.FCMacro'), script);
      return {
        ...configuration,
        state: 'assembled',
        id: part.id,
        expected,
        kinematics: actuatorLayout(parameters),
        dimensions: part.dimensions(parameters, 'assembled'),
        source: part.python(parameters, 'assembled'),
        script,
        ...(mode === 'full'
          ? {
              nominalSource: withGeometryMode('simple', () => part.python(parameters, 'assembled')),
            }
          : {}),
        billOfMaterials: part.composition!(parameters),
      };
    } finally {
      disposeModel(model);
    }
  }),
);
writeFileSync(output, JSON.stringify(cases));
writeFileSync(
  resolve(directory, 'bill-of-materials.json'),
  JSON.stringify(part.composition!(part.defaults), null, 2),
);
console.log(JSON.stringify({ cases: cases.length, output }));

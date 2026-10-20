/** Prepare every holder inspection variant, without external wires, for native CAD checks. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Box3, Mesh, Vector3 } from 'three';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import holder from '../src/parts/li-ion-battery-holder/part';
import { models } from '../src/parts/li-ion-battery-holder/lib/model';

const sourceFiles = [
  'src/parts/li-ion-battery-holder/part.ts',
  'src/parts/li-ion-battery-holder/configurator.ts',
  'src/parts/li-ion-battery-holder/lib/model.ts',
  'src/parts/li-ion-battery-holder/lib/models.json',
  'src/parts/li-ion-battery-holder/lib/native/index.ts',
  'src/parts/li-ion-battery-holder/presets.json',
  'src/core/manufacturer-cad.ts',
  'src/core/freecad.ts',
  ...models.map((model) => `src/parts/li-ion-battery-holder/lib/native/${model.id}.json`),
];
const sourceHashes = Object.fromEntries(
  sourceFiles.map((path) => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]),
);
const cases = [...models]
  .sort((a, b) => Number(b.id === holder.defaults.model) - Number(a.id === holder.defaults.model))
  .flatMap((model) =>
    ['assembled', 'exploded'].map((state) => {
      const parameters = { ...holder.defaults, model: model.id };
      const errors = validateParameters(holder, parameters, state);
      if (errors.length) throw new Error(errors.join('; '));
      const geometry = holder.buildGeometry(parameters, state);
      try {
        geometry.updateMatrixWorld(true);
        const components = geometry.children.map((child, i) => {
          const bounds = new Box3().setFromObject(child, true);
          let volume = 0;
          const labels: string[] = [];
          child.traverse((mesh) => {
            if (!(mesh instanceof Mesh)) return;
            if (mesh.name) labels.push(mesh.name);
            const positions = mesh.geometry.getAttribute('position'),
              indices = mesh.geometry.index;
            for (let triangle = 0; triangle < (indices?.count ?? positions.count); triangle += 3) {
              const [a, b, c] = [0, 1, 2].map((j) =>
                new Vector3()
                  .fromBufferAttribute(
                    positions,
                    indices ? indices.getX(triangle + j) : triangle + j,
                  )
                  .applyMatrix4(mesh.matrixWorld),
              );
              volume += a.dot(b.clone().cross(c)) / 6;
            }
          });
          if (!(volume > 0)) throw new Error(`Inward/empty preview: ${model.id} component ${i}`);
          return {
            label: child.name || labels.join(' / '),
            min: bounds.min.toArray(),
            max: bounds.max.toArray(),
            volume,
            sourceSolids: 1,
            sourceContact: i > 0 && i <= model.cells * 2,
          };
        });
        const bounds = new Box3().setFromObject(geometry, true);
        const script = generateScript(holder, parameters, state);
        return {
          name: `${model.id}/${state}`,
          id: holder.id,
          state,
          parameters,
          model: model.id,
          wired: model.wired,
          cells: model.cells,
          expectedComponents: 1 + 2 * model.cells,
          components,
          bounds: [...bounds.min.toArray(), ...bounds.max.toArray()],
          roundtrip: model.wired && state === 'assembled',
          script,
          scriptSha256: createHash('sha256').update(script).digest('hex'),
        };
      } finally {
        disposeModel(geometry);
      }
    }),
  );
const output = process.argv[2] ?? '/tmp/protolab-18650-holder-cases.json';
writeFileSync(output, JSON.stringify({ sourceHashes, cases }));
console.log(
  JSON.stringify({
    output,
    cases: cases.length,
    components: cases.reduce((s, c) => s + c.components.length, 0),
  }),
);

/** Prepare full component macros and independently measured preview envelopes. */
import { writeFileSync } from 'node:fs';
import { Box3, Mesh, Vector3 } from 'three';
import part from '../src/parts/thread-tool/part';
import { values, radiusAt } from '../src/parts/thread-tool/lib/thread';
import type { Parameters } from '../src/core/types';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';

const samples = ['metric', 'unc', 'unf', 'unef', 'tr', 'acme'].map((family) =>
  part.presets.find((p) => p.parameters.family === family)!,
);
samples.push(
  part.presets.find((p) => p.parameters.family === 'metric' && p.parameters.diameter === 2)!,
);
samples.push(
  part.presets.find((p) => p.parameters.family === 'unf' && p.parameters.diameter === 9.525)!,
);
const configurations: { id: string; parameters: Parameters }[] = [
  ...samples,
  { id: 'left-hand', parameters: { ...part.defaults, handedness: 'left', length: 4 } },
  { id: 'four-start', parameters: { ...part.defaults, starts: 4, length: 4 } },
  {
    id: 'two-start-left',
    parameters: { ...part.defaults, starts: 2, handedness: 'left', length: 4 },
  },
  {
    id: 'custom-clearance',
    parameters: {
      ...part.defaults,
      family: 'custom',
      angle: 45,
      depth: 0.35,
      crest: 0.2,
      clearance: 0.12,
      length: 4,
    },
  },
];
const cases = configurations.flatMap((preset) =>
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
        radialSamples: Array.from({ length: 35 }, (_, i) => {
          const z = Number(preset.parameters.length) * (0.15 + 0.7 * (((i * 7) % 35) / 35));
          const angle = i * 2.399963;
          const radius = radiusAt(preset.parameters, state.id, z, angle);
          const epsilon = values(preset.parameters, state.id).pitch * 0.01;
          return {
            inside: [(radius - epsilon) * Math.cos(angle), (radius - epsilon) * Math.sin(angle), z],
            outside: [
              (radius + epsilon) * Math.cos(angle),
              (radius + epsilon) * Math.sin(angle),
              z,
            ],
          };
        }),
        script: generateScript(part, preset.parameters, state.id),
      };
    } finally {
      disposeModel(model);
    }
  }),
);
const output = process.argv[2] ?? '/tmp/protolab-thread-cases.json';
writeFileSync(output, JSON.stringify(cases));
console.log(JSON.stringify({ cases: cases.length, output }));

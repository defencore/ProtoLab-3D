/** Prepare actual AMASS panel and PCB connector exports for native verification. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Box3, Mesh, Vector3 } from 'three';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';
import part from '../src/parts/electrical-connector/part';
import models from '../src/parts/electrical-connector/lib/models.json';
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const sourceFiles = [
  'src/parts/electrical-connector/part.ts',
  'src/parts/electrical-connector/configurator.ts',
  'src/parts/electrical-connector/lib/model.ts',
  'src/parts/electrical-connector/lib/panel.ts',
  'src/parts/electrical-connector/lib/pcb.ts',
  'src/parts/electrical-connector/lib/models.json',
  'src/parts/electrical-connector/presets.json',
  'src/core/freecad.ts',
  'src/core/assembly/mechanical/assembly.ts',
  'src/core/assembly/mechanical/shapes.ts',
];
const sourceHashes = Object.fromEntries(
  sourceFiles.map((path) => [path, hash(readFileSync(path))]),
);
const cases = models
  .filter((m) => ('panel' in m && m.panel) || ('pcb' in m && m.pcb))
  .flatMap((m) =>
    ['envelope', 'detailed'].flatMap((detail) =>
      ['assembled', 'exploded'].map((state) => {
        const parameters = { model: m.id, detail },
          group = part.buildGeometry(parameters, state);
        try {
          const errors = part.validate(parameters, state);
          if (errors.length) throw new Error(errors.join('; '));
          group.updateMatrixWorld(true);
          const components = group.children.map((child) => {
            const b = new Box3().setFromObject(child, true);
            let volume = 0;
            child.traverse((mesh) => {
              if (!(mesh instanceof Mesh)) return;
              const position = mesh.geometry.getAttribute('position'),
                index = mesh.geometry.index;
              for (let t = 0; t < (index?.count ?? position.count); t += 3) {
                const [a, b, c] = [0, 1, 2].map((n) =>
                  new Vector3()
                    .fromBufferAttribute(position, index ? index.getX(t + n) : t + n)
                    .applyMatrix4(mesh.matrixWorld),
                );
                volume += a.dot(b.clone().cross(c)) / 6;
              }
            });
            if (volume <= 0) throw new Error('Empty or inward preview');
            return { label: child.name, bounds: [...b.min.toArray(), ...b.max.toArray()], volume };
          });
          const b = new Box3().setFromObject(group, true),
            script = generateScript(part, parameters, state);
          return {
            name: [m.id, detail, state].join('/'),
            state,
            parameters,
            model: m,
            components,
            bounds: [...b.min.toArray(), ...b.max.toArray()],
            script,
            scriptSha256: hash(script),
          };
        } finally {
          disposeModel(group);
        }
      }),
    ),
  );
const output = process.argv[2] ?? '/tmp/protolab-xt-panel-cases.json';
writeFileSync(output, JSON.stringify({ sourceHashes, cases }));
console.log(
  JSON.stringify({
    output,
    cases: cases.length,
    components: cases.reduce((s, c) => s + c.components.length, 0),
  }),
);

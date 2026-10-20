/** Prepare source-sized controls and connector cases for isolated FreeCAD verification. */
import { writeFileSync } from 'node:fs';
import { Box3, Mesh, Vector3 } from 'three';
import { generateScript } from '../src/core/freecad';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import type { PartDefinition, Parameters } from '../src/core/types';

function poses(part: PartDefinition, baseline: Parameters): Parameters[] {
  const errors = validateParameters(part, baseline, 'assembled');
  if (errors.length) throw new Error(`${part.id}: ${errors.join('; ')}`);
  let results = [{ ...baseline }];
  for (const field of part.parameters) {
    if (field.key === 'model' || /color|detail|gap|separation/i.test(field.key)) continue;
    if (field.visibleWhen && !field.visibleWhen(baseline, 'assembled')) continue;
    const values =
      field.type === 'select'
        ? field.options!.map((option) => option.value)
        : field.type === 'boolean'
          ? [false, true]
          : field.type === 'number'
            ? [field.min, field.max].filter((v) => v !== undefined)
            : [];
    results = results.flatMap((parameters) =>
      [...new Set([parameters[field.key], ...values])].map((value) => ({
        ...parameters,
        [field.key]: value!,
      })),
    );
  }
  return results.filter((parameters) => !validateParameters(part, parameters, 'assembled').length);
}

const importers = {
  'panel-switch': () => import('../src/parts/panel-switch/part'),
  'laboratory-terminal': () => import('../src/parts/laboratory-terminal/part'),
  'signal-connector': () => import('../src/parts/signal-connector/part'),
};
const requested = process.argv.slice(3);
const ids = requested.length ? requested : Object.keys(importers);
const parts = await Promise.all(
  ids.map(async (id) => {
    if (!(id in importers)) throw new Error(`Unknown electrical catalog: ${id}`);
    return (await importers[id as keyof typeof importers]()).default;
  }),
);
const cases = parts.flatMap((part) =>
  part.presets.flatMap((preset) =>
    poses(part, preset.parameters).flatMap((parameters) =>
      (JSON.stringify(parameters) === JSON.stringify(preset.parameters)
        ? (part.states ?? [{ id: 'assembled' }])
        : [{ id: 'assembled' }]
      ).map((state) => {
        const errors = validateParameters(part, parameters, state.id);
        if (errors.length) throw new Error(`${part.id}/${preset.id}: ${errors.join('; ')}`);
        const model = part.buildGeometry(parameters, state.id);
        try {
          model.updateMatrixWorld(true);
          const components = model.children.map((child) => {
            const bounds = new Box3().setFromObject(child, true);
            let volume = 0;
            child.traverse((mesh) => {
              if (!(mesh instanceof Mesh)) return;
              const position = mesh.geometry.getAttribute('position');
              const index = mesh.geometry.index;
              for (let i = 0; i < (index?.count ?? position.count); i += 3) {
                const [a, b, c] = [0, 1, 2].map((j) =>
                  new Vector3()
                    .fromBufferAttribute(position, index ? index.getX(i + j) : i + j)
                    .applyMatrix4(mesh.matrixWorld),
                );
                volume += a.dot(b.clone().cross(c)) / 6;
              }
            });
            return {
              label: child.name,
              min: bounds.min.toArray(),
              max: bounds.max.toArray(),
              volume,
              sourceSolids: child.userData.sourceSolids ?? 1,
            };
          });
          return {
            name:
              `${part.id}/${preset.id}/${state.id}` +
              part.parameters
                .filter((field) => parameters[field.key] !== preset.parameters[field.key])
                .map((field) => `/${field.key}-${parameters[field.key]}`)
                .join(''),
            id: part.id,
            state: state.id,
            parameters,
            sourceUrl: preset.catalog?.sourceUrl,
            sourceSha256: preset.catalog?.geometryEvidence?.sourceSha256,
            retainedSource: part.id === 'signal-connector',
            components,
            script: generateScript(part, parameters, state.id),
          };
        } finally {
          disposeModel(model);
        }
      }),
    ),
  ),
);
const output = process.argv[2] ?? '/tmp/protolab-electrical-catalogs-cases.json';
writeFileSync(output, JSON.stringify(cases));
console.log(
  JSON.stringify({
    output,
    cases: cases.length,
    components: cases.reduce((n, row) => n + row.components.length, 0),
  }),
);

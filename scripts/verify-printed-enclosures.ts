/** Prepare production macros and physical mesh measurements for native verification. */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Mesh, Vector3 } from 'three';
import type { PartDefinition, Parameters } from '../src/core/types';
import { generateScript } from '../src/core/freecad';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { withGeometryMode } from '../src/core/geometry-mode';

const supported = [
  'printed-rim-enclosure',
  'printed-self-centering-enclosure',
  'printed-screw-enclosure',
  'printed-bayonet-enclosure',
  'printed-threaded-enclosure',
];
const selected = process.argv.slice(2).length ? process.argv.slice(2) : supported;
const destination = path.resolve('test-results/printed-enclosures');
mkdirSync(destination, { recursive: true });
function meshVolumes(part: PartDefinition, p: Parameters, state: string) {
  const model = (part.buildExportGeometry ?? part.buildGeometry)(p, state);
  model.updateMatrixWorld(true);
  try {
    return model.children.map((child) => {
      let volume = 0;
      child.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const positions = object.geometry.getAttribute('position'),
          index = object.geometry.getIndex(),
          count = index?.count ?? positions.count;
        const point = (i: number) =>
          new Vector3()
            .fromBufferAttribute(positions, index ? index.getX(i) : i)
            .applyMatrix4(object.matrixWorld);
        for (let i = 0; i < count; i += 3) {
          const a = point(i),
            b = point(i + 1),
            c = point(i + 2);
          volume += a.dot(b.cross(c)) / 6;
        }
      });
      return Math.abs(volume);
    });
  } finally {
    disposeModel(model);
  }
}
const cases = [];
for (const id of selected) {
  if (!supported.includes(id)) throw new Error('Unsupported enclosure ID.');
  const part: PartDefinition = (await import(`../src/parts/${id}/part.ts`)).default;
  const fitKeys =
    id === 'printed-screw-enclosure' ? ['holeClearance', 'nutClearance'] : ['clearance'];
  const edgeConfigurations = fitKeys.flatMap((key) => {
    const field = part.parameters.find((f) => f.key === key);
    return [field?.min, field?.max]
      .filter((v): v is number => v !== undefined)
      .map((value) => ({
        id: `${key}-${value}`,
        parameters: { ...part.defaults, [key]: value },
        presetId: undefined,
      }));
  });
  const candidates = [
    ...part.presets.map((p) => ({
      id: p.id,
      parameters: p.parameters,
      presetId: p.id as string | undefined,
    })),
    ...edgeConfigurations,
  ];
  for (const candidate of candidates) {
    for (const state of part.states ?? []) {
      if (state.availableWhen && !state.availableWhen(candidate.parameters)) continue;
      const p = candidate.parameters,
        errors = validateParameters(part, p, state.id);
      if (errors.length) throw new Error(`${id}/${candidate.id}: ${errors.join(' ')}`);
      const composition = part.composition!(p),
        printed = composition.components.filter((c) => c.supply === 'manufactured').length;
      const volume = meshVolumes(part, p, state.id);
      cases.push({
        name: `${id}/${candidate.id}/${state.id}`,
        partId: id,
        parameters: p,
        state: state.id,
        mode: 'simple',
        expectedComponents: state.id === 'print' ? printed : composition.components.length,
        printedComponents: printed,
        meshVolumes: volume,
        dimensions: part.dimensions(p, state.id),
        script: generateScript(part, p, state.id, candidate.presetId),
      });
      if (
        id === 'printed-screw-enclosure' &&
        state.id === 'assembled' &&
        candidate.presetId &&
        part.presets.indexOf(part.presets.find((v) => v.id === candidate.presetId)!) < 2
      ) {
        cases.push({
          name: `${id}/${candidate.id}/${state.id}/full`,
          partId: id,
          parameters: p,
          state: state.id,
          mode: 'full',
          expectedComponents: composition.components.length,
          printedComponents: printed,
          meshVolumes: volume,
          dimensions: withGeometryMode('full', () => part.dimensions(p, state.id)),
          script: generateScript(part, p, state.id, candidate.presetId, undefined, 'full'),
        });
      }
    }
  }
}
writeFileSync(path.join(destination, 'cases.json'), JSON.stringify(cases, null, 2));
console.log(JSON.stringify({ cases: cases.length, output: destination }));

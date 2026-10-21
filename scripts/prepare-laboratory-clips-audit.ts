import { writeFileSync } from 'node:fs';
import { Box3, Mesh, Vector3 } from 'three';
import { generateScript } from '../src/core/freecad';
import { modelEvidence } from '../src/core/model-evidence';
import part from '../src/parts/laboratory-terminal/part';
import { pieces, selected } from '../src/parts/laboratory-terminal/lib/model';

const allModelIds = [
  'lever-clip-55',
  'lever-clip-bank-6',
  'lever-clip-101',
  'lever-clip-55-bottom',
  'lever-clip-bank-6-bottom',
];
const modelIds = process.argv[3]?.split(',') ?? allModelIds;
if (modelIds.some((id) => !allModelIds.includes(id))) throw new Error('Unknown clip audit model');
const fixtures = [];
for (const model of modelIds)
  for (const state of ['assembled', 'exploded']) {
    const parameters = { model },
      definition = selected(parameters),
      preset = part.presets!.find((preset) => preset.id === model);
    if (!preset) throw new Error('Missing clip preset: ' + model);
    const group = part.buildGeometry(parameters, state),
      components: { label: string; volume: number; bounds: number[][] }[] = [];
    group.updateMatrixWorld(true);
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const position = object.geometry.getAttribute('position'),
        index = object.geometry.index,
        count = index?.count ?? position.count;
      let volume = 0;
      for (let i = 0; i < count; i += 3) {
        const points = [0, 1, 2].map((offset) => {
          const n = index ? index.getX(i + offset) : i + offset;
          return new Vector3(position.getX(n), position.getY(n), position.getZ(n)).applyMatrix4(
            object.matrixWorld,
          );
        });
        volume += points[0].dot(points[1].clone().cross(points[2])) / 6;
      }
      const bounds = new Box3().setFromObject(object, true);
      components.push({
        label: object.name,
        volume,
        bounds: [bounds.min.toArray(), bounds.max.toArray()],
      });
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        material.dispose();
    });
    fixtures.push({
      id: model + '/' + state,
      partId: part.id,
      model,
      state,
      parameters,
      python: part.python(parameters, state),
      wrapper: generateScript(part, parameters, state, preset.id),
      dimensions: part.dimensions(parameters, state),
      mountingHoles:
        model === 'lever-clip-101'
          ? [
              [0, -43, 4.8],
              [0, 43, 4.8],
            ]
          : [
              ...(definition.clipBase
                ? [-59, 59].flatMap((x) => [-25, 25].map((y) => [x, y, 4.5]))
                : []),
              ...(definition.clipTermination === 'bottom-tab'
                ? Array.from(
                    { length: definition.poles },
                    (_, i) => (i - (definition.poles - 1) / 2) * 18,
                  ).flatMap((x) => [
                    ...[-4.8, 4.8].map((offset) => [x + offset, 3, 3.2]),
                    [x, -21, 3.2],
                  ])
                : []),
            ],
      poles: definition.poles,
      clipSize: definition.clipSize,
      bottomTab: definition.clipTermination === 'bottom-tab',
      clipOffsetZ: definition.clipBase ? 3 : 0,
      components,
      componentLabels: pieces(parameters, state).map((component) => component.label),
      evidence: preset.catalog!.geometryEvidence,
      wrapperEvidence: modelEvidence(part, parameters, preset.id),
      sourceUrl: preset.catalog!.sourceUrl,
    });
  }
writeFileSync(
  process.argv[2] ?? '/tmp/laboratory-clips-native-fixtures.json',
  JSON.stringify(fixtures),
);
console.log(JSON.stringify({ fixtures: fixtures.length, models: modelIds.length }));

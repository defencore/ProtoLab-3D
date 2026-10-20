import { writeFileSync } from 'node:fs';
import { Mesh, Vector3 } from 'three';
import { generateScript } from '../src/core/freecad';
import part from '../src/parts/addressable-led/part';
import { models, pieces } from '../src/parts/addressable-led/lib/model';

const fixtures = [];
for (const model of models)
  for (const state of ['assembled', 'exploded']) {
    const parameters = { model: model.id },
      group = part.buildGeometry(parameters, state);
    let previewVolume = 0;
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const position = object.geometry.getAttribute('position'),
        index = object.geometry.index,
        count = index?.count ?? position.count;
      for (let i = 0; i < count; i += 3) {
        const points = [0, 1, 2].map((offset) => {
          const n = index ? index.getX(i + offset) : i + offset;
          return new Vector3(position.getX(n), position.getY(n), position.getZ(n));
        });
        previewVolume += points[0].dot(points[1].clone().cross(points[2])) / 6;
      }
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        material.dispose();
    });
    const preset = part.presets.find((preset) => preset.id === model.id)!;
    fixtures.push({
      id: model.id + '/' + state,
      partId: part.id,
      model: model.id,
      state,
      parameters,
      python: part.python(parameters, state),
      wrapper: generateScript(part, parameters, state, preset.id),
      dimensions: part.dimensions(parameters, state),
      holes: model.holes,
      innerDiameter: model.innerDiameter,
      previewVolume,
      components: pieces(parameters, state).length,
      sourceUrl: preset.catalog!.sourceUrl,
      sourceSha256: preset.catalog!.geometryEvidence?.sourceSha256 ?? null,
    });
  }
writeFileSync(
  process.argv[2] ?? '/tmp/addressable-led-native-fixtures.json',
  JSON.stringify(fixtures),
);
console.log(JSON.stringify({ fixtures: fixtures.length, models: models.length }));

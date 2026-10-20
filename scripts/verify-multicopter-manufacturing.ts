/** Native source-geometry checks. This is deliberately not a flight qualification. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import frame from '../src/parts/multicopter-frame/part';
import component from '../src/parts/multicopter-frame-component/part';
import { models, frames } from '../src/parts/multicopter-frame-component/lib/model';
import { pieces } from '../src/parts/multicopter-frame/lib/model';
import { generateScript } from '../src/core/freecad';
import { engineering } from '../src/parts/multicopter-frame/lib/engineering';
const dir = resolve('data/real-frame-audit');
mkdirSync(dir, { recursive: true });
const cases = frame.presets.flatMap((preset) =>
  frame
    .states!.filter((s) => !s.availableWhen || s.availableWhen(preset.parameters))
    .map((state) => ({
      id: preset.id + '/' + state.id,
      frame: preset.id,
      state: state.id,
      code: frame.python(preset.parameters, state.id),
      dimensions: frame.dimensions(preset.parameters, state.id),
      components: pieces(preset.parameters, state.id).map((s) =>
        String(s.component.parameters.component),
      ),
    })),
);
for (const model of models)
  cases.push({
    id: model.id,
    frame: model.frameId,
    state: 'component',
    code:
      component.python({ component: model.id }, 'default') +
      '\ncomponents=[shape]\ncomponent_labels=[' +
      JSON.stringify(model.label) +
      ']',
    dimensions: [...model.dimensions] as [number, number, number],
    components: [model.id],
  });
writeFileSync(
  resolve(dir, 'cases.json'),
  JSON.stringify({
    cases,
    sources: frames.map((f) => ({ id: f.id, source: f.source })),
    knownInterferences: Object.fromEntries(frames.map((f) => [f.id, f.knownSourceInterferences])),
    motorStations: Object.fromEntries(frames.map((f) => [f.id, f.motorStations])),
    rotorEnvelopes: Object.fromEntries(
      frame.presets.map((p) => [
        p.id,
        {
          diameter: Number(p.parameters.propDiameter),
          axialEnvelope: Number(p.parameters.bladeAxialEnvelope),
          planes: engineering(p.parameters).coaxialClearance,
        },
      ]),
    ),
    reference: models.map((m) => ({
      id: m.id,
      brep: m.brep,
      volume: m.volume,
      route: m.route,
      sourceIndex: m.sourceIndex,
    })),
  }),
);
writeFileSync(resolve(dir, 'load-case.json'), JSON.stringify(engineering(frame.defaults), null, 2));
for (const preset of frame.presets) {
  for (const file of frame.fabricationFiles!(preset.parameters))
    writeFileSync(resolve(dir, file.name), file.content);
  writeFileSync(
    resolve(dir, preset.id + '.FCMacro'),
    generateScript(frame, preset.parameters, 'assembled'),
  );
}
console.log(JSON.stringify({ cases: cases.length, dir }));

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Parameters, PartDefinition } from '../src/core/types';
import guide from '../src/parts/hiwin-profile-guide/part';
import tbi from '../src/parts/tbi-ball-screw/part';
import stepper from '../src/parts/stepper-motor/part';
import { withGeometryMode, type GeometryMode } from '../src/core/geometry-mode';
import { validateParameters } from '../src/core/validation';
import { generateScript } from '../src/core/freecad';
const output = resolve(process.argv[2] ?? 'test-results/motion-library');
mkdirSync(output, { recursive: true });
const cases: object[] = [];
function add(
  part: PartDefinition,
  id: string,
  p: Parameters,
  state: string,
  mode: GeometryMode = 'simple',
  save = false,
) {
  const issues = validateParameters(part, p, state);
  if (issues.length) throw new Error(`${id}: ${issues.join(' ')}`);
  cases.push({
    id: part.id + '/' + id + '/' + state + '/' + mode,
    partId: part.id,
    parameters: p,
    state,
    mode,
    save,
    dimensions: withGeometryMode(mode, () => part.dimensions(p, state)),
    code: withGeometryMode(mode, () => part.python(p, state)),
    ...(save ? { macro: generateScript(part, p, state, undefined, undefined, mode) } : {}),
  });
}
for (const part of [guide, tbi])
  for (const preset of part.presets)
    for (const state of part.states!)
      add(
        part,
        preset.id,
        preset.parameters,
        state.id,
        'simple',
        preset.id === part.defaults.model && state.id === 'assembled',
      );
for (const preset of stepper.presets) {
  for (const state of stepper.states!)
    add(
      stepper,
      preset.id,
      preset.parameters,
      state.id,
      'simple',
      preset.id === '23hs22-2804s' && state.id === 'assembled',
    );
}
for (const id of ['17hs15-1504s1', '17hs24-2104s', '23hs22-2804s', '23hp45-4204s']) {
  const preset = stepper.presets.find((p) => p.id === id)!;
  add(
    stepper,
    id + '/leads-angle-90',
    { ...preset.parameters, showLeads: true, outputAngle: 90 },
    'assembled',
  );
}
add(
  guide,
  'two-carriages',
  { ...guide.defaults, length: 650, blockCount: 2, blockSpacing: 150, position: 80 },
  'assembled',
);
add(
  guide,
  'wide-two-rows',
  { ...guide.defaults, model: 'mgw15h', length: 450, blockCount: 2, blockSpacing: 100 },
  'assembled',
);
add(guide, 'mgn-thread-depth', { ...guide.defaults, model: 'mgn12h' }, 'carriage', 'full');
add(guide, 'hgh-thread-depth', guide.defaults, 'carriage', 'full');
add(tbi, 'rotation-180', { ...tbi.defaults, nutPosition: 75, rotation: 180 }, 'assembled');
for (const model of ['sfnu01605-4', 'sfb01205-2.8'])
  add(tbi, 'helical-' + model, { ...tbi.defaults, model, length: 150 }, 'assembled', 'full');
writeFileSync(resolve(output, 'cases.json'), JSON.stringify(cases));
for (const part of [guide, tbi, stepper])
  writeFileSync(
    resolve(output, part.id + '.FCMacro'),
    generateScript(
      part,
      part.id === 'stepper-motor'
        ? part.presets.find((p) => p.id === '23hs22-2804s')!.parameters
        : part.defaults,
      'assembled',
    ),
  );
console.log(JSON.stringify({ cases: cases.length, output }));

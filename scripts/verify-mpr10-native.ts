/** Prepare reproducible MPR.10 native CAD clearance cases. Run from scripts/ with tsx. */
import fs from 'node:fs';
import path from 'node:path';
import part from '../src/parts/mpr-10-demonstrator/part';
import {
  configured,
  driveInterface,
  framePosts,
  layout,
} from '../src/parts/mpr-10-demonstrator/lib/model';
import { generateScript } from '../src/core/freecad';
import { withGeometryMode } from '../src/core/geometry-mode';
import { libraries } from '../src/parts/mpr-10-demonstrator/lib/model';

const poses = [
  { id: 'neutral', angles: [0, 0, 0, 0] },
  { id: 'positive-limit', angles: [18, 18, 18, 18] },
  { id: 'negative-limit', angles: [-18, -18, -18, -18] },
  { id: 'mixed', angles: [18, -18, 9, -9] },
];
const motionScenario = (id: string, anglesFor: (angle: number) => number[]) => ({
  id,
  samples: Array.from({ length: 37 }, (_, i) => i - 18).map((angle) => ({
    angle,
    components: configured(
      {
        ...part.defaults,
        ...Object.fromEntries(anglesFor(angle).map((value, i) => [`angle${i + 1}`, value])),
      },
      'assembled',
    ).map(({ component }) => ({
      id: component.id,
      placement: component.placement,
      axialSpin: component.libraryId === 'ball-screw' ? Number(component.parameters.rotation) : 0,
    })),
  })),
});
const cases = poses.map(({ id, angles }) => {
  const parameters = {
    ...part.defaults,
    ...Object.fromEntries(angles.map((value, i) => [`angle${i + 1}`, value])),
  };
  const errors = part.validate(parameters, 'assembled');
  if (errors.length) throw new Error(`${id}: ${errors.join('; ')}`);
  return {
    id,
    parameters,
    layout,
    driveInterface,
    framePosts,
    code: part.python(parameters, 'assembled'),
    ...(id === 'neutral'
      ? {
          macro: generateScript(part, parameters, 'assembled', undefined, undefined, 'simple'),
          motionScenarios: [
            motionScenario('synchronous', (angle) => [angle, angle, angle, angle]),
            motionScenario('channel-1-neighbors-positive', (angle) => [angle, 18, 18, 18]),
            motionScenario('channel-1-neighbors-negative', (angle) => [angle, -18, -18, -18]),
          ],
        }
      : {}),
    components: configured(parameters, 'assembled').map(
      ({ component, requireSingleSolid, label, color }) => ({
        ...component,
        id: component.id,
        libraryId: component.libraryId,
        supply: component.supply,
        label,
        color,
        requireSingleSolid: !!requireSingleSolid,
        printed: component.manufacturing?.processes.includes('printing') ?? false,
      }),
    ),
  };
});
const target = process.argv[2] ?? '/tmp/mpr10-native-cases.json';
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(cases));
// Check that the same fabricated carriage remains valid in Full detail mode.
const carriage = configured(part.defaults, 'assembled').find(
  ({ component }) => component.id === 'channel-1-carriage',
)!.component;
const definition = libraries.find((item) => item.id === carriage.libraryId)!;
fs.writeFileSync(
  path.join(path.dirname(target), path.parse(target).name + '.full-carriage.py'),
  withGeometryMode('full', () => definition.python(carriage.parameters, carriage.state)),
);
console.log(
  JSON.stringify({ target, cases: cases.length, components: cases[0].components.length }),
);

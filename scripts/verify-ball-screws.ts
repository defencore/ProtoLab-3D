/** Prepare repeatable native FreeCAD checks; run with node --import tsx. */
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import nut from "../src/parts/ball-nut/part";
import screw from "../src/parts/ball-screw/part";
import {
  ballScrewBalls,
  ballScrewDefaults,
  ballScrewLayout,
  ballScrewPython,
} from "../src/parts/ball-screw/lib/parts/ball-screw-geometry";
import type { Parameters } from '../src/core/types';

const { values } = parseArgs({
  options: {
    output: { type: 'string', default: '/tmp/protolab-ball-native-cases.json' },
    state: { type: 'string', default: 'all' },
    shard: { type: 'string', default: '0/1' },
  },
});
if (!['all', 'assembled', 'cutaway', 'shaft'].includes(values.state!))
  throw new Error('State must be all, assembled, cutaway or shaft.');
const [index, count] = values.shard!.split('/').map(Number);
if (
  !Number.isInteger(index) ||
  !Number.isInteger(count) ||
  index < 0 ||
  count < 1 ||
  index >= count
)
  throw new Error('Shard must be zero-based index/count.');
const cases: { name: string; python: string; bounds: number[]; contact?: boolean }[] = [];
for (const preset of nut.presets)
  for (const state of ['assembled', 'cutaway']) {
    if (!['all', state].includes(values.state!)) continue;
    const p = preset.parameters,
      v = ballScrewLayout(p),
      balls = ballScrewBalls(p, 0);
    const front = Math.min(
      0,
      ...balls.map((b) => b.y - v.br),
      ...(v.double ? [-Number(p.nutDiameter) / 2 + v.br * 0.1] : []),
    );
    cases.push({
      name: `${preset.id}-${state}`,
      python: ballScrewPython(p, state, true),
      bounds: [
        Number(p.flangeWidth),
        state === 'assembled' ? Number(p.flangeDiameter) : Number(p.flangeDiameter) / 2 - front,
        Number(p.nutLength),
      ],
      contact: /sfk1004|sfi1605|sfe3264|sfu10020|sfh/.test(preset.id) && state === 'assembled',
    });
  }
if (['all', 'shaft'].includes(values.state!)) {
  const presets = [
    screw.presets.find((p) => p.id.startsWith('sfk0401') && p.parameters.length === 550),
    screw.presets.find((p) => p.id.startsWith('sfe3264')),
    screw.presets.find((p) => p.id.startsWith('sfu10020')),
  ];
  for (const preset of presets) {
    if (!preset) throw new Error('A required extreme shaft preset is missing.');
    const p = preset.parameters;
    cases.push({
      name: `${preset.id}-full-shaft`,
      python: ballScrewPython(p, 'screw'),
      bounds: [Number(p.shaftDiameter), Number(p.shaftDiameter), Number(p.length)],
    });
  }
  const p: Parameters = {
    ...ballScrewDefaults,
    endMachining: 'custom',
    length: 240,
    rotation: 360,
    hand: 'left',
  };
  cases.push({
    name: 'left-machined-journals',
    python: ballScrewPython(p, 'assembled'),
    bounds: [Number(p.flangeWidth), Number(p.flangeDiameter), Number(p.length)],
    contact: true,
  });
}
const selected = cases.filter((_, i) => i % count === index);
fs.writeFileSync(values.output!, JSON.stringify(selected));
console.log(`${selected.length} of ${cases.length} native cases written to ${values.output}.`);

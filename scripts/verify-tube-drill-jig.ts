/** Prepare real FreeCAD geometry checks. Run the adjacent Python script in FreeCAD. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import part from '../src/parts/tube-drill-jig/part';
import { jigPieces } from '../src/parts/tube-drill-jig/lib/model';
import { layout } from '../src/parts/tube-drill-jig/lib/selection';
import { validateParameters } from '../src/core/validation';
import { generateScript } from '../src/core/freecad';

const output = resolve(process.argv[2] ?? 'data/tube-drill-jig');
mkdirSync(output, { recursive: true });
const examples = [4, 8, 12].map((count) => ({
  id: `Tube90_${count}_M3`,
  parameters: { ...part.defaults, holeCount: String(count) },
  state: 'assembled',
  export: true,
}));
const cases = [
  ...examples,
  { id: 'Tube90_4_offset20', parameters: { ...part.defaults, endOffset: 20 }, state: 'assembled' },
  {
    id: 'Tube90_4_offset30_no_spacers',
    parameters: { ...part.defaults, endOffset: 30 },
    state: 'assembled',
  },
  {
    id: 'Tube60_8_M3',
    parameters: { ...part.defaults, tubeOD: 60, holeCount: '8' },
    state: 'assembled',
  },
  {
    id: 'Tube150_12_M6',
    parameters: { ...part.defaults, tubeOD: 150, holeCount: '12', thread: 'M6', endOffset: 15 },
    state: 'assembled',
  },
  {
    id: 'Tube90_8_M4_bushing',
    parameters: { ...part.defaults, holeCount: '8', thread: 'M4', endOffset: 12 },
    state: 'assembled',
  },
  {
    id: 'Tube90_8_M5_bushing',
    parameters: { ...part.defaults, holeCount: '8', thread: 'M5', endOffset: 12 },
    state: 'assembled',
  },
  {
    id: 'Tube90_8_through4',
    parameters: {
      ...part.defaults,
      holeCount: '8',
      holeMode: 'through',
      holeDiameter: 4,
      endOffset: 12,
    },
    state: 'assembled',
  },
  {
    id: 'Tube25_12_printed',
    parameters: { ...part.defaults, tubeOD: 25, holeCount: '12', guide: 'plain' },
    state: 'assembled',
  },
  {
    id: 'Tube90_4_thick_bottom_phase',
    parameters: { ...part.defaults, stopThickness: 12, endOffset: 18.5, phase: 17 },
    state: 'assembled',
  },
  { id: 'Tube90_4_exploded', parameters: part.defaults, state: 'exploded' },
];
for (const example of examples)
  writeFileSync(
    resolve(output, `${example.id}.FCMacro`),
    generateScript(part, example.parameters, example.state),
  );
writeFileSync(
  resolve(output, 'cases.json'),
  JSON.stringify(
    cases.map((item) => {
      const errors = validateParameters(part, item.parameters, item.state);
      if (errors.length) throw new Error(`${item.id}: ${errors.join(' ')}`);
      return {
        ...item,
        layout: layout(item.parameters),
        code: part.python(item.parameters, item.state),
        pieces: jigPieces(item.parameters).map(({ id, supply }) => ({ id, supply })),
      };
    }),
    null,
    2,
  ) + '\n',
);
console.log(`Prepared ${cases.length} native geometry cases and 3 standalone macros in ${output}`);

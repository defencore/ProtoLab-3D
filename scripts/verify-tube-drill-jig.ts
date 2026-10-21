/** Prepare the actual generators and standalone macros for native FreeCAD checks. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Euler, Matrix4, Vector3 } from 'three';
import part from '../src/parts/tube-drill-jig/part';
import { jigPieces, printLayout, configuredPieces } from '../src/parts/tube-drill-jig/lib/model';
import { layout } from '../src/parts/tube-drill-jig/lib/selection';
import { validateParameters } from '../src/core/validation';
import { generateScript } from '../src/core/freecad';

const output = resolve(process.argv[2] ?? 'test-results/tube-drill-jig');
mkdirSync(output, { recursive: true });
const examples = [4, 8, 12].map((count) => ({
  id: `Tube90_${count}_Through3`,
  parameters: { ...part.defaults, holeCount: String(count) },
  state: 'assembled',
  export: true,
}));
const cases = [
  ...examples,
  { id: 'Tube90_offset20', parameters: { ...part.defaults, endOffset: 20 }, state: 'assembled' },
  {
    id: 'Tube90_offset25_stack5',
    parameters: { ...part.defaults, endOffset: 25 },
    state: 'assembled',
  },
  {
    id: 'Tube90_offset29p5_stack0p5',
    parameters: { ...part.defaults, endOffset: 29.5 },
    state: 'assembled',
  },
  {
    id: 'Tube90_offset30_no_spacers',
    parameters: { ...part.defaults, endOffset: 30 },
    state: 'assembled',
  },
  {
    id: 'Tube25_4_common_body_long_bit',
    parameters: { ...part.defaults, tubeOD: 25, holeCount: '4' },
    state: 'assembled',
  },
  {
    id: 'Tube60_8_common_body',
    parameters: { ...part.defaults, tubeOD: 60, holeCount: '8' },
    state: 'assembled',
  },
  {
    id: 'Tube51_8_minimum_web',
    parameters: { ...part.defaults, tubeOD: 51, holeCount: '8' },
    state: 'assembled',
  },
  { id: 'Tube80_12_minimum_web', parameters: { ...part.defaults, tubeOD: 80 }, state: 'assembled' },
  {
    id: 'Tube90_8_M3_pilot',
    parameters: { ...part.defaults, holeCount: '8', holeMode: 'tap', thread: 'M3' },
    state: 'assembled',
  },
  {
    id: 'Tube90_8_M4_bushing',
    parameters: { ...part.defaults, holeCount: '8', holeMode: 'tap', thread: 'M4' },
    state: 'assembled',
  },
  { id: 'Tube90_12_drill5', parameters: { ...part.defaults, holeDiameter: 5 }, state: 'assembled' },
  {
    id: 'Tube100_12_drill6',
    parameters: { ...part.defaults, tubeOD: 100, bodyCapacity: 120, holeDiameter: 6 },
    state: 'assembled',
  },
  {
    id: 'Tube100_12_drill8',
    parameters: { ...part.defaults, tubeOD: 100, bodyCapacity: 120, holeDiameter: 8 },
    state: 'assembled',
  },
  {
    id: 'Tube25_4_printed',
    parameters: { ...part.defaults, tubeOD: 25, holeCount: '4', guide: 'plain', showTube: false },
    state: 'assembled',
  },
  {
    id: 'Tube90_long_through',
    parameters: { ...part.defaults, stopMode: 'through' },
    state: 'assembled',
    export: true,
  },
  {
    id: 'Tube25_4_long_through',
    parameters: { ...part.defaults, stopMode: 'through', tubeOD: 25, holeCount: '4' },
    state: 'assembled',
  },
  {
    id: 'Tube90_thick_stop_station7',
    parameters: { ...part.defaults, stopThickness: 12, endOffset: 18.5, station: 7 },
    state: 'assembled',
  },
  { id: 'Tube90_exploded', parameters: part.defaults, state: 'exploded' },
  { id: 'Tube90_print_layout', parameters: part.defaults, state: 'print-layout', export: true },
  {
    id: 'Tube25_print_layout',
    parameters: { ...part.defaults, tubeOD: 25, holeCount: '4' },
    state: 'print-layout',
  },
  {
    id: 'Tube90_through_print_layout',
    parameters: { ...part.defaults, stopMode: 'through' },
    state: 'print-layout',
  },
  {
    id: 'Tube100_drill8_print_layout',
    parameters: { ...part.defaults, tubeOD: 100, bodyCapacity: 120, holeDiameter: 8 },
    state: 'print-layout',
  },
];
for (const example of cases.filter((item) => 'export' in item && item.export))
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
      const d = layout(item.parameters);
      const source = configuredPieces(item.parameters, 'assembled');
      const target = configuredPieces(item.parameters, item.state);
      const matrix = (placement: (typeof source)[number]['component']['placement']) =>
        new Matrix4()
          .makeRotationFromEuler(
            new Euler(
              ...(placement.rotation.map((angle) => (angle * Math.PI) / 180) as [
                number,
                number,
                number,
              ]),
              'ZYX',
            ),
          )
          .setPosition(...placement.translation);
      const definitions =
        item.state === 'print-layout' ? printLayout(item.parameters) : jigPieces(item.parameters);
      return {
        ...item,
        layout: d,
        code: part.python(item.parameters, item.state),
        assembledCode:
          item.state === 'print-layout' ? part.python(item.parameters, 'assembled') : undefined,
        assembledPieceIds:
          item.state === 'print-layout'
            ? jigPieces(item.parameters).map((piece) => piece.id)
            : undefined,
        wrapper:
          'export' in item && item.export
            ? generateScript(part, item.parameters, item.state)
            : undefined,
        pieces: definitions.map(({ id, supply, label }) => {
          let openGrooveProbes: number[][] | undefined;
          if (item.state === 'print-layout' && ['index-lower', 'index-upper'].includes(id)) {
            const a = source.find((piece) => piece.component.id === id)!.component.placement;
            const b = target.find((piece) => piece.component.id === id)!.component.placement;
            const transform = matrix(b).multiply(matrix(a).invert());
            const radial = (d.start + d.flangeStart) / 2;
            openGrooveProbes = d.stations.map((station) => {
              const angle = (station.angle * Math.PI) / 180;
              return new Vector3(
                radial * Math.cos(angle),
                radial * Math.sin(angle),
                d.axisHeight + (id === 'index-lower' ? -0.5 : 0.5),
              )
                .applyMatrix4(transform)
                .toArray();
            });
          }
          return { id, supply, label, openGrooveProbes };
        }),
      };
    }),
    null,
    2,
  ) + '\n',
);
console.log(`Prepared ${cases.length} native cases and 5 standalone macros in ${output}`);

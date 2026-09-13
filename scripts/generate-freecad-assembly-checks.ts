/** Generate complete macros for the isolated native assembly export audit. */
import { writeFileSync } from 'node:fs';
import { parts } from '../src/parts';
import { generateScript } from '../src/core/freecad';
import type { Parameters, PartDefinition } from '../src/core/types';

const selections: [string, string[], Parameters?][] = [
  ['ball-bearing', ['assembled', 'exploded']],
  ['ball-bearing', ['assembled'], { seals: 'rubber' }],
  ['spherical-roller-bearing', ['assembled']],
  ['self-aligning-bearing', ['assembled'], { seals: 'rubber' }],
  ['ball-screw', ['assembled', 'cutaway', 'screw', 'nut']],
  ['ball-nut', ['assembled', 'cutaway']],
  ['jaw-coupling', ['assembly', 'exploded', 'hub-a', 'hub-b', 'spider']],
  ['bevel-gear-pair', ['assembled', 'exploded', 'pinion', 'wheel']],
  ['worm-drive', ['assembled']],
  ['linear-guide', ['assembled', 'cutaway', 'rail', 'carriage']],
  ['round-linear-guide', ['assembled', 'cutaway', 'shaft', 'block']],
  ['linear-bearing', ['assembled']],
  ['wheel', ['default']],
  ['ball-screw-axis', ['assembled']],
  ['ball-screw-axis', ['assembled'], { detail: 'envelope' }],
  ['bolt-screw', ['default']],
  ['hex-nut', ['default']],
  ['flange-nut', ['default']],
  ['nyloc-nut', ['default']],
];
const cases = selections.flatMap(([id, states, patch]) => {
  const part = parts.find((candidate) => candidate.id === id);
  if (!part) throw new Error(`Missing part ${id}`);
  return states.map((state) => {
    const parameters = { ...part.defaults, ...patch };
    return {
      name: `${id}/${state}${patch ? '/variant' : ''}`,
      id,
      state,
      parameters,
      dimensions: part.dimensions(parameters, state),
      script: generateScript(part, parameters, state),
    };
  });
});
const bearing = parts.find((part) => part.id === 'ball-bearing')!;
const catalog = bearing.presets.find((preset) => preset.catalog)!;
cases.push({
  name: 'ball-bearing/catalog-metadata',
  id: bearing.id,
  state: 'assembled',
  parameters: catalog.parameters,
  dimensions: bearing.dimensions(catalog.parameters, 'assembled'),
  script: generateScript(bearing, catalog.parameters, 'assembled'),
});
// The wire is valid topology but not a physical component. It must roll back the
// container and first child already inserted before component validation fails.
const invalid: PartDefinition = {
  ...bearing,
  id: 'invalid-assembly-fixture',
  defaults: {},
  parameters: [],
  presets: [],
  validate: () => [],
  dimensions: () => [2, 2, 2],
  python: () =>
    'shape = Part.makeCompound([Part.makeSphere(1), Part.makePolygon([App.Vector(0,0,0),App.Vector(1,0,0)])])',
};
const output = process.argv[2] || '/tmp/protolab-freecad-assembly-cases.json';
writeFileSync(
  output,
  JSON.stringify({ cases, rollbackScript: generateScript(invalid, {}, 'assembled') }, null, 2),
);
console.log(`Wrote ${cases.length} complete macros and a rollback fixture to ${output}`);

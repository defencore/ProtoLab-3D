/** Prepare the production-generated native macros and measurable joint cases. */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { generateScript } from '../src/core/freecad';
import { validateParameters } from '../src/core/validation';
import type { PartDefinition } from '../src/core/types';

const ids = process.argv.slice(2);
const selected = ids.length
  ? ids
  : [
      'printed-dovetail-joint',
      'printed-tongue-groove-joint',
      'printed-pin-joint',
      'printed-snap-joint',
    ];
const cases = [];
const destination = path.resolve('test-results/printed-joints');
mkdirSync(destination, { recursive: true });
for (const id of selected) {
  if (!/^printed-(dovetail|tongue-groove|pin|snap)-joint$/.test(id))
    throw new Error('Unsupported joint ID.');
  const part: PartDefinition = (await import(`../src/parts/${id}/part.ts`)).default;
  const clearance = part.parameters.find((field) => field.key === 'clearance');
  const configurations = [
    ...part.presets.map((preset) => ({ ...preset, presetId: preset.id as string | undefined })),
    ...[clearance?.min, clearance?.max]
      .filter((value): value is number => value !== undefined)
      .map((value) => ({
        id: `clearance-${value}`,
        presetId: undefined,
        parameters: { ...part.defaults, clearance: value },
      })),
  ];
  for (const configuration of configurations) {
    for (const state of part.states ?? []) {
      if (state.availableWhen && !state.availableWhen(configuration.parameters)) continue;
      const p = configuration.parameters;
      const errors = validateParameters(part, p, state.id);
      if (errors.length) throw new Error(`${id}/${configuration.id}: ${errors.join(' ')}`);
      cases.push({
        name: `${id}/${configuration.id}/${state.id}`,
        partId: id,
        state: state.id,
        parameters: p,
        dimensions: part.dimensions(p, state.id),
        script: generateScript(part, p, state.id, configuration.presetId),
      });
    }
  }
}
writeFileSync(path.join(destination, 'cases.json'), JSON.stringify(cases, null, 2));
console.log(JSON.stringify({ cases: cases.length, output: destination }));

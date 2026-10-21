import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { workshopJigIds } from './workshop-jigs/manifest';
import { inspectPackage } from './part-modules/library';
import { checkPackageDefinitions } from './part-modules/check';
import { validateParameters } from '../src/core/validation';
import { generateScript } from '../src/core/freecad';
import type { PartDefinition, Parameters } from '../src/core/types';

const root = resolve('.'),
  output = resolve(process.argv[2] ?? 'test-results/workshop-jigs');
mkdirSync(output, { recursive: true });
const inspections = await Promise.all(
  workshopJigIds.map((id) => inspectPackage(resolve(root, 'src/parts', id), root)),
);
console.log(await checkPackageDefinitions(inspections));
const cases: object[] = [];
for (const id of workshopJigIds) {
  const part: PartDefinition = (
    await import(pathToFileURL(resolve(root, 'src/parts', id, 'part.ts')).href)
  ).default;
  const model = await import(pathToFileURL(resolve(root, 'src/parts', id, 'lib/model.ts')).href);
  const records: { id: string; parameters: Parameters; state: string; export?: boolean }[] = [
    { id: 'default', parameters: part.defaults, state: 'assembled', export: true },
    ...part.presets.map((preset) => ({
      id: preset.id,
      parameters: preset.parameters,
      state: 'assembled',
    })),
    { id: 'exploded', parameters: part.defaults, state: 'exploded' },
    ...(part.defaults.guide
      ? [
          {
            id: 'printed-pilot',
            parameters: { ...part.defaults, guide: 'printed' },
            state: 'assembled',
          },
        ]
      : []),
  ];
  writeFileSync(resolve(output, id + '.FCMacro'), generateScript(part, part.defaults, 'assembled'));
  for (const record of records) {
    const errors = validateParameters(part, record.parameters, record.state);
    if (errors.length) throw new Error(`${id}/${record.id}: ${errors.join(' ')}`);
    cases.push({
      ...record,
      partId: id,
      name: part.name,
      code: part.python(record.parameters, record.state),
      pieces: model
        .pieces(record.parameters)
        .map((piece: { id: string; bought?: string }) => ({
          id: piece.id,
          bought: !!piece.bought,
        })),
      paths: model.paths(record.parameters),
      layout: model.layout(record.parameters),
    });
  }
}
writeFileSync(resolve(output, 'cases.json'), JSON.stringify(cases, null, 2) + '\n');
console.log(
  `Prepared ${cases.length} native cases and ${workshopJigIds.length} macros in ${output}`,
);

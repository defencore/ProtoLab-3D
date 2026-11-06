import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { withGeometryMode } from '../src/core/geometry-mode';
import { generateScript } from '../src/core/freecad';
import part, { fixed, pieces } from '../src/parts/tr8-geared-rocker-actuator/part';
import { motorModels } from '../src/parts/tr8-geared-rocker-actuator/configurator';

const out = resolve(process.argv[2] ?? 'test-results/tr8-geared-rocker');
mkdirSync(out, { recursive: true });
const primary = String(part.defaults.motor);
const secondary = motorModels.find((p) => p.value === 'surpass-2838-3700kv')!.value;
const executions = [
  { id: primary, modes: ['simple', 'full'] as const, stem: 'TR8x4-geared-rocker' },
  { id: secondary, modes: ['full'] as const, stem: 'TR8x4-geared-rocker-' + secondary },
];
if (process.argv.includes('--fabrication-only')) {
  for (const execution of executions) {
    const folder = execution.id === primary ? out : resolve(out, execution.id);
    mkdirSync(folder, { recursive: true });
    for (const file of part.fabricationFiles!({ ...part.defaults, motor: execution.id }))
      writeFileSync(resolve(folder, file.name), file.content);
  }
  console.log(JSON.stringify({ out, fabricationExecutions: executions.map((e) => e.id) }));
  process.exit(0);
}
const hashFiles = (paths: string[]) =>
  Object.fromEntries(
    paths.map((path) => [
      path,
      createHash('sha256')
        .update(readFileSync(resolve(path)))
        .digest('hex'),
    ]),
  );
const data = {
  schemaVersion: 3,
  partId: part.id,
  primary,
  executions,
  layout: fixed,
  sources: hashFiles(
    [
      'index.ts',
      'part.ts',
      'configurator.ts',
      'lib/layout.ts',
      'lib/model.ts',
      'lib/native.ts',
      'lib/shapes.ts',
    ].map((name) => 'src/parts/tr8-geared-rocker-actuator/' + name),
  ),
  motorSources: hashFiles(
    ['surpass-2845', 'surpass-2838'].flatMap((id) =>
      ['part.ts', 'configurator.ts', 'lib/model.ts'].map((name) => 'src/parts/' + id + '/' + name),
    ),
  ),
  dependencySources: hashFiles([
    'src/parts/spring-pin/part.ts',
    'src/parts/e-ring/part.ts',
    'src/core/eskd.ts',
  ]),
  ids: {
    screw: 'screw',
    nut: 'nut',
    frame: 'frame',
    shaft: 'output-shaft',
    forks: ['fork-upper-plate', 'fork-lower-plate'],
    crossPins: ['fork-cross-pin-1', 'fork-cross-pin-2'],
    gearPins: ['screw-gear-pin', 'motor-gear-pin'],
  },
  poses: [] as {
    execution: string;
    mode: string;
    angle: number;
    source: string;
    occurrences: {
      id: string;
      name: string;
      supply: string;
      libraryId: string;
      requireSingleSolid: boolean;
      placement: { translation: number[]; rotation: number[] };
    }[];
  }[],
  macros: [] as { execution: string; mode: string; path: string }[],
};
for (const execution of executions)
  for (const mode of execution.modes) {
    for (const angle of [-20, 0, 20])
      withGeometryMode(mode, () => {
        const p = { ...part.defaults, motor: execution.id, outputAngle: angle };
        const occurrences = pieces(p).map(({ component: item, requireSingleSolid }) => ({
          id: item.id,
          name: item.name,
          supply: item.supply,
          libraryId: item.libraryId,
          requireSingleSolid: Boolean(requireSingleSolid),
          placement: item.placement,
        }));
        data.poses.push({
          execution: execution.id,
          mode,
          angle,
          source: part.python(p, 'assembled'),
          occurrences,
        });
      });
    const path = resolve(out, execution.stem + '-' + mode + '.FCMacro');
    const p = { ...part.defaults, motor: execution.id };
    writeFileSync(
      path,
      withGeometryMode(mode, () =>
        generateScript(part, p, 'assembled', undefined, undefined, mode),
      ),
    );
    data.macros.push({ execution: execution.id, mode, path });
    if (!process.argv.includes('--geometry-only')) {
      const folder = execution.id === primary ? out : resolve(out, execution.id);
      mkdirSync(folder, { recursive: true });
      for (const file of part.fabricationFiles!(p))
        writeFileSync(resolve(folder, file.name), file.content);
    }
  }
writeFileSync(resolve(out, 'capture.json'), JSON.stringify(data));
console.log(
  JSON.stringify({
    out,
    poses: data.poses.length,
    publicMacros: data.macros.length,
    motors: executions.map((e) => e.id),
  }),
);

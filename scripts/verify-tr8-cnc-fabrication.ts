/** Capture both public fabrication APIs, in both geometry modes, for native contour verification. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import coplanar, {
  cncLayout, cncFramePieces, forkBlankShape, forkShape, libraries, linkage, outerPlateBlankShape,
} from '../src/parts/tr8-quad-cnc-actuator/part';
import staggered from '../src/parts/tr8-quad-staggered-actuator/part';
import { pythonShape } from '../src/core/assembly/boundary/shapes';
import { componentPython } from '../src/core/assembly/detail-instances';
import { withGeometryMode } from '../src/core/geometry-mode';

const digest = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
const root = resolve(process.argv[2] ?? 'test-results');
const sourceFiles = [
  'src/parts/tr8-quad-cnc-actuator/part.ts',
  'src/parts/tr8-quad-cnc-actuator/lib/fabrication.ts',
  'src/parts/tr8-quad-cnc-actuator/lib/frame.ts',
  'src/parts/tr8-quad-cnc-actuator/lib/layout.ts',
  'src/parts/tr8-quad-cnc-actuator/lib/linkage.ts',
  'src/parts/tr8-quad-staggered-actuator/part.ts',
];
const sourceHashes = sourceFiles.map(path => ({ path, sha256: digest(readFileSync(path)) }));
const captured: { partId: string; mode: string; directory: string; expectationSha256: string }[] = [];
for (const [part, variant] of [[coplanar, 'coplanar-64'], [staggered, 'staggered-56']] as const) {
  for (const mode of ['simple', 'full'] as const) withGeometryMode(mode, () => {
    const layout = cncLayout(variant), directory = resolve(root, part.id, 'fabrication-' + mode);
    mkdirSync(directory, { recursive: true });
    const files = part.fabricationFiles!(part.defaults).map(file => {
      if (typeof file.content !== 'string') throw new Error('Textual fabrication output required');
      writeFileSync(resolve(directory, file.name), file.content);
      return { id: file.id, name: file.name, sha256: digest(file.content) };
    });
    if (files.length !== 12 || new Set(files.map(file => file.name)).size !== 12) throw new Error('Expected 12 unique API outputs');
    const stem = variant === 'coplanar-64' ? 'TR8-CNC64' : 'TR8-CNC56';
    const framePieces = cncFramePieces(layout);
    const rows = [
      { id: 'motor-disc', quantity: 1, indices: [0], translations: [[0, 0, 0]],
        pilot: outerPlateBlankShape(layout, true, true), finished: outerPlateBlankShape(layout, true, false),
        pilotHoles: 0, expectedAreaRemoved: 0 },
      { id: 'end-disc', quantity: 1, indices: [1], translations: [[layout.diameter + 5, 0, 0]],
        pilot: outerPlateBlankShape(layout, false, true), finished: outerPlateBlankShape(layout, false, false),
        pilotHoles: 4, expectedAreaRemoved: 4 * Math.PI * (6.51 ** 2 - 6.4 ** 2) },
      { id: 'fork', quantity: 4, indices: [2, 3, 4, 5], translations: Array.from({ length: 4 }, (_, i) => [2 * layout.diameter + 20 + i * 15, 0, 0]),
        pilot: forkBlankShape(layout, true), finished: forkBlankShape(layout, false),
        pilotHoles: 1, expectedAreaRemoved: Math.PI * (3.025 ** 2 - 2.9 ** 2) },
    ].map(({ pilot, finished, ...row }) => ({ ...row, thickness: 3,
      pilotSource: 'shape=(' + pythonShape(pilot) + ').removeSplitter()',
      finishedSource: 'shape=(' + pythonShape(finished) + ').removeSplitter()',
      assembledSource: row.id === 'fork' ? 'shape=(' + pythonShape(forkShape(layout, 0, 0)) + ').removeSplitter()' : componentPython(libraries, [framePieces.find(piece => piece.component.id === 'cnc-' + row.id)!]),
      assembledStation: row.id === 'motor-disc' ? layout.motorPlateX : row.id === 'end-disc' ? layout.endPlateX : undefined,
    }));
    const body = framePieces.find(piece => piece.component.id === 'cnc-middle-body')!;
    const expectedBodySource = componentPython(libraries, [body]);
    const expectations = { schemaVersion: 1, partId: part.id, variant, mode, stem, layout, linkage, sourceHashes, files, rows,
      expectedBodySource, expectedBodySourceSha256: digest(expectedBodySource) };
    const content = JSON.stringify(expectations, null, 2) + '\n';
    writeFileSync(resolve(directory, 'fabrication-expectations.json'), content);
    captured.push({ partId: part.id, mode, directory, expectationSha256: digest(content) });
  });
}
mkdirSync(resolve(root, 'tr8-quad-milled-study'), { recursive: true });
writeFileSync(resolve(root, 'tr8-quad-milled-study', 'fabrication-captures.json'), JSON.stringify(captured, null, 2) + '\n');
console.log(JSON.stringify(captured));

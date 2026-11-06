/** Bind the continuous stock proof to the actual standard column configurations. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { withGeometryMode } from '../src/core/geometry-mode';
import { actuatorNativeSource } from '../src/parts/tr8-compact-actuator/part';
import { frameColumnPieces, columnLines } from '../src/parts/tr8-quad-mini-actuator/lib/columns';
import { packing } from '../src/parts/tr8-quad-mini-actuator/lib/placement';
const directory = resolve(process.argv[2] ?? 'test-results/tr8-quad-mini-actuator/channel');
mkdirSync(directory, { recursive: true });
const pieces = frameColumnPieces();
writeFileSync(
  resolve(directory, 'column-stock.json'),
  JSON.stringify({
    packing,
    columnLines: columnLines(),
    components: pieces.map((p) => p.component),
    source: withGeometryMode('full', () => actuatorNativeSource(pieces)),
  }),
);
console.log(JSON.stringify({ columnOccurrences: pieces.length, directory }));

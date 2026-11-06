import { writeFile } from 'node:fs/promises';
import { enclosurePresets } from '../src/parts/catalog-enclosure/lib/catalog';

await writeFile(
  new URL('../src/parts/catalog-enclosure/presets.json', import.meta.url),
  `${JSON.stringify(enclosurePresets, null, 2)}\n`,
);
process.stdout.write(`Synchronized ${enclosurePresets.length} enclosure catalog presets.\n`);

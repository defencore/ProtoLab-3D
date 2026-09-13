/** Prepare every distinct imported bearing configuration for native FreeCAD validation. */
import fs from 'node:fs';
import { parts } from '../src/parts';
import { generateScript } from '../src/core/freecad';

const seen = new Set<string>();
const cases = [];
for (const part of parts) {
  for (const preset of part.presets.filter(
    (preset) => preset.catalog?.sourceName === 'Promtehimport',
  )) {
    for (const state of part.states?.map((state) => state.id) ?? ['default']) {
      const key = JSON.stringify([part.id, preset.parameters, state]);
      if (seen.has(key)) continue;
      seen.add(key);
      cases.push({
        id: `${part.id}/${preset.id}/${state}`,
        dimensions: part.dimensions(preset.parameters, state),
        code: generateScript(part, preset.parameters, state),
      });
    }
  }
}
fs.writeFileSync(
  process.argv[2] ?? '/tmp/protolab-promteh-native-cases.json',
  JSON.stringify(cases),
);
console.log(JSON.stringify({ cases: cases.length }));

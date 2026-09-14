/** Prepare complete macros for an optional native FreeCAD audit. */
import { writeFileSync } from 'node:fs';
import horn from '../src/parts/servo-arm/part';
import gear from '../src/parts/servo-gear/part';
import clevis from '../src/parts/clevis/part';
import { generateScript } from '../src/core/freecad';
import type { Parameters } from '../src/core/types';

const cases = [horn, gear, clevis].flatMap((part) => {
  const states = part.states?.map((s) => s.id) ?? ['default'];
  const selections: { name: string; parameters: Parameters; state: string; roundTrip: boolean }[] =
    [
      ...states.map((state) => ({
        name: `${part.id}/default/${state}`,
        parameters: part.defaults,
        state,
        roundTrip: true,
      })),
      ...part.presets.map((preset) => ({
        name: `${part.id}/${preset.id}`,
        parameters: preset.parameters,
        state: states[0],
        roundTrip: false,
      })),
    ];
  if (part.id === 'servo-arm') {
    const clamp = part.presets.find((preset) => preset.parameters.clamp);
    if (clamp)
      selections.push({
        name: 'servo-arm/clamp/socket-up',
        parameters: clamp.parameters,
        state: 'socket-up',
        roundTrip: true,
      });
  }
  return selections.map((s) => ({
    ...s,
    id: part.id,
    script: generateScript(part, s.parameters, s.state),
  }));
});
const output = process.argv[2] ?? '/tmp/protolab-servo-native.json';
writeFileSync(output, JSON.stringify(cases));
console.log(`Prepared ${cases.length} native FreeCAD cases in ${output}.`);

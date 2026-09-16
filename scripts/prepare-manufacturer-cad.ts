/** Prepare a production macro for comparison with its pinned source STEP. */
import { writeFileSync } from 'node:fs';
import { parts } from '../src/parts';
import { generateScript } from '../src/core/freecad';
import { modelEvidence } from '../src/core/model-evidence';

const [family, presetId, output, state = 'assembled'] = process.argv.slice(2);
const part = parts.find((part) => part.id === family);
const preset = part?.presets.find((preset) => preset.id === presetId);
if (!part || !preset || !output)
  throw new Error('Usage: prepare-manufacturer-cad.ts FAMILY PRESET OUTPUT.json [STATE]');
const parameters = { ...part.defaults, ...preset.parameters };
if (modelEvidence(part, parameters, presetId).kind !== 'manufacturer-cad')
  throw new Error('The selected preset has no pinned manufacturer CAD source.');
writeFileSync(
  output,
  JSON.stringify({ parameters, state, script: generateScript(part, parameters, state, presetId) }),
);
console.log(output);

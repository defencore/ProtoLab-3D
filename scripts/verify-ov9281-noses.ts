import { mkdirSync, writeFileSync } from 'node:fs';
import { generateScript } from '../src/core/freecad';
import part, {
  configuredPieces,
  libraries,
  ethernetKeepout,
} from '../src/parts/rocket-camera-nose/part';
import { cameraCablePlans } from '../src/parts/rocket-camera-nose/lib/csi';
import { pythonShape } from '../src/core/assembly/boundary/shapes';
import { componentPython } from '../src/core/assembly/detail-instances';
const output = 'test-results/ov9281-camera-variants';
mkdirSync(output, { recursive: true });
const cases = [];
for (const setup of ['ov9281', 'dual']) {
  const preset = part.presets.find((p) => p.id === setup + '-90-86')!;
  const p = preset.parameters;
  const pieces = configuredPieces(p, 'assembled');
  const macro = generateScript(part, p, 'assembled', preset.id);
  writeFileSync(`${output}/${setup}.FCMacro`, macro);
  writeFileSync(
    `${output}/${setup}-reserves.py`,
    `ethernet=${pythonShape(ethernetKeepout(p))}\n` +
      cameraCablePlans(p)
        .map((route) => `csi_${route.id}=${pythonShape({ kind: 'loft', rings: route.rings })}`)
        .join('\n'),
  );
  cases.push({
    setup,
    macro: setup + '.FCMacro',
    parameters: p,
    components: pieces.map((x) => ({
      id: x.component.id,
      libraryId: x.component.libraryId,
      printed: x.component.manufacturing?.processes.includes('printing'),
    })),
    routes: cameraCablePlans(p).map(
      ({ id, port, totalLength, slack, minBendRadius, sourceMouth, cameraMouth }) => ({
        id,
        port,
        totalLength,
        slack,
        minBendRadius,
        sourceMouth,
        cameraMouth,
      }),
    ),
  });
}
writeFileSync(`${output}/variants.json`, JSON.stringify(cases, null, 2));
console.log(
  cases.map((c) => ({ setup: c.setup, components: c.components.length, routes: c.routes })),
);

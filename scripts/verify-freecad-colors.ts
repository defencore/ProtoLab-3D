/** Prepare GUI appearance cases for verify-freecad-colors.FCMacro. */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Mesh, MeshStandardMaterial, SRGBColorSpace } from 'three';
import coupling from '../src/parts/jaw-coupling/part';
import { generateScript } from '../src/core/freecad';
import { generateProjectScript } from '../src/core/project-freecad';
import { freecadAppearancePython } from '../src/core/freecad-appearance';
import { addProduct, createProject } from '../src/core/design-project';
import { disposeModel } from '../src/core/mechanical';

const selections = [
  coupling.presets.find((preset) => preset.parameters.design === 'hltnc-d25-l30')!,
  ...['clamp', 'thimble'].map((fixing) =>
    coupling.presets.find(
      (preset) =>
        preset.parameters.design === 'lf-d14-l22' &&
        preset.parameters.fixing === fixing &&
        preset.parameters.boreOption === '3-4',
    )!,
  ),
];
const cases = selections.flatMap((preset) =>
  coupling.states!.map((state) => {
    const model = coupling.buildGeometry(preset.parameters, state.id),
      colors: number[][] = [];
    try {
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const hex = (object.material as MeshStandardMaterial).color.getHex(SRGBColorSpace);
        colors.push([16, 8, 0].map((shift) => ((hex >> shift) & 255) / 255));
      });
    } finally {
      disposeModel(model);
    }
    return {
      name: `${preset.id}/${state.id}`,
      colors,
      script: generateScript(coupling, preset.parameters, state.id),
    };
  }),
);
const selected = selections[2];
const project = addProduct(createProject('Coupling appearance audit'), [coupling], {
  part: coupling,
  parameters: selected.parameters,
  state: 'assembly',
  presetId: selected.id,
}).project;
cases.push({
  name: 'project-lf-thimble/assembly',
  colors: cases.find((item) => item.name === `${selected.id}/assembly`)!.colors,
  script: generateProjectScript(project, [coupling]),
});
const destination = process.argv[2] ?? 'test-results/jaw-coupling-colors';
mkdirSync(destination, { recursive: true });
writeFileSync(path.join(destination, 'cases.json'), JSON.stringify(cases, null, 2));
writeFileSync(path.join(destination, 'appearance.py'), freecadAppearancePython);
copyFileSync('scripts/verify-freecad-colors.py', path.join(destination, 'verify.FCMacro'));
console.log(JSON.stringify({ cases: cases.length, output: path.resolve(destination) }));

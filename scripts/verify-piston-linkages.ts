/** Prepare preview envelopes and full macros for the optional native FreeCAD audit. */
import { writeFileSync } from 'node:fs';
import { Box3 } from 'three';
import piston from '../src/parts/piston/part';
import rod from '../src/parts/connecting-rod/part';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';

const cases = [piston, rod].flatMap((part) => {
  const states = part.states?.map((state) => state.id) ?? ['default'];
  const selections = [{ id: 'default', parameters: part.defaults }, ...part.presets];
  if (part.id === 'piston') {
    for (const nominalBore of [20, 42, 90]) {
      const pneumatic = part.updateParameters!(
        { ...part.defaults, nominalBore, variant: 'pneumatic' },
        'variant',
      );
      selections.push({
        id: `transition-pneumatic-to-engine-${nominalBore}`,
        parameters: part.updateParameters!({ ...pneumatic, variant: 'engine' }, 'variant'),
      });
    }
  } else {
    const compact = part.presets.find((preset) => preset.id === 'compact-linkage')!;
    selections.push({
      id: 'transition-compact-to-split',
      parameters: part.updateParameters!({ ...compact.parameters, bigEnd: 'split-cap' }, 'bigEnd'),
    });
  }
  return selections.flatMap((selection, index) =>
    states.map((state) => {
      const model = part.buildGeometry(selection.parameters, state);
      try {
        model.updateMatrixWorld(true);
        const components = model.children.map((child) => {
          const bounds = new Box3().setFromObject(child, true);
          return { name: child.name, min: bounds.min.toArray(), max: bounds.max.toArray() };
        });
        return {
          name: `${part.id}/${selection.id}/${state}`,
          id: part.id,
          state,
          parameters: selection.parameters,
          components,
          roundTrip: index === 0 || (state === states[0] && index === selections.length - 1),
          script: generateScript(part, selection.parameters, state),
        };
      } finally {
        disposeModel(model);
      }
    }),
  );
});
const output = process.argv[2] ?? '/tmp/protolab-piston-native.json';
writeFileSync(output, JSON.stringify(cases));
console.log(`Prepared ${cases.length} native FreeCAD cases in ${output}.`);

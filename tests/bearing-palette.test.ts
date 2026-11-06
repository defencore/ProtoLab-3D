import assert from 'node:assert/strict';
import test from 'node:test';
import { Mesh, MeshStandardMaterial, SRGBColorSpace } from 'three';
import type { Parameters, PartDefinition } from '../src/core/types';
import { disposeModel } from '../src/core/mechanical';
import ball from '../src/parts/ball-bearing/part';
import doubleRow from '../src/parts/double-row-bearing/part';
import angular from '../src/parts/angular-contact-bearing/part';
import spherical from '../src/parts/spherical-roller-bearing/part';
import tapered from '../src/parts/tapered-roller-bearing/part';
import needle from '../src/parts/needle-bearing/part';
import selfAligning from '../src/parts/self-aligning-bearing/part';
import cylindrical from '../src/parts/roller-bearing/part';
import flanged from '../src/parts/flanged-ball-bearing/part';
import sphericalThrust from '../src/parts/spherical-thrust-bearing/part';
import plain from '../src/parts/plain-bearing/part';
import insert from '../src/parts/insert-bearing/part';
import rodEnd from '../src/parts/rod-end-bearing/part';
import flange2 from '../src/parts/flange-2-bolt-bearing/part';
import flange4 from '../src/parts/flange-4-bolt-bearing/part';
import thrust from '../src/parts/thrust-bearing/part';
import doubleAngular from '../src/parts/double-row-angular-contact-bearing/part';
import clutch from '../src/parts/csk-clutch/part';
import oilSeal from '../src/parts/radial-oil-seal/part';

const families = [
  ball,
  doubleRow,
  angular,
  spherical,
  tapered,
  needle,
  selfAligning,
  cylindrical,
  flanged,
  sphericalThrust,
  plain,
  insert,
  rodEnd,
  flange2,
  flange4,
  thrust,
  doubleAngular,
  clutch,
  oilSeal,
];

function renderedColors(part: PartDefinition, parameters: Parameters, state: string): number[][] {
  const model = part.buildGeometry(parameters, state),
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
  if (part.id === 'rod-end-bearing') {
    // The native housing fuses the same-colored eye and stem into one physical component.
    assert.deepEqual(colors[0], colors[2]);
    return colors.slice(0, 2);
  }
  return colors;
}

test('all nineteen analytic-bearing families export the rendered sRGB palette in every state and closure', () => {
  for (const part of families) {
    const closure = part.parameters.find((field) => ['seals', 'closure'].includes(field.key));
    const configurations = closure?.options?.map((option) => ({
      ...part.defaults,
      [closure.key]: option.value,
    })) ?? [part.defaults];
    for (const p of configurations)
      for (const state of part.states ?? [{ id: 'default' }]) {
        let exported: number[][] | undefined;
        for (const line of part.python(p, state.id).split('\n')) {
          if (line.startsWith('component_colors = '))
            exported = JSON.parse(line.slice('component_colors = '.length));
          if (line.startsWith('component_colors.extend('))
            exported!.push(...JSON.parse(line.slice('component_colors.extend('.length, -1)));
        }
        assert.ok(exported, `${part.id}: explicit native component colors`);
        assert.deepEqual(
          exported,
          renderedColors(part, p, state.id),
          `${part.id}/${state.id}/${closure ? p[closure.key] : ''}`,
        );
      }
  }
});

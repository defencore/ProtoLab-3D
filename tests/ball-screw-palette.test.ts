import assert from 'node:assert/strict';
import test from 'node:test';
import { Mesh, MeshStandardMaterial } from 'three';
import screw from '../src/parts/ball-screw/part';
import nut from '../src/parts/ball-nut/part';
import { withGeometryMode } from '../src/core/geometry-mode';
import { disposeModel } from '../src/core/mechanical';

test('screw and nut native components use the exact browser palette in both detail modes', () => {
  for (const part of [screw, nut])
    for (const mode of ['simple', 'full'] as const)
      for (const family of ['SFK', 'DFU', 'SFI', 'SFE'])
        withGeometryMode(mode, () => {
          const p = { ...part.defaults, family };
          const state = part.states![0].id;
          const model = part.buildGeometry(p, state);
          const preview = new Set<number>();
          try {
            model.traverse((child) => {
              if (!(child instanceof Mesh)) return;
              for (const material of Array.isArray(child.material)
                ? child.material
                : [child.material])
                if (material instanceof MeshStandardMaterial) preview.add(material.color.getHex());
            });
          } finally {
            disposeModel(model);
          }
          const source = part.python(p, state);
          const line = source.split('\n').find((line) => line.startsWith('component_colors = '))!;
          const colors = JSON.parse(line.slice('component_colors = '.length)) as number[][];
          const native = new Set(
            colors.map((rgb) => rgb.reduce((hex, value) => hex * 256 + Math.round(value * 255), 0)),
          );
          for (const rgb of colors)
            for (const value of rgb)
              assert.ok(
                Math.abs(value * 255 - Math.round(value * 255)) < 1e-8,
                'Saved native RGB must be exactly byte-representable.',
              );
          assert.deepEqual(
            [...native].sort(),
            [...preview].sort(),
            part.id + '/' + family + '/' + mode,
          );
        });
});

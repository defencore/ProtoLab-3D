import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { DoubleSide, Mesh, Raycaster, Vector3 } from 'three';
import type { Shape } from '../src/core/assembly/boundary/shapes';
import type { Parameters } from '../src/core/types';
import {
  initializeManifoldGeometry,
  manifoldBoundaryComponent,
} from '../src/core/assembly/manifold-boundary';
import { disposeModel } from '../src/core/mechanical';
import { defaults } from '../src/parts/handheld-lora-controller/configurator';
import presets from '../src/parts/handheld-lora-controller/presets.json';
import { details } from '../src/parts/handheld-lora-controller/lib/details';
import { roundedFloorEnvelope } from '../src/parts/handheld-lora-controller/lib/grip';
import { board } from '../src/parts/handheld-lora-controller/lib/layout';
import {
  pcbWallReinforcement,
  reinforcement,
} from '../src/parts/handheld-lora-controller/lib/reinforcement';
import { B, shellLoft, subtract } from '../src/parts/handheld-lora-controller/lib/shapes';
import { webSliderAtTravel } from '../src/parts/handheld-lora-controller/lib/web-button';

before(initializeManifoldGeometry);

/** Evaluate the new wall roots through the exact clipping and cutters used by the finished base. */
function installedRoots(p: Parameters): Shape {
  const base = details(p).find(({ id }) => id === 'base')!.shape;
  if (base.kind !== 'subtract') throw new Error('Expected the production base cutters');
  return subtract(
    {
      kind: 'intersect',
      children: [
        pcbWallReinforcement(),
        roundedFloorEnvelope(p),
        shellLoft([
          [0, 2.4],
          [5, 0.2],
          [28, 0.2],
        ]),
      ],
    },
    ...base.children.slice(1),
  );
}

function evaluated(shape: Shape) {
  const model = manifoldBoundaryComponent(shape, 'PCB wall roots', 0xffffff);
  model.updateMatrixWorld(true);
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      material.side = DoubleSide;
    });
  });
  return model;
}

function inside(model: ReturnType<typeof evaluated>, point: number[]) {
  const hits = new Raycaster(
      new Vector3(...point),
      new Vector3(0.217, 0.537, 0.815).normalize(),
    ).intersectObject(model, true),
    distances = hits
      .map(({ distance }) => distance)
      .filter((distance, i, all) => !i || Math.abs(distance - all[i - 1]) > 1e-6);
  return distances.length % 2 === 1;
}

function volume(shape: Shape) {
  const model = evaluated(shape);
  let result = 0;
  try {
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const position = object.geometry.getAttribute('position'),
        index = object.geometry.index,
        count = index?.count ?? position.count;
      for (let i = 0; i < count; i += 3) {
        const [a, b, c] = [0, 1, 2].map((j) =>
          new Vector3().fromBufferAttribute(position, index ? index.getX(i + j) : i + j),
        );
        result += a.dot(b.cross(c)) / 6;
      }
    });
    return result;
  } finally {
    disposeModel(model);
  }
}

test('All seven variants keep the complete bearing width rooted from floor to PCB height', () => {
  for (const preset of presets) {
    const model = evaluated(installedRoots({ ...defaults, ...preset.parameters }));
    try {
      for (const site of reinforcement.pcbSupports) {
        assert.equal(site.width, site.id.endsWith('4') || site.id.endsWith('5') ? 3 : 6);
        for (const y of [site.y - site.width / 2 + 0.2, site.y, site.y + site.width / 2 - 0.2])
          for (const z of [3, 8, 14, board.pcbBottom - 0.2])
            assert.ok(
              inside(model, [Math.sign(site.x) * 13.7, y, z]),
              `${preset.id}: ${site.id} retains its full-width upright at Y${y}, Z${z}`,
            );
      }
    } finally {
      disposeModel(model);
    }
  }
});

test('PCB roots reach the side shell across their full width after lanyard and lock clearances', () => {
  for (const bodyModel of ['original', 'contoured', 'web-grip']) {
    const model = evaluated(installedRoots({ ...defaults, bodyModel, antennaType: 'internal' }));
    try {
      for (const site of reinforcement.pcbSupports) {
        // The USB-corner cord crosses the left root. Its broad lower web
        // stays below the cord; the complete slider loading channel stays open above it.
        const z = site.x < 0 && site.y > 30 ? 3.8 : 8.8;
        for (const y of [site.y - site.width / 2 + 0.2, site.y, site.y + site.width / 2 - 0.2])
          for (let i = 0; i <= 30; i++) {
            const x = Math.sign(site.x) * (13.7 + ((Math.abs(site.wallX) - 1.2 - 13.7) * i) / 30);
            assert.ok(
              inside(model, [x, y, z]),
              `${bodyModel}: ${site.id} has an uninterrupted broad load path to the shell`,
            );
          }
      }
    } finally {
      disposeModel(model);
    }
  }
});

test('Broad PCB roots leave the Palm Lock slider operating and loading path clear', () => {
  const roots = installedRoots({ ...defaults, bodyModel: 'web-grip', antennaType: 'internal' }),
    original = volume(roots);
  for (const travel of [0, 4.2, 8.4, 15.4, 22.4, 29.4, 36.4])
    assert.ok(
      Math.abs(original - volume(subtract(roots, webSliderAtTravel(travel)))) < 1e-4,
      `The full-width support obstructs slider travel at ${travel} mm`,
    );
});

test('Wall-connected PCB roots leave conservative board and 102540 cell envelopes clear', () => {
  const boardReserve = B(board.width + 1, board.length + 1, 12, 0, board.y, board.z - 0.5),
    // Includes the measured 43 × 25 × 10 cell, 0.5 mm tape and side clearance.
    cellReserve = B(26, 44, 11, 0, 3, 1.9);
  for (const preset of presets) {
    const roots = installedRoots({ ...defaults, ...preset.parameters }),
      original = volume(roots);
    for (const [label, envelope] of [
      ['board and components', boardReserve],
      ['cell and adhesive', cellReserve],
    ] as const)
      assert.ok(
        Math.abs(original - volume(subtract(roots, envelope))) < 1e-4,
        `${preset.id}: broad wall supports intrude into the ${label} clearance`,
      );
  }
});

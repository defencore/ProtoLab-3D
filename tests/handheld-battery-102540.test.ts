import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import type { Shape } from '../src/core/assembly/boundary/shapes';
import { componentGeometry } from '../src/core/assembly/detail-instances';
import {
  initializeManifoldGeometry,
  manifoldBoundaryComponent,
} from '../src/core/assembly/manifold-boundary';
import { disposeModel } from '../src/core/mechanical';
import part from '../src/parts/handheld-lora-controller/part';
import { details } from '../src/parts/handheld-lora-controller/lib/details';
import { layout, batteryBridge, shell } from '../src/parts/handheld-lora-controller/lib/layout';
import { configuredPieces, libraries } from '../src/parts/handheld-lora-controller/lib/model';
import { rounded, subtract } from '../src/parts/handheld-lora-controller/lib/shapes';

before(initializeManifoldGeometry);

function volume(shape: Shape): number {
  const object = manifoldBoundaryComponent(shape, 'Measured battery fit', 0xaaaaaa);
  try {
    let result = 0;
    object.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const positions = child.geometry.getAttribute('position'),
        index = child.geometry.index;
      for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
        const [a, b, c] = [0, 1, 2].map((j) =>
          new Vector3().fromBufferAttribute(positions, index ? index.getX(i + j) : i + j),
        );
        result += a.dot(b.clone().cross(c)) / 6;
      }
    });
    return result;
  } finally {
    disposeModel(object);
  }
}

test('The measured 102540 preview includes the actual cell and 0.5 mm adhesive', () => {
  const p = { ...part.defaults },
    d = layout(p);
  const pieces = configuredPieces(p, 'assembled').filter(({ component }) =>
    ['battery-reference', 'battery-floor-pad', 'battery-bridge-pad'].includes(component.id),
  );
  const model = componentGeometry(libraries, pieces);
  try {
    model.updateMatrixWorld(true);
    const boxes = Object.fromEntries(
      pieces.map((piece, i) => [
        piece.component.id,
        new Box3().setFromObject(model.children[i], true),
      ]),
    );
    const cell = boxes['battery-reference'],
      tape = boxes['battery-floor-pad'],
      pad = boxes['battery-bridge-pad'];
    for (const [actual, expected] of cell
      .getSize(new Vector3())
      .toArray()
      .map((n, i) => [n, [25, 43, 10][i]]))
      assert.ok(Math.abs(actual - expected) < 1e-5);
    assert.equal(d.battery.y, 3, 'Preserve the physically checked existing battery bay');
    assert.equal(d.battery.tapeThickness, 0.5);
    assert.equal(tape.min.z, shell.floor);
    assert.equal(tape.max.z - tape.min.z, 0.5);
    assert.equal(cell.min.z, tape.max.z);
    assert.ok(Math.abs(pad.min.z - cell.max.z) < 1e-5);
    assert.ok(Math.abs(pad.max.z - batteryBridge.z) < 1e-5);
    assert.ok(Math.abs(pad.max.z - pad.min.z - 0.9) < 1e-5);
  } finally {
    disposeModel(model);
  }
});

test('The measured cell fits every finished printed bay without moving its original location', () => {
  for (const preset of part.presets) {
    const p = { ...part.defaults, ...preset.parameters },
      d = layout(p).battery;
    const cell = rounded(d.width, d.length, 2, d.z, d.height, d.x, d.y);
    const original = volume(cell);
    for (const piece of details(p).filter(({ id }) => id === 'base' || id === 'battery-retainer')) {
      const obstruction = original - volume(subtract(cell, piece.shape));
      assert.ok(
        Math.abs(obstruction) < 1e-4,
        `${preset.id}: measured cell intersects printed ${piece.id} by ${obstruction} mm³`,
      );
    }
  }
});

test('The clamp pad bears on the retainer across its complete upper face in every variant', () => {
  for (const preset of part.presets) {
    const p = { ...part.defaults, ...preset.parameters };
    const pieces = configuredPieces(p, 'assembled').filter(({ component }) =>
      ['battery-bridge-pad', 'battery-retainer'].includes(component.id),
    );
    const model = componentGeometry(libraries, pieces);
    try {
      model.updateMatrixWorld(true);
      const pad =
        model.children[pieces.findIndex(({ component }) => component.id === 'battery-bridge-pad')];
      const retainer =
        model.children[pieces.findIndex(({ component }) => component.id === 'battery-retainer')];
      let checked = 0;
      pad.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        const position = child.geometry.getAttribute('position'),
          index = child.geometry.index;
        for (let i = 0; i < (index?.count ?? position.count); i += 3) {
          const points = [0, 1, 2].map((j) =>
            new Vector3()
              .fromBufferAttribute(position, index ? index.getX(i + j) : i + j)
              .applyMatrix4(child.matrixWorld),
          );
          const normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));
          if (
            normal.z <= 1e-8 ||
            !points.every((point) => Math.abs(point.z - batteryBridge.z) < 1e-5)
          )
            continue;
          const center = points[0]
            .clone()
            .add(points[1])
            .add(points[2])
            .multiplyScalar(1 / 3);
          center.z -= 0.05;
          const hit = new Raycaster(center, new Vector3(0, 0, 1), 0, 0.1).intersectObject(
            retainer,
            true,
          )[0];
          assert.ok(
            // JSCAD's evaluated boundary is displaced by about 0.00002 mm;
            // allow its numerical surface precision, not a physical pad gap.
            hit && Math.abs(hit.point.z - batteryBridge.z) < 1e-4,
            `${preset.id}: unsupported upper clamp-pad face`,
          );
          checked++;
        }
      });
      assert.ok(checked >= 2, `${preset.id}: no actual pad bearing faces checked`);
    } finally {
      disposeModel(model);
    }
  }
});

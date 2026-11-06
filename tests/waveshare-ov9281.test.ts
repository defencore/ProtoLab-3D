import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, DoubleSide, Mesh, Raycaster, Vector3 } from 'three';
import camera, {
  ov9281Interface as a,
  rearContactInterface,
} from '../src/parts/waveshare-ov9281-110/part';
import { disposeModel } from '../src/core/mechanical';

test('OV9281 supplier datums, six bores and focus travel are preserved', () => {
  assert.deepEqual(a.fieldOfView, { diagonal: 110, horizontal: 93, vertical: 70 });
  assert.equal(a.mountingHoles.length, 4);
  assert.deepEqual(
    rearContactInterface.mountingHoles,
    a.mountingHoles.map((hole) => ({ ...hole, z: 0 })),
  );
  assert.equal(rearContactInterface.contactButtonDiameter, 3);
  assert.equal(rearContactInterface.componentKeepoutDiameter, 3.4);
  assert.equal(rearContactInterface.supplierPadOuterDiameter, null);
  assert.equal(rearContactInterface.supplierRearComponentHeights, null);
  for (const focusExtension of [7, 10]) {
    const p = { focusExtension };
    assert.deepEqual(camera.validate?.(p, 'default'), []);
    const model = camera.buildGeometry(p, 'default');
    try {
      model.updateMatrixWorld(true);
      model.traverse((node) => {
        if (node instanceof Mesh)
          for (const material of Array.isArray(node.material) ? node.material : [node.material])
            material.side = DoubleSide;
      });
      const b = new Box3().setFromObject(model, true);
      assert.ok(Math.abs(b.max.z - (8.8 + focusExtension)) < 1e-4);
      assert.ok(Math.abs(b.min.y + 15) < 1e-4);
      const pcb = model.children[0];
      for (const hole of [...a.mountingHoles, ...a.auxiliaryHoles])
        assert.equal(
          new Raycaster(new Vector3(hole.x, hole.y, 3), new Vector3(0, 0, -1)).intersectObject(
            pcb,
            true,
          ).length,
          0,
        );
      const rear = model.children[1];
      for (const hole of rearContactInterface.mountingHoles)
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const radius: number = rearContactInterface.contactButtonDiameter / 2 - 0.05;
          const x: number = hole.x + dx * radius;
          const y: number = hole.y + dy * radius;
          assert.equal(
            new Raycaster(new Vector3(x, y, -2), new Vector3(0, 0, 1), 0, 2.1).intersectObject(
              rear,
              true,
            ).length,
            0,
            'only the rear reference is relieved around the four source mounting annuli',
          );
          assert.ok(
            new Raycaster(new Vector3(x, y, -0.1), new Vector3(0, 0, 1), 0, 1.8).intersectObject(
              pcb,
              true,
            ).length >= 2,
            'PCB material outside the unchanged D2.2 bore remains available for the authored contact',
          );
        }
    } finally {
      disposeModel(model);
    }
  }
  for (const focusExtension of [6, 11, NaN])
    assert.ok(camera.validate?.({ focusExtension }, 'default').length);
});

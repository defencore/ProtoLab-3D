import assert from 'node:assert/strict';
import test from 'node:test';
import { Mesh, Vector3 } from 'three';
import { component } from '../src/core/assembly/boundary/shapes';
import { withGeometryMode } from '../src/core/geometry-mode';
import { disposeModel } from '../src/core/mechanical';
import { configuredDrive } from '../src/parts/tr8-compact-actuator/lib/drive';

test('concave four-start thread caps stay inside the turned stock at every configured phase', () => {
  for (const angle of [-20, 0, 20])
    withGeometryMode('full', () => {
      const travel = 10 * Math.tan((angle * Math.PI) / 180);
      const model = component(configuredDrive(travel).screw, 'Four-start screw', 0x87919c);
      model.rotation.x = Math.PI / 4;
      model.updateMatrixWorld(true);
      const axis = new Vector3(0, 0, 10).applyAxisAngle(new Vector3(1, 0, 0), Math.PI / 4);
      let count = 0,
        maxRadius = 0;
      try {
        model.traverse((ob) => {
          if (!(ob instanceof Mesh)) return;
          const positions = ob.geometry.getAttribute('position');
          for (let i = 0; i < positions.count; i++) {
            const point = new Vector3()
              .fromBufferAttribute(positions, i)
              .applyMatrix4(ob.matrixWorld);
            maxRadius = Math.max(maxRadius, Math.hypot(point.y - axis.y, point.z - axis.z));
            count++;
          }
        });
        assert.ok(
          count > 10000,
          'The actual threaded union, including both turned end journals, must be checked.',
        );
        assert.ok(
          maxRadius <= 4.00003,
          `Phase ${angle} exceeds the nominal Ø8 stock: R${maxRadius}`,
        );
        assert.ok(maxRadius > 3.999, 'The complete crests must survive cap triangulation.');
      } finally {
        disposeModel(model);
      }
    });
});

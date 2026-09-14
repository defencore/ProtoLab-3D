import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import setScrew from '../src/parts/set-screw/part';
import { din915Rows } from '../src/parts/set-screw/lib/catalog/din915';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';

const references = setScrew.presets.filter((preset) => preset.id.startsWith('reference-din915-'));

test('DIN 915 retains every supplied size without claiming an unlisted stock length', () => {
  assert.deepEqual(
    references.map((preset) => preset.parameters.diameter),
    [2, 2.5, 3, 4, 5, 6, 8, 10, 12, 14, 16],
  );
  for (const [index, preset] of references.entries()) {
    const row = din915Rows[index],
      p = preset.parameters;
    assert.deepEqual(validateParameters(setScrew, p, 'default'), [], preset.id);
    assert.deepEqual(
      [p.pitch, p.tipDiameter, p.tipLength, p.driveWidth, p.driveDepth],
      [
        row.pitch,
        row.pointDiameter.max,
        row.pointLength.max,
        row.socketNominal,
        row.socketDepthMin,
      ],
    );
    assert.equal(p.tip, 'dog');
    assert.equal(p.threadMode, 'modeled');
    assert.equal(p.finish, 'black');
    assert.ok(!preset.catalog?.verifiedParameters?.includes('length'));
    assert.ok(!preset.catalog?.verifiedParameters?.includes('dogShoulderLength'));
    assert.deepEqual(preset.catalog?.parameterRanges?.tipDiameter, row.pointDiameter);
    assert.deepEqual(preset.catalog?.parameterRanges?.tipLength, row.pointLength);
  }
  // Keep the printed nominal and tolerance values distinct, even where they disagree.
  assert.equal(din915Rows[1].socketNominal, 1.3);
  assert.deepEqual(din915Rows[1].socketActual, { min: 1.27, max: 1.295 });
});

test('all DIN 915 sizes have a closed outward shell, full cylindrical point and blind hex socket', () => {
  for (const preset of references) {
    const p = preset.parameters,
      model = setScrew.buildGeometry(p, 'default');
    try {
      model.updateMatrixWorld(true);
      const size = new Box3().setFromObject(model).getSize(new Vector3());
      assert.ok(Math.abs(size.z - Number(p.length)) < 1e-5, preset.id + ': L includes point');
      model.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        assert.ok(child.material instanceof MeshStandardMaterial);
        assert.equal(child.material.color.getHex(), 0x34363b);
        const position = child.geometry.getAttribute('position'),
          index = child.geometry.index;
        const edges = new Map<string, { count: number; winding: number }>();
        let volume = 0;
        for (let i = 0; i < (index?.count ?? position.count); i += 3) {
          const points = [0, 1, 2].map((j) =>
            new Vector3().fromBufferAttribute(position, index ? index.getX(i + j) : i + j),
          );
          const keys = points.map((point) =>
            point
              .toArray()
              .map((v) => Math.round(v * 1e5))
              .join(','),
          );
          assert.equal(new Set(keys).size, 3, preset.id + ': no collapsed triangles');
          volume += points[0].dot(points[1].clone().cross(points[2])) / 6;
          for (let j = 0; j < 3; j++) {
            const a = keys[j],
              b = keys[(j + 1) % 3],
              key = [a, b].sort().join('|');
            const edge = edges.get(key) ?? { count: 0, winding: 0 };
            edge.count++;
            edge.winding += a < b ? 1 : -1;
            edges.set(key, edge);
          }
        }
        assert.ok(volume > 0, preset.id + ': outward winding');
        for (const edge of edges.values())
          assert.deepEqual(edge, { count: 2, winding: 0 }, preset.id + ': manifold edge');
      });
      const length = Number(p.length),
        radius = Number(p.tipDiameter) / 2;
      // Probe well inside both ends of Z: the chamfer must not shorten the cylinder.
      for (const fraction of [0.1, 0.9])
        for (let i = 0; i < 12; i++) {
          const angle = (i * Math.PI) / 6;
          const ray = new Raycaster(
            new Vector3(
              Number(p.diameter) * Math.cos(angle),
              Number(p.diameter) * Math.sin(angle),
              Number(p.tipLength) * fraction - length / 2,
            ),
            new Vector3(-Math.cos(angle), -Math.sin(angle), 0),
          );
          const hit = ray.intersectObject(model, true)[0];
          assert.ok(hit, preset.id + ': cylindrical point');
          assert.ok(
            Math.abs(Math.hypot(hit.point.x, hit.point.y) - radius) < 1e-4,
            preset.id + ': dp through full Z',
          );
        }
      const floor = new Raycaster(new Vector3(0, 0, length), new Vector3(0, 0, -1)).intersectObject(
        model,
        true,
      )[0];
      assert.ok(floor);
      assert.ok(
        Math.abs(floor.point.z - (length / 2 - Number(p.driveDepth))) < 1e-5,
        preset.id + ': t socket depth',
      );
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const hit = new Raycaster(
          new Vector3(0, 0, length / 2 - Number(p.driveDepth) / 2),
          new Vector3(Math.cos(angle), Math.sin(angle), 0),
        ).intersectObject(model, true)[0];
        assert.ok(hit);
        assert.ok(
          Math.abs(Math.hypot(hit.point.x, hit.point.y) - Number(p.driveWidth) / 2) < 1e-5,
          preset.id + ': six socket flats',
        );
      }
    } finally {
      disposeModel(model);
    }
  }
});

test('dog shoulder and socket cannot consume the remaining body length', () => {
  const p = references.find((preset) => preset.parameters.diameter === 6)!.parameters;
  assert.ok(
    validateParameters(
      setScrew,
      { ...p, length: Number(p.tipLength) + Number(p.dogShoulderLength) },
      'default',
    ).length,
  );
  assert.ok(
    validateParameters(
      setScrew,
      { ...p, driveDepth: Number(p.length) - Number(p.tipLength) - Number(p.dogShoulderLength) },
      'default',
    ).length,
  );
});

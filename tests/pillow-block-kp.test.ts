import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Raycaster, Vector3, type Object3D } from 'three';
import pillow from '../src/parts/pillow-block-bearing/part';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { generateScript } from '../src/core/freecad';

const drawings = [
  {
    id: 'kp08-mini-tech',
    bore: 8,
    height: 29,
    centre: 15,
    length: 55,
    depth: 13,
    pitch: 42,
    hole: 4.5,
    foot: 5,
    boundsDepth: 14.5,
  },
  {
    id: 'kp001-mini-tech',
    bore: 12,
    height: 38,
    centre: 19,
    length: 71,
    depth: 16,
    pitch: 56,
    hole: 7,
    foot: 6,
    boundsDepth: 18.5,
  },
];

for (const drawing of drawings)
  test(`${drawing.id}: actual shaft, foot and mounting holes follow the supplied drawing`, () => {
    const preset = pillow.presets.find((p) => p.id === drawing.id)!;
    assert.ok(preset?.catalog);
    const p = preset.parameters;
    assert.deepEqual(validateParameters(pillow, p, 'default'), []);
    assert.deepEqual(
      [
        p.bore,
        p.totalHeight,
        p.centerHeight,
        p.baseWidth,
        p.baseDepth,
        p.mountPitch,
        p.hole,
        p.baseThickness,
      ],
      [
        drawing.bore,
        drawing.height,
        drawing.centre,
        drawing.length,
        drawing.depth,
        drawing.pitch,
        drawing.hole,
        drawing.foot,
      ],
    );
    const model = pillow.buildGeometry(p, 'default');
    try {
      model.updateMatrixWorld(true);
      assert.equal(model.children.length, 7);
      const bounds = new Box3().setFromObject(model, true);
      [drawing.length, drawing.boundsDepth, drawing.height].forEach((value, i) =>
        assert.ok(Math.abs(bounds.getSize(new Vector3()).getComponent(i) - value) < 0.02),
      );
      assert.ok(Math.abs(bounds.min.z + drawing.centre) < 0.001);
      const housing = model.children[0];
      const ray = (x: number, y: number, z: number, direction: Vector3, target: Object3D = model) =>
        new Raycaster(new Vector3(x, y, z), direction).intersectObject(target, true);
      assert.equal(ray(0, -100, 0, new Vector3(0, 1, 0)).length, 0, 'shaft bore stays clear');
      assert.ok(
        ray(drawing.bore / 2 + 0.5, -100, 0, new Vector3(0, 1, 0)).length > 0,
        'physical inner race',
      );
      for (const side of [-1, 1]) {
        const x = (side * drawing.pitch) / 2;
        assert.equal(
          ray(x, 0, 100, new Vector3(0, 0, -1), housing).length,
          0,
          'through mounting hole',
        );
        assert.ok(
          ray(x + drawing.hole / 2 + 0.4, 0, 100, new Vector3(0, 0, -1), housing).length > 0,
          'material around mounting hole',
        );
      }
      const script = generateScript(pillow, p, 'default');
      assert.ok(script.includes('Locking set screw 2'));
      assert.ok(script.includes(preset.catalog.designation));
    } finally {
      disposeModel(model);
    }
  });

test('KP001 retains the drawing B/S datums and KP08 does not certify missing dimensions', () => {
  const kp001 = pillow.presets.find((p) => p.id === 'kp001-mini-tech')!;
  assert.equal(kp001.parameters.insertWidth, 14.5);
  assert.equal(Number(kp001.parameters.insertOffset) + Number(kp001.parameters.insertWidth) / 2, 4);
  const kp08 = pillow.presets.find((p) => p.id === 'kp08-mini-tech')!;
  assert.ok(!kp08.catalog!.verifiedParameters.includes('insertWidth'));
  assert.ok(!kp08.catalog!.verifiedParameters.includes('insertOffset'));
  assert.ok(
    validateParameters(pillow, { ...kp001.parameters, insertOffset: 8 }, 'default').length > 0,
  );
});

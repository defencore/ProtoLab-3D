import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, DoubleSide, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import part from '../src/parts/raspberry-pi/part';
import { cm5Mechanical, cm5Models, cm5Pieces } from '../src/parts/raspberry-pi/lib/cm5';
import { disposeModel } from '../src/core/mechanical';
import { matchingPreset } from '../src/core/preset-resolution';
import { modelEvidence } from '../src/core/model-evidence';

const parameters = (code: string, detail = 'lightweight') => ({
  model: `raspberry-pi-${code.toLowerCase()}`,
  detail,
});

test('CM5 provides the 32 stocked order codes rather than freely resizable module dimensions', () => {
  assert.equal(cm5Models.length, 32);
  const codes = new Set<string>();
  for (const model of cm5Models) {
    const p = parameters(model.id.replace('raspberry-pi-', ''));
    assert.deepEqual(part.validate(p, 'assembled'), []);
    const preset = matchingPreset(part, p)!;
    assert.equal(preset.id, model.id);
    const code = preset.catalog!.designation;
    codes.add(code);
    assert.equal(
      code,
      `CM5${model.wireless ? 1 : 0}${String(model.ramGB).padStart(2, '0')}${String(model.emmcGB).padStart(3, '0')}`,
    );
    assert.equal(preset.catalog!.attributes!.ramGB, model.ramGB);
    assert.equal(preset.catalog!.attributes!.emmcGB, model.emmcGB);
    assert.equal(preset.catalog!.attributes!.wireless, model.wireless ? 'Yes' : 'No');
    assert.match(preset.catalog!.sourceName, /table 12/);
    assert.equal(modelEvidence(part, p).kind, 'source-dimensions');
    assert.match(modelEvidence(part, p).limitations, /not original manufacturer CAD/);
    assert.deepEqual(part.dimensions(p, 'assembled').slice(0, 2), [55, 40]);
  }
  for (const wireless of [0, 1])
    for (const ram of [2, 4, 8, 16])
      for (const emmc of [0, 16, 32, 64])
        assert.ok(
          codes.has(
            `CM5${wireless}${String(ram).padStart(2, '0')}${String(emmc).padStart(3, '0')}`,
          ),
        );
  assert.ok(part.validate({ ...parameters('CM5104032'), width: 60 }, 'assembled').length);
  assert.ok(part.validate(parameters('CM5112032'), 'assembled').length);
  assert.ok(part.validate(parameters('CM5104008'), 'assembled').length);
  assert.ok(part.keywords!.includes('CM5'));
  for (const key of ['ramGB', 'emmcGB', 'wireless'])
    assert.ok(part.catalogFilterFields!.some((field) => field.key === key));
});

test('CM5 underside B2B connectors have the drawing orientation and carrier stacking datum', () => {
  const group = part.buildGeometry(parameters('CM5104032'), 'assembled');
  try {
    const connectors = group.children.filter((child) => child.name.includes('100-pin B2B'));
    assert.equal(connectors.length, 2);
    connectors.forEach((connector, index) => {
      const bounds = new Box3().setFromObject(connector, true);
      const center = bounds.getCenter(new Vector3());
      const size = bounds.getSize(new Vector3());
      assert.ok(Math.abs(center.x + 2.5) < 0.002);
      assert.ok(Math.abs(center.y - (index ? 17 : -17)) < 0.002);
      assert.ok(Math.abs(size.x - 21.52) < 0.002);
      assert.ok(Math.abs(size.y - 2.97) < 0.002);
      assert.ok(Math.abs(bounds.min.z + 1.11) < 0.002);
      assert.ok(Math.abs(bounds.max.z) < 0.002);
    });
    assert.deepEqual(
      cm5Mechanical.stacking.map((stack) => stack.pcbGap),
      [1.5, 4],
    );
    assert.deepEqual(
      cm5Mechanical.stacking.map((stack) => stack.nominalTop),
      [4.94, 7.44],
    );
    for (const stack of cm5Mechanical.stacking) {
      assert.equal(Number((stack.pcbGap + cm5Mechanical.board + 2.2).toFixed(2)), stack.nominalTop);
      assert.ok(stack.pcbGap + cm5Mechanical.connectors[0].bottom > 0);
    }
  } finally {
    disposeModel(group);
  }
});

test('CM5 has four open M2.5 clearance bores in a nominal 1.24 mm PCB', () => {
  const group = part.buildGeometry(parameters('CM5004000'), 'assembled');
  try {
    const pcb = group.children.find((child) => child.name.startsWith('CM5 PCB'))!;
    pcb.traverse((child) => {
      if (child instanceof Mesh) (child.material as MeshStandardMaterial).side = DoubleSide;
    });
    const ray = new Raycaster();
    const hit = (x: number, y: number) => {
      ray.set(new Vector3(x, y, 5), new Vector3(0, 0, -1));
      return ray.intersectObject(pcb, true).length > 0;
    };
    for (const [x, y] of cm5Mechanical.holes) {
      assert.equal(hit(x, y), false, `clear bore at ${x}, ${y}`);
      assert.equal(hit(x + 1.2, y), false, 'bore radius exceeds 1.2 mm');
      assert.equal(hit(x + 1.5, y), true, 'material remains around the Ø2.7 mm bore');
    }
    assert.equal(hit(0, 0), true);
    assert.equal(hit(27.4, 19.9), false, 'R3 corner is rounded');
    const size = new Box3().setFromObject(pcb, true).getSize(new Vector3());
    assert.ok(size.distanceTo(new Vector3(55, 40, 1.24)) < 0.002);
    assert.match(part.python(parameters('CM5004000'), 'assembled'), /1\.35/);
  } finally {
    disposeModel(group);
  }
});

test('CM5 Lite and radio options change fitted components while RAM and eMMC capacities share geometry', () => {
  const labels = (code: string) =>
    cm5Pieces(parameters(code), 'assembled').map((piece) => piece.label);
  assert.ok(labels('CM5104032').some((label) => label.includes('eMMC storage')));
  assert.ok(labels('CM5104032').some((label) => label.includes('Wireless module')));
  assert.ok(labels('CM5104032').some((label) => label.includes('U.FL')));
  assert.ok(!labels('CM5004000').some((label) => /eMMC|Wireless|U\.FL|antenna/.test(label)));
  assert.deepEqual(
    cm5Pieces(parameters('CM5104032'), 'assembled'),
    cm5Pieces(parameters('CM5116064'), 'assembled'),
  );
  for (const code of ['CM5004000', 'CM5104000', 'CM5004032', 'CM5104032']) {
    for (const detail of ['lightweight', 'full']) {
      const p = parameters(code, detail);
      const assembled = part.buildGeometry(p, 'assembled');
      const exploded = cm5Pieces(p, 'exploded');
      try {
        const size = new Box3().setFromObject(assembled, true).getSize(new Vector3());
        assert.ok(size.distanceTo(new Vector3(55, 40, 4.55)) < 0.002);
        const contactCount = assembled.children.filter((child) =>
          child.name.includes('illustrative contact'),
        ).length;
        assert.equal(contactCount, detail === 'full' ? 200 : 0);
        assert.ok(exploded.find((piece) => piece.label.includes('100-pin B2B'))!.z! < 0);
        assert.equal(exploded.find((piece) => piece.label.startsWith('CM5 PCB'))!.z, 0);
        assert.match(part.python(p, 'assembled'), /component_labels/);
      } finally {
        disposeModel(assembled);
      }
    }
  }
  assert.deepEqual(part.defaults, { model: 'raspberry-pi-5', detail: 'lightweight' });
  assert.ok(part.presets.some((preset) => preset.parameters.model === 'raspberry-pi-cm4'));
});

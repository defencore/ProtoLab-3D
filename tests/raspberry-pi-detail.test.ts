import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import part from '../src/parts/raspberry-pi/part';
import native from '../src/parts/raspberry-pi/lib/pi5/native.json';
import { disposeModel } from '../src/core/mechanical';
import { modelEvidence } from '../src/core/model-evidence';

test('Pi 5 defaults to a small assembly with original PCB and unchanged outer bounds', () => {
  const light = part.buildGeometry(part.defaults, 'assembled');
  const fullParameters = { ...part.defaults, detail: 'full' };
  const full = part.buildGeometry(fullParameters, 'assembled');
  try {
    assert.equal(part.defaults.detail, 'lightweight');
    assert.equal(light.children.length, 20);
    assert.equal(full.children.length, 2689);
    const bounds = (group: typeof light) => new Box3().setFromObject(group, true);
    assert.ok(bounds(light).min.distanceTo(bounds(full).min) < 0.002);
    assert.ok(bounds(light).max.distanceTo(bounds(full).max) < 0.002);
    assert.equal(
      (light.children[0] as Mesh).geometry,
      (full.children[2688] as Mesh).geometry,
      'PCB and mounting holes must use the unchanged original mesh',
    );
    const triangles = (group: typeof light) => {
      let n = 0;
      group.traverse((mesh) => {
        if (mesh instanceof Mesh)
          n += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3;
      });
      return n;
    };
    assert.ok(
      triangles(light) < triangles(full) / 50,
      'Reduce actual geometry, not just tree grouping',
    );
    const macro = part.python(part.defaults, 'assembled');
    const pcb = native.components[2688];
    assert.ok(
      macro.includes(native.templates[pcb.template].brep),
      'Exact original PCB BREP retained',
    );
    assert.ok(macro.length < part.python(fullParameters, 'assembled').length / 50);
    assert.ok(light.children.some((child) => child.name === 'Ethernet RJ45'));
    assert.equal(light.children.filter((child) => child.name.includes('GPIO')).length, 1);
    assert.equal(modelEvidence(part, part.defaults).kind, 'source-dimensions');
    assert.equal(modelEvidence(part, fullParameters).kind, 'manufacturer-cad');
  } finally {
    disposeModel(light);
    disposeModel(full);
  }
});

test('all Raspberry Pi models support lightweight and full detail without changing PCB dimensions', () => {
  for (const preset of part.presets.filter((p) => p.parameters.detail === 'lightweight')) {
    for (const detail of ['lightweight', 'full']) {
      const parameters = { ...preset.parameters, detail };
      assert.deepEqual(part.validate(parameters, 'assembled'), []);
      const model = part.buildGeometry(parameters, 'assembled');
      try {
        const size = new Box3().setFromObject(model, true).getSize(new Vector3());
        assert.ok(size.x >= Number(preset.catalog!.attributes!.width) - 0.002);
        assert.ok(size.y >= Number(preset.catalog!.attributes!.length) - 0.002);
      } finally {
        disposeModel(model);
      }
    }
  }
  assert.ok(part.validate({ ...part.defaults, detail: 'invalid' }, 'assembled').length);
});

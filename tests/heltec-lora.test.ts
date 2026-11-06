import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import module from '../src/parts/lora-module';
import { disposeModel } from '../src/core/mechanical';

const part = module.part;
const parameters = { model: 'heltec-wifi-lora32-v3' };
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 0.0003, `${actual} ~= ${expected}`);

test('Heltec V3.2: fixed supplier identity, connector filters and primary evidence', () => {
  const preset = part.presets.find((item) => item.id === parameters.model)!;
  assert.ok(preset);
  assert.deepEqual(part.validate(parameters, 'assembled'), []);
  assert.ok(part.validate({ ...parameters, width: 30 }, 'assembled').length);
  assert.equal(preset.catalog?.attributes?.manufacturer, 'Heltec');
  assert.equal(preset.catalog?.attributes?.usb, 'USB Type-C');
  assert.match(preset.catalog?.sourceUrl ?? '', /heltec\.cn\/.*V3\.2\.pdf$/);
  assert.ok(preset.catalog?.alternateSourceUrls?.some((url) => url.endsWith('/pin.png')));
  for (const key of ['manufacturer', 'construction', 'usb', 'connection', 'interface', 'chip']) {
    const field = part.catalogFilterFields!.find((item) => item.key === key)!;
    assert.ok(field.options?.some((option) => option.value === preset.catalog!.attributes![key]));
  }
});

test('Heltec V3.2: installation datum, unpopulated pads and closed exported preview', () => {
  for (const state of ['assembled', 'exploded']) {
    const group = part.buildGeometry(parameters, state);
    try {
      group.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(group, true);
      const size = bounds.getSize(new Vector3()).toArray();
      part.dimensions(parameters, state).forEach((value, i) => close(value, size[i]));
      assert.equal(
        group.children.filter((item) => /Unpopulated GPIO .* pad /.test(item.name)).length,
        36,
      );
      assert.ok(group.children.every((item) => !/ pin /.test(item.name)));
      if (state === 'assembled') {
        close(bounds.min.z, 0);
        close(bounds.max.z, 10.2);
        close(bounds.min.x, -12.75);
        close(bounds.max.x, 12.75);
        close(bounds.max.y, 26);
        const pcb = new Box3().setFromObject(
          group.children.find((item) => /^PCB /.test(item.name))!,
          true,
        );
        close(pcb.min.z, 3.6);
        close(pcb.max.z, 5.2);
        const usb = new Box3().setFromObject(
          group.children.find((item) => item.name === 'USB Type-C housing')!,
          true,
        );
        close(usb.max.y, 26);
        close((usb.min.z + usb.max.z) / 2, 2);
        const oled = new Box3().setFromObject(
          group.children.find((item) => item.name === 'OLED glass')!,
          true,
        );
        close((oled.min.y + oled.max.y) / 2, -6.1);
        close((oled.min.x + oled.max.x) / 2, 0);
        close(oled.max.x - oled.min.x, 18.56);
        close(oled.max.y - oled.min.y, 33.28);
      }
      group.traverse((item) => {
        if (!(item instanceof Mesh)) return;
        const positions = item.geometry.getAttribute('position');
        const index = item.geometry.index;
        const edges = new Map<string, number>();
        let volume = 0;
        for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
          const points = [0, 1, 2].map((j) =>
            new Vector3().fromBufferAttribute(positions, index ? index.getX(i + j) : i + j),
          );
          assert.ok(points.every((point) => point.toArray().every(Number.isFinite)));
          volume += points[0].dot(points[1].clone().cross(points[2])) / 6;
          const keys = points.map((point) =>
            point
              .toArray()
              .map((value) => Math.round(value * 1e5))
              .join(','),
          );
          for (let j = 0; j < 3; j++) {
            const edge = [keys[j], keys[(j + 1) % 3]].sort().join('|');
            edges.set(edge, (edges.get(edge) ?? 0) + 1);
          }
        }
        assert.ok(volume > 0, `${item.name}: positive volume`);
        assert.ok(
          [...edges.values()].every((count) => count === 2),
          `${item.name}: closed boundary`,
        );
      });
    } finally {
      disposeModel(group);
    }
  }
});

test('Heltec V4: separate sourced revision, protected display and correct USB side', () => {
  const parametersV4 = { model: 'heltec-wifi-lora32-v4' };
  const preset = part.presets.find((item) => item.id === parametersV4.model)!;
  assert.ok(preset);
  assert.deepEqual(part.validate(parametersV4, 'assembled'), []);
  assert.match(preset.catalog?.sourceUrl ?? '', /V4\.3\.1_Datasheet\.pdf$/);
  assert.equal(preset.catalog?.attributes?.length, 51.69);
  assert.ok(
    part.presets.some((item) => item.id === parameters.model),
    'V3 remains a separate valid article',
  );
  const group = part.buildGeometry(parametersV4, 'assembled');
  try {
    group.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(group, true);
    close(bounds.min.z, 0);
    close(bounds.max.z, 10.7);
    close(bounds.min.x, -12.7);
    close(bounds.max.x, 12.7);
    close(bounds.min.y, -25.845);
    close(bounds.max.y, 26.6);
    assert.equal(group.children.filter((item) => /Unpopulated .* pad /.test(item.name)).length, 40);
    assert.ok(group.children.every((item) => !/ pin /.test(item.name)));
    assert.ok(group.children.every((item) => !/spring antenna/.test(item.name)));
    for (const name of [
      'SH1.25-2 battery connector housing',
      'SH1.25-2 solar connector housing',
      'SH1.25-8 GNSS connector housing',
      'LoRa IPEX U.FL connector',
      'WiFi IPEX U.FL connector',
    ]) {
      assert.ok(
        group.children.some((item) => item.name === name),
        name,
      );
    }
    const usb = new Box3().setFromObject(
      group.children.find((item) => item.name === 'USB Type-C housing')!,
      true,
    );
    close(usb.min.z, 5.2);
    close(usb.max.y, 26.6);
    close((usb.min.z + usb.max.z) / 2, 6.69);
    const guard = new Box3().setFromObject(
      group.children.find(
        (item) => item.name === 'PC OLED guard and integrated FPC antenna envelope',
      )!,
      true,
    );
    close((guard.min.y + guard.max.y) / 2, -5.35);
    close((guard.min.x + guard.max.x) / 2, 0);
    close(guard.max.z, 10.7);
    close(guard.max.x - guard.min.x, 18.6);
    close(guard.max.y - guard.min.y, 33);
    const face = new Box3().setFromObject(
      group.children.find((item) => item.name === 'OLED active face')!,
      true,
    );
    close(face.max.z, 10.6);
    close((face.min.x + face.max.x) / 2, 2);
    close((face.min.y + face.max.y) / 2, -6.35);
    close(face.max.x - face.min.x, 11.4);
    close(face.max.y - face.min.y, 22);
    const glass = new Box3().setFromObject(
      group.children.find((item) => item.name === 'OLED glass')!,
      true,
    );
    close(glass.min.x, face.min.x);
    close(glass.max.x, face.max.x);
    close(glass.min.y, face.min.y);
    close(glass.max.y, face.max.y);
    assert.ok(guard.max.y < 12.8, 'head retainer band remains beyond the guarded OLED');
  } finally {
    disposeModel(group);
  }
});

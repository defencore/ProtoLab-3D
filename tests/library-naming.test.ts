import assert from 'node:assert/strict';
import test from 'node:test';
import camera from '../src/parts/camera/part';
import raspberryPi from '../src/parts/raspberry-pi/part';
import carrier from '../src/parts/compute-module-carrier/part';
import demonstrator from '../src/parts/mpr-10-demonstrator/part';

test('recent fixed catalogs use the same article names in model selectors and preset results', () => {
  for (const part of [camera, raspberryPi, carrier]) {
    const selector = part.parameters.find((field) => field.key === 'model');
    assert.ok(selector?.options, part.id);
    const names = new Map(selector.options.map((option) => [String(option.value), option.label]));
    assert.equal(new Set(names.values()).size, names.size, `${part.id}: article names are unique`);
    for (const preset of part.presets) {
      // Pi 5 also retains a separate full-detail inspection preset for the
      // same physical article; the default-detail preset names the article.
      if ('detail' in part.defaults && preset.parameters.detail !== part.defaults.detail) continue;
      assert.equal(
        preset.name,
        names.get(String(preset.parameters.model)),
        `${part.id}/${preset.id}`,
      );
    }
  }
});

test('Compute Module 5 names distinguish the order code, RAM, storage and wireless population', () => {
  const modules = raspberryPi.presets.filter((preset) =>
    /^CM5\d{6}$/.test(preset.catalog?.designation ?? ''),
  );
  assert.ok(modules.length > 0);
  for (const preset of modules) {
    const catalog = preset.catalog!;
    const attributes = catalog.attributes!;
    assert.ok(preset.name.includes(catalog.designation), preset.id);
    assert.ok(preset.name.includes(`${attributes.ramGB} GB RAM`), preset.id);
    assert.ok(
      preset.name.includes(
        Number(attributes.emmcGB) === 0 ? '· Lite ·' : `${attributes.emmcGB} GB eMMC`,
      ),
      preset.id,
    );
    assert.ok(
      preset.name.endsWith(attributes.wireless === 'Yes' ? '· wireless' : '· no wireless'),
      preset.id,
    );
  }
});

test('demonstrator controls identify prescribed poses as nominal rather than proven driven travel', () => {
  const angles = demonstrator.parameters.filter((field) => /^angle[1-4]$/.test(field.key));
  assert.equal(angles.length, 4);
  for (const angle of angles) {
    assert.match(angle.label, /nominal/i);
    assert.match(angle.description!, /prescribed.*pose/i);
  }
  assert.ok(
    demonstrator.assessment!(demonstrator.defaults).some((entry) =>
      /nominal joint travel/i.test(entry),
    ),
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import usb, { usbExtenderInterface } from '../src/parts/usb-wireless-extender/part';
import platform from '../src/parts/recovery-electronics-platform/part';
import mount, { mountingLayout } from '../src/parts/recovery-electronics-mount/part';
import gps from '../src/parts/gps-tracker/part';
import buzzer from '../src/parts/jhe42b-finder/part';
import evidence from '../src/parts/usb-wireless-extender/lib/source-evidence.json';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { groupBrowseFamilies } from '../src/core/browse-families';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';
import { resolveLibraryEntry } from '../src/core/library-identity';
import {
  addProduct,
  createProject,
  parseProject,
  serializeProject,
  validateProject,
  projectReadiness,
  specificationRows,
} from '../src/core/design-project';

const libraries = [usb, platform, mount, gps, buzzer];
test('transferred products and seats are separately searchable without replacing standard identities', () => {
  const index = buildLibrarySearchIndex(groupBrowseFamilies(libraries));
  for (const id of [
    'gps-tracker:zx908',
    'jhe42b-finder:jhe42b',
    'jhe42b-finder:jhe42b-project-reference-26x17x15',
    'usb-wireless-extender:speedybee-f405-wing-mini-usb',
    'recovery-electronics-platform:pem-current',
    ...mount.presets.map((preset) => mount.id + ':' + preset.id),
  ]) {
    const selected = resolveLibraryEntry(libraries, id);
    assert.ok(selected?.preset, id);
    assert.ok(
      searchLibrary(index, id).some(({ family }) => family.members.includes(selected.part)),
      id,
    );
    const state = selected.part.states?.[0]?.id ?? 'default';
    assert.deepEqual(validateParameters(selected.part, selected.preset.parameters, state), [], id);
  }
  assert.deepEqual(buzzer.dimensions({ model: 'jhe42b' }, 'default'), [23, 17, 17]);
  assert.deepEqual(
    buzzer.dimensions({ model: 'jhe42b-project-reference-26x17x15' }, 'default'),
    [26, 17, 15],
  );
});

test('USB fixed source model retains its complete underside and open mounting bores', () => {
  const retained = inflateSync(Buffer.from(evidence.retainedNativeBrep.data, 'base64'));
  assert.equal(
    createHash('sha256').update(retained).digest('hex'),
    usbExtenderInterface.sourceWorldSha256,
  );
  assert.equal(usb.validate({ ...usb.defaults, width: 30 }, 'assembled').length, 1);
  for (const state of usb.states!) {
    const model = usb.buildGeometry(usb.defaults, state.id);
    try {
      model.updateMatrixWorld(true);
      assert.equal(model.children.length, 7);
      assert.equal(new Set(model.children.map((child) => child.name)).size, 7);
      const measured = new Box3().setFromObject(model, true);
      const dimensions = measured.getSize(new Vector3()).toArray();
      usb
        .dimensions(usb.defaults, state.id)
        .forEach((value, axis) => assert.ok(Math.abs(value - dimensions[axis]) < 0.001));
      model.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        const position = child.geometry.getAttribute('position');
        assert.ok(Array.from(position.array).every(Number.isFinite));
      });
      if (state.id === 'assembled') {
        assert.ok(measured.min.distanceTo(new Vector3(-12.25, -10.75, -1.5)) < 0.001);
        assert.ok(measured.max.distanceTo(new Vector3(12.25, 10.75, 5.5)) < 0.001);
        for (const [x, y] of usbExtenderInterface.mountingAxes)
          assert.equal(
            new Raycaster(new Vector3(x, y, 10), new Vector3(0, 0, -1)).intersectObject(
              model.children[0],
              true,
            ).length,
            0,
          );
      }
    } finally {
      disposeModel(model);
    }
  }
});

test('current platform occurrences preserve exact source choices and canonical assembled placements', () => {
  const composition = platform.composition!(platform.defaults);
  assert.equal(composition.components.length, 9);
  assert.deepEqual(
    composition.components.map((component) => component.id),
    [
      'source-140',
      'source-248',
      'source-233',
      'source-234',
      'source-326',
      'source-159',
      'source-160',
      'source-161',
      'source-162',
    ],
  );
  const plain = composition.components.filter(
    (component) => component.presetId === 'gps-pad-plain-current',
  );
  assert.equal(plain.length, 2);
  assert.ok(plain.every((component) => component.supply === 'reference'));
  assert.equal(
    composition.components.find((component) => component.id === 'source-234')!.supply,
    'reference',
  );
  assert.equal(
    composition.components.find((component) => component.id === 'source-326')!.presetId,
    'speedybee-f405-wing-mini-usb',
  );
  assert.deepEqual(
    composition.components.find((component) => component.id === 'source-326')!.placement
      .translation,
    mountingLayout.usb.translation,
  );
  assert.deepEqual(
    composition.components.find((component) => component.id === 'source-248')!.placement
      .translation,
    [0, 0, 13],
  );
  for (const state of platform.states!) {
    const model = platform.buildGeometry(platform.defaults, state.id);
    try {
      model.updateMatrixWorld(true);
      assert.equal(model.children.length, 9);
      const size = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
      platform
        .dimensions(platform.defaults, state.id)
        .forEach((value, axis) => assert.ok(Math.abs(value - size[axis]) < 0.002));
    } finally {
      disposeModel(model);
    }
  }
  assert.deepEqual(platform.composition!(platform.defaults), composition);
});

test('source seating study round trip keeps reference status, one USB unit and reused plain pads', () => {
  const project = addProduct(createProject('Transferred recovery electronics'), libraries, {
    part: platform,
    parameters: platform.defaults,
    state: 'exploded',
    presetId: 'pem-current',
  }).project;
  const restored = parseProject(serializeProject(project, libraries), libraries);
  assert.deepEqual(validateProject(restored, libraries), []);
  const parent = restored.configurations.find(
    (configuration) => configuration.libraryId === platform.id,
  )!;
  assert.equal(parent.state, 'assembled');
  assert.equal(parent.supply, 'reference');
  assert.equal(specificationRows(restored, libraries).length, 0);
  assert.ok(
    projectReadiness(restored, libraries).issues.some((issue) =>
      issue.includes('reference geometry cannot be released'),
    ),
  );
  for (const keepPreset of [true, false]) {
    const forged = structuredClone(restored);
    const reference = forged.configurations.find(
      (configuration) => configuration.libraryId === buzzer.id,
    )!;
    reference.supply = 'purchased';
    if (!keepPreset) delete reference.presetId;
    assert.match(validateProject(forged, libraries).join(' '), /reference geometry cannot become/);
  }
  assert.equal(
    restored.configurations.filter((configuration) => configuration.libraryId === usb.id).length,
    1,
  );
  const plain = restored.configurations.filter(
    (configuration) =>
      configuration.libraryId === mount.id && configuration.presetId === 'gps-pad-plain-current',
  );
  assert.equal(plain.length, 1);
  assert.equal(
    restored.occurrences.filter((occurrence) => occurrence.configurationId === plain[0].id).length,
    2,
  );
});

test('only a declared reference structure accepts extra project occurrences', () => {
  const root = addProduct(createProject(), libraries, {
    part: platform,
    parameters: platform.defaults,
    state: 'assembled',
    presetId: 'pem-current',
  });
  const expanded = addProduct(
    root.project,
    libraries,
    {
      part: gps,
      parameters: gps.defaults,
      state: 'assembled',
      presetId: 'zx908',
    },
    root.occurrenceId,
  );
  assert.deepEqual(validateProject(expanded.project, libraries), []);
  assert.equal(expanded.project.occurrences.length, root.project.occurrences.length + 1);
  const leaf = addProduct(createProject(), libraries, {
    part: buzzer,
    parameters: { model: 'jhe42b-project-reference-26x17x15' },
    state: 'default',
    presetId: 'jhe42b-project-reference-26x17x15',
  });
  assert.throws(
    () =>
      addProduct(
        leaf.project,
        libraries,
        {
          part: gps,
          parameters: gps.defaults,
          state: 'assembled',
          presetId: 'zx908',
        },
        leaf.occurrenceId,
      ),
    /cannot contain another product/,
  );
});

test('saved projects cannot attach extra procurement units below an opaque USB accessory', () => {
  const root = addProduct(createProject(), libraries, {
    part: usb,
    parameters: usb.defaults,
    state: 'assembled',
    presetId: 'speedybee-f405-wing-mini-usb',
  });
  const other = addProduct(root.project, libraries, {
    part: gps,
    parameters: gps.defaults,
    state: 'assembled',
    presetId: 'zx908',
  });
  other.project.occurrences.find((occurrence) => occurrence.id === other.occurrenceId)!.parentId =
    root.occurrenceId;
  assert.match(
    validateProject(other.project, libraries).join(' '),
    /parent product cannot contain components/,
  );
  assert.throws(
    () => parseProject(JSON.stringify(other.project), libraries),
    /parent product cannot contain components/,
  );
});

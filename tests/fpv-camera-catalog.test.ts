import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Raycaster, Vector3 } from 'three';
import camera from '../src/parts/camera/part';
import models from '../src/parts/camera/lib/models.json';
import { disposeModel } from '../src/core/mechanical';
import {
  buildPresetIndex,
  emptyPresetFilters,
  fieldId,
  filterPresets,
} from '../src/core/preset-search';

const added = ['racer-nano4', 'robin3', 'ant', 'ratel-pro', 'avatar-nano-v3'] as const;
const preset = (id: string) => camera.presets.find((entry) => entry.id === id)!;

test('FPV additions are distinct fixed manufacturer articles with explicit reconstruction evidence', () => {
  for (const id of added) {
    const entry = preset(id);
    assert.ok(entry, id);
    assert.equal(camera.presets.filter((candidate) => candidate.id === id).length, 1);
    assert.deepEqual(entry.parameters, { model: id });
    assert.ok(['RunCam', 'Caddx'].includes(entry.catalog!.manufacturer!));
    assert.match(
      entry.catalog!.sourceUrl,
      /^https:\/\/(shop\.runcam\.com|en\.caddxfpv\.com\.cn|caddxfpv\.com)\//,
    );
    assert.equal(entry.catalog!.geometryEvidence!.kind, 'source-dimensions');
    assert.match(entry.catalog!.geometryEvidence!.limitations, /Not manufacturer CAD/);
    assert.match(
      entry.catalog!.geometryEvidence!.limitations,
      /reconstructed|approximate|illustrative/,
    );
    assert.deepEqual(camera.validate(entry.parameters, 'assembled'), []);
    assert.ok(camera.validate({ ...entry.parameters, width: 25 }, 'assembled').length);
    const matches = filterPresets(buildPresetIndex([camera]), {
      ...emptyPresetFilters(camera),
      query: entry.name,
    }).items;
    assert.ok(
      matches.some((match) => match.preset.id === id),
      id + ': article search',
    );
  }
  for (const id of ['phoenix2-spv5', 'ratel2', 'baby-ratel2']) assert.ok(preset(id));
});

test('FPV manufacturer envelopes retain nano, micro and long-lens executions', () => {
  const expected = {
    'racer-nano4': [14, 14, 20],
    robin3: [19, 19, 19],
    ant: [14, 14, 15],
    'ratel-pro': [19, 19, 28.5],
    'avatar-nano-v3': [14, 14, 16.8],
  };
  for (const id of added) {
    assert.deepEqual(camera.dimensions({ model: id }, 'assembled'), expected[id]);
    const attributes = preset(id).catalog!.attributes!;
    assert.deepEqual([attributes.width, attributes.height, attributes.depth], expected[id]);
  }
  const filters = emptyPresetFilters(camera);
  filters.parameters[fieldId(camera.catalogFilterFields!.find((field) => field.key === 'width')!)] =
    {
      min: '14',
      max: '14',
    };
  const nano = filterPresets(buildPresetIndex([camera]), filters).items.map(
    (entry) => entry.preset.id,
  );
  for (const id of ['racer-nano4', 'ant', 'avatar-nano-v3']) assert.ok(nano.includes(id));
  assert.ok(!nano.includes('robin3'));
  assert.ok(!nano.includes('ratel-pro'));
});

test('Racer Nano 4 side pivots use the drawing datum fourteen millimetres behind the lens tip', () => {
  const model = models.find((entry) => entry.id === 'racer-nano4')!;
  assert.equal(model.geometry.sideMountZ, -14);
  assert.equal(model.geometry.sideHole, 2);
  const group = camera.buildGeometry({ model: model.id }, 'assembled');
  group.updateMatrixWorld(true);
  try {
    const housing = group.children.find((child) => child.name === 'Camera housing')!;
    for (const side of [-1, 1]) {
      const through = new Raycaster(
        new Vector3(side * 9, 0, -14),
        new Vector3(-side, 0, 0),
      ).intersectObject(housing, true);
      assert.equal(through.length, 0, 'nominal M2 bore is open through each side wall');
      const beside = new Raycaster(
        new Vector3(side * 9, 2, -14),
        new Vector3(-side, 0, 0),
      ).intersectObject(housing, true);
      assert.ok(beside.length > 0, 'side wall remains beside the mounting bore');
    }
  } finally {
    disposeModel(group);
  }
});

test('Ant retains an exposed camera PCB and the Ratel Pro rear socket retains its extra axial extent', () => {
  for (const id of ['ant', 'ratel-pro']) {
    const group = camera.buildGeometry({ model: id }, 'assembled');
    try {
      const connector = group.children.find((child) => child.name === 'Camera connector envelope')!;
      assert.ok(connector, id);
      const rear = new Box3().setFromObject(connector, true);
      assert.ok(Math.abs(rear.min.z + (id === 'ant' ? 15 : 28.5)) < 0.001);
      if (id === 'ant') {
        assert.ok(group.children.some((child) => child.name === 'Camera PCB'));
        assert.ok(group.children.some((child) => child.name === 'Lens holder envelope'));
        assert.ok(!group.children.some((child) => child.name === 'Camera housing'));
        assert.ok(!group.children.some((child) => child.name === 'Rear cover'));
      } else {
        const cover = group.children.find((child) => child.name === 'Rear cover')!;
        assert.ok(Math.abs(new Box3().setFromObject(cover, true).min.z + 26.8) < 0.001);
      }
    } finally {
      disposeModel(group);
    }
  }
});

test('analog TVL and digital Avatar system requirements remain separate', () => {
  for (const id of ['racer-nano4', 'robin3', 'ant', 'ratel-pro']) {
    const attributes = preset(id).catalog!.attributes!;
    assert.ok(Number(attributes.tvl) >= 1200);
    assert.equal(attributes.interface, 'cvbs');
    assert.equal(attributes.pixelsX, undefined);
    assert.equal(attributes.pixelsY, undefined);
    assert.equal(attributes.fps, undefined);
  }
  const avatar = preset('avatar-nano-v3').catalog!;
  assert.equal(avatar.attributes!.interface, 'walksnail-avatar');
  assert.equal(avatar.attributes!.weight, 3);
  assert.equal(avatar.attributes!.pixelsX, 1920);
  assert.equal(avatar.attributes!.pixelsY, 1080);
  assert.equal(avatar.attributes!.fps, 120);
  for (const field of ['tvl', 'voltageMin', 'voltageMax', 'current', 'power', 'dfov'])
    assert.equal(
      avatar.attributes![field],
      undefined,
      field + ': no kit rating or unspecified FoV axis',
    );
  assert.match(avatar.attributeConditions!.fps, /1280 × 720/);
  assert.match(avatar.attributeConditions!.fps, /1920 × 1080 up to 60 fps/);
  const filters = emptyPresetFilters(camera);
  filters.parameters[
    fieldId(camera.catalogFilterFields!.find((field) => field.key === 'interface')!)
  ] = {
    value: 'walksnail-avatar',
  };
  assert.deepEqual(
    filterPresets(buildPresetIndex([camera]), filters).items.map((entry) => entry.preset.id),
    ['avatar-nano-v3'],
  );
});

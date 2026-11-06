import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, MeshStandardMaterial, Object3D, Raycaster, Vector3 } from 'three';
import part from '../src/parts/panel-switch/part';
import { daierColours, models } from '../src/parts/panel-switch/lib/catalog';
import { disposeModel } from '../src/core/mechanical';
import { presetMatchesConfiguration } from '../src/core/catalog-models';
import { groupBrowseFamilies } from '../src/core/browse-families';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';
import {
  buildPresetIndex,
  emptyPresetFilters,
  fieldId,
  filterPresets,
} from '../src/core/preset-search';

const variants = [
  { id: 'berm-bem-la16-11d-y', head: 'round', behavior: 'Momentary one end' },
  { id: 'berm-bem-la16-11ds-y', head: 'round', behavior: 'Latching' },
  { id: 'berm-bem-la16-11ds-f', head: 'square', behavior: 'Unverified' },
  { id: 'berm-bem-la16-11ds-j', head: 'rectangular', behavior: 'Latching' },
] as const;
const ids = variants.map(({ id }) => id);
const index = buildPresetIndex([part]);
const preset = (id: string) => {
  const entry = part.presets.find((entry) => entry.id === id);
  assert.ok(entry, `${id}: fixed catalog entry`);
  return entry;
};
const bounds = (object: Object3D) => new Box3().setFromObject(object, true);
function close(actual: number, expected: number, message: string) {
  assert.ok(Math.abs(actual - expected) < 0.001, `${message}: ${actual} ≈ ${expected}`);
}
function child(object: Object3D, name: RegExp) {
  const matches = object.children.filter((item) => name.test(item.name));
  assert.equal(matches.length, 1, `${name}: unique component`);
  return matches[0];
}

test('BERM variants retain separate identities and disclose provisional dimensions and unknown ratings', () => {
  assert.equal(part.defaults.model, 'ck-7101syzqe');
  for (const { id, head, behavior } of variants) {
    const entry = preset(id),
      model = models.find((model) => model.id === id)!;
    assert.equal(part.presets.filter((candidate) => candidate.id === id).length, 1);
    assert.equal(entry.parameters.model, id);
    assert.equal(entry.name, model.name);
    assert.equal(model.manufacturer, 'BERM');
    assert.equal(model.form, 'pushbutton');
    assert.equal(model.bermHead, head);
    assert.equal(model.behavior, behavior);
    assert.deepEqual(part.validate(entry.parameters, 'assembled'), []);
    assert.deepEqual(entry.catalog!.verifiedParameters, ['model']);
    assert.equal(entry.catalog!.manufacturer, 'BERM');
    assert.equal(entry.catalog!.attributes!.headShape, head);
    assert.equal(entry.catalog!.geometryEvidence!.kind, 'envelope');
    assert.equal(entry.catalog!.geometryEvidence!.sourceUrl, entry.catalog!.sourceUrl);
    assert.match(entry.catalog!.sourceUrl, /^https:\/\//);
    assert.match(entry.catalog!.geometryEvidence!.summary, /not source-verified/i);
    assert.match(entry.catalog!.geometryEvidence!.limitations, /Not original manufacturer CAD/);
    assert.match(entry.catalog!.geometryEvidence!.limitations, /dimensions are assumptions/);
    assert.match(
      entry.catalog!.geometryEvidence!.limitations,
      /voltage, current or ingress rating/,
    );
    for (const key of [
      'mountDiameter',
      'mountFlatWidth',
      'cutoutLength',
      'cutoutWidth',
      'width',
      'height',
      'depth',
      'bodyWidth',
      'bodyDepth',
      'voltage',
      'voltageMin',
      'voltageMax',
      'current',
      'power',
      'ipRating',
    ]) {
      assert.equal(entry.catalog!.attributes![key], undefined, `${id}: ${key} is unverified`);
      assert.equal(entry.catalog!.parameterRanges?.[key], undefined, `${id}: no assumed range`);
    }
    assert.ok(part.validate({ ...entry.parameters, diameter: 16 }, 'assembled').length);
    if (behavior === 'Unverified') {
      assert.equal(entry.catalog!.attributes!.behavior, undefined);
      assert.equal(model.illuminated, false);
      assert.match(entry.description, /Action and lamp execution are unverified/);
      assert.match(entry.catalog!.geometryEvidence!.summary, /Lamp execution is unverified/);
    } else assert.equal(entry.catalog!.attributes!.behavior, behavior);
    if (id !== 'berm-bem-la16-11d-y')
      assert.equal(entry.catalog!.attributes!.terminalCount, undefined);
  }
});

test('BERM family and individual buttons are searchable with manufacturer and head filters', () => {
  const library = buildLibrarySearchIndex(groupBrowseFamilies([part]));
  for (const query of ['BERM', 'BEM-LA16', '\u043a\u043d\u043e\u043f\u043a\u0438 BERM BEM-LA16']) {
    assert.deepEqual(
      filterPresets(index, { ...emptyPresetFilters(part), query }).items.map(
        (entry) => entry.preset.id,
      ),
      ids,
      query,
    );
    assert.deepEqual(
      searchLibrary(library, query).map((match) => match.family.id),
      [part.id],
    );
  }
  for (const id of ids)
    assert.deepEqual(
      filterPresets(index, {
        ...emptyPresetFilters(part),
        query: preset(id).catalog!.designation!,
      }).items.map((entry) => entry.preset.id),
      [id],
    );

  const manufacturer = { ...emptyPresetFilters(part), manufacturer: 'BERM' },
    head = part.catalogFilterFields!.find((field) => field.key === 'headShape')!,
    action = part.catalogFilterFields!.find((field) => field.key === 'behavior')!,
    opening = part.catalogFilterFields!.find((field) => field.key === 'mountDiameter')!;
  assert.deepEqual(
    filterPresets(index, manufacturer).items.map((entry) => entry.preset.id),
    ids,
  );
  for (const shape of ['round', 'square', 'rectangular'])
    assert.deepEqual(
      filterPresets(index, {
        ...manufacturer,
        parameters: { [fieldId(head)]: { value: shape } },
      }).items.map((entry) => entry.preset.id),
      variants.filter(({ head }) => head === shape).map(({ id }) => id),
    );
  assert.deepEqual(
    filterPresets(index, {
      ...manufacturer,
      parameters: { [fieldId(action)]: { value: 'Latching' } },
    }).items.map((entry) => entry.preset.id),
    ['berm-bem-la16-11ds-y', 'berm-bem-la16-11ds-j'],
  );
  assert.equal(
    filterPresets(index, {
      ...manufacturer,
      parameters: { [fieldId(opening)]: { min: '16', max: '16' } },
    }).items.length,
    0,
    'The nominal product class cannot become a verified panel-cutout filter',
  );
});

test('BERM preview poses retain head shapes, fixed hardware and matching native export dimensions', () => {
  for (const { id, head } of variants) {
    const entry = preset(id);
    for (const state of ['assembled', 'exploded']) {
      const params = { ...entry.parameters },
        group = part.buildGeometry(params, state);
      try {
        const size = bounds(group).getSize(new Vector3()).toArray(),
          reported = part.dimensions(params, state),
          script = part.python(params, state),
          labelLine = script.split('\n').find((line) => line.startsWith('component_labels = '));
        size.forEach((value, axis) => {
          assert.ok(Number.isFinite(value) && value > 0, `${id}/${state}: finite envelope`);
          close(reported[axis], value, `${id}/${state}: reported dimension ${axis}`);
        });
        group.traverse((item) => {
          if (!(item instanceof Mesh)) return;
          const box = bounds(item),
            meshSize = box.getSize(new Vector3());
          assert.ok([...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite));
          assert.ok(
            meshSize.toArray().every((value) => value > 0),
            `${item.name}: solid extent`,
          );
        });
        assert.ok(labelLine, 'Native export carries the visible component labels');
        assert.deepEqual(
          JSON.parse(labelLine.slice('component_labels = '.length)),
          group.children.map((item) => item.name),
        );
        assert.match(script, /shape = Part.makeCompound\(components\)/);
        assert.match(script, /component_colors = /);
        assert.doesNotMatch(script, /\b(?:NaN|Infinity|undefined)\b/);

        if (state !== 'assembled') continue;
        const overall = bounds(group),
          body = child(group, /insulating body/),
          bezel = child(group, /mounting barrel and bezel/),
          cap = child(group, /coloured illuminated cap/),
          headBounds = bounds(bezel).getSize(new Vector3()),
          pressedParams = { ...params, position: 'last' },
          pressed = part.buildGeometry(pressedParams, state);
        try {
          close(overall.max.z, 7, `${id}: assumed front projection`);
          close(overall.min.z, -35, `${id}: assumed body and terminal depth`);
          close(headBounds.x, head === 'rectangular' ? 24 : 18, `${id}: head width`);
          close(headBounds.y, 18, `${id}: head depth`);
          const bodyCentre = bounds(body).getCenter(new Vector3()),
            barrelCentre = bounds(bezel).getCenter(new Vector3());
          close(bodyCentre.x, barrelCentre.x, `${id}: body follows the mounting axis`);
          close(bodyCentre.y, barrelCentre.y, `${id}: body follows the mounting axis`);
          for (const [x, y, inside] of [
            [6, 0, true],
            [6, 6, false],
          ] as const) {
            const ray = new Raycaster(new Vector3(x, y, 0), new Vector3(0, 0, -1));
            assert.equal(
              ray.intersectObject(body, true).length > 0,
              inside,
              `${id}: lower housing has a circular section without rectangular corners`,
            );
          }
          const corner = new Raycaster(new Vector3(7, 7, 8), new Vector3(0, 0, -1));
          assert.equal(
            corner.intersectObject(cap, true).length > 0,
            head !== 'round',
            `${id}: round caps omit the square corner`,
          );
          assert.deepEqual(part.validate(pressedParams, state), []);
          assert.equal(presetMatchesConfiguration(part, entry, pressedParams), true);
          assert.deepEqual(
            pressed.children.map((item) => item.name),
            group.children.map((item) => item.name),
          );
          for (const component of group.children) {
            const moved = pressed.children.find((item) => item.name === component.name)!;
            if (component === cap) {
              const expected = bounds(component).translate(new Vector3(0, 0, -1.5)),
                actual = bounds(moved);
              expected.min
                .toArray()
                .forEach((value, axis) =>
                  close(actual.min.toArray()[axis], value, `${id}: cap lower bound ${axis}`),
                );
              expected.max
                .toArray()
                .forEach((value, axis) =>
                  close(actual.max.toArray()[axis], value, `${id}: cap upper bound ${axis}`),
                );
            } else
              assert.ok(bounds(moved).equals(bounds(component)), `${component.name}: fixed pose`);
          }
        } finally {
          disposeModel(pressed);
        }
      } finally {
        disposeModel(group);
      }
    }
  }
});

test('BERM cap appearance changes colour without resizing or changing the selected article', () => {
  const entry = preset('berm-bem-la16-11ds-j'),
    colourField = part.parameters.find((field) => field.key === 'colour')!,
    colors = new Set<number>();
  let baseline: Map<string, Box3> | undefined;
  for (const id of ids) assert.equal(colourField.visibleWhen!(preset(id).parameters), true);
  for (const colour of daierColours) {
    const params = { ...entry.parameters, colour: colour.value },
      group = part.buildGeometry(params, 'assembled');
    try {
      assert.deepEqual(part.validate(params, 'assembled'), []);
      assert.equal(presetMatchesConfiguration(part, entry, params), true);
      const cap = child(group, /coloured illuminated cap/);
      cap.traverse((item) => {
        if (!(item instanceof Mesh)) return;
        const material = item.material as MeshStandardMaterial;
        assert.equal(material.color.getHex(), colour.color);
        colors.add(material.color.getHex());
      });
      const current = new Map(group.children.map((item) => [item.name, bounds(item)]));
      if (!baseline) baseline = current;
      else {
        assert.deepEqual([...current.keys()], [...baseline.keys()]);
        for (const [name, box] of current)
          assert.ok(box.equals(baseline.get(name)!), `${colour.value}/${name}: unchanged bounds`);
      }
    } finally {
      disposeModel(group);
    }
  }
  assert.equal(colors.size, 4);
});

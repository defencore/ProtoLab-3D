import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, DoubleSide, Group, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import part from '../src/parts/panel-switch/part';
import { daierColours, models } from '../src/parts/panel-switch/lib/catalog';
import { geometry, pieces, sac01 } from '../src/parts/panel-switch/lib/model';
import type { Parameters } from '../src/core/types';
import { presetMatchesConfiguration } from '../src/core/catalog-models';

function dispose(group: Group) {
  group.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry.dispose();
      (o.material as MeshStandardMaterial).dispose();
    }
  });
}
function contains(group: Group, point: [number, number, number]): boolean {
  group.updateMatrixWorld(true);
  const ray = new Raycaster(new Vector3(...point), new Vector3(0.913, 0.327, 0.244).normalize());
  let result = false;
  group.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    (o.material as MeshStandardMaterial).side = DoubleSide;
    const distances = ray.intersectObject(o, false).map((hit) => hit.distance);
    const unique = distances.filter((d, i) => i === 0 || Math.abs(d - distances[i - 1]) > 1e-5);
    result ||= unique.length % 2 === 1;
  });
  return result;
}
function volume(group: Group) {
  group.updateMatrixWorld(true);
  let v = 0;
  group.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const g = o.geometry,
      pos = g.getAttribute('position'),
      count = g.index?.count ?? pos.count;
    for (let i = 0; i < count; i += 3) {
      const points = [0, 1, 2].map((j) => {
        const id = g.index ? g.index.getX(i + j) : i + j;
        return new Vector3(pos.getX(id), pos.getY(id), pos.getZ(id)).applyMatrix4(o.matrixWorld);
      });
      v += points[0].dot(points[1].clone().cross(points[2])) / 6;
    }
  });
  return v;
}
const p = (model: string, extra: Parameters = {}): Parameters => ({
  ...part.defaults,
  model,
  ...extra,
});

test('24 fixed switch configurations cover separate functions and retain source scope', () => {
  assert.equal(models.length, 24);
  assert.equal(part.presets!.length, models.length);
  assert.equal(part.catalogSelectionOnly, true);
  assert.equal(part.name, 'Toggle switches & buttons');
  assert.equal(part.category, 'SWITCHES & BUTTONS');
  assert.equal(part.subgroup, 'PANEL CONTROLS');
  assert.equal(new Set(models.map((m) => m.id)).size, models.length);
  for (const model of models) {
    const preset = part.presets!.find((v) => v.id === model.id)!;
    assert.equal(preset.name, model.name);
    assert.deepEqual(part.validate(preset.parameters, 'assembled'), []);
    assert.deepEqual(Object.keys(preset.parameters), [
      'model',
      'position',
      'guard',
      'colour',
      'panelThickness',
    ]);
    assert.equal(preset.parameters.panelThickness, 0.3);
    assert.deepEqual(preset.catalog!.verifiedParameters, ['model']);
    assert.equal(
      preset.catalog!.geometryEvidence!.kind,
      model.manufacturer === 'APEM' ? 'envelope' : 'source-dimensions',
    );
    assert.match(preset.catalog!.geometryEvidence!.limitations, /Not original manufacturer CAD/);
    assert.equal(preset.catalog!.attributes!.terminalCount, model.terminalCount);
    assert.ok(!('current' in preset.catalog!.attributes!), 'Unknown ratings are not invented');
  }
  for (const key of [
    'actuation',
    'behavior',
    'circuit',
    'mounting',
    'mountDiameter',
    'cutoutLength',
    'guarded',
  ])
    assert.ok(part.catalogFilterFields!.some((field) => field.key === key));
  assert.ok(part.validate(p('made-up-toggle'), 'assembled').length);
  for (const extra of [
    { diameter: 22 },
    { length: 50 },
    { terminals: 8 },
    { scale: 2 },
  ] as Parameters[])
    assert.ok(part.validate({ ...part.defaults, ...extra }, 'assembled').length);
});

test('bare ASW-07D installation leaves the selected panel thickness between its retaining nuts', () => {
  const field = part.parameters.find((field) => field.key === 'panelThickness')!;
  assert.equal(field.type, 'number');
  assert.equal(field.min, 0.3);
  assert.equal(field.max, 4);
  assert.equal(field.filterable, false);
  for (const model of models)
    assert.equal(field.visibleWhen!(p(model.id)), model.id === 'daier-asw-07d');
  const preset = part.presets.find((preset) => preset.id === 'daier-asw-07d')!;
  const baseline = part.buildGeometry(p(preset.id), 'assembled');
  for (const panelThickness of [0.3, 1, 3, 4]) {
    const params = p(preset.id, { panelThickness });
    assert.deepEqual(part.validate(params, 'assembled'), []);
    assert.equal(
      presetMatchesConfiguration(part, preset, params),
      true,
      'Installation retains the manufacturer model identity',
    );
    const group = part.buildGeometry(params, 'assembled'),
      lower = group.children.find((child) => child.name === 'Panel retaining nut')!,
      upper = group.children.find((child) => child.name === 'Panel locking nut')!,
      lowerBounds = new Box3().setFromObject(lower),
      upperBounds = new Box3().setFromObject(upper);
    assert.ok(Math.abs(lowerBounds.min.z - 0.6) < 0.001);
    assert.ok(Math.abs(lowerBounds.max.z - 3) < 0.001);
    assert.ok(Math.abs(upperBounds.min.z - 3 - panelThickness) < 0.001);
    assert.ok(Math.abs(upperBounds.max.z - 5.4 - panelThickness) < 0.001);
    assert.ok(upperBounds.max.z < 12.5, 'Upper nut remains within the fixed bushing projection');
    assert.equal(
      contains(group, [7, 0, 3 + panelThickness / 2]),
      false,
      'Panel material outside the mounting bore clears the nut stack',
    );
    assert.equal(
      contains(group, [-5.5, 0, 3 + panelThickness / 2]),
      false,
      'Panel orientation tongue clears the fixed bushing groove',
    );
    for (const child of group.children.filter((child) => child.name !== 'Panel locking nut')) {
      const original = baseline.children.find((item) => item.name === child.name)!;
      assert.ok(
        new Box3().setFromObject(child).equals(new Box3().setFromObject(original)),
        `${child.name}: fixed source geometry and placement`,
      );
    }
    dispose(group);
  }
  for (const panelThickness of [0.2, 4.1, NaN, Infinity, '3', true])
    assert.ok(part.validate(p(preset.id, { panelThickness }), 'assembled').length);
  for (const model of ['ck-7101syzqe', 'daier-asw-07d-sac-01'])
    assert.equal(
      part.python(p(model), 'assembled'),
      part.python(p(model, { panelThickness: 4 }), 'assembled'),
      'Hidden installation control does not change other models',
    );
  dispose(baseline);
});

test('ASW-07D follows its linked drawing execution and retains three distinct blade interfaces', () => {
  const params = p('daier-asw-07d'),
    group = part.buildGeometry(params, 'assembled'),
    frame = group.children.find((child) => child.name === 'Metal case frame')!,
    bushing = group.children.find((child) => child.name.startsWith('M12'))!;
  assert.deepEqual(
    new Box3()
      .setFromObject(frame)
      .getSize(new Vector3())
      .toArray()
      .map((v) => Math.round(v * 1000) / 1000),
    [28, 16, 19],
    'The exact PDF body is distinct from ASW-07D-2 / the inconsistent web-page envelope',
  );
  const insulatingCase = group.children.find((child) => child.name === 'Insulating case')! as Group;
  assert.equal(
    contains(insulatingCase, [12, 7.8, -10]),
    true,
    'Black insulating end remains visible',
  );
  assert.equal(
    contains(frame as Group, [12, 7.8, -10]),
    false,
    'Metal plate leaves the end block exposed',
  );
  assert.equal(
    contains(insulatingCase, [13.9, 0, -10]),
    true,
    'End face remains insulating plastic',
  );
  assert.equal(contains(frame as Group, [13.9, 0, -10]), false);
  assert.equal(contains(frame as Group, [0, 7.8, -10]), true, 'Central side plate is metal');
  assert.equal(contains(insulatingCase, [0, 7.8, -10]), false);
  assert.equal(contains(frame as Group, [0, 0, -0.4]), true, 'Top cap joins both side plates');
  assert.equal(new Box3().setFromObject(bushing).max.z, 12.5);
  const lens = group.children.find((child) => child.name === 'Coloured LED actuator lens')!;
  assert.ok(
    Math.abs(new Box3().setFromObject(lens).max.z - 12.5 - 19.9) < 0.001,
    '19.9 mm is the tilted actuator projection above the bushing',
  );
  assert.equal(contains(bushing as Group, [5.8, 0, 8]), true);
  assert.equal(
    contains(bushing as Group, [-5.5, 0, 8]),
    false,
    'Orientation groove clears the key tongue',
  );
  assert.equal(contains(bushing as Group, [-5.5, 1.2, 8]), true);
  const blades = group.children.filter((child) => child.name.startsWith('6.3 mm quick-connect'));
  assert.equal(blades.length, 3, 'Two lower switch blades and one horizontal lamp-ground blade');
  const lower = blades.filter((child) => !child.name.includes('horizontal'));
  const centres = lower.map((child) => new Box3().setFromObject(child).getCenter(new Vector3()));
  assert.ok(Math.abs(centres[1].x - centres[0].x - 24.2) < 0.001);
  for (const blade of lower) {
    const size = new Box3().setFromObject(blade).getSize(new Vector3());
    assert.ok(Math.abs(size.y - 6.3) < 0.001);
    assert.ok(Math.abs(size.z - 10.3) < 0.001);
    assert.ok(Math.abs(size.x - 0.8) < 0.001);
  }
  assert.ok(Math.abs(new Box3().setFromObject(group).min.z + 29.3) < 0.001);
  assert.equal(models.find((m) => m.id === params.model)!.mountDiameter, 12.2);
  assert.ok(part.validate({ ...params, colour: 'purple' }, 'assembled').length);
  dispose(group);
});

test('SAC-01 keeps its dimensioned mounting envelope and a hollow rigid moving cover', () => {
  const params = p('daier-asw-07d-sac-01'),
    closed = geometry(params, 'assembled'),
    open = geometry({ ...params, guard: 'open' }, 'assembled'),
    cap = closed.children.find((child) => child.name.includes('transparent coloured'))! as Group,
    raised = open.children.find((child) => child.name.includes('transparent coloured'))! as Group,
    base = closed.children.find((child) => child.name.includes('keyed steel'))! as Group;
  const baseBounds = new Box3().setFromObject(base),
    capBounds = new Box3().setFromObject(cap),
    raisedBounds = new Box3().setFromObject(raised);
  assert.ok(Math.abs(baseBounds.max.x - baseBounds.min.x - 40.6) < 0.001);
  assert.ok(Math.abs(baseBounds.max.y - baseBounds.min.y - 17) < 0.001);
  assert.equal(contains(base, [24, 7.9, sac01.seat + 0.45]), false, 'Rear base is 15 mm wide');
  assert.equal(contains(base, [24, 7.3, sac01.seat + 0.45]), true);
  assert.equal(contains(base, [-5.5, 0, sac01.seat + 0.45]), true, 'Published mounting key tongue');
  assert.equal(contains(base, [-5, 0, sac01.seat + 0.45]), false, 'Clear bore beyond key tongue');
  const hinge = closed.children.find((child) => child.name.includes('steel hinge pin'))!,
    hingeCentre = new Box3().setFromObject(hinge).getCenter(new Vector3());
  assert.ok(Math.abs(baseBounds.max.x - hingeCentre.x - 11.8) < 0.001);
  assert.ok(Math.abs(capBounds.max.z - sac01.seat - 27.8) < 0.001);
  assert.ok(Math.abs(baseBounds.max.x - capBounds.min.x - 46.6) < 0.001);
  assert.ok(Math.abs(raisedBounds.max.z - sac01.seat - 45) < 0.05);
  assert.equal(contains(cap, [-4, 0, 32]), false, 'Hollow actuator clearance');
  assert.equal(contains(cap, [-4, 0, 34]), true, 'Continuous roof above the actuator');
  assert.equal(contains(raised, [-4, 0, 34]), false, 'Cover lifts clear of its closed envelope');
  assert.ok(Math.abs(volume(cap) - volume(raised)) < volume(cap) * 5e-5);
  for (const colour of daierColours) {
    const coloured = geometry({ ...params, colour: colour.value }, 'assembled');
    coloured.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      if (child.name.includes('transparent coloured')) {
        const material = child.material as MeshStandardMaterial;
        assert.equal(material.transparent, true);
        assert.equal(material.opacity, 0.55);
        assert.equal(material.metalness, 0.05);
        assert.equal(material.color.getHex(), colour.color);
      }
    });
    assert.match(part.python({ ...params, colour: colour.value }, 'assembled'), /component_colors/);
    dispose(coloured);
  }
  for (const position of ['first', 'last'])
    assert.deepEqual(part.validate({ ...params, position, guard: 'open' }, 'assembled'), []);
  assert.ok(part.validate({ ...params, position: 'last' }, 'assembled').length);
  dispose(closed);
  dispose(open);
});

test('DAIER actuator, guard and mounting key follow the long case axis in the manufacturer views', () => {
  for (const model of ['daier-asw-07d', 'daier-asw-07d-sac-01']) {
    const first = geometry(p(model), 'assembled'),
      last = geometry(p(model, { position: 'last', guard: 'open' }), 'assembled');
    const firstLens = first.children.find((child) => child.name.includes('LED actuator lens'))!,
      lastLens = last.children.find((child) => child.name.includes('LED actuator lens'))!,
      released = new Box3().setFromObject(firstLens).getCenter(new Vector3()),
      switched = new Box3().setFromObject(lastLens).getCenter(new Vector3());
    assert.ok(released.x < -1 && switched.x > 1, 'Actuator travels along the 28 mm X dimension');
    assert.ok(Math.abs(released.y) < 0.001 && Math.abs(switched.y) < 0.001);
    if (model.endsWith('sac-01')) {
      const cap = first.children.find((child) => child.name.includes('transparent coloured'))!,
        base = first.children.find((child) => child.name.includes('keyed steel'))! as Group,
        bushing = first.children.find((child) => child.name.startsWith('M12'))! as Group,
        hinge = first.children.find((child) => child.name.includes('steel hinge pin'))!,
        capSize = new Box3().setFromObject(cap).getSize(new Vector3()),
        hingeBounds = new Box3().setFromObject(hinge),
        hingeCentre = hingeBounds.getCenter(new Vector3()),
        hingeSize = hingeBounds.getSize(new Vector3());
      assert.ok(capSize.x > capSize.y * 2, 'Long guard direction follows the long case direction');
      assert.ok(
        hingeSize.y > hingeSize.x * 4 && hingeSize.y > hingeSize.z * 4,
        'Hinge pin is perpendicular to actuator travel',
      );
      assert.ok(
        hingeCentre.x > 0 && released.x < 0,
        'OFF points toward the free front, away from the hinge',
      );
      const keyPoint: [number, number, number] = [-5.5, 0, sac01.seat + 0.45];
      assert.equal(contains(base, keyPoint), true, 'Base tongue faces the free front');
      assert.equal(contains(bushing, keyPoint), false, 'Bushing groove clears the base tongue');
      assert.equal(contains(base, [0, 5.5, keyPoint[2]]), false, 'No sideways mounting tongue');
      assert.equal(contains(base, [5.5, 0, keyPoint[2]]), false, 'No hinge-facing mounting tongue');
      assert.equal(
        contains(bushing, [5.5, 0, keyPoint[2]]),
        true,
        'Groove stays on the free-front end',
      );
    }
    dispose(first);
    dispose(last);
  }
});

test('all assembled and separated components have positive volume and reported preview bounds', () => {
  for (const m of models)
    for (const state of ['assembled', 'exploded']) {
      const params = p(m.id),
        group = part.buildGeometry(params, state);
      assert.equal(group.children.length, pieces(params, state).length);
      for (const child of group.children)
        assert.ok(volume(child as Group) > 0.001, `${m.id}/${state}/${child.name}`);
      const size = new Box3().setFromObject(group, true).getSize(new Vector3()).toArray();
      const reported = part.dimensions(params, state);
      reported.forEach((v, i) =>
        assert.ok(
          Number.isFinite(v) && Math.abs(v - size[i]) < 0.001,
          `${m.id}/${state} axis ${i}`,
        ),
      );
      assert.match(part.python(params, state), /Part.makeCompound/);
      assert.match(part.python(params, state), /component_labels/);
      dispose(group);
    }
});

test('published bushing and snap-in interfaces remain smaller than their fitting openings', () => {
  for (const id of ['ck-7101syzqe', 'ck-7201syzqe', 'apem-12146ak']) {
    const group = part.buildGeometry(p(id), 'assembled');
    const r = id.startsWith('apem') ? 5.8 : 3.05;
    assert.equal(contains(group, [r, 0, 1]), true, `${id}: bushing wall`);
    assert.equal(contains(group, [r + 0.5, 0, 1]), false, `${id}: outside bushing`);
    dispose(group);
  }
  const group = part.buildGeometry(p('eswitch-r1966ablkblkff'), 'assembled');
  assert.equal(contains(group, [9, 0, -1]), true, 'Body within 19.2 mm panel opening');
  assert.equal(contains(group, [9.7, 0, -1]), false, 'No rigid body across panel opening boundary');
  assert.equal(contains(group, [10, 0, 1]), true, 'Bezel overlaps panel opening');
  dispose(group);
});

test('PCB buttons preserve real pin centre patterns and actuator heights', () => {
  for (const m of models.filter((m) => m.form === 'tactile')) {
    const group = part.buildGeometry(p(m.id), 'assembled'),
      [px, py] = m.pitch!;
    for (const x of [-px / 2, px / 2])
      for (const y of [-py / 2, py / 2])
        assert.equal(contains(group, [x, y, -2]), true, `${m.id}: solder lead ${x},${y}`);
    assert.equal(contains(group, [0, 0, -2]), false, 'No invented centre pin');
    assert.ok(Math.abs(new Box3().setFromObject(group).max.z - m.height!) < 1e-5);
    const pressed = part.buildGeometry(p(m.id, { position: 'last' }), 'assembled');
    assert.ok(Math.abs(new Box3().setFromObject(pressed).max.z - (m.height! - 0.2)) < 1e-5);
    dispose(group);
    dispose(pressed);
  }
});

test('rotary D-flat and pushbutton front/rear packaging match the selected drawing', () => {
  for (const m of models.filter((m) => m.form === 'rotary')) {
    const group = part.buildGeometry(p(m.id), 'assembled');
    assert.equal(
      contains(group, [0, 2.2, m.bushingHeight! + 2]),
      true,
      'Material before the 5.51 mm shaft flat',
    );
    assert.equal(
      contains(group, [0, 2.5, m.bushingHeight! + 2]),
      false,
      'Flat removes the circular shaft segment',
    );
    dispose(group);
  }
  for (const [id, rear, front] of [
    ['eswitch-pva6fe24s41', 17.8, 1.5],
    ['eswitch-pva6lre21231', 24.1, 2.2],
  ] as [string, number, number][]) {
    const group = part.buildGeometry(p(id), 'assembled'),
      bounds = new Box3().setFromObject(group);
    assert.ok(Math.abs(bounds.min.z + rear) < 0.001, `${id}: rear including solder lugs`);
    assert.ok(
      Math.abs(bounds.max.z - front) < 0.001,
      `${id}: projection in front of mounting shoulder`,
    );
    assert.equal(
      contains(group, [0, 7.6, -2]),
      true,
      `${id}: material before the orientation flat`,
    );
    assert.equal(
      contains(group, [0, 7.72, -2]),
      false,
      `${id}: body clears the panel opening flat`,
    );
    assert.equal(
      contains(group, [8.02, 0, -2]),
      false,
      `${id}: body stays inside the nominal circular opening`,
    );
    dispose(group);
  }
});

test('guard is hollow, rotates rigidly about its hinge and locks a compatible toggle', () => {
  const m = models.find((m) => m.guarded)!;
  assert.equal(m.mountDiameter, 12);
  assert.ok(m.bushing! > 11.8);
  const closedP = p(m.id),
    openP = p(m.id, { guard: 'open' });
  const closed = part.buildGeometry(closedP, 'assembled'),
    open = part.buildGeometry(openP, 'assembled');
  assert.equal(contains(closed, [0, 5, 20]), false, 'Hollow space around the actuator');
  assert.equal(contains(closed, [0, 0, 31.7]), true, 'Closed roof');
  assert.equal(contains(open, [0, 0, 31.7]), false, 'Roof lifts away');
  const closedCap = closed.children.at(-1)! as Group,
    openCap = open.children.at(-1)! as Group;
  assert.ok(
    Math.abs(volume(closedCap) - volume(openCap)) < volume(closedCap) * 5e-5,
    'Opening preserves cap material within preview welding tolerance',
  );
  const closedPin = closed.children.at(-2)!,
    openPin = open.children.at(-2)!;
  assert.ok(
    new Box3().setFromObject(closedPin).equals(new Box3().setFromObject(openPin)),
    'Hinge remains fixed',
  );
  assert.ok(
    part
      .validate(p(m.id, { position: 'last', guard: 'closed' }), 'assembled')
      .some((e) => e.includes('closed')),
  );
  assert.equal(part.updateParameters!(p(m.id, { position: 'last' }), 'position').guard, 'open');
  assert.equal(part.updateParameters!(p(m.id, { position: 'last' }), 'guard').position, 'first');
  for (const m of models.filter((m) => m.positions === 2))
    assert.ok(part.validate(p(m.id, { position: 'center' }), 'assembled').length);
  dispose(closed);
  dispose(open);
});

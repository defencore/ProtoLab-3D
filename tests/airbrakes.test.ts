import test from 'node:test';
import assert from 'node:assert/strict';
import {
  jaynesHinged,
  camLift,
  linkage,
  phases,
  layer,
  mechanismOptions,
} from '../src/parts/rocket-airbrakes/lib/kinematics';
import { Box3, Vector3 } from 'three';
import part from '../src/parts/rocket-airbrakes/part';
import { layout, pieces, slotPoint, slotOutline } from '../src/parts/rocket-airbrakes/lib/model';
import { component } from '../src/parts/rocket-airbrakes/lib/shapes';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import type { Parameters } from '../src/core/types';

test('AirBrakes presets fit their tube, guide travel and vertical stack in every view', () => {
  assert.equal(part.defaults.tubeOD, 80);
  assert.equal(part.defaults.tubeID, 76);
  for (const preset of part.presets)
    for (const state of part.states!)
      for (const deployment of [0, 50, 100])
        assert.deepEqual(
          validateParameters(part, { ...preset.parameters, deployment }, state.id),
          [],
          `${preset.id}/${state.id}`,
        );
  for (const patch of [
    { tubeID: 90 },
    { tubeOD: 105 },
    { stroke: 25 },
    { height: 70 },
    { bladeWidth: 50 },
    { servo: 'invalid' },
  ] as Parameters[])
    assert.ok(validateParameters(part, { ...part.defaults, ...patch }, 'assembled').length);
});
test('AirBrakes spiral transforms onto the fixed guide with linear travel through the full sweep', () => {
  for (const preset of part.presets.filter((p) =>
    ['spiral', 'sculpted-cam'].includes(String(p.parameters.mechanism)),
  ))
    for (const phase of [0, 120, 240])
      for (let i = 0; i <= 100; i++) {
        const p = preset.parameters,
          f = i / 100,
          angle = (+p.sweep * f * Math.PI) / 180;
        const [x, y] = slotPoint(p, f, phase),
          world = [
            x * Math.cos(angle) - y * Math.sin(angle),
            x * Math.sin(angle) + y * Math.cos(angle),
          ];
        const r = layout(p).followerStart + +p.stroke * camLift(p, f),
          a = (phase * Math.PI) / 180;
        assert.ok(Math.hypot(world[0] - r * Math.cos(a), world[1] - r * Math.sin(a)) < 1e-10);
        // Bearing circumference stays inside the polygonal slot: minimum distance to every edge.
        const boundary = slotOutline(p, phase);
        let distance = Infinity;
        for (let j = 0; j < boundary.length; j++) {
          const a = boundary[j],
            b = boundary[(j + 1) % boundary.length],
            dx = b[0] - a[0],
            dy = b[1] - a[1],
            l = dx * dx + dy * dy;
          if (l < 1e-16) continue;
          const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l));
          distance = Math.min(distance, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy));
        }
        assert.ok(distance > 3.5, `bearing clearance: ${preset.id}/${i}: ${distance}`);
      }
});
test('AirBrakes actual blades move equally, guides stay fixed and cam changes angle', () => {
  const closed = pieces({ ...part.defaults, deployment: 0 }, 'mechanism');
  const open = pieces({ ...part.defaults, deployment: 100 }, 'mechanism');
  const bounds = (p: (typeof closed)[number]) => {
    const group = component(p.shape, p.label, p.color);
    const b = new Box3().setFromObject(group, true);
    disposeModel(group);
    return b;
  };
  for (let i = 1; i <= 3; i++) {
    const name = `Curved airbrake blade ${i}`,
      a = bounds(closed.find((p) => p.label === name)!),
      b = bounds(open.find((p) => p.label === name)!);
    const delta = b.getCenter(new Vector3()).sub(a.getCenter(new Vector3()));
    assert.ok(Math.abs(delta.length() - +part.defaults.stroke) < 1e-4);
    const phase = ((i - 1) * 2 * Math.PI) / 3;
    assert.ok(
      delta.distanceTo(
        new Vector3(
          +part.defaults.stroke * Math.cos(phase),
          +part.defaults.stroke * Math.sin(phase),
          0,
        ),
      ) < 1e-4,
    );
  }
  assert.deepEqual(
    closed.filter((p) => p.label.startsWith('Ø3 guide')),
    open.filter((p) => p.label.startsWith('Ø3 guide')),
  );
  assert.notDeepEqual(
    closed.find((p) => p.label === 'Three-slot spiral cam'),
    open.find((p) => p.label === 'Three-slot spiral cam'),
  );
  assert.equal(closed.filter((p) => p.label.startsWith('683ZZ')).length, 3);
  assert.equal(closed.filter((p) => p.label.startsWith('Ø3 guide')).length, 6);
});
test('AirBrakes all exposed parameters affect physical geometry', () => {
  const reference = part.presets.find((p) => p.id === 'tube-90-86')!.parameters;
  const base = part.python(reference, 'assembled');
  for (const patch of [
    { tubeOD: 92 },
    { tubeID: 87 },
    { height: 100 },
    { fitClearance: 0.6 },
    { deployment: 80 },
    { stroke: 8 },
    { sweep: 70 },
    { bladeWidth: 24 },
    { servo: 'micro' },
  ] as Parameters[]) {
    const p = { ...reference, ...patch };
    assert.deepEqual(validateParameters(part, p, 'assembled'), []);
    assert.notEqual(part.python(p, 'assembled'), base, JSON.stringify(patch));
  }
  const complete = pieces(part.defaults, 'assembled'),
    mechanism = pieces(part.defaults, 'mechanism');
  assert.ok(complete.some((p) => p.label === 'Slotted body tube'));
  assert.ok(
    !mechanism.some((p) => p.label === 'Slotted body tube' || p.label === 'Upper bulkhead'),
  );
});

test('AirBrakes linkage joints keep a constant rod length and have nonlinear travel', () => {
  for (const type of ['curved-link', 'mit-link']) {
    let previous = 0;
    for (let deployment = 0; deployment <= 100; deployment += 5) {
      const p = { ...part.defaults, mechanism: type, deployment },
        k = linkage(p);
      assert.ok(Math.abs(Math.hypot(k.q - k.joint[0], k.joint[1]) - k.rod) < 1e-9);
      const travel = k.q - layout(p).followerStart;
      assert.ok(travel >= previous - 1e-8);
      previous = travel;
      if (deployment === 0) assert.ok(Math.abs(travel) < 1e-8);
      if (deployment === 100) assert.ok(Math.abs(travel - +part.defaults.stroke) < 1e-8);
      if (deployment === 50) assert.ok(Math.abs(travel - +part.defaults.stroke / 2) > 0.1);
    }
  }
});
test('AirBrakes mechanism selector changes the actual drive and two-level shaft', () => {
  const signatures = new Set();
  for (const option of mechanismOptions) {
    const p = part.updateParameters!({ ...part.defaults, mechanism: option.value }, 'mechanism');
    assert.deepEqual(validateParameters(part, p, 'assembled'), []);
    signatures.add(part.python(p, 'mechanism'));
    const assembly = pieces(p, 'mechanism');
    assert.equal(
      assembly.filter((v) =>
        v.label.includes(
          jaynesHinged(p)
            ? 'Jaynes hinged flap'
            : ['geared-petal', 'jaynes-v4'].includes(option.value)
              ? 'Geared pivoting petal'
              : 'Curved airbrake blade',
        ),
      ).length,
      phases(p).length,
    );
    if (['mit-link', 'rack-pinion'].includes(option.value)) {
      assert.equal(layer(p, 1), 20);
      assert.equal(layer(p, 2), 0);
      assert.equal(assembly.filter((v) => v.label.startsWith('Resin guide tray')).length, 4);
      assert.ok(!assembly.some((v) => v.label.startsWith('Ø3 guide rod')));
    }
  }
  assert.equal(signatures.size, 11);
  const gear = { ...part.defaults, mechanism: 'geared-petal' };
  for (const key of ['stroke', 'bladeWidth'])
    assert.equal(
      part.parameters.find((f) => f.key === key)!.visibleWhen!(gear, 'assembled'),
      false,
    );
  const rack = pieces({ ...part.defaults, mechanism: 'rack-pinion' }, 'mechanism');
  assert.equal(rack.filter((v) => v.label.startsWith('Drive pinion')).length, 2);
  assert.equal(rack.filter((v) => v.label.startsWith('Radial rack')).length, 4);
});

test('Jaynes V1–V5 have named presets, separate motion controls and source attribution', () => {
  const presets = part.presets.filter((p) => p.id.startsWith('jaynes-'));
  assert.equal(presets.length, 5);
  assert.ok(part.sources?.some((s) => s.url === 'https://www.benjaynes.com/projects/airbrakes/'));
  for (const preset of presets) {
    const p = preset.parameters;
    const closed = part.python({ ...p, deployment: 0 }, 'mechanism');
    assert.notEqual(closed, part.python({ ...p, deployment: 100 }, 'mechanism'));
    assert.equal(
      part.parameters.find((v) => v.key === 'flapLength')!.visibleWhen!(p, 'assembled'),
      jaynesHinged(p),
    );
    if (jaynesHinged(p)) {
      assert.notEqual(closed, part.python({ ...p, deployment: 0, flapLength: 35 }, 'mechanism'));
      assert.equal(
        part.parameters.find((v) => v.key === 'stroke')!.visibleWhen!(p, 'assembled'),
        false,
      );
    }
  }
});

test('Jaynes V2 spatial links close through every deployment step and reachable sweep', async () => {
  const { jaynesLinkage, jaynesLayout } = await import('../src/parts/rocket-airbrakes/lib/jaynes');
  const reference = part.presets.find((p) => p.id === 'jaynes-v2-90')!.parameters;
  assert.ok(
    validateParameters(part, { ...reference, sweep: 90, deployment: 0 }, 'assembled').length,
  );
  for (const sweep of [45, 60]) {
    let previous = -1;
    let length = 0;
    for (let deployment = 0; deployment <= 100; deployment++) {
      const p = { ...reference, sweep, deployment },
        q = jaynesLinkage(p),
        j = jaynesLayout(p);
      if (!deployment) length = q.rod;
      assert.ok(q.error < 1e-8);
      assert.equal(q.rod, length);
      assert.ok(q.angle >= previous);
      assert.ok(Math.abs(Math.hypot(q.B[0] - j.hinge, q.B[2] - j.z) - 14) < 1e-9);
      previous = q.angle;
    }
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { Box3, Mesh, Vector3 } from 'three';
import clamp from '../src/parts/tube-arm-clamp/part';
import clampModule from '../src/parts/tube-arm-clamp/index';
import {
  clampComponents,
  clampHalf,
  clampLayout,
  libraries,
  pieces,
} from '../src/parts/tube-arm-clamp/lib/model';
import plate from '../src/parts/vehicle-mounting-plate/part';
import plateModule from '../src/parts/vehicle-mounting-plate/index';
import {
  dxf,
  featureEdgeDistance,
  plateLayout,
  slotEndpoints,
} from '../src/parts/vehicle-mounting-plate/lib/model';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import { inspectPackage } from '../scripts/part-modules/library';
import type { Shape } from '../src/core/assembly/boundary/shapes';

test('vehicle interfaces are portable fabrication packages with declared concrete dependencies', async () => {
  for (const module of [clampModule, plateModule]) {
    const report = await inspectPackage(path.resolve('src/parts', module.part.id), process.cwd());
    assert.equal(report.id, module.part.id);
    assert.equal(module.part.category, 'VEHICLE STRUCTURES');
    assert.equal(module.part.subgroup, 'VEHICLE MOUNTS');
    for (const preset of module.part.presets) {
      assert.equal(
        preset.catalog,
        undefined,
        'authored dimensions must not masquerade as supplier CAD',
      );
      for (const state of module.part.states!)
        assert.deepEqual(
          validateParameters(module.part, preset.parameters, state.id),
          [],
          `${preset.id}/${state.id}`,
        );
    }
  }
  assert.deepEqual(clampModule.dependencies, [
    'manufactured-detail',
    'bolt-screw',
    'hex-nut',
    'washer',
  ]);
  assert.equal(plate.product.kind, 'detail');
});

test('four clamp fastener axes mate with both half bores and full washer bearing faces', () => {
  for (const preset of clamp.presets) {
    const p = preset.parameters,
      v = clampLayout(p),
      all = clampComponents(p);
    assert.equal(all.length, 18);
    assert.equal(all.filter((c) => c.libraryId === 'manufactured-detail').length, 2);
    for (const item of all) {
      const lib = libraries.find((part) => part.id === item.libraryId)!;
      assert.deepEqual(validateParameters(lib, item.parameters, item.state), []);
      assert.equal(item.quantity, 1);
    }
    const lower = clampHalf(p, false),
      upper = clampHalf(p, true);
    assert.equal(lower.kind, 'subtract');
    assert.equal(upper.kind, 'subtract');
    if (lower.kind !== 'subtract' || upper.kind !== 'subtract') continue;
    const upperBore = upper.children[1],
      lowerBore = lower.children[1];
    assert.equal(upperBore.kind, 'cylinder');
    assert.equal(lowerBore.kind, 'cylinder');
    if (upperBore.kind === 'cylinder' && lowerBore.kind === 'cylinder') {
      assert.equal(upperBore.axis, 'x');
      assert.equal(upperBore.radius * 2, Number(p.tubeDiameter) + Number(p.boreAllowance));
      assert.deepEqual(upperBore, lowerBore, 'halves share one tube datum');
    }
    for (let i = 0; i < 4; i++) {
      const [x, y] = v.boltCentres[i],
        bolt = all.find((c) => c.id === `bolt-${i + 1}`)!,
        nut = all.find((c) => c.id === `nut-${i + 1}`)!;
      const halves: Extract<Shape, { kind: 'subtract' }>[] = [lower, upper];
      for (const half of halves) {
        const hole: Shape = half.children[i + 2];
        assert.equal(hole.kind, 'cylinder');
        if (hole.kind === 'cylinder') {
          assert.deepEqual(hole.origin.slice(0, 2), [x, y]);
          assert.equal(hole.axis, 'z');
          assert.equal(hole.radius * 2, p.boltClearance);
        }
      }
      assert.deepEqual(bolt.placement.translation.slice(0, 2), [x, y]);
      assert.deepEqual(nut.placement.translation.slice(0, 2), [x, y]);
      const length = Number(bolt.parameters.length),
        head = Number(bolt.parameters.headHeight),
        z = bolt.placement.translation[2];
      const underHead = z + (length - head) / 2,
        tip = z - (length + head) / 2;
      assert.ok(Math.abs(underHead - v.halfHeight - v.washerThickness) < 1e-8);
      assert.ok(tip <= nut.placement.translation[2] - 2 * v.pitch);
      const phaseDifference =
        (nut.placement.rotation[2] / 360 -
          (nut.placement.translation[2] - tip - Number(bolt.parameters.threadStart)) / v.pitch) %
        1;
      assert.ok(
        Math.abs(phaseDifference - Math.round(phaseDifference)) < 1e-8,
        'mating helical thread frames have equal phase',
      );
      assert.ok(
        Math.abs(nut.placement.translation[2] + v.nutHeight + v.washerThickness + v.halfHeight) <
          1e-8,
      );
      assert.ok(Math.abs(x) + v.washerDiameter / 2 + 2 <= Number(p.length) / 2);
      assert.ok(Math.abs(y) - Number(p.boltClearance) / 2 - v.diameter / 2 >= v.wall);
    }
    assert.deepEqual(clamp.composition!(p).components, all);
    assert.match(clamp.python(p, 'assembled'), /LibraryId/);
    const canonical = JSON.stringify(clamp.composition!(p));
    assert.equal(pieces(p, 'exploded').length, 18);
    assert.equal(pieces(p, 'print').length, 2);
    assert.equal(
      JSON.stringify(clamp.composition!(p)),
      canonical,
      'inspection states do not mutate canonical component definitions',
    );
  }
});

test('clamp rejects disconnected bearing faces, bore collisions and inadequate screw clearance', () => {
  assert.match(
    clamp.validate({ ...clamp.defaults, boltPitchX: 28 }, 'assembled').join(' '),
    /bearing face/,
  );
  assert.match(
    clamp.validate({ ...clamp.defaults, boltPitchY: 18 }, 'assembled').join(' '),
    /selected wall/,
  );
  assert.match(
    clamp.validate({ ...clamp.defaults, bolt: '4' }, 'assembled').join(' '),
    /bolt diameter/,
  );
  assert.ok(clamp.validate({ ...clamp.defaults, tubeDiameter: NaN }, 'assembled').length);
  const changed = clamp.updateParameters!({ ...clamp.defaults, bolt: '4' }, 'bolt');
  assert.equal(changed.boltClearance, 4.5);
  assert.equal(changed.tubeDiameter, clamp.defaults.tubeDiameter);
});

test('plate DXF preserves mm units, mounting pitch and exact circular slot ends', () => {
  for (const preset of plate.presets) {
    const p = preset.parameters,
      v = plateLayout(p),
      text = dxf(p),
      words = text.trim().split('\n');
    const records: { type: string; data: Map<number, string[]> }[] = [];
    for (let i = 0; i < words.length; i += 2) {
      const code = Number(words[i]),
        value = words[i + 1];
      if (code === 0) records.push({ type: value, data: new Map() });
      else if (records.length) {
        const data = records.at(-1)!.data;
        data.set(code, [...(data.get(code) ?? []), value]);
      }
    }
    assert.match(text, /\$INSUNITS\n70\n4\n/);
    const circles = records.filter((r) => r.type === 'CIRCLE'),
      arcs = records.filter((r) => r.type === 'ARC');
    assert.equal(circles.length, v.holes.length);
    assert.equal(arcs.length, v.slots.length * 2);
    circles.forEach((circle, index) => {
      assert.equal(Number(circle.data.get(40)![0]), Number(p.hole) / 2);
      assert.deepEqual(
        [Number(circle.data.get(10)![0]), Number(circle.data.get(20)![0])],
        v.holes[index],
      );
    });
    v.slots.forEach((s, index) => {
      assert.ok(featureEdgeDistance(v.outline, slotEndpoints(s), s.width / 2) >= 2);
      for (let side = 0; side < 2; side++) {
        const arc = arcs[2 * index + side];
        assert.deepEqual(
          [Number(arc.data.get(10)![0]), Number(arc.data.get(20)![0])],
          slotEndpoints(s)[side],
        );
        assert.equal(Number(arc.data.get(40)![0]), s.width / 2);
        assert.equal(
          (Number(arc.data.get(51)![0]) - Number(arc.data.get(50)![0]) + 360) % 360,
          180,
        );
      }
    });
    assert.equal(plate.fabricationFiles!(p)[0].content, text);
  }
  const dual = plateLayout(plate.presets.find((p) => p.id === 'dual-stack-65')!.parameters);
  for (const pitch of [20, 30.5])
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        assert.ok(dual.holes.some(([x, y]) => x === (sx * pitch) / 2 && y === (sy * pitch) / 2));
});

test('plate validation checks cut edge distances, strap separation and chamfered corners', () => {
  assert.match(
    plate.validate({ ...plate.defaults, strapPitchX: 80 }, 'default').join(' '),
    /outline|mounting holes/,
  );
  assert.match(
    plate.validate({ ...plate.defaults, strapPitchY: 30.5 }, 'default').join(' '),
    /strap slots or mounting holes/,
  );
  assert.match(
    plate
      .validate(
        { ...plate.defaults, hole: 5.5, pattern: 'dual', straps: false, perimeter: false },
        'default',
      )
      .join(' '),
    /between their edges/,
  );
  assert.match(
    plate.validate({ ...plate.defaults, corner: 20 }, 'default').join(' '),
    /chamfered corners/,
  );
  assert.match(
    plate.validate({ ...plate.defaults, edgeOffset: 6 }, 'default').join(' '),
    /two hole diameters/,
  );
});

test('preview geometry and fabrication poses retain finite dimensions and positive volumes', () => {
  for (const part of [clamp, plate])
    for (const preset of part.presets) {
      const states = part === clamp ? ['assembled', 'print'] : ['default'];
      for (const state of states) {
        const model = part.buildExportGeometry!(preset.parameters, state);
        try {
          model.updateMatrixWorld(true);
          const bounds = new Box3().setFromObject(model),
            size = bounds.getSize(new Vector3());
          assert.ok(size.toArray().every((value) => Number.isFinite(value) && value > 0));
          if (state === 'print') assert.ok(Math.abs(bounds.min.z) < 0.002);
          if (part === plate)
            size
              .toArray()
              .forEach((value, index) =>
                assert.ok(
                  Math.abs(value - part.dimensions(preset.parameters, state)[index]) < 0.002,
                ),
              );
          model.traverse((child) => {
            if (!(child instanceof Mesh)) return;
            const g = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone(),
              p = g.getAttribute('position');
            let volume = 0;
            for (let i = 0; i < p.count; i += 3) {
              const a = new Vector3().fromBufferAttribute(p, i),
                b = new Vector3().fromBufferAttribute(p, i + 1),
                c = new Vector3().fromBufferAttribute(p, i + 2);
              assert.ok(a.clone().sub(c).cross(b.clone().sub(c)).lengthSq() > 1e-16);
              volume += a.dot(b.clone().cross(c)) / 6;
            }
            assert.ok(volume > 0);
            g.dispose();
          });
        } finally {
          disposeModel(model);
        }
      }
    }
});

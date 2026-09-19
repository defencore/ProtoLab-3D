import { component } from '../src/parts/rocket-release/lib/shapes';
import type { Shape } from '../src/parts/rocket-release/lib/shapes';
import { Matrix4, Vector3, Mesh, Raycaster } from 'three';
import test from 'node:test';
import assert from 'node:assert/strict';
import part from '../src/parts/rocket-release/part';
import { motion, layout, at } from '../src/parts/rocket-release/lib/motion';
import { pieces, studAngles } from '../src/parts/rocket-release/lib/model';
import { servoMounts } from '../src/parts/rocket-release/lib/micro-servo';
import { validateParameters } from '../src/core/validation';
import type { Parameters } from '../src/core/types';

test('Release presets validate throughout lock rotation and axial separation', () => {
  assert.equal(part.defaults.tubeOD, 80);
  assert.equal(part.defaults.tubeID, 76);
  for (const preset of part.presets)
    for (const state of part.states!)
      for (const release of [0, 30, 59, 60, 61, 70, 100])
        assert.deepEqual(
          validateParameters(part, { ...preset.parameters, release }, state.id),
          [],
          `${preset.id}/${state.id}/${release}`,
        );
  assert.ok(validateParameters(part, { ...part.defaults, tubeID: 81 }, 'assembled').length);
  assert.ok(validateParameters(part, { ...part.defaults, motor: 'unknown' }, 'assembled').length);
  assert.ok(
    validateParameters(part, { ...part.defaults, separation: 16, springTravel: 13 }, 'assembled')
      .length,
  );
});
test('Eight fixed studs align with the ring openings before any axial motion', () => {
  for (const unlockAngle of [12, 14, 20])
    for (let release = 0; release <= 100; release++) {
      const p = { ...part.defaults, unlockAngle, release },
        m = layout(p);
      assert.equal(m.pinionAngle, m.angle * 4);
      assert.ok(m.lift === 0 || m.angle === unlockAngle);
      assert.ok(m.springExpansion <= +part.defaults.springTravel);
      if (release >= 60)
        for (const a of studAngles) {
          const hole = at(m.lockRadius, a - unlockAngle + m.angle),
            stud = at(m.lockRadius, a);
          assert.ok(Math.hypot(hole[0] - stud[0], hole[1] - stud[1]) < 1e-10);
        }
    }
  assert.equal(motion({ ...part.defaults, release: 100 }).lift, part.defaults.separation);
});
test('Actual component recipes retain the lower drive and move the complete upper section', () => {
  const fixed = pieces(part.defaults, 'assembled'),
    separated = pieces({ ...part.defaults, release: 100 }, 'assembled');
  const find = (items: typeof fixed, label: string) => items.find((x) => x.label === label)!.shape;
  for (const label of [
    'Fixed windowed carrier',
    'Lower tube section',
    ...studAngles.map((_, i) => `Retaining shoulder stud ${i + 1} · fixed`),
  ])
    assert.deepEqual(find(fixed, label), find(separated, label), label);
  for (const label of [
    'Rotating release disk',
    'Upper tube sleeve',
    'Released upper tube section',
    ...Array.from({ length: 4 }, (_, i) => `Upper tube screw ${i + 1}`),
  ]) {
    const shape = find(separated, label);
    assert.equal(shape.kind, 'transform');
    if (shape.kind === 'transform') {
      assert.equal(shape.offset[2], part.defaults.separation);
      assert.equal(shape.angle, part.defaults.unlockAngle);
    }
  }
  assert.equal(fixed.filter((p) => p.label.startsWith('Drive pinion')).length, 4);
  assert.equal(fixed.filter((p) => p.label.startsWith('Retaining shoulder stud')).length, 8);
  assert.equal(fixed.filter((p) => p.label.startsWith('Compression spring')).length, 4);
  for (let i = 1; i <= 4; i++) {
    assert.notDeepEqual(
      find(fixed, `Drive pinion ${i} · 20 teeth`),
      find(separated, `Drive pinion ${i} · 20 teeth`),
    );
    const a = find(fixed, `Compression spring ${i}`),
      b = find(separated, `Compression spring ${i}`);
    assert.ok(a.kind === 'spring' && b.kind === 'spring');
    assert.ok(Math.abs(b.height - a.height - +part.defaults.springTravel) < 1e-10);
  }
});
test('Every release control changes geometry and inspection views remove only their intended components', () => {
  const reference = { ...part.defaults, release: 75 },
    macro = part.python(reference, 'assembled');
  for (const patch of [
    { tubeOD: 82 },
    { tubeID: 77 },
    { fitClearance: 0.6 },
    { release: 40 },
    { unlockAngle: 16 },
    { separation: 32 },
    { springTravel: 6 },
    { motor: '16' },
    { drive: 'central-servo' },
  ] as Parameters[]) {
    const p = { ...reference, ...patch };
    assert.deepEqual(validateParameters(part, p, 'assembled'), []);
    assert.notEqual(part.python(p, 'assembled'), macro, JSON.stringify(patch));
  }
  const mechanism = pieces(reference, 'mechanism');
  assert.ok(
    !mechanism.some(
      (p) => p.label === 'Fixed windowed carrier' || p.label.includes('tube section'),
    ),
  );
  assert.ok(pieces(reference, 'open').some((p) => p.label === 'Fixed windowed carrier'));
});

test('Single servo closes all four gear meshes and unlocks eight studs before lifting', () => {
  for (const preset of part.presets.filter((p) => p.parameters.drive === 'central-servo')) {
    for (const release of [0, 30, 59, 60, 61, 100]) {
      const m = layout({ ...preset.parameters, release });
      const sunRadius = (20 * m.module) / 2;
      assert.equal(m.ringTeeth, 20 + 2 * m.pinionTeeth);
      assert.equal(
        (m.ringTeeth + 20) % 4,
        0,
        'Four equally spaced idlers share a valid tooth phase',
      );
      assert.ok(Math.abs(m.driveRadius - sunRadius - m.pinionRadius) < 1e-10);
      assert.ok(Math.abs(m.driveRadius + m.pinionRadius - m.pitchRadius) < 1e-10);
      assert.ok(2 * (m.pinionRadius + m.module) < Math.SQRT2 * m.driveRadius);
      assert.equal(m.servoAngle, -5 * m.angle);
      assert.equal(m.pinionAngle, 2.5 * m.angle);
      assert.ok(m.lift === 0 || m.angle === +preset.parameters.unlockAngle);
      if (release >= 60)
        for (const a of studAngles) {
          const hole = at(m.lockRadius, a - +preset.parameters.unlockAngle + m.angle);
          const stud = at(m.lockRadius, a);
          assert.ok(Math.hypot(hole[0] - stud[0], hole[1] - stud[1]) < 1e-10);
        }
    }
  }
  assert.equal(motion({ ...part.defaults, drive: 'central-servo', release: 60 }).servoAngle, -70);
});
test('Single-servo assembly contains one input, four fixed-axis idlers and no independent motors', () => {
  const p = { ...part.defaults, drive: 'central-servo' };
  const closed = pieces(p, 'assembled');
  const released = pieces({ ...p, release: 100 }, 'assembled');
  assert.equal(closed.filter((x) => x.label.startsWith('Central micro servo')).length, 1);
  assert.equal(closed.filter((x) => /^Servo input pinion ·/.test(x.label)).length, 1);
  assert.equal(closed.filter((x) => /^Idler pinion \d ·/.test(x.label)).length, 4);
  assert.equal(closed.filter((x) => x.label.startsWith('Gearmotor')).length, 0);
  assert.equal(closed.filter((x) => x.label.startsWith('Retaining shoulder stud')).length, 8);
  for (const item of closed) {
    const after = released.find((x) => x.label === item.label)!;
    if (
      item.label.startsWith('Central micro servo') ||
      item.label.startsWith('Servo mounting') ||
      item.label.startsWith('Output shaft bushing')
    )
      assert.deepEqual(item.shape, after.shape, item.label);
    if (/^Idler pinion \d ·/.test(item.label)) {
      assert.ok(item.shape.kind === 'transform' && after.shape.kind === 'transform');
      assert.deepEqual(item.shape.offset, after.shape.offset);
      assert.equal(after.shape.angle - item.shape.angle, 35);
    }
  }
  const motorControl = part.parameters.find((x) => x.key === 'motor')!;
  assert.equal(motorControl.visibleWhen?.(p), false);
  assert.equal(motorControl.visibleWhen?.(part.defaults), true);
  assert.deepEqual(pieces({ ...p, motor: '16' }, 'assembled'), closed);
  assert.ok(validateParameters(part, { ...p, drive: 'invalid' }, 'assembled').length);
});

test('Servo mounting hardware clears idler supports throughout the custom tube range', () => {
  for (let tubeID = 76; tubeID <= 156; tubeID += 0.5) {
    const m = layout({ ...part.defaults, drive: 'central-servo', tubeID });
    for (const [x, y] of servoMounts)
      for (const a of [0, 90, 180, 270]) {
        const [sx, sy] = at(m.driveRadius, a);
        assert.ok(Math.hypot(x - sx, y - sy) > 2 + 3.6, `Mount/idler clearance at ID${tubeID}`);
      }
  }
});

test('Original defaults are preserved and ST3215 has its own 90/86 nose layout', () => {
  assert.equal(part.defaults.drive, 'four-motors');
  assert.equal(part.defaults.tubeOD, 80);
  const original = part.presets.filter((x) =>
    ['four-motors', 'central-servo'].includes(String(x.parameters.drive)),
  );
  assert.equal(original.length, 8);
  for (const preset of original) {
    const model = pieces(preset.parameters, 'assembled');
    assert.ok(!model.some((x) => /U-bolt|Parachute|18650|ST3215/.test(x.label)));
  }
  const nose = part.presets.find((x) => x.id === 'nose-90-86-st3215-compact')!;
  assert.equal(nose.parameters.tubeOD, 90);
  assert.equal(nose.parameters.tubeID, 86);
  assert.equal(nose.parameters.batteryPack, 'none');
  const updated = part.updateParameters!({ ...part.defaults, drive: 'st3215-nose' }, 'drive');
  assert.equal(updated.tubeOD, 90);
  assert.equal(updated.tubeID, 86);
  assert.ok(part.validate({ ...nose.parameters, tubeOD: 80, tubeID: 76 }, 'assembled').length);
});

test('ST3215 nose and its mounting disk separate while the body ring remains stationary', () => {
  const p = part.presets.find((x) => x.id === 'nose-90-86-st3215-compact')!.parameters;
  const rootMatrix = (shape: Shape): Matrix4 => {
    if (shape.kind === 'transform')
      return new Matrix4()
        .makeTranslation(...shape.offset)
        .multiply(new Matrix4().makeRotationZ((shape.angle * Math.PI) / 180))
        .multiply(rootMatrix(shape.child));
    if (shape.kind === 'rotate')
      return (
        shape.axis === 'x'
          ? new Matrix4().makeRotationX((shape.angle * Math.PI) / 180)
          : new Matrix4().makeRotationY((shape.angle * Math.PI) / 180)
      ).multiply(rootMatrix(shape.child));
    return new Matrix4();
  };
  const closed = pieces(p, 'assembled');
  assert.ok(
    !closed.some((x) =>
      /U-bolt|Parachute|Fixed windowed carrier|Carrier standoff|18650|guard|shield|upper clamp|coupler|Front output disc|cradle/.test(
        x.label,
      ),
    ),
  );
  assert.equal(closed.filter((x) => x.label.startsWith('ST3215 standoff disk screw')).length, 4);
  assert.equal(closed.filter((x) => x.label.startsWith('Servo input pinion')).length, 1);
  assert.ok(
    closed
      .find((x) => x.label.startsWith('Servo input pinion'))!
      .label.includes('ST3215 25T spline'),
  );
  assert.equal(closed.filter((x) => x.label.startsWith('ST3215 front support pillar')).length, 4);
  for (const release of [30, 60, 61, 100]) {
    const after = pieces({ ...p, release }, 'assembled');
    const m = layout({ ...p, release });
    for (const prefix of [
      'ST3215 · Middle case',
      'Nose servo and gear mounting disk',
      'Nose tube section',
    ]) {
      const a = closed.find((x) => x.label.startsWith(prefix))!,
        b = after.find((x) => x.label === a.label)!;
      const before = new Vector3(0, 0, 0).applyMatrix4(rootMatrix(a.shape));
      const next = new Vector3(0, 0, 0).applyMatrix4(rootMatrix(b.shape));
      assert.ok(Math.abs(next.z - before.z - m.lift) < 1e-8, prefix);
    }
    for (const prefix of ['Body locking ring', 'Main body tube section']) {
      const a = closed.find((x) => x.label.startsWith(prefix))!,
        b = after.find((x) => x.label === a.label)!;
      const before = rootMatrix(a.shape).elements,
        next = rootMatrix(b.shape).elements;
      assert.ok(
        before.every((v, i) => Math.abs(v - next[i]) < 1e-8),
        prefix,
      );
    }
  }
  assert.equal(closed.filter((x) => x.label.startsWith('Idler axle retaining disk')).length, 1);
  assert.equal(closed.filter((x) => x.label.startsWith('Fixed idler axle')).length, 4);
  assert.equal(closed.filter((x) => x.label.startsWith('Idler retaining disk screw')).length, 4);
  assert.ok(closed.find((x) => x.label.startsWith('Body locking ring'))!.label.includes('rim h30'));
  assert.ok(
    !closed.some((x) =>
      /Body-side tube sleeve|Sleeve mounting screw|Nose tube mounting tab|Nose disk mounting screw|Idler spindle|Idler pinion retaining screw|Output shaft bushing/.test(
        x.label,
      ),
    ),
  );
  assert.equal(closed.filter((x) => x.label.startsWith('Threaded spring barrel')).length, 4);
  assert.equal(closed.filter((x) => x.label.startsWith('Spring barrel bottom plug')).length, 4);
  assert.equal(closed.filter((x) => x.label.startsWith('ST3215 metal clamp standoff')).length, 4);
  assert.equal(
    closed.filter((x) => x.label.startsWith('ST3215 machined rear mounting plate')).length,
    1,
  );
  assert.equal(
    closed.filter((x) => x.label.startsWith('Piston external retaining ring')).length,
    4,
  );
  assert.ok(!closed.some((x) => x.label.startsWith('ST3215 rear pressure tab')));
  assert.ok(
    !closed.some((x) => /Spring seat tab|Spring seat spacer|modeled M2 mount/.test(x.label)),
  );
  const optional = pieces({ ...p, batteryPack: '3x18650' }, 'assembled');
  assert.equal(optional.filter((x) => /18650 cell.*jacket/.test(x.label)).length, 3);
  assert.ok(part.python(p, 'assembled').includes('MAKE RR-'));
});

function assertClosedModel(model: ReturnType<typeof component>, minimumTriangles = 101) {
  let triangles = 0;
  model.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const position = o.geometry.getAttribute('position'),
      index = o.geometry.index;
    const edges = new Map<string, number>();
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const vertices = [0, 1, 2].map((j) => {
        const k = index ? index.getX(i + j) : i + j;
        return [position.getX(k), position.getY(k), position.getZ(k)]
          .map((v) => Math.round(v * 1e5))
          .join(',');
      });
      for (let j = 0; j < 3; j++) {
        const a = vertices[j],
          b = vertices[(j + 1) % 3],
          key = a < b ? a + '|' + b : b + '|' + a;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
      triangles++;
    }
    assert.deepEqual(
      [...edges].filter(([, count]) => count !== 2).slice(0, 10),
      [],
      'Every triangle edge must have exactly two incident faces',
    );
    o.geometry.dispose();
  });
  assert.ok(triangles >= minimumTriangles, 'The component retains its surface detail');
}
test('Machined structural components have closed triangle boundaries', () => {
  const p = part.presets.find((x) => x.id === 'nose-90-86-st3215-compact')!.parameters;
  for (const state of ['assembled', 'cutaway']) {
    const model = pieces(p, state);
    for (const prefix of [
      'Nose servo and gear mounting disk',
      'Body locking ring',
      'Idler axle retaining disk',
    ]) {
      const piece = model.find((x) => x.label.startsWith(prefix))!;
      try {
        assertClosedModel(component(piece.shape, piece.label, piece.color));
      } catch (error) {
        throw new Error(`${state}: ${prefix}`, { cause: error });
      }
    }
  }
});

test('Common cell seats, wire liners and printed board support retain closed surfaces', () => {
  const p = part.presets.find((x) => x.id === 'nose-90-86-st3215')!.parameters;
  for (const piece of pieces(p, 'assembled').filter((x) =>
    /^(3S common|3S harness liner|HAT common anti-flex carrier|HAT clamped frame gasket)/.test(
      x.label,
    ),
  )) {
    try {
      assertClosedModel(component(piece.shape, piece.label, piece.color));
    } catch (error) {
      throw new Error(piece.label, { cause: error });
    }
  }
});

test('Spring cartridge meshes stay closed for minimum, default and maximum stroke', () => {
  for (const travel of [4, 8, 12]) {
    for (const kind of ['springBarrel', 'springPlug'] as const) {
      const model = component({ kind, travel }, kind, 0xffffff);
      model.traverse((mesh) => {
        if (!(mesh instanceof Mesh)) return;
        const indices = mesh.geometry.index!;
        const edges = new Map<string, number>();
        for (let i = 0; i < indices.count; i += 3) {
          for (let j = 0; j < 3; j++) {
            const a = indices.getX(i + j),
              b = indices.getX(i + ((j + 1) % 3));
            const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
            edges.set(key, (edges.get(key) ?? 0) + 1);
          }
        }
        assert.ok(
          [...edges.values()].every((n) => n === 2),
          `${kind}, travel ${travel}`,
        );
        mesh.geometry.dispose();
      });
    }
  }
});

test('Spring sizing uses extraction load and mass, without claiming a selected rated spring', async () => {
  const { springAssessment, springReport } =
    await import('../src/parts/rocket-release/lib/spring-assessment');
  const p = part.presets.find((x) => x.id === 'nose-90-86-st3215-compact')!.parameters;
  const a = springAssessment(p);
  assert.ok(a.startForce > a.endForce && a.endForce > 0);
  assert.ok(Math.abs(a.energy - ((a.startForce + a.endForce) * +p.springTravel) / 2000) < 1e-9);
  assert.ok(springAssessment({ ...p, noseMass: 2 }).required > a.required);
  assert.equal(springAssessment({ ...p, extractionForce: 100 }).sufficient, false);
  assert.equal(springAssessment({ ...p, extractionForce: 100 }).speed, 0);
  assert.ok(springReport(p)[0].includes('Preliminary'));
  assert.deepEqual(springReport(part.defaults), []);
});

test('Countersunk tube screw heads remain inside the tube outer cylinder', () => {
  const p = part.presets.find((x) => x.id === 'nose-90-86-st3215-compact')!.parameters;
  const bolts = pieces(p, 'assembled').filter((x) =>
    /Nose radial mounting screw|Main body tube screw/.test(x.label),
  );
  assert.equal(bolts.length, 12);
  for (const bolt of bolts) {
    assert.ok(bolt.label.includes('countersunk 90°'));
    const model = component(bolt.shape, bolt.label, bolt.color);
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const vertices = o.geometry.getAttribute('position');
      for (let i = 0; i < vertices.count; i++) {
        const v = new Vector3().fromBufferAttribute(vertices, i).applyMatrix4(o.matrixWorld);
        assert.ok(Math.hypot(v.x, v.y) <= +p.tubeOD / 2 + 1e-5, bolt.label);
      }
      o.geometry.dispose();
    });
  }
});

test('WING MINI presets keep the original defaults and select the correct LiPo envelope', () => {
  const wing = part.presets.filter((x) => x.parameters.drive === 'wing-mini-nose');
  assert.equal(wing.length, 3);
  assert.equal(part.defaults.drive, 'four-motors');
  assert.equal(part.defaults.batteryPack, 'none');
  for (const preset of wing) {
    const p = preset.parameters;
    const model = pieces(p, 'assembled');
    assert.ok(model.some((x) => x.label.startsWith('BUY TowerPro MG996R')));
    assert.ok(model.some((x) => x.label.startsWith('BUY SpeedyBee F405 WING-MINI')));
    if (p.wingBattery === 'lipo')
      assert.ok(model.some((x) => x.label.startsWith(`BUY Tattu TA-75C-650-${p.lipoCells}S1P`)));
    else
      assert.equal(
        model.filter((x) => x.label.startsWith('BUY 18650 cell') && x.label.includes('2S1P'))
          .length,
        2,
      );
    assert.ok(!model.some((x) => /ST3215|Waveshare/.test(x.label)));
    const next = part.updateParameters!(
      { ...p, lipoCells: p.lipoCells === '3' ? '2' : '3' },
      'lipoCells',
    );
    assert.equal(next.lipoThickness, next.lipoCells === '2' ? 12 : 16);
    assert.equal(next.lipoLength, next.lipoCells === '2' ? 57 : 58);
    assert.ok(part.assessment!(p).some((x) => x.includes('default 5 V')));
    assert.ok(part.assessment!(p).some((x) => x.includes('not implemented')));
  }
});
test('New powered package departs with the nose and retains closed structural meshes', () => {
  const p = part.presets.find((x) => x.id === 'nose-90-86-mg996r-tattu-3s-wing-mini')!.parameters;
  const rest = pieces(p, 'open'),
    released = pieces({ ...p, release: 100 }, 'open');
  for (const prefix of [
    'BUY TowerPro',
    'BUY Tattu',
    'BUY SpeedyBee',
    'Servo body capture',
    'LiPo lower retention',
    'LiPo lower insulating',
    'WING MINI horizontal shelf',
    'Nose servo and gear',
  ]) {
    const a = rest.find((x) => x.label.startsWith(prefix))!,
      b = released.find((x) => x.label.startsWith(prefix))!;
    assert.ok(a && b, prefix);
    assert.notDeepEqual(a.shape, b.shape, prefix);
    if (!prefix.startsWith('BUY')) assertClosedModel(component(a.shape, a.label, a.color), 12);
  }
});

test('Transverse LiPo follows mass balance while four cage columns remain symmetric', async () => {
  const { wingLayout, wingTies } = await import('../src/parts/rocket-release/lib/wing-layout');
  for (const preset of part.presets.filter((x) => x.parameters.drive === 'wing-mini-nose')) {
    const p = preset.parameters;
    for (const lipoMass of [43, 59, 75]) {
      const w = wingLayout({ ...p, lipoMass });
      assert.ok(Math.abs(w.payloadCgX) < 1e-9);
      assert.ok(w.controllerZ - 25.8 > w.noseBottom, 'PLS bend zone stays inside nose');
    }
    assert.ok(wingLayout({ ...p, lipoTrimX: 1 }).payloadCgX > 0);
  }
  for (const [x, y] of wingTies) assert.ok(wingTies.some(([a, b]) => a === -x && b === -y));
});

test('WING MINI models three physical boards and supplier spacer gaps instead of a solid box', async () => {
  const { controllerPieces } = await import('../src/parts/rocket-release/lib/wing-controller');
  const { Box3 } = await import('three');
  const p = part.presets.find((x) => x.parameters.drive === 'wing-mini-nose')!.parameters;
  const all = controllerPieces(p);
  const bounds = (prefix: string) => {
    const piece = all.find((x) => x.label.includes(prefix))!;
    const model = component(piece.shape, piece.label, piece.color);
    const b = new Box3().setFromObject(model, true);
    model.traverse((x) => {
      if (x instanceof Mesh) x.geometry.dispose();
    });
    return b;
  };
  const shield = bounds('shield C'),
    fc = bounds('FC board B'),
    pdb = bounds('PDB board A');
  assert.ok(Math.abs(shield.min.z - fc.max.z - 3) < 1e-5);
  assert.ok(Math.abs(fc.min.z - pdb.max.z - 6.5) < 1e-5);
  assert.equal(all.filter((x) => x.label.includes('header pin')).length, 30);
  assert.equal(all.filter((x) => x.label.includes('shield isolation pad')).length, 4);
});

test('18650 variant captures two opposite cells, a small servo rim and outward-facing controller', async () => {
  const { wingLayout, cellLocations } = await import('../src/parts/rocket-release/lib/wing-layout');
  const { wingPieces } = await import('../src/parts/rocket-release/lib/wing-package');
  const { controllerServiceZones } = await import('../src/parts/rocket-release/lib/wing-frame');
  const { Box3 } = await import('three');
  const p = part.presets.find((p) => p.id === 'nose-90-86-mg996r-18650-2s-wing-mini')!.parameters;
  const w = wingLayout(p),
    parts = wingPieces(p);
  assert.equal(w.cells, 2);
  assert.equal(w.controllerX, 0, 'FC is centered on the tube axis');
  assert.ok(Math.abs(w.payloadCgX) < 1e-9, 'Battery offset compensates the centered electronics');
  assert.equal(w.packMass, 2 * +p.wingCellMass);
  assert.equal(cellLocations(p)[0][1], -cellLocations(p)[1][1]);
  assert.ok(parts.some((p) => p.label.includes('cell 1 positive to cell 2 negative')));
  assert.equal(parts.filter((p) => p.label.includes('insulating cup')).length, 4);
  const bounds = (shape: Shape) => {
    const model = component(shape, 'test', 0);
    const bounds = new Box3().setFromObject(model, true);
    model.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
    return bounds;
  };
  assert.ok(
    !parts.some(
      (p) =>
        p.label.startsWith('WING MINI horizontal shelf') ||
        p.label.startsWith('WING MINI shelf spacer'),
    ),
  );
  const heel = parts.find((p) => p.label.startsWith('Servo body capture'))!;
  const bb = bounds(heel.shape);
  assert.ok(
    Math.abs(bb.min.y + bb.max.y) < 1e-5,
    'Heel has identical open cell reliefs on both sides',
  );
  const shield = bounds(parts.find((p) => p.label.includes('shield C'))!.shape);
  assert.ok(
    Math.abs(bb.min.z - shield.max.z - 4) < 1e-5,
    'FC has a 4 mm damper gap above the heel',
  );
  assert.equal(w.cellTop, 38, '6 mm disk-side terminal space');
  assert.ok(Math.abs(bb.max.z - bb.min.z - 6) < 1e-5, '2 mm web + 4 mm rim replaces deep box');
  assertClosedModel(component(heel.shape, heel.label, heel.color), 12);
  for (const zone of controllerServiceZones(p)) {
    const b = bounds(zone.shape);
    assert.ok(b.min.z > w.noseBottom, zone.label);
    for (const x of [b.min.x, b.max.x])
      for (const y of [b.min.y, b.max.y])
        assert.ok(Math.hypot(x, y) + 0.5 < +p.tubeID / 2, zone.label);
  }
  for (const prefix of [
    '2S 18650 common retention',
    '18650 cell 1 disk insulating',
    '18650 cell 1 nose-tip insulating',
    '18650 cell 1 fixed output',
    'WING MINI bonded elastomer damper 1',
    'WING MINI damper lower insert 1',
    'WING MINI damper upper stud 1',
    'WING MINI heel wire liner 1',
    'WING MINI heel wire liner 2',
    '2S angled bridge backing',
    '2S angled series bridge',
  ]) {
    const item = parts.find((p) => p.label.startsWith(prefix))!;
    assertClosedModel(component(item.shape, item.label, item.color), 12);
  }
});

test('CSG trimming keeps the LiPo 2S liner centred at its original assembly coordinates', async () => {
  const { wingPieces } = await import('../src/parts/rocket-release/lib/wing-package');
  const { Box3 } = await import('three');
  const p = part.presets.find((p) => p.id === 'nose-90-86-mg996r-tattu-2s-wing-mini')!.parameters;
  const seat = wingPieces(p).find((p) => p.label.startsWith('LiPo upper insulating seat'))!;
  const model = component(seat.shape, seat.label, seat.color),
    bb = new Box3().setFromObject(model, true);
  assert.ok(Math.abs(bb.min.y + (+p.lipoLength / 2 + 2)) < 0.002);
  assert.ok(Math.abs(bb.max.y - (+p.lipoLength / 2 + 2)) < 0.002);
  model.traverse((o) => {
    if (o instanceof Mesh) o.geometry.dispose();
  });
});

test('Release transmission reports carrier-relative angles and exports gear data', async () => {
  const { transmission, transmissionMetadata } =
    await import('../src/parts/rocket-release/lib/transmission');
  const p = part.presets.find((p) => p.id === 'nose-90-86-mg996r-18650-2s-wing-mini')!.parameters;
  const t = transmission(p);
  assert.equal(t.ringTeeth, 100);
  assert.equal(t.inputTeeth, 20);
  assert.equal(t.idlerTeeth, 40);
  assert.equal(t.ratio, 5);
  assert.equal(t.inputUnlockDeg, -70);
  assert.equal(t.idlerUnlockDeg, 35);
  assert.ok(Math.abs(t.module - 0.6) < 1e-8);
  assert.ok(Math.abs(t.ringClearBoreMm - 58.8) < 1e-8);
  assert.ok(Math.abs(t.lockWebMm - 2.45) < 1e-8);
  assert.equal(transmission({ ...p, unlockAngle: 20 }).inputUnlockDeg, -100);
  assert.equal(transmission({ ...p, release: 60 }).currentInputDeg, -70);
  assert.equal(transmission({ ...p, release: 100 }).axialTravelMm, +p.separation);
  const four = transmission({ ...part.defaults, drive: 'four-motors' });
  assert.equal(four.ratio, 4);
  assert.equal(four.inputUnlockDeg, 56);
  const model = pieces(p, 'assembled');
  const ring = model.find((x) => x.label.startsWith('Body locking ring'))!;
  assert.deepEqual(JSON.parse(ring.metadata!.TransmissionJSON), t);
  assert.equal(
    transmissionMetadata(p).TransmissionRatio,
    '5:1 input to relative ring/carrier travel',
  );
});

test('Wide 2S release bore clears the extraction path and retains gear-support margins', async () => {
  const { capPosts, capRadius } = await import('../src/parts/rocket-release/lib/gear-carrier');
  const p = part.presets.find((p) => p.id === 'nose-90-86-mg996r-18650-2s-wing-mini')!.parameters;
  const m = layout(p);
  const liPo = layout({ ...p, wingBattery: 'lipo' });
  assert.ok(Math.abs(liPo.module - 0.50445) < 1e-8, 'Other layouts retain their gear sizes');
  assert.ok(Math.abs(m.driveRadius - 18) < 1e-8);
  for (const a of [0, 90, 180, 270]) {
    const [x, y] = at(m.driveRadius, a);
    for (const [px, py] of capPosts(p))
      assert.ok(Math.hypot(x - px, y - py) - (m.pinionRadius + m.module) - 2.6 > 1.5);
  }
  assert.ok(
    m.lockRadius - 5 - capRadius(p) > 2,
    'Spring flanges clear the enlarged retaining disk',
  );
  assert.ok(Math.SQRT2 * m.driveRadius - 2 * (m.pinionRadius + m.module) > 0.25);
  const item = pieces(p, 'assembled').find((x) => x.label.startsWith('Body locking ring'))!;
  const model = component(item.shape, item.label, item.color);
  model.updateMatrixWorld(true);
  // Probe the finished mesh along the entire bore, including angles between teeth.
  for (let a = 0; a < 360; a += 1) {
    const [x, y] = at(29.3, a);
    assert.equal(
      new Raycaster(new Vector3(x, y, -200), new Vector3(0, 0, 1), 0, 400).intersectObject(
        model,
        true,
      ).length,
      0,
      `Clear bore at ${a} degrees`,
    );
  }
  assert.ok(
    new Raycaster(new Vector3(32, 0, -200), new Vector3(0, 0, 1), 0, 400).intersectObject(
      model,
      true,
    ).length > 0,
    'Ring still has material outside the teeth',
  );
  model.traverse((o) => {
    if (o instanceof Mesh) o.geometry.dispose();
  });
});

test('2S contacts have fixed outputs and an insulated angled midpoint, with open lay-in slots', async () => {
  const { cylindricalPack, cellDeckBosses, cellBridgePath } =
    await import('../src/parts/rocket-release/lib/wing-cells');
  const { wingLayout, cellLocations } = await import('../src/parts/rocket-release/lib/wing-layout');
  const { material, manufactured } = await import('../src/parts/rocket-release/lib/names');
  const p = part.presets.find((p) => p.id === 'nose-90-86-mg996r-18650-2s-wing-mini')!.parameters;
  const pack = cylindricalPack(p),
    w = wingLayout(p);
  const contacts = pack.filter((p) => p.metadata?.ElectricalNode);
  assert.deepEqual(contacts.map((p) => p.metadata!.ElectricalNode).sort(), ['B+', 'B-', 'B1']);
  for (const contact of contacts) {
    assert.equal(material(contact), 'Ni200');
    assert.equal(manufactured(contact), true, 'Formed contacts require a fabrication drawing');
    assertClosedModel(component(contact.shape, contact.label, contact.color), 12);
  }
  assert.ok(!pack.some((p) => /harness|connector|socket|crimp|cassette|pod|cable/.test(p.label)));
  assert.ok(
    !validateParameters(part, { ...p, lipoTrimX: 3 }, 'assembled').some((e) =>
      e.includes('balance-plug'),
    ),
  );
  const path = cellBridgePath(p);
  assert.deepEqual(
    path.slice(1, 3),
    [
      [-23, -8],
      [-23, 8],
    ],
    'Bridge bypasses the back of the servo',
  );
  const hits = (shape: Shape, origin: number[], direction: number[], far: number) => {
    const model = component(shape, 'slot probe', 0);
    model.updateMatrixWorld(true);
    const count = new Raycaster(
      new Vector3(...origin),
      new Vector3(...direction),
      0,
      far,
    ).intersectObject(model, true).length;
    model.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
    return count;
  };
  const backing = pack.find((p) => p.label.startsWith('2S angled bridge backing'))!.shape;
  const bridge = contacts.find((p) => p.metadata!.ElectricalNode === 'B1')!.shape;
  // Installed nose inverts Z: the plastic begins below the lamella, not over it.
  assert.ok(hits(backing, [-23, 0, w.cellTop + 1.9], [0, 0, 1], 0.2) > 0);
  assert.equal(hits(backing, [-23, 0, w.cellTop + 1.7], [0, 0, 1], 0.2), 0);
  assert.ok(hits(bridge, [-23, 0, w.cellTop + 1.7], [0, 0, 1], 0.2) > 0);
  assert.equal(w.retentionThickness, 3);
  const frame = pack[0].shape;
  cellLocations(p).forEach(([x, y], i) => {
    const target = path[i === 0 ? 1 : 2],
      d = Math.hypot(target[0] - x, target[1] - y);
    for (const distance of [7, 9, 11]) {
      const px = x + ((target[0] - x) * distance) / d,
        py = y + ((target[1] - y) * distance) / d;
      assert.equal(
        hits(cellDeckBosses(p)[i], [px, py, 44], [0, 0, -1], 7),
        0,
        'Disk seat has a through notch, not a drilled lead hole',
      );
    }
    for (let angle = 0; angle < 360; angle += 15) {
      const a = (angle * Math.PI) / 180;
      assert.ok(
        hits(frame, [x + 8 * Math.cos(a), y + 8 * Math.sin(a), w.base + 6], [0, 0, -1], 8) > 0,
        `Cell ${i + 1} retaining ring is continuous at ${angle} degrees`,
      );
    }
    const cup = pack.find((p) =>
      p.label.startsWith(`18650 cell ${i + 1} nose-tip insulating cup`),
    )!;
    assert.equal(
      hits(cup.shape, [x + 8, y, w.base - 4], [0, 0, 1], 13),
      0,
      'Wire can be laid in from the nose-tip side',
    );
    assert.ok(
      hits(frame, [x - 8, y, w.base + 6], [0, 0, -1], 8) > 0,
      'Metal retaining shoulder remains continuous',
    );
  });
});

test('Centered FC heel keeps its load rim while wire passages and circular bores are open', async () => {
  const { wingPieces } = await import('../src/parts/rocket-release/lib/wing-package');
  const { controllerWirePorts } = await import('../src/parts/rocket-release/lib/wing-frame');
  const p = part.presets.find((p) => p.id === 'nose-90-86-mg996r-18650-2s-wing-mini')!.parameters;
  const all = wingPieces(p);
  const model = component(
    all.find((x) => x.label.startsWith('Servo body capture'))!.shape,
    'heel',
    0,
  );
  model.updateMatrixWorld(true);
  const hits = (x: number, y: number) =>
    new Raycaster(new Vector3(x, y, 1), new Vector3(0, 0, 1), 0, 7).intersectObject(model, true)
      .length;
  for (const [x, y] of controllerWirePorts)
    assert.equal(hits(x, y), 0, 'Wire port passes through the heel');
  for (const [x, y] of [
    [0, 0],
    [20, 0],
    [-23, 0],
  ])
    assert.equal(hits(x, y), 0, 'Circular lightening bore passes through the web');
  for (const [x, y] of [
    [10, -8],
    [10, 8],
    [-9, 0],
    [29, 0],
  ])
    assert.ok(hits(x, y) > 0, 'Servo case perimeter remains supported');
  model.traverse((o) => {
    if (o instanceof Mesh) o.geometry.dispose();
  });
});

test('Four FC dampers separate the two metal ends without a through-bolt', async () => {
  const { controllerPieces } = await import('../src/parts/rocket-release/lib/wing-controller');
  const { Box3 } = await import('three');
  const p = part.presets.find((p) => p.id === 'nose-90-86-mg996r-18650-2s-wing-mini')!.parameters;
  const all = controllerPieces(p);
  assert.equal(
    all.filter((x) => x.label.startsWith('WING MINI bonded elastomer damper')).length,
    4,
  );
  assert.equal(all.filter((x) => x.label.startsWith('WING MINI shield isolation pad')).length, 0);
  const bb = (prefix: string) => {
    const model = component(all.find((x) => x.label.startsWith(prefix))!.shape, prefix, 0);
    const bounds = new Box3().setFromObject(model, true);
    model.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
    return bounds;
  };
  for (let i = 1; i <= 4; i++) {
    const lower = bb(`WING MINI damper lower insert ${i}`),
      upper = bb(`WING MINI damper upper stud ${i}`),
      bolt = bb(`WING MINI frame screw ${i}`);
    assert.ok(
      Math.abs(lower.min.z - upper.max.z - 1.1) < 1e-5,
      'Separate inserts retain an elastomer gap',
    );
    assert.ok(bolt.min.z > upper.max.z + 1, 'Frame screw cannot touch the floating end');
  }
});

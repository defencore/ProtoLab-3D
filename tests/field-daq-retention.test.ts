import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import type { Parameters } from '../src/core/types';
import { box, subtract, type Shape } from '../src/core/assembly/boundary/shapes';
import {
  initializeManifoldGeometry,
  manifoldBoundaryComponent,
} from '../src/core/assembly/manifold-boundary';
import { disposeModel } from '../src/core/mechanical';
import { defaults } from '../src/parts/field-daq-enclosure/configurator';
import { layout } from '../src/parts/field-daq-enclosure/lib/layout';
import { pieces } from '../src/parts/field-daq-enclosure/lib/model';
import {
  boardRetention,
  retentionLayout,
  keyBody,
  keyLatch,
  keyPose,
  innerCornerSeats,
} from '../src/parts/field-daq-enclosure/lib/board-retention';

before(initializeManifoldGeometry);

const cases = [
  { boardThickness: 1.2, fitClearance: 0.15 },
  { boardThickness: 1.6, fitClearance: 0.25 },
  { boardThickness: 2, fitClearance: 0.5 },
];
const parameters = (extra: Parameters = {}): Parameters => ({
  ...defaults,
  showReferences: false,
  ...extra,
});
const shifted = (child: Shape, x = 0, y = 0, z = 0): Shape => ({
  kind: 'transform',
  child,
  translation: [x, y, z],
  rotation: [0, 0, 0],
});
const volumes = new Map<string, number>();

function volume(shape: Shape): number {
  const key = JSON.stringify(shape),
    saved = volumes.get(key);
  if (saved !== undefined) return saved;
  const model = manifoldBoundaryComponent(shape, 'Central PCB retention witness', 0xffffff);
  try {
    let total = 0;
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const positions = object.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i += 3) {
        const [a, b, c] = [0, 1, 2].map((n) => new Vector3().fromBufferAttribute(positions, i + n));
        total += a.dot(b.cross(c)) / 6;
      }
    });
    volumes.set(key, total);
    return total;
  } finally {
    disposeModel(model);
  }
}

function overlap(a: Shape, b: Shape) {
  return Math.max(0, volume(a) - volume(subtract(a, b)));
}
function substrate(p: Parameters, index: number, x = 0, z = 0): Shape {
  const d = layout(p),
    b = d.boards[index];
  return box([b.length, b.width, d.boardThickness], [b.x + x, b.y, d.boardZ + z]);
}

function components(shape: Shape): number {
  const model = manifoldBoundaryComponent(shape, 'Connected retention solid', 0xffffff);
  const parents = new Map<string, string>();
  const root = (key: string): string => {
    if (!parents.has(key)) parents.set(key, key);
    const p = parents.get(key)!;
    if (p !== key) parents.set(key, root(p));
    return parents.get(key)!;
  };
  try {
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const p = object.geometry.getAttribute('position');
      for (let i = 0; i < p.count; i += 3) {
        const ids = [0, 1, 2].map((n) => `${p.getX(i + n)},${p.getY(i + n)},${p.getZ(i + n)}`);
        for (const id of ids.slice(1)) parents.set(root(id), root(ids[0]));
      }
    });
    return new Set([...parents.keys()].map(root)).size;
  } finally {
    disposeModel(model);
  }
}

test('The removable key and raised base features each form one connected positive solid', () => {
  const p = parameters(),
    r = boardRetention(p);
  for (const shape of [r.base, r.key, keyBody(p), keyLatch(p), keyPose(p, 0, 0.9)]) {
    assert.ok(volume(shape) > 0);
    assert.equal(components(shape), 1);
  }
  assert.equal(r.pads.length, 4);
});

test('The lifted latch permits vertical entry followed by the full three-millimetre locking stroke', () => {
  for (const c of cases) {
    const p = parameters(c),
      base = pieces(p).find((piece) => piece.id === 'base')!.shape;
    const fixtures = [base, substrate(p, 0), substrate(p, 1)];
    for (const z of [12, 6, 3, 1, 0]) {
      const entering = shifted(keyPose(p, -3, 0.9), 0, 0, z);
      for (const fixed of fixtures)
        assert.ok(
          overlap(fixed, entering) < 0.01,
          `Entry blocked at Z${z}, t/c ${c.boardThickness}/${c.fitClearance}`,
        );
    }
    for (let step = 0; step <= 12; step++) {
      const y = -3 + step / 4,
        sliding = keyPose(p, y, 0.9);
      for (const fixed of fixtures)
        assert.ok(overlap(fixed, sliding) < 0.01, `Locking stroke blocked at Y${y}`);
    }
  }
});

test('Bayonet shoulders retain the key upward and the relaxed latch blocks its reverse stroke', () => {
  for (const c of cases) {
    const p = parameters(c),
      base = pieces(p).find((piece) => piece.id === 'base')!.shape;
    assert.ok(overlap(base, keyPose(p)) < 0.01);
    assert.ok(
      overlap(base, shifted(keyPose(p), 0, 0, 0.1)) > 1,
      'Base-owned roofs must block upward key removal',
    );
    assert.ok(
      overlap(base, keyPose(p, -0.3)) > 0.1,
      'The unbent latch must provide a positive reverse stop',
    );
    assert.ok(
      overlap(base, keyPose(p, -0.3, 0.9)) < 0.01,
      'Intentional leaf lifting must release that stop',
    );
  }
});

test('Central grooves retain both PCB inner edges in X and Z with the lid completely absent', () => {
  for (const c of cases) {
    const p = parameters(c),
      d = layout(p),
      key = keyPose(p);
    for (const [i, board] of d.boards.entries()) {
      assert.ok(overlap(key, substrate(p, i)) < 0.01);
      assert.ok(
        overlap(key, substrate(p, i, board.direction * (d.clearance + 0.1))) > 0.5,
        `${board.id}: centre web must stop inward travel`,
      );
      assert.ok(
        overlap(key, substrate(p, i, 0, d.clearance + 0.1)) > 0.5,
        `${board.id}: groove roof must stop inner-edge lifting`,
      );
    }
  }
});

test('Open triangular seats stop lateral movement locally at all four inner PCB corners', () => {
  for (const c of cases) {
    const p = parameters(c),
      d = layout(p),
      seats = innerCornerSeats(p);
    assert.equal(seats.length, 4);
    for (const [index, board] of d.boards.entries()) {
      for (const [sideIndex, side] of ([-1, 1] as const).entries()) {
        // Only a 3 × 3 mm inner-corner witness: the good outer pockets cannot mask a missing stop.
        const witness = box(
          [3, 3, d.boardThickness],
          [
            board.direction === 1 ? board.innerX - 3 : board.innerX,
            side === 1 ? 37 : -40,
            d.boardZ,
          ],
        );
        const seat = seats[index * 2 + sideIndex];
        assert.ok(overlap(seat, witness) < 0.001, `${board.id} ${side}: nominal corner must fit`);
        assert.ok(
          overlap(seat, shifted(witness, 0, side * (d.clearance + 0.2))) > 0.01,
          `${board.id} ${side}: inner-corner Y stop must work independently of outer pockets`,
        );
      }
    }
  }
});

test('Inner triangular guides leave the existing key release and bare-board service paths clear', () => {
  for (const c of cases) {
    const p = parameters(c),
      d = layout(p),
      seats = innerCornerSeats(p);
    for (const seat of seats) {
      for (let step = 0; step <= 12; step++)
        assert.ok(
          overlap(seat, keyPose(p, (-3 * step) / 12, 0.9)) < 0.001,
          'Guide blocks key unlocking',
        );
      for (const z of [0, 0.5, 2, 6, 12, 25])
        assert.ok(
          overlap(seat, shifted(keyPose(p, -3, 0.9), 0, 0, z)) < 0.001,
          'Guide blocks key lifting',
        );
      for (const [index, board] of d.boards.entries()) {
        for (let step = 0; step <= 19; step++)
          assert.ok(
            overlap(seat, substrate(p, index, (board.direction * 9.5 * step) / 19)) < 0.001,
            'Guide blocks PCB withdrawal',
          );
        for (const z of [0, 0.5, 2, 6, 12])
          assert.ok(
            overlap(seat, substrate(p, index, board.direction * 9.5, z)) < 0.001,
            'Guide blocks PCB lifting',
          );
      }
    }
  }
});

test('The lid backup blocks the reverse key stroke even if the leaf is intentionally lifted', () => {
  const p = parameters(),
    r = boardRetention(p);
  assert.ok(overlap(r.lidStop, r.key) < 0.01);
  assert.ok(overlap(r.lidStop, keyPose(p, -0.3, 0.9)) > 0.05);
});

test('The key and pad locking sweep stays inside the four confirmed contact lands', () => {
  const p = parameters(),
    d = retentionLayout(p),
    r = boardRetention(p);
  for (const cy of d.capCentres) {
    const landCentre = cy < 0 ? -24 : 24;
    assert.ok(cy - 3 - 3 >= landCentre - 5);
    assert.ok(cy + 3 <= landCentre + 5);
  }
  for (const pad of r.pads) {
    const model = manifoldBoundaryComponent(pad.shape, 'Retainer pad', 0xffffff);
    try {
      model.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(model, true);
      assert.ok(bounds.min.x >= -38 && bounds.max.x <= -20);
      assert.ok(Math.abs(bounds.max.z - (d.boardTop + 0.96)) < 0.001);
      assert.ok(Math.abs(bounds.min.z - (d.boardTop - 0.24)) < 0.001);
    } finally {
      disposeModel(model);
    }
  }
});

test('After removing the key, either bare PCB still withdraws 9.5 mm and lifts clear', () => {
  for (const c of cases) {
    const p = parameters(c),
      d = layout(p);
    const base = pieces(p).find((piece) => piece.id === 'base')!.shape;
    for (const board of d.boards) {
      const path = box(
        [board.length, board.width, d.boardThickness + 12],
        [board.x + board.direction * 9.5, board.y, d.boardZ],
      );
      assert.ok(
        overlap(base, path) < 0.1,
        'Fixed retention features must not block the bare-PCB service path',
      );
    }
  }
});

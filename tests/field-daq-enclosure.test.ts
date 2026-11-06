import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import type { Shape } from '../src/core/assembly/boundary/shapes';
import { box, cylinder, prism, subtract } from '../src/core/assembly/boundary/shapes';
import {
  initializeManifoldGeometry,
  manifoldBoundaryComponent,
} from '../src/core/assembly/manifold-boundary';
import { disposeModel } from '../src/core/mechanical';
import { componentGeometry } from '../src/core/assembly/detail-instances';
import { roundedRectPoints, roundedRectShape } from '../src/core/analytic-geometry';
import { validateParameters } from '../src/core/validation';
import type { Parameters } from '../src/core/types';
import part from '../src/parts/field-daq-enclosure/part';
import {
  pieces,
  hardware,
  configuredPieces,
  sensorOpening,
  libraries,
} from '../src/parts/field-daq-enclosure/lib/model';
import { layout } from '../src/parts/field-daq-enclosure/lib/layout';
import { pieces as connectorPieces } from '../src/parts/waterproof-connector/lib/model';
import { baseNutBoss } from '../src/parts/field-daq-enclosure/lib/closure';

before(initializeManifoldGeometry);

const parameters = (extra: Parameters = {}): Parameters => ({ ...part.defaults, ...extra });

function volume(shape: Shape): number {
  const model = manifoldBoundaryComponent(shape, 'DAQ material witness', 0xffffff);
  try {
    let result = 0;
    model.traverse((item) => {
      if (!(item instanceof Mesh)) return;
      const positions = item.geometry.getAttribute('position');
      const index = item.geometry.index;
      for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
        const [a, b, c] = [0, 1, 2].map((j) =>
          new Vector3().fromBufferAttribute(positions, index ? index.getX(i + j) : i + j),
        );
        result += a.dot(b.cross(c)) / 6;
      }
    });
    return result;
  } finally {
    disposeModel(model);
  }
}

function overlap(first: Shape, second: Shape): number {
  return Math.max(0, volume(first) - volume(subtract(first, second)));
}

/** A conservative annulus wholly inside the M3 nut's actual chamfered top bearing face. */
function nutBearing(x: number, y: number, nutBottom: number): Shape {
  const z = nutBottom + 2.4 - 0.05;
  return subtract(cylinder(2.4, 0.05, [x, y, z]), cylinder(1.9, 0.07, [x, y, z - 0.01]));
}

function rectangularGland(
  w: number,
  h: number,
  r: number,
  width: number,
  z: number,
  height: number,
): Shape {
  return subtract(
    prism(roundedRectPoints(roundedRectShape(w, h, r, z, height)), height, z),
    prism(
      roundedRectPoints(
        roundedRectShape(w - 2 * width, h - 2 * width, r - width, z - 0.1, height + 0.2),
      ),
      height + 0.2,
      z - 0.1,
    ),
  );
}

test('DAQ presets expose valid two, three, four and blank interchangeable cassettes', () => {
  assert.equal(part.id, 'field-daq-enclosure');
  assert.deepEqual(
    new Set(part.presets.map((preset) => preset.parameters.sensorCount)),
    new Set(['2', '3', '4', 'blank']),
  );
  for (const preset of part.presets)
    for (const state of part.states ?? [])
      assert.deepEqual(
        validateParameters(part, preset.parameters, state.id),
        [],
        `${preset.id}/${state.id}`,
      );
  for (const extra of [
    { sensorCount: '5' },
    { screwLength: '50' },
    { boardThickness: 0.9 },
    { boardThickness: NaN },
    { componentHeight: 26 },
    { fitClearance: 0.1 },
    { sp16Hole: 25 },
    { showReferences: 'yes' },
    { bodyWidth: 115 },
    { bodyWidth: 181 },
    { bodyWidth: NaN },
    { sensorCount: '4', bodyWidth: 116 },
  ] as Parameters[])
    assert.ok(
      validateParameters(part, parameters(extra), 'assembled').length,
      JSON.stringify(extra),
    );
});

test('Inspection references do not change the manufactured enclosure composition', () => {
  const visible = parameters();
  const hidden = parameters({ showReferences: false, componentHeight: 5 });
  assert.deepEqual(part.composition!(visible), part.composition!(hidden));
  assert.ok(part.composition!(visible).components.length >= 4);
  assert.ok(
    part.composition!(visible).components.every((component) => component.supply !== 'reference'),
  );
  assert.ok(
    configuredPieces(visible, 'assembled').some((piece) => piece.component.supply === 'reference'),
  );
  assert.ok(
    configuredPieces(hidden, 'assembled').every((piece) => piece.component.supply !== 'reference'),
  );
  if (part.identityParameters)
    assert.deepEqual(part.identityParameters(visible), part.identityParameters(hidden));
});

test('Closure hardware keeps valid physical states through composition and inspection views', () => {
  for (const screwLength of ['25', '30']) {
    const p = parameters({ screwLength });
    const physical = hardware(p).map((piece) => piece.component);
    assert.equal(physical.length, 12);
    assert.equal(physical.filter((component) => component.libraryId === 'bolt-screw').length, 4);
    assert.equal(physical.filter((component) => component.libraryId === 'hex-nut').length, 4);
    assert.equal(physical.filter((component) => component.libraryId === 'washer').length, 4);
    for (const component of physical) {
      const target = libraries.find((library) => library.id === component.libraryId)!;
      assert.equal(component.state, 'default', component.name);
      assert.deepEqual(
        validateParameters(target, component.parameters, component.state),
        [],
        component.name,
      );
      assert.deepEqual(
        part.composition!(p).components.find((item) => item.id === component.id),
        component,
      );
      for (const state of ['assembled', 'open', 'board-service', 'exploded'])
        assert.deepEqual(
          configuredPieces(p, state).find((piece) => piece.component.id === component.id)!
            .component,
          component,
          `${component.name}/${state} retains its physical definition and installed placement`,
        );
    }
  }
});

test('Changing the sensor cassette preserves the other enclosure details', () => {
  const original = pieces(parameters({ bodyWidth: 164 }));
  for (const sensorCount of ['3', '4', 'blank']) {
    const changed = pieces(parameters({ sensorCount, bodyWidth: 164 }));
    for (const id of ['base', 'wall', 'lid'])
      assert.deepEqual(
        changed.find((piece) => piece.id === id)?.shape,
        original.find((piece) => piece.id === id)?.shape,
        `${sensorCount}: ${id} must remain interchangeable`,
      );
    assert.notDeepEqual(
      changed.find((piece) => piece.id === 'panel')?.shape,
      original.find((piece) => piece.id === 'panel')?.shape,
    );
  }
});

test('Actual PCB substrate envelopes clear the hard retention parts at both thickness limits', () => {
  for (const boardThickness of [1.2, 2]) {
    const p = parameters({ boardThickness, showReferences: false });
    const hardParts = pieces(p).filter((piece) =>
      ['base', 'wall', 'lid', 'panel', 'board-retainer'].includes(piece.id),
    );
    assert.equal(hardParts.length, 5);
    for (const [label, substrate] of [
      ['PSU', box([60, 80, boardThickness], [-94, -40, 8])],
      ['MCU/ADC', box([120, 80, boardThickness], [-24, -40, 8])],
    ] as const)
      for (const piece of hardParts)
        assert.ok(
          overlap(piece.shape, substrate) < 0.1,
          `${label} ${boardThickness} mm: ${piece.id} intrudes into the substrate`,
        );
  }
});

test('Maximum-height components fit the central PCB regions outside retention and connector zones', () => {
  const p = parameters({ boardThickness: 2, componentHeight: 25, showReferences: false });
  const hardParts = pieces(p).filter((piece) =>
    ['base', 'wall', 'lid', 'panel', 'board-retainer'].includes(piece.id),
  );
  for (const [label, region] of [
    ['PSU', box([46, 64, 25], [-84, -32, 10])],
    ['MCU/ADC', box([104, 64, 25], [-20, -32, 10])],
  ] as const)
    for (const piece of hardParts)
      assert.ok(
        overlap(piece.shape, region) < 0.1,
        `${label}: ${piece.id} blocks the 25 mm component envelope`,
      );
});

test('The five hard enclosure details assemble without positive material intersections', () => {
  for (const [bodyWidth, sensorCount] of [
    [116, '3'],
    [164, '4'],
  ] as const) {
    const p = parameters({ sensorCount, bodyWidth, showReferences: false });
    const hardParts = pieces(p).filter((piece) =>
      ['base', 'wall', 'lid', 'panel', 'board-retainer'].includes(piece.id),
    );
    for (let i = 0; i < hardParts.length; i++)
      for (let j = i + 1; j < hardParts.length; j++)
        assert.ok(
          overlap(hardParts[i].shape, hardParts[j].shape) < 0.1,
          `W${bodyWidth} ${hardParts[i].id}/${hardParts[j].id}: hard surfaces interfere`,
        );
  }
});

test('Both M3 screw choices fully cross their nuts and remain clear of the blind base floor', () => {
  for (const bodyWidth of [116, 164])
    for (const screwLength of ['25', '30']) {
      const p = parameters({ screwLength, bodyWidth, showReferences: false });
      const d = layout(p);
      assert.ok(d.screwTip < d.nutBottom - 0.8, 'The screw must cross the full nut');
      assert.ok(d.screwTip > 6.2, 'The screw must not reach the closed blind-well floor');
      assert.ok(
        d.bossTop > d.nutBottom + d.nutHeight,
        'The top-loaded nut pocket needs insertion depth',
      );
      const hardParts = pieces(p).filter((piece) => ['base', 'wall', 'lid'].includes(piece.id));
      for (const [x, y] of d.screwAxes) {
        const shaft = cylinder(1.5, d.screwLength, [x, y, d.screwTip]);
        for (const piece of hardParts)
          assert.ok(
            overlap(piece.shape, shaft) < 0.1,
            `${screwLength} mm screw ${x},${y} hits ${piece.id}`,
          );
      }
    }
});

test('Individual printing views place the selected detail directly on the print bed', () => {
  for (const [bodyWidth, sensorCount] of [
    [116, '3'],
    [164, '4'],
  ] as const)
    for (const state of [
      'base',
      'wall',
      'lid',
      'panel',
      'retainer',
      'gasket',
      'fit-coupon',
      'retention-coupon',
    ]) {
      const p = parameters({ bodyWidth, sensorCount, showReferences: false });
      const model = part.buildGeometry(p, state);
      try {
        model.updateMatrixWorld(true);
        const bounds = new Box3().setFromObject(model, true);
        assert.ok(
          Math.abs(bounds.min.z) < 0.001,
          `${state}: first material starts at Z${bounds.min.z}`,
        );
        const size = bounds.getSize(new Vector3());
        assert.ok(size.x <= 256 && size.y <= 256, `${state} must fit the nominal P2S plate`);
        assert.ok(size.z > 0 && size.z < 50, `${state} must have a finite printable height`);
      } finally {
        disposeModel(model);
      }
    }
});

test('Opening the lid keeps the key and pads locked; service moves them together', () => {
  const p = parameters({ showReferences: false });
  const assembled = configuredPieces(p, 'assembled');
  assert.equal(assembled.length, 28);
  for (const state of ['open', 'board-service']) {
    const inspected = configuredPieces(p, state);
    for (const id of [
      'board-retainer',
      ...Array.from({ length: 4 }, (_, i) => `clamp-pad-${i + 1}`),
    ]) {
      const original = assembled.find((v) => v.component.id === id)!;
      const current = inspected.find((v) => v.component.id === id)!;
      assert.deepEqual(
        current.component,
        original.component,
        `${id}: inspection must preserve the manufactured definition`,
      );
      assert.deepEqual(current.position, state === 'open' ? [0, 0, 0] : [0, -3, 30]);
    }
    assert.equal(inspected.find((v) => v.component.id === 'lid')!.position?.[2], 60);
  }
});

test('Open-lid groove key resists sideways PCB movement without relying on pad friction', () => {
  for (const fitClearance of [0.15, 0.5]) {
    const p = parameters({ fitClearance, showReferences: false });
    const d = layout(p);
    const base = pieces(p).find((piece) => piece.id === 'base')!.shape;
    const key = pieces(p).find((piece) => piece.id === 'board-retainer')!.shape;
    for (const board of d.boards) {
      for (const direction of [-1, 1]) {
        const displaced = box(
          [board.length, board.width, d.boardThickness],
          [board.x, board.y + direction * (fitClearance + 0.6), d.boardZ],
        );
        assert.ok(overlap(base, displaced) > 0.5, `${board.id}: no positive Y${direction} locator`);
      }
      const displaced = box(
        [board.length, board.width, d.boardThickness],
        [board.x + board.direction * (fitClearance + 0.6), board.y, d.boardZ],
      );
      assert.ok(overlap(key, displaced) > 0.5, `${board.id}: no positive inner-edge X locator`);
    }
  }
});

test('A blank sensor cassette remains a closed printable solid without connector apertures', () => {
  const blank = pieces(parameters({ sensorCount: 'blank', bodyWidth: 164 })).find(
    (piece) => piece.id === 'panel',
  )!;
  assert.ok(volume(blank.shape) > 0);
  const perforated = pieces(parameters({ sensorCount: '4', bodyWidth: 164 })).find(
    (piece) => piece.id === 'panel',
  )!;
  assert.ok(volume(blank.shape) > volume(perforated.shape) + 1000);
});

test('Either PCB can withdraw 9.5 mm into the centre gap and then lift clear of its envelopes', () => {
  for (const boardThickness of [1.2, 2]) {
    const p = parameters({ boardThickness, fitClearance: 0.5, showReferences: false });
    const d = layout(p);
    const base = pieces(p).find((piece) => piece.id === 'base')!.shape;
    for (const board of d.boards) {
      const shiftedX = board.x + board.direction * 9.5;
      const liftPath = box(
        [board.length, board.width, boardThickness + 12],
        [shiftedX, board.y, d.boardZ],
      );
      assert.ok(
        overlap(base, liftPath) < 0.1,
        `${board.id}: the outer envelopes block lifting after withdrawal`,
      );
      const peer = d.boards.find((candidate) => candidate.id !== board.id)!;
      const peerGap =
        board.direction > 0
          ? peer.x - (shiftedX + board.length)
          : shiftedX - (peer.x + peer.length);
      assert.ok(Math.abs(peerGap - 0.5) < 1e-9, `${board.id}: withdrawal reaches the adjacent PCB`);
      const peerSubstrate = box(
        [peer.length, peer.width, boardThickness],
        [peer.x, peer.y, d.boardZ],
      );
      assert.ok(
        overlap(liftPath, peerSubstrate) < 0.1,
        `${board.id}: lift path hits the adjacent PCB`,
      );
    }
  }
});

test('SP20 apertures preserve the source opposing flats in wall and printing orientations', () => {
  for (const axis of ['y', 'z'] as const) {
    const model = manifoldBoundaryComponent(
      sensorOpening(20.5, 3, [0, 0, 0], axis),
      'SP20 aperture',
      0xffffff,
    );
    try {
      model.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(model, true);
      const size = bounds.getSize(new Vector3());
      assert.ok(Math.abs(size.x - 20.5) < 1e-4);
      assert.ok(Math.abs((axis === 'y' ? size.z : size.y) - 19.5) < 1e-4);
      assert.ok(Math.abs((axis === 'y' ? bounds.min.z : bounds.min.y) + 9.75) < 1e-4);
      assert.ok(Math.abs((axis === 'y' ? bounds.max.z : bounds.max.y) - 9.75) < 1e-4);
    } finally {
      disposeModel(model);
    }
  }
  const p = parameters({ sp20Hole: 20.5 });
  const d = layout(p);
  const panel = pieces(p).find((piece) => piece.id === 'panel')!.shape;
  for (const y of d.sensorYs) {
    for (const z of [14.9, 34.85]) {
      const flatLand = box([1, 0.5, 0.25], [108, y - 0.25, z]);
      assert.ok(
        overlap(panel, flatLand) > 0.12,
        'Both anti-rotation flats must retain material inside the round outline',
      );
    }
    assert.ok(
      overlap(panel, box([1, 1, 1], [108, y - 0.5, 24.5])) < 0.01,
      'The centre of each aperture must remain open',
    );
  }
});

test('The existing library SP20 socket body and retaining nut clear the selected cassette', () => {
  for (const [bodyWidth, sensorCount] of [
    [116, '2'],
    [116, '3'],
    [164, '4'],
  ] as const) {
    const p = parameters({ sensorCount, bodyWidth, sp20Hole: 20.5 });
    const reference = configuredPieces(p, 'assembled').find(
      (piece) => piece.component.id === 'reference-sp20-1',
    )!;
    assert.ok(reference);
    assert.equal(reference.component.libraryId, 'waterproof-connector');
    assert.equal(reference.component.parameters.model, 'sp20-4-panel-socket');
    assert.equal(reference.component.parameters.panelThickness, 3);
    assert.equal(reference.component.supply, 'reference');
    assert.equal(reference.component.placement.translation[0], 110);
    assert.ok(layout(p).sensorYs.includes(reference.component.placement.translation[1]));
    const panel = pieces(p).find((piece) => piece.id === 'panel')!.shape;
    const critical = connectorPieces(reference.component.parameters, 'assembled').filter((piece) =>
      /Panel socket body|Inner retaining nut/.test(piece.label),
    );
    assert.equal(critical.length, 2);
    for (const piece of critical) {
      const installed: Shape = {
        kind: 'transform',
        child: {
          kind: 'transform',
          child: piece.shape,
          translation: [0, 0, piece.z ?? 0],
          rotation: [0, 0, piece.angle ?? 0],
        },
        translation: reference.component.placement.translation,
        rotation: reference.component.placement.rotation,
      };
      assert.ok(
        overlap(panel, installed) < 0.1,
        `${sensorCount} connectors: ${piece.label} intersects the cassette`,
      );
    }
  }
});

test('The end-wall connector openings face opposite narrow ends of both body widths', () => {
  for (const [bodyWidth, sensorCount] of [
    [116, '3'],
    [164, '4'],
  ] as const) {
    const p = parameters({ bodyWidth, sensorCount, showReferences: false });
    const d = layout(p);
    const wall = pieces(p).find((piece) => piece.id === 'wall')!.shape;
    const panel = pieces(p).find((piece) => piece.id === 'panel')!.shape;
    assert.ok(
      overlap(wall, box([1, 1, 1], [-109, -0.5, 24.5])) < 0.01,
      'SP16 opening must cross the X−110 end wall',
    );
    assert.ok(
      overlap(wall, box([1, 1, 1], [-109, 15, 24.5])) > 0.9,
      'Material must remain beside the SP16 opening',
    );
    for (const z of [17, 32.8])
      assert.ok(
        overlap(wall, box([1, 0.5, 0.25], [-109, -0.25, z])) > 0.12,
        'The SP16 opening must retain both flats of its 15.3 mm profile',
      );
    for (const y of d.sensorYs) {
      assert.ok(
        overlap(panel, box([1, 1, 1], [108, y - 0.5, 24.5])) < 0.01,
        'Each SP20 opening must cross the X+110 cassette',
      );
      assert.ok(
        Math.abs(y) + 14.5 <= d.panelWidth / 2 - 3,
        'SP20 collars must fit inside the cassette edges',
      );
    }
  }
});

test('SP16-5 and every SP20 channel use full library connectors with clear mounting bodies', () => {
  for (const [bodyWidth, sensorCount] of [
    [116, '2'],
    [116, '3'],
    [164, '4'],
  ] as const) {
    const p = parameters({ bodyWidth, sensorCount });
    const source = pieces(p);
    const references = configuredPieces(p, 'assembled').filter((piece) =>
      /^reference-sp(?:16|20)/.test(piece.component.id),
    );
    assert.equal(references.length, Number(sensorCount) + 1);
    const sp16 = references.find((piece) => piece.component.id === 'reference-sp16')!;
    assert.equal(sp16.component.parameters.model, 'sp16-5-panel-socket');
    assert.deepEqual(sp16.component.placement.translation, [-110, 0, 25]);
    for (const reference of references) {
      assert.equal(reference.component.libraryId, 'waterproof-connector');
      assert.equal(reference.component.supply, 'reference');
      if (reference.component.id === 'reference-sp20-2')
        assert.equal(reference.component.parameters.model, 'sp20-3-panel-socket');
      const hardParts = source.filter((piece) =>
        ['base', 'wall', 'lid', 'panel', 'board-retainer'].includes(piece.id),
      );
      const critical = connectorPieces(reference.component.parameters, 'assembled').filter(
        (piece) => /socket body|retaining nut/i.test(piece.label),
      );
      assert.equal(critical.length, 2);
      for (const piece of critical) {
        const installed: Shape = {
          kind: 'transform',
          child: piece.shape,
          translation: reference.component.placement.translation,
          rotation: reference.component.placement.rotation,
        };
        for (const hard of hardParts)
          assert.ok(
            overlap(hard.shape, installed) < 0.1,
            `${reference.component.id}: ${piece.label} intersects ${hard.id}`,
          );
      }
    }
  }
});

test('Base-owned nut roofs stop upward bearing motion for both screw lengths and body widths', () => {
  for (const bodyWidth of [116, 164])
    for (const screwLength of ['25', '30']) {
      const p = parameters({ bodyWidth, screwLength, showReferences: false });
      const d = layout(p);
      for (const [x, y] of d.screwAxes) {
        const boss = baseNutBoss(p, x, y);
        const bearing = nutBearing(x, y, d.nutBottom + 0.25);
        assert.ok(
          overlap(boss, bearing) < 0.01,
          'The loaded nut bearing face must seat below its roof',
        );
        const raised: Shape = {
          kind: 'transform',
          child: bearing,
          translation: [0, 0, 0.1],
          rotation: [0, 0, 0],
        };
        assert.ok(overlap(boss, raised) > 0.25, 'Upward nut tension must meet a base-owned roof');
      }
    }
});

test('The actual base cannot pull downward off the installed M3 nuts', () => {
  for (const bodyWidth of [116, 164])
    for (const screwLength of ['25', '30']) {
      const p = parameters({ bodyWidth, screwLength, showReferences: false });
      const d = layout(p);
      const base = pieces(p).find((piece) => piece.id === 'base')!.shape;
      const nuts = configuredPieces(p, 'assembled').filter((piece) =>
        /^nut-/.test(piece.component.id),
      );
      assert.equal(nuts.length, 4);
      const fallingBase: Shape = {
        kind: 'transform',
        child: base,
        translation: [0, 0, -0.1],
        rotation: [0, 0, 0],
      };
      for (const nut of nuts) {
        const [x, y, z] = nut.component.placement.translation;
        assert.ok(
          Math.abs(z - d.nutBottom - 0.25) < 1e-8,
          'Hardware must represent the positively seated nut state',
        );
        assert.equal(nut.component.parameters.acrossFlats, 5.5);
        assert.equal(nut.component.parameters.height, 2.4);
        assert.ok(
          overlap(fallingBase, nutBearing(x, y, z)) > 0.25,
          'A loaded nut must mechanically retain the base',
        );
      }
    }
});

test('M3 nuts insert from the inboard side without opening the blind shaft floor', () => {
  for (const fitClearance of [0.15, 0.5])
    for (const y of [-49, 49]) {
      const p = parameters({ fitClearance, showReferences: false });
      const d = layout(p),
        x = 80;
      const boss = baseNutBoss(p, x, y);
      for (const travel of [0, 2, 4, 6, 8]) {
        const cy = y + (y > 0 ? -travel : travel);
        const nut = prism(
          Array.from({ length: 6 }, (_, i): [number, number] => [
            x + (5.5 / Math.sqrt(3)) * Math.cos(Math.PI / 6 + (i * Math.PI) / 3),
            cy + (5.5 / Math.sqrt(3)) * Math.sin(Math.PI / 6 + (i * Math.PI) / 3),
          ]),
          2.4,
          d.nutBottom + 0.125,
        );
        assert.ok(overlap(boss, nut) < 0.01, 'The side entry must pass the complete nut envelope');
      }
      const floor = cylinder(1.5, 1.5, [x, y, 3.1]);
      assert.ok(
        Math.abs(overlap(boss, floor) - volume(floor)) < 0.01,
        'The shaft well must retain its closed lower floor',
      );
    }
});

test('The cassette is positively stopped before its U-seal can lose nominal compression', () => {
  for (const [bodyWidth, sensorCount] of [
    [116, '3'],
    [164, '4'],
  ] as const) {
    const p = parameters({ bodyWidth, sensorCount, fitClearance: 0.5, showReferences: false });
    const source = pieces(p);
    const panel = source.find((piece) => piece.id === 'panel')!.shape;
    const wall = source.find((piece) => piece.id === 'wall')!.shape;
    const lid = source.find((piece) => piece.id === 'lid')!.shape;
    assert.ok(overlap(wall, panel) < 0.01, 'The nominal panel must seat without a hard collision');
    const outward: Shape = {
      kind: 'transform',
      child: panel,
      translation: [0.01, 0, 0],
      rotation: [0, 0, 0],
    };
    const inward: Shape = {
      kind: 'transform',
      child: panel,
      translation: [-0.11, 0, 0],
      rotation: [0, 0, 0],
    };
    assert.ok(
      overlap(wall, outward) > 0.1,
      'The front guide faces must prevent outward seal relaxation',
    );
    assert.ok(
      overlap(wall, inward) > 0.1,
      'The rear compression rib must limit inward seal over-compression',
    );
    const inwardTilt: Shape = {
      kind: 'transform',
      child: { kind: 'transform', child: panel, translation: [-110, 0, -7], rotation: [0, 0, 0] },
      translation: [110, 0, 7],
      rotation: [0, -0.2, 0],
    };
    assert.ok(
      overlap(lid, inwardTilt) > 0.1,
      'The upper brace must prevent the panel top from tilting away from its U-seal',
    );
  }
});

test('Perimeter gaskets leave gland volume and retain supporting lands beside the nut wells', () => {
  for (const bodyWidth of [116, 164]) {
    const p = parameters({ bodyWidth, fitClearance: 0.5, showReferences: false });
    const d = layout(p),
      source = pieces(p);
    const base = source.find((piece) => piece.id === 'base')!.shape;
    const wall = source.find((piece) => piece.id === 'wall')!.shape;
    const gasket = source.find((piece) => piece.id === 'base-gasket')!.shape;
    const gland = rectangularGland(218, bodyWidth - 2, 9, 2, 2.04, 0.96);
    const fill = volume(gasket) / volume(gland);
    assert.ok(fill > 0.8 && fill < 0.86, `Nominal gland fill ${fill} leaves insufficient volume`);
    const compressedWidth = (d.gasketWidth * d.gasketFree) / d.gasketCompressed;
    for (const [x, y] of d.screwAxes) {
      const centreY = Math.sign(y) * (bodyWidth / 2 - 2);
      const lowY = centreY - compressedWidth / 2;
      const floor = box([2, compressedWidth, 0.1], [x - 1, lowY, 1.94]);
      const land = box([2, compressedWidth, 0.1], [x - 1, lowY, 3.01]);
      assert.ok(
        Math.abs(overlap(base, floor) - volume(floor)) < 0.01,
        'The groove must keep its closed base floor',
      );
      assert.ok(
        Math.abs(overlap(wall, land) - volume(land)) < 0.01,
        'The expanded seal footprint must remain supported beside the nut well',
      );
    }
  }
});

test('Steel head washers bear on hard PETG stops independently of the TPU seals', () => {
  for (const bodyWidth of [116, 164]) {
    const p = parameters({ bodyWidth, showReferences: false });
    const source = pieces(p);
    const lid = source.find((piece) => piece.id === 'lid')!.shape;
    const washers = configuredPieces(p, 'assembled').filter((piece) =>
      /^head-washer-/.test(piece.component.id),
    );
    assert.equal(washers.length, 4);
    for (const washer of washers) {
      assert.equal(washer.component.libraryId, 'washer');
      assert.equal(washer.component.parameters.bore, 3.2);
      assert.equal(washer.component.parameters.outerDiameter, 7);
      assert.equal(washer.component.parameters.thickness, 0.5);
      const model = componentGeometry(libraries, [washer]);
      try {
        model.updateMatrixWorld(true);
        const bounds = new Box3().setFromObject(model, true);
        assert.ok(Math.abs(bounds.min.z - 44.8) < 0.001);
        assert.ok(Math.abs(bounds.max.z - 45.3) < 0.001);
      } finally {
        disposeModel(model);
      }
      const [x, y, z] = washer.component.placement.translation;
      const metal = subtract(
        cylinder(3.5, 0.5, [x, y, z - 0.25]),
        cylinder(1.6, 0.7, [x, y, z - 0.35]),
      );
      assert.ok(
        overlap(lid, metal) < 0.01,
        'The installed washer must seat without penetrating the lid',
      );
      const downward: Shape = {
        kind: 'transform',
        child: metal,
        translation: [0, 0, -0.01],
        rotation: [0, 0, 0],
      };
      assert.ok(overlap(lid, downward) > 0.08, 'A hard bearing ring must stop washer motion');
      const seal = source.find(
        (piece) => piece.id === washer.component.id.replace('head-washer', 'screw-seal'),
      )!.shape;
      const gland = subtract(cylinder(2.9, 0.6, [x, y, 44.2]), cylinder(1.5, 0.8, [x, y, 44.1]));
      assert.ok(
        volume(seal) / volume(gland) < 0.85,
        'The under-washer seal must have room to deform',
      );
    }
  }
});

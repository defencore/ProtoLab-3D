import assert from 'node:assert/strict';
import test from 'node:test';
import {
  Box3,
  DoubleSide,
  Euler,
  Mesh,
  Raycaster,
  Vector3,
  type Group,
  type Object3D,
} from 'three';
import { parts } from '../src/parts';
import { groupBrowseFamilies } from '../src/core/browse-families';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import type { Parameters, PartDefinition } from '../src/core/types';
import type { AssemblyComponent } from '../src/core/product-types';
import { componentGeometry, type ConfiguredPiece } from '../src/core/assembly/detail-instances';
import {
  configuredPieces,
  ethernetKeepout,
  libraries,
  layout,
} from '../src/parts/rocket-camera-nose/lib/model';
import { upsInterface } from '../src/parts/waveshare-ups-3s/part';
import { adapterInterface } from '../src/parts/waveshare-pcie-m2-d/part';

const find = (id: string): PartDefinition => {
  const part = parts.find((candidate) => candidate.id === id);
  assert.ok(part, `Missing registered product ${id}`);
  return part;
};
const nose = () => find('rocket-camera-nose');

async function inspect(p: Parameters, state: string, check: (model: Group) => void) {
  const part = nose();
  await part.initializeGeometry?.(p, state);
  const model = part.buildGeometry(p, state);
  try {
    model.updateMatrixWorld(true);
    check(model);
  } finally {
    disposeModel(model);
  }
}

async function inspectUnits(
  p: Parameters,
  ids: string[],
  check: (units: Map<string, Object3D>, pieces: ConfiguredPiece[]) => void,
) {
  const pieces = configuredPieces(p, 'assembled').filter((piece) =>
    ids.includes(piece.component.id),
  );
  assert.equal(pieces.length, ids.length, 'all requested physical units are declared');
  await nose().initializeGeometry?.(p, 'assembled');
  const model = componentGeometry(libraries, pieces);
  try {
    model.updateMatrixWorld(true);
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        material.side = DoubleSide;
    });
    check(
      new Map(pieces.map((piece, index) => [piece.component.id, model.children[index]])),
      pieces,
    );
  } finally {
    disposeModel(model);
  }
}

function crossings(root: Object3D, origin: Vector3, direction: Vector3, far = 200): Vector3[] {
  const hits = new Raycaster(origin, direction.clone().normalize(), 0, far).intersectObject(
    root,
    true,
  );
  return hits
    .filter((hit, index) => index === 0 || hit.distance - hits[index - 1].distance > 0.0001)
    .map((hit) => hit.point);
}

function containsPoint(root: Object3D, point: Vector3): boolean {
  return crossings(root, point, new Vector3(1, 0.01234, 0.02345)).length % 2 === 1;
}

function canonical(component: AssemblyComponent) {
  return {
    id: component.id,
    libraryId: component.libraryId,
    parameters: component.parameters,
    state: component.state,
    quantity: component.quantity,
    placement: component.placement,
  };
}

const center = (object: Object3D) =>
  new Box3().setFromObject(object, true).getCenter(new Vector3());

function pointInView(piece: ConfiguredPiece, local = new Vector3()) {
  const rotation = piece.component.placement.rotation.map((angle) => (angle * Math.PI) / 180) as [
    number,
    number,
    number,
  ];
  return local
    .clone()
    .applyEuler(new Euler(...rotation, 'ZYX'))
    .add(new Vector3(...piece.component.placement.translation))
    .applyAxisAngle(new Vector3(0, 0, 1), ((piece.angle ?? 0) * Math.PI) / 180)
    .add(new Vector3(...(piece.position ?? [0, 0, piece.z ?? 0])));
}

function isReleasedServiceLock(p: Parameters, piece: ConfiguredPiece): boolean {
  return (
    p.packaging === 'structural-ogive' &&
    piece.component.libraryId === 'bolt-screw' &&
    (piece.component.id === 'cassette-lock-screw' ||
      (layout(p).guided && piece.component.id.startsWith('body-anchor-screw-')))
  );
}

function mobileParts(p: Parameters) {
  const assembled = configuredPieces(p, 'assembled');
  const extracted = configuredPieces(p, 'extracted');
  const result = new Set<string>();
  for (const original of assembled) {
    const moved = extracted.find((piece) => piece.component.id === original.component.id)!;
    if (pointInView(moved).distanceTo(pointInView(original)) > 1e-6)
      result.add(original.component.id);
  }
  return result;
}

function packagingExamples(includeTPU = false): Parameters[] {
  const representatives = new Map<string, Parameters>();
  for (const preset of nose().presets) {
    const key = String(preset.parameters.packaging ?? 'tandem');
    if (!includeTPU && (key.startsWith('tpu-') || key === 'structural-ogive')) continue;
    const current = representatives.get(key);
    if (!current || Number(preset.parameters.tubeID) < Number(current.tubeID))
      representatives.set(key, preset.parameters);
  }
  return [...representatives.values()];
}

function radialBoundsInSlab(root: Object3D, minimumZ: number, maximumZ: number) {
  let maximum = 0,
    sampled = 0;
  const clip = (points: Vector3[], plane: number, above: boolean): Vector3[] => {
    const result: Vector3[] = [];
    for (let i = 0; i < points.length; i++) {
      const previous = points[(i + points.length - 1) % points.length],
        current = points[i];
      const previousInside = above ? previous.z >= plane : previous.z <= plane;
      const currentInside = above ? current.z >= plane : current.z <= plane;
      if (previousInside !== currentInside)
        result.push(
          new Vector3().lerpVectors(
            previous,
            current,
            (plane - previous.z) / (current.z - previous.z),
          ),
        );
      if (currentInside) result.push(current);
    }
    return result;
  };
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const positions = object.geometry.getAttribute('position'),
      indices = object.geometry.index;
    for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
      const triangle = [0, 1, 2].map((offset) =>
        new Vector3()
          .fromBufferAttribute(positions, indices ? indices.getX(i + offset) : i + offset)
          .applyMatrix4(object.matrixWorld),
      );
      const section = clip(clip(triangle, minimumZ, true), maximumZ, false);
      for (const vertex of section) {
        sampled++;
        maximum = Math.max(maximum, Math.hypot(vertex.x, vertex.y));
      }
    }
  });
  return { maximum, sampled };
}

test('the camera payload is a physical assembly variant within the original nose-cone browse family', () => {
  const plain = find('rocket-nose-cone');
  const payload = nose();
  assert.notEqual(payload.id, plain.id);
  assert.equal(plain.product.kind, 'detail');
  assert.equal(payload.product.kind, 'assembly');
  assert.equal(payload.product.supply, 'manufactured');
  const families = groupBrowseFamilies(parts);
  const family = families.find((candidate) => candidate.members.includes(payload));
  assert.ok(family);
  assert.ok(family.members.includes(plain), 'the plain detail remains independently selectable');
  assert.equal(family.primary.id, plain.id);
  assert.deepEqual(
    payload.states?.map((state) => state.id),
    ['assembled', 'cutaway', 'extracted', 'print-layout'],
  );
  assert.ok(payload.presets.length >= 3);
  for (const [outside, inside] of [
    [90, 86],
    [110, 106],
    [130, 126],
  ])
    assert.ok(
      payload.presets.some(
        (preset) => preset.parameters.tubeOD === outside && preset.parameters.tubeID === inside,
      ),
      `${outside}/${inside}: supported tube interface`,
    );
  for (const preset of payload.presets)
    for (const state of payload.states ?? [])
      assert.deepEqual(
        validateParameters(payload, preset.parameters, state.id),
        [],
        `${preset.id}/${state.id}`,
      );
});

test('the cassette resolves the Pi, power board, three cells, adapter, SSD and camera as reusable physical units', () => {
  const part = nose();
  assert.ok(part.composition);
  for (const preset of part.presets) {
    const components: AssemblyComponent[] = part.composition(preset.parameters).components;
    const byLibrary = (id: string): AssemblyComponent[] =>
      components.filter((component) => component.libraryId === id);
    for (const id of [
      'raspberry-pi',
      'waveshare-ups-3s',
      'waveshare-pcie-m2-d',
      'm2-ssd',
      'board-camera-19',
      'waveshare-ov9281-110',
      'optical-dome-window',
    ])
      assert.equal(
        byLibrary(id).reduce((quantity, component) => quantity + component.quantity, 0),
        id === 'optical-dome-window' && ['structural-90-86', 'ov9281-90-86'].includes(preset.id)
          ? 0
          : id === 'optical-dome-window' && preset.parameters.cameraSetup === 'dual'
            ? 2
            : id === 'board-camera-19' && preset.parameters.cameraSetup === 'ov9281'
              ? 0
              : id === 'waveshare-ov9281-110' && preset.parameters.cameraSetup === 'camera-19'
                ? 0
                : 1,
        `${preset.id}: ${id}`,
      );
    assert.equal(
      byLibrary('li-ion-cell').reduce((quantity, component) => quantity + component.quantity, 0),
      3,
    );
    assert.equal(byLibrary('raspberry-pi')[0].parameters.model, 'raspberry-pi-5');
    assert.equal(byLibrary('m2-ssd')[0].parameters.format, '2280');
    assert.ok(
      components.some((component) => component.supply === 'manufactured'),
      'reusable mounting details are included',
    );
    assert.equal(
      new Set(components.map((component) => component.id)).size,
      components.length,
      'occurrence identities are unique',
    );
    for (const component of components) {
      const library = find(component.libraryId);
      assert.deepEqual(
        validateParameters(library, component.parameters, component.state),
        [],
        `${preset.id}/${component.id}`,
      );
    }
  }
});

test('the Pi Ethernet port faces toward the nose while the camera optical axis remains forward', () => {
  const part = nose();
  for (const preset of part.presets) {
    const components = part.composition!(preset.parameters).components;
    for (const [libraryId, localForward] of [
      ['raspberry-pi', new Vector3(1, 0, 0)],
      ['board-camera-19', new Vector3(0, 0, 1)],
    ] as const) {
      const product = components.find((component) => component.libraryId === libraryId);
      if (!product) {
        assert.equal(preset.parameters.cameraSetup, 'ov9281');
        continue;
      }
      const angles = product.placement.rotation.map((angle) => (angle * Math.PI) / 180) as [
        number,
        number,
        number,
      ];
      const actual = localForward.clone().applyEuler(new Euler(...angles, 'ZYX'));
      assert.ok(
        actual.distanceTo(new Vector3(0, 0, 1)) < 1e-12,
        `${preset.id}: ${libraryId} faces +Z`,
      );
    }
  }
});

test('the body and shoulder inputs reject collapsed shells and an undersized electronics bay', () => {
  const part = nose();
  const baseline = part.presets.find(
    (preset) => preset.parameters.packaging === 'tandem',
  )!.parameters;
  const invalid: Parameters[] = [
    { tubeID: baseline.tubeOD },
    { tubeID: Number(baseline.tubeOD) + 1 },
    { wall: Number(baseline.tubeID) / 2 },
    { shoulderLength: 40 },
    { shoulderClearance: Number(baseline.tubeID) - 1 },
  ];
  for (const change of invalid)
    assert.ok(
      validateParameters(part, { ...baseline, ...change }, 'assembled').length > 0,
      JSON.stringify(change),
    );
});

test('inspection states preserve canonical occurrence identities through lock release and axial cassette withdrawal', () => {
  const part = nose();
  for (const preset of part.presets) {
    const p = preset.parameters;
    const assembled = configuredPieces(p, 'assembled');
    for (const state of ['cutaway', 'extracted']) {
      const viewed = configuredPieces(p, state);
      assert.deepEqual(
        viewed.map((piece) => canonical(piece.component)),
        assembled.map((piece) => canonical(piece.component)),
        `${preset.id}/${state}: physical specification stays canonical`,
      );
    }
    const mobile = mobileParts(p);
    const extracted = configuredPieces(p, 'extracted');
    const pi = assembled.find((piece) => piece.component.libraryId === 'raspberry-pi')!;
    const movedPi = extracted.find((piece) => piece.component.id === pi.component.id)!;
    const delta = pointInView(movedPi).sub(pointInView(pi));
    assert.ok(
      Math.abs(delta.x) < 1e-9 && Math.abs(delta.y) < 1e-9 && delta.z < 0,
      'cassette withdraws axially through the rear',
    );
    for (const original of assembled) {
      const moved = extracted.find((piece) => piece.component.id === original.component.id)!;
      const actual = pointInView(moved).sub(pointInView(original));
      const expected = isReleasedServiceLock(p, original)
        ? new Vector3(
            original.component.id.startsWith('body-anchor-screw-')
              ? Math.sign(original.component.placement.translation[0]) * 30
              : 12,
            0,
            0,
          )
        : mobile.has(original.component.id)
          ? delta
          : new Vector3();
      assert.ok(
        actual.distanceTo(expected) < 1e-9,
        `${preset.id}/${original.component.id}: the lock releases radially and the cassette withdraws axially`,
      );
      assert.equal(
        moved.angle ?? 0,
        original.angle ?? 0,
        'withdrawal does not rotate individual parts',
      );
      if (
        [
          'raspberry-pi',
          'waveshare-ups-3s',
          'waveshare-pcie-m2-d',
          'm2-ssd',
          'li-ion-cell',
          'board-camera-19',
        ].includes(original.component.libraryId)
      )
        assert.ok(
          mobile.has(original.component.id),
          `${original.component.libraryId}: belongs to the removable cassette`,
        );
      if (original.component.libraryId === 'optical-dome-window')
        assert.ok(!mobile.has(original.component.id), 'the window stays with the housing');
    }
  }
});

test('the withdrawn Ethernet mouth and its complete service-plug corridor are outside the fixed housing and unobstructed', async () => {
  for (const p of packagingExamples(true)) {
    const pieces = configuredPieces(p, 'extracted');
    const mobile = mobileParts(p);
    const corridor = ethernetKeepout(p);
    assert.equal(corridor.kind, 'box');
    if (corridor.kind !== 'box') return;
    const originalPi = configuredPieces(p, 'assembled').find(
      (piece) => piece.component.libraryId === 'raspberry-pi',
    )!;
    const piIndex = pieces.findIndex((piece) => piece.component.libraryId === 'raspberry-pi');
    const delta = pointInView(pieces[piIndex]).sub(pointInView(originalPi));
    const origin = new Vector3(...corridor.origin).add(delta);
    await inspect(p, 'extracted', (model) => {
      assert.equal(model.children.length, pieces.length);
      const fixed = model.children.filter((_, index) => !mobile.has(pieces[index].component.id));
      const fixedBounds = new Box3();
      for (const object of fixed) fixedBounds.union(new Box3().setFromObject(object, true));
      const piNode = model.children[piIndex];
      let ethernet: Object3D | undefined;
      piNode.traverse((object) => {
        if (object.name.includes('Ethernet RJ45') && object instanceof Mesh) ethernet = object;
      });
      assert.ok(ethernet, 'actual Pi source-derived Ethernet connector is retained');
      const mouth = new Box3().setFromObject(ethernet, true);
      assert.ok(
        mouth.max.z < fixedBounds.min.z - 20,
        'forward-facing mouth is fully below the housing rear plane',
      );
      assert.ok(
        origin.z + corridor.size[2] < fixedBounds.min.z - 10,
        'entire plug boot has room beyond the housing',
      );
      assert.ok(
        corridor.size[0] >= mouth.getSize(new Vector3()).x,
        'plug space covers the connector height',
      );
      assert.ok(
        corridor.size[1] >= mouth.getSize(new Vector3()).y,
        'plug space covers the connector width',
      );
      const obstacles = model.children.filter((_, index) => index !== piIndex);
      for (const x of [0.5, 0.25, 0.75, 0.05, 0.95])
        for (const y of [0.5, 0.25, 0.75, 0.05, 0.95]) {
          const ray: Raycaster = new Raycaster(
            new Vector3(
              origin.x + corridor.size[0] * x,
              origin.y + corridor.size[1] * y,
              origin.z + corridor.size[2] - 0.05,
            ),
            new Vector3(0, 0, -1),
            0,
            corridor.size[2] - 0.1,
          );
          const hits: ReturnType<Raycaster['intersectObjects']> = ray.intersectObjects(
            obstacles,
            true,
          );
          assert.equal(
            hits.length,
            0,
            `service plug cross-section at ${x},${y} remains free of physical parts`,
          );
        }
      const movingBounds = new Box3();
      for (const [index, object] of model.children.entries())
        if (mobile.has(pieces[index].component.id) && !isReleasedServiceLock(p, pieces[index]))
          movingBounds.union(new Box3().setFromObject(object, true));
      const gap = fixedBounds.min.z - movingBounds.max.z;
      assert.ok(
        layout(p).guided ? gap >= 10 - 0.02 : gap > 10,
        'the complete camera and equipment carrier clears the rear opening by at least10mm',
      );
    });
  }
});

test('the board spacers are centered on the actual transformed PCB hole patterns', async () => {
  for (const p of packagingExamples()) {
    const pieces = configuredPieces(p, 'assembled');
    await inspect(p, 'assembled', (model) => {
      const records = [
        {
          library: 'raspberry-pi',
          holes: [-39, 19].flatMap((x) => [-24.5, 24.5].map((y) => [x, y] as [number, number])),
          spacerPrefix: 'pi-frame-spacer-',
        },
        {
          library: 'waveshare-pcie-m2-d',
          holes: adapterInterface.holes.map((h) => [h.x, h.y] as [number, number]),
          spacerPrefix: 'pi-adapter-spacer-',
        },
        {
          library: 'waveshare-ups-3s',
          holes: upsInterface.holes.map((h) => [h.x, h.y] as [number, number]),
          spacerPrefix: 'ups-frame-spacer-',
        },
      ];
      for (const record of records) {
        const board = pieces.find((piece) => piece.component.libraryId === record.library)!;
        const standoffs = pieces
          .map((piece, index) => ({ piece, object: model.children[index] }))
          .filter(({ piece }) => piece.component.id.startsWith(record.spacerPrefix));
        assert.equal(standoffs.length, 4, record.library + ': four physical mounting spacers');
        for (const [x, y] of record.holes) {
          const hole = pointInView(board, new Vector3(x, y, 0));
          const coincident = standoffs.filter(({ object }) => {
            const middle = center(object);
            return Math.hypot(middle.y - hole.y, middle.z - hole.z) < 0.02;
          });
          assert.equal(
            coincident.length,
            1,
            `${record.library}: spacer axis coincides with PCB hole at ${x},${y}`,
          );
        }
      }
      const cameraIndex = pieces.findIndex(
        (piece) => piece.component.libraryId === 'board-camera-19',
      );
      const windowIndex = pieces.findIndex(
        (piece) => piece.component.libraryId === 'optical-dome-window',
      );
      const cameraBounds = new Box3().setFromObject(model.children[cameraIndex], true);
      const windowBounds = new Box3().setFromObject(model.children[windowIndex], true);
      assert.ok(
        windowBounds.min.z - cameraBounds.max.z >= 1,
        'the objective stays clear of the window mounting plane',
      );
      const clamps = pieces.filter(
        (piece) =>
          piece.component.id.startsWith('camera-clamp-') &&
          piece.component.libraryId === 'manufactured-detail',
      );
      assert.equal(
        clamps.length,
        2,
        'split external clamps retain the camera without inventing camera screw holes',
      );
    });
  }
});

test('the removable parts that pass through the deep shoulder stay inside its actual bore', async () => {
  const representatives = new Map<string, Parameters>();
  for (const preset of nose().presets) {
    const key = String(preset.parameters.packaging ?? 'tandem');
    if (key.startsWith('tpu-') || key === 'structural-ogive') continue;
    const current = representatives.get(key);
    if (!current || Number(preset.parameters.tubeID) < Number(current.tubeID))
      representatives.set(key, preset.parameters);
  }
  for (const [mode, p] of representatives) {
    const pieces = configuredPieces(p, 'assembled');
    const mobile = mobileParts(p);
    const boreRadius = (Number(p.tubeID) - Number(p.shoulderClearance)) / 2 - Number(p.wall);
    await inspect(p, 'assembled', (model) => {
      let maximum = 0,
        inspected = 0;
      for (const [index, group] of model.children.entries()) {
        if (!mobile.has(pieces[index].component.id)) continue;
        group.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          const positions = object.geometry.getAttribute('position');
          for (let i = 0; i < positions.count; i++) {
            const point = new Vector3()
              .fromBufferAttribute(positions, i)
              .applyMatrix4(object.matrixWorld);
            if (point.z <= -Number(p.shoulderLength) + 0.05 || point.z >= -0.05) continue;
            inspected++;
            maximum = Math.max(maximum, Math.hypot(point.x, point.y));
          }
        });
      }
      assert.ok(inspected > 100, 'the complete internal cassette geometry is inspected');
      assert.ok(
        maximum + 0.1 < boreRadius,
        `${mode}: removable material radius ${maximum} fits inside shoulder radius ${boreRadius}`,
      );
    });
    const components = nose().composition!(p).components;
    const locks = components.filter((component) => component.id.startsWith('cassette-lock-screw-'));
    const pockets = components.filter((component) => component.id.startsWith('cassette-lock-nut-'));
    assert.equal(locks.length, 3, 'three independently removable rear locks');
    assert.equal(pockets.length, 3, 'three captive housing-side retention nuts');
    for (const screw of locks) {
      const [x, y] = screw.placement.translation;
      assert.ok(
        pockets.some(
          (nut) =>
            Math.hypot(nut.placement.translation[0] - x, nut.placement.translation[1] - y) < 1e-8,
        ),
        'each lock is coaxial with a fixed nut seat',
      );
    }
  }
});

test('sandwich packaging shortens the same tube interface and moves the UPS beside the computer without reversing Ethernet', () => {
  const part = nose();
  const compact = part.presets.filter((preset) => preset.parameters.packaging === 'sandwich');
  assert.ok(
    compact.some((preset) => preset.parameters.tubeOD === 110 && preset.parameters.tubeID === 106),
  );
  assert.ok(
    compact.some((preset) => preset.parameters.tubeOD === 130 && preset.parameters.tubeID === 126),
  );
  for (const preset of compact) {
    const p = preset.parameters;
    const tandem: Parameters = { ...p, packaging: 'tandem', shoulderLength: 240 };
    assert.deepEqual(validateParameters(part, tandem, 'assembled'), []);
    assert.ok(
      Number(p.shoulderLength) < Number(tandem.shoulderLength) - 100,
      'sandwich uses a shallower insertion for the same tube',
    );
    assert.ok(
      part.dimensions(p, 'assembled')[2] < part.dimensions(tandem, 'assembled')[2] - 100,
      'the physical nose assembly is shorter',
    );
    const compactParts = part.composition!(p).components;
    const tandemParts = part.composition!(tandem).components;
    const location = (components: AssemblyComponent[], id: string) =>
      components.find((component) => component.libraryId === id)!.placement.translation;
    const compactPi = location(compactParts, 'raspberry-pi');
    const compactUPS = location(compactParts, 'waveshare-ups-3s');
    const tandemPi = location(tandemParts, 'raspberry-pi');
    const tandemUPS = location(tandemParts, 'waveshare-ups-3s');
    assert.ok(compactUPS[2] > tandemUPS[2] + 100, 'battery section moves forward');
    assert.ok(
      Math.abs(compactUPS[2] - compactPi[2]) < 10,
      'power and computer boards share the same axial region',
    );
    assert.ok(
      Math.abs(compactUPS[2] - compactPi[2]) < Math.abs(tandemUPS[2] - tandemPi[2]) - 100,
      'equipment is concentrated rather than stretched along the bay',
    );
    const rotation = compactParts.find((component) => component.libraryId === 'raspberry-pi')!
      .placement.rotation;
    const forward = new Vector3(1, 0, 0).applyEuler(
      new Euler(
        (rotation[0] * Math.PI) / 180,
        (rotation[1] * Math.PI) / 180,
        (rotation[2] * Math.PI) / 180,
        'ZYX',
      ),
    );
    assert.ok(
      forward.distanceTo(new Vector3(0, 0, 1)) < 1e-12,
      'the compact Pi keeps its nose-facing Ethernet opening',
    );
  }
  const smallTandem = part.presets.find(
    (preset) => preset.parameters.packaging === 'tandem' && preset.parameters.tubeOD === 90,
  )!.parameters;
  const tooSmall: Parameters = { ...smallTandem, packaging: 'sandwich', shoulderLength: 110 };
  assert.ok(
    validateParameters(part, tooSmall, 'assembled').length > 0,
    '90/86 cannot silently accept the wider sandwich stack',
  );
});

function tpuConfiguration(): Parameters {
  const preset = nose().presets.find((candidate) => candidate.id === 'tpu-90-86');
  assert.ok(preset, 'the 90/86 printed TPU cassette is a standalone selectable configuration');
  return preset.parameters;
}

test('the short 90/86 TPU cassette remains selectable and uses one printed carrier with minimal loose hardware', () => {
  const part = nose();
  const p = tpuConfiguration();
  assert.equal(p.packaging, 'tpu-compact');
  assert.equal(p.tubeOD, 90);
  assert.equal(p.tubeID, 86);
  assert.equal(p.noseLength, 75);
  assert.equal(p.shoulderLength, 100);
  assert.equal(p.wall, 1.2);
  assert.equal(p.shoulderClearance, 0.4);
  for (const id of [
    'tube-90-86',
    'tube-110-106',
    'tube-130-126',
    'compact-110-106',
    'compact-130-126',
  ])
    assert.ok(
      part.presets.some((preset) => preset.id === id),
      `${id}: previous physical configuration remains available`,
    );
  const pieces = configuredPieces(p, 'assembled');
  const mobile = mobileParts(p);
  const carriers = pieces.filter(
    (piece) =>
      mobile.has(piece.component.id) &&
      piece.component.supply === 'manufactured' &&
      /TPU/i.test(piece.component.manufacturing?.material ?? ''),
  );
  assert.equal(
    carriers.length,
    1,
    'the removable mounting structure is one manufactured component',
  );
  assert.equal(carriers[0].component.libraryId, 'manufactured-detail');
  assert.match(carriers[0].component.manufacturing?.material ?? '', /TPU/i);
  assert.equal(carriers[0].requireSingleSolid, true, 'native export requires one continuous solid');
  const components: AssemblyComponent[] = part.composition!(p).components;
  assert.ok(
    components.length <= 24,
    'the printed cassette does not retain the separate rigid-frame hardware stack',
  );
  assert.equal(
    components.some((component) => component.libraryId === 'threaded-rod'),
    false,
    'no long M3/M4 tie rods',
  );
  const screws = components.filter((component) => component.libraryId === 'bolt-screw');
  assert.ok(
    screws.reduce((count, screw) => count + screw.quantity, 0) <= 4,
    'at most three window screws and one SSD screw',
  );
  assert.equal(screws.filter((screw) => screw.id.startsWith('window-screw-')).length, 3);
  assert.equal(screws.filter((screw) => screw.id === 'ssd-retention-screw').length, 1);
  assert.equal(
    components.some((component) => component.id.startsWith('camera-tower-')),
    false,
    'the camera is located by the printed forward seat',
  );
  for (const state of ['assembled', 'cutaway', 'extracted'])
    assert.deepEqual(validateParameters(part, p, state), [], `TPU ${state}`);
});

test('the TPU90 stack has short NVMe spacing, a thin clear partition and a near-camera seat inside a single tube-inserting shell', async () => {
  const p = tpuConfiguration();
  const pieces = configuredPieces(p, 'assembled');
  const mobile = mobileParts(p);
  const index = (id: string) => pieces.findIndex((piece) => piece.component.libraryId === id);
  const pi = pieces[index('raspberry-pi')];
  const ups = pieces[index('waveshare-ups-3s')];
  const adapter = pieces[index('waveshare-pcie-m2-d')];
  const piOrigin = pointInView(pi),
    upsOrigin = pointInView(ups),
    adapterOrigin = pointInView(adapter);
  assert.ok(Math.abs(piOrigin.x + 6.45558) < 0.02);
  assert.ok(Math.abs(upsOrigin.x - 3.84442) < 0.02);
  assert.ok(Math.abs(adapterOrigin.x + 24.76158) < 0.02);
  assert.ok(Math.abs(piOrigin.z + 40) < 0.02);
  assert.ok(Math.abs(upsOrigin.z + 44) < 0.02);
  assert.ok(
    Math.abs(piOrigin.x - adapterOrigin.x - 1.306 - 17) < 0.02,
    'the true Pi PCB-top to adapter PCB-bottom gap is 17 mm',
  );
  await inspect(p, 'assembled', (model) => {
    const piBounds = new Box3().setFromObject(model.children[index('raspberry-pi')], true);
    const upsBounds = new Box3().setFromObject(model.children[index('waveshare-ups-3s')], true);
    assert.ok(
      Math.abs(upsBounds.min.x - piBounds.max.x - 2.25) < 0.03,
      'conservative electronics envelopes leave the 1.2 mm partition plus two clearances',
    );
    const carrierIndex = pieces.findIndex(
      (piece) => mobile.has(piece.component.id) && piece.component.supply === 'manufactured',
    );
    assert.ok(carrierIndex >= 0);
    const carrier = model.children[carrierIndex];
    carrier.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        material.side = DoubleSide;
    });
    const materialAt = (point: Vector3): boolean => {
      // An oblique ray avoids coincident cap diagonals on the fork center planes.
      const ray: Raycaster = new Raycaster(
        point,
        new Vector3(1, 0.01234, 0.02345).normalize(),
        0,
        120,
      );
      const distances: number[] = ray
        .intersectObject(carrier, true)
        .map((hit) => hit.distance)
        .sort((a, b) => a - b);
      const crossings: number[] = distances.filter(
        (distance, index) => index === 0 || distance - distances[index - 1] > 0.0001,
      );
      return crossings.length % 2 === 1;
    };
    const mountingPatterns = [
      {
        board: pi,
        thicknessCenter: 0.668,
        insideOffset: 0.7,
        holeRadius: 1.35,
        holes: [-39, 19].flatMap((x) => [-24.5, 24.5].map((y) => [x, y] as [number, number])),
      },
      {
        board: adapter,
        thicknessCenter: 0.8,
        insideOffset: 0.7,
        holeRadius: 1.35,
        holes: adapterInterface.holes.map((hole) => [hole.x, hole.y] as [number, number]),
      },
      {
        board: ups,
        thicknessCenter: 0.8,
        insideOffset: 1,
        holeRadius: 1.55,
        holes: upsInterface.holes.map((hole) => [hole.x, hole.y] as [number, number]),
      },
    ];
    for (const pattern of mountingPatterns)
      for (const [x, y] of pattern.holes) {
        const inside = pointInView(
          pattern.board,
          new Vector3(x, y + pattern.insideOffset, pattern.thicknessCenter),
        );
        const outside = pointInView(
          pattern.board,
          new Vector3(x, y + pattern.holeRadius + 0.2, pattern.thicknessCenter),
        );
        assert.equal(
          materialAt(inside),
          true,
          `${pattern.board.component.libraryId}: printed fork aligns with the source mounting bore at ${x},${y}`,
        );
        assert.equal(
          materialAt(outside),
          false,
          `${pattern.board.component.libraryId}: printed post leaves the surrounding PCB material clear`,
        );
      }
    let partition = false;
    for (const y of [-15, 0, 15])
      for (const z of [-70, -50, -30, -10]) {
        const ray: Raycaster = new Raycaster(
          new Vector3(piBounds.max.x + 0.01, y, z),
          new Vector3(1, 0, 0),
          0,
          upsBounds.min.x - piBounds.max.x - 0.02,
        );
        const faces: number[] = [
          ...new Set(
            ray
              .intersectObject(carrier, true)
              .map((hit) => Math.round(hit.point.x * 10000) / 10000),
          ),
        ].sort((a, b) => a - b);
        for (let i = 0; i + 1 < faces.length; i++) {
          if (Math.abs(faces[i + 1] - faces[i] - 1.2) >= 0.03) continue;
          assert.ok(
            faces[i] - piBounds.max.x >= 0.49,
            'partition is clear of the actual Pi underside envelope',
          );
          assert.ok(
            upsBounds.min.x - faces[i + 1] >= 0.49,
            'partition is clear of the populated UPS face',
          );
          partition = true;
        }
      }
    assert.ok(
      partition,
      'actual manufactured geometry contains the thin divider between the two boards',
    );
    const { maximum, sampled } = radialBoundsInSlab(
      carrier,
      -Number(p.shoulderLength) + 0.05,
      -0.05,
    );
    const intendedRadius = (Number(p.tubeID) - Number(p.shoulderClearance)) / 2;
    assert.ok(sampled > 100);
    assert.ok(
      maximum <= intendedRadius + 0.03,
      'the actual printed shell passes through the 86 mm tube',
    );
    assert.ok(
      maximum > intendedRadius - 0.15,
      'the TPU shell itself defines the shoulder outside diameter',
    );
    const housingIndex = pieces.findIndex((piece) => piece.component.id === 'nose-shell');
    assert.ok(housingIndex >= 0);
    const housing = new Box3().setFromObject(model.children[housingIndex], true);
    assert.ok(
      housing.min.z >= -10,
      'the fixed forehousing does not add an old deep rigid wall around the printed shoulder',
    );
    const camera = new Box3().setFromObject(model.children[index('board-camera-19')], true);
    assert.ok(
      Math.abs(camera.min.z - 46.5) < 0.03,
      'camera sits directly above the short equipment bay',
    );
    assert.ok(camera.max.z < Number(p.noseLength) - 1, 'objective remains below the window seat');
  });
});

test('the default 240 mm execution is the prewired guided cassette while previous camera variants remain selectable', () => {
  const part = nose(),
    preset = part.presets.find((candidate) => candidate.id === 'structural-90-86');
  assert.ok(preset);
  const p = preset.parameters;
  assert.equal(part.presets[0].id, preset.id);
  assert.deepEqual(part.defaults, p);
  assert.equal(p.packaging, 'structural-ogive');
  assert.equal(p.cameraSetup, 'camera-19');
  assert.equal(p.tubeOD, 90);
  assert.equal(p.tubeID, 86);
  assert.equal(p.noseLength, 140);
  assert.equal(p.shoulderLength, 98);
  assert.equal(part.dimensions(p, 'assembled')[2], 240);
  for (const change of [{ noseLength: 140.1 }, { shoulderLength: 98.1 }] as Parameters[])
    assert.ok(
      validateParameters(part, { ...p, ...change }, 'assembled').some((error) => /240/.test(error)),
    );
  const pieces = configuredPieces(p),
    ids = new Set(pieces.map((piece) => piece.component.id));
  for (const id of [
    'outer-shell',
    'cassette-cage-base',
    'cassette-cage-cover',
    'pi-pocket',
    'pi-pressure',
    'power-carrier',
    'adapter-cushion',
    'camera-pocket',
    'rear-retainer',
  ])
    assert.ok(ids.has(id), id);
  assert.equal(pieces.filter((piece) => piece.component.libraryId === 'bolt-screw').length, 10);
  assert.ok(
    !pieces.some(
      (piece) =>
        piece.component.libraryId === 'optical-dome-window' ||
        piece.component.id.startsWith('window-'),
    ),
  );
  for (const id of [
    'ov9281-90-86',
    'dual-90-86',
    'tpu-90-86',
    'tube-90-86',
    'tube-110-106',
    'tube-130-126',
    'compact-110-106',
    'compact-130-126',
  ])
    assert.ok(
      part.presets.some((candidate) => candidate.id === id),
      id,
    );
});

test('the print state contains only separate grounded fabrication parts and preserves the complete assembly BOM', async () => {
  const part = nose();
  assert.ok(part.composition);
  const state = part.states?.find((candidate) => candidate.id === 'print-layout');
  assert.ok(state, 'the fabrication layout is an independently selectable model state');
  assert.equal(state.label, 'For 3D printing');
  const defaultIds = [
    'outer-shell',
    'cassette-cage-base',
    'cassette-cage-cover',
    'pi-pocket',
    'pi-pressure',
    'power-carrier',
    'adapter-cushion',
    'ups-cell-cover',
    'camera-pocket',
    'camera-front-liner',
    'aux-bed',
    'aux-clamp',
    'aux-pressure-plate',
    'rear-retainer',
  ].sort();
  const representatives = new Map<string, Parameters>();
  for (const preset of part.presets) {
    const p = preset.parameters;
    const assembled: AssemblyComponent[] = structuredClone(part.composition(p).components);
    const eligible: AssemblyComponent[] = assembled.filter(
      (component) =>
        component.supply === 'manufactured' &&
        component.manufacturing?.processes.includes('printing'),
    );
    await part.initializeGeometry?.(p, 'print-layout');
    const printed = configuredPieces(p, 'print-layout');
    assert.deepEqual(
      validateParameters(part, p, 'print-layout'),
      [],
      `${preset.id}: print state validates`,
    );
    assert.deepEqual(
      printed.map((piece) => piece.component.id).sort(),
      eligible.map((component) => component.id).sort(),
      `${preset.id}: the print kit exactly matches the assembly's printing-process parts`,
    );
    assert.ok(printed.length > 0);
    for (const piece of printed) {
      const source = assembled.find((component) => component.id === piece.component.id);
      assert.ok(source);
      assert.equal(piece.component.supply, 'manufactured');
      assert.ok(piece.component.manufacturing?.processes.includes('printing'));
      assert.equal(piece.component.libraryId, source.libraryId);
      assert.deepEqual(
        piece.component.parameters,
        source.parameters,
        'print orientation must not change the fabrication recipe or geometry backend',
      );
      assert.equal(piece.component.quantity, source.quantity);
      assert.equal(piece.component.state, source.state);
    }
    assert.deepEqual(
      part.composition(p).components,
      assembled,
      `${preset.id}: preparing print poses does not mutate the full assembly BOM`,
    );
    if (p.packaging === 'structural-ogive' && p.cameraSetup === 'camera-19')
      assert.deepEqual(printed.map((piece) => piece.component.id).sort(), defaultIds);
    const printKey = String(p.packaging) + '/' + String(p.cameraSetup);
    if (!representatives.has(printKey)) representatives.set(printKey, p);
  }
  for (const [packaging, p] of representatives) {
    const before: AssemblyComponent[] = structuredClone(part.composition(p).components);
    const pieces = configuredPieces(p, 'print-layout');
    await part.initializeGeometry?.(p, 'print-layout');
    const preview = part.buildGeometry(p, 'print-layout');
    const exported = (part.buildExportGeometry ?? part.buildGeometry)(p, 'print-layout');
    try {
      const check = (model: Group, dimensions: [number, number, number]) => {
        model.updateMatrixWorld(true);
        assert.equal(
          model.children.length,
          pieces.length,
          `${packaging}: one displayed group per printable physical unit`,
        );
        const boxes = model.children.map((child, index) => {
          const bounds = new Box3().setFromObject(child, true);
          assert.ok(!bounds.isEmpty());
          assert.ok(
            Math.abs(bounds.min.z) < 0.03,
            `${pieces[index].component.id}: lies on the actual Z=0 print plane`,
          );
          assert.ok(bounds.max.z > 0.05);
          return bounds;
        });
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) {
            const first = boxes[i],
              second = boxes[j];
            const gap = Math.max(
              first.min.x - second.max.x,
              second.min.x - first.max.x,
              first.min.y - second.max.y,
              second.min.y - first.max.y,
            );
            assert.ok(
              gap >= 7.9,
              `${packaging}/${pieces[i].component.id}/${pieces[j].component.id}: actual XY print footprints have the authored 8 mm spacing`,
            );
          }
        const actual = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
        for (let axis = 0; axis < 3; axis++)
          assert.ok(
            Math.abs(actual[axis] - dimensions[axis]) < 0.03,
            `${packaging}: declared print dimensions match the actual displayed/exported parts`,
          );
        return boxes;
      };
      const previewBoxes = check(preview, part.dimensions(p, 'print-layout'));
      const exportBoxes = check(
        exported,
        (part.exportDimensions ?? part.dimensions)(p, 'print-layout'),
      );
      for (let i = 0; i < previewBoxes.length; i++) {
        assert.ok(previewBoxes[i].min.distanceTo(exportBoxes[i].min) < 0.03);
        assert.ok(previewBoxes[i].max.distanceTo(exportBoxes[i].max) < 0.03);
      }
      if (packaging === 'structural-ogive') {
        const flatIds = ['pi-cradle', 'ups-cradle', 'camera-pocket', 'rear-cable-grommet'];
        const assembledPieces = configuredPieces(p, 'assembled').filter((piece) =>
          flatIds.includes(piece.component.id),
        );
        const assembled = componentGeometry(libraries, assembledPieces);
        try {
          assembled.updateMatrixWorld(true);
          for (const id of flatIds) {
            const index = pieces.findIndex((piece) => piece.component.id === id),
              sourceIndex = assembledPieces.findIndex((piece) => piece.component.id === id),
              bounds = previewBoxes[index],
              sourceSize = new Box3()
                .setFromObject(assembled.children[sourceIndex], true)
                .getSize(new Vector3()),
              source = assembledPieces[sourceIndex],
              sourceZ = pointInView(source, new Vector3(0, 0, 1)).sub(pointInView(source)),
              printZ = pointInView(pieces[index], new Vector3(0, 0, 1)).sub(
                pointInView(pieces[index]),
              );
            assert.ok(
              Math.abs(bounds.getSize(new Vector3()).z - sourceSize.z) < 0.03,
              `${id}: original axial length is retained in the grounded inverted print pose`,
            );
            assert.ok(
              printZ.distanceTo(sourceZ.applyAxisAngle(new Vector3(1, 0, 0), Math.PI)) < 1e-8,
              `${id}: the fabrication pose inverts the source on its selected end face`,
            );
          }
        } finally {
          disposeModel(assembled);
        }
      }
      assert.deepEqual(
        part.composition(p).components,
        before,
        'preview and native-export preparation keep the complete assembly specification unchanged',
      );
    } finally {
      disposeModel(preview);
      disposeModel(exported);
    }
  }
});

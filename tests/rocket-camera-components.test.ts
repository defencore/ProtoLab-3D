import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Euler, Mesh, Raycaster, Vector3, type Group } from 'three';
import { parts } from '../src/parts';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import { eskdIdentity, productIdentityParameters } from '../src/core/eskd';
import type { Parameters, PartDefinition } from '../src/core/types';
import { pieces as pi5Pieces } from '../src/parts/raspberry-pi/lib/pi5/lightweight';
import { upsInterface } from '../src/parts/waveshare-ups-3s/part';
import { adapterInterface } from '../src/parts/waveshare-pcie-m2-d/part';

const componentIds = [
  'optical-dome-window',
  'board-camera-19',
  'waveshare-ups-3s',
  'waveshare-pcie-m2-d',
  'm2-ssd',
];
const find = (id: string): PartDefinition => {
  const part = parts.find((candidate) => candidate.id === id);
  assert.ok(part, `Missing standalone component ${id}`);
  return part;
};

async function inspect(part: PartDefinition, p: Parameters, check: (model: Group) => void) {
  const state = part.states?.[0]?.id ?? 'default';
  await part.initializeGeometry?.(p, state);
  const model = part.buildGeometry(p, state);
  try {
    model.updateMatrixWorld(true);
    check(model);
  } finally {
    disposeModel(model);
  }
}

function volume(model: Group) {
  let value = 0;
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const positions = object.geometry.getAttribute('position');
    const indices = object.geometry.index;
    for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
      const triangle = [0, 1, 2].map((offset) =>
        new Vector3()
          .fromBufferAttribute(positions, indices ? indices.getX(i + offset) : i + offset)
          .applyMatrix4(object.matrixWorld),
      );
      value += triangle[0].dot(triangle[1].cross(triangle[2])) / 6;
    }
  });
  return value;
}

function assertClosedTriangleMesh(model: Group) {
  const edges = new Map<string, number>();
  const pointKey = (point: Vector3) =>
    point
      .toArray()
      .map((value) => Math.round(value * 1e5))
      .join(',');
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const positions = object.geometry.getAttribute('position');
    const indices = object.geometry.index;
    for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
      const triangle = [0, 1, 2].map((offset) =>
        new Vector3()
          .fromBufferAttribute(positions, indices ? indices.getX(i + offset) : i + offset)
          .applyMatrix4(object.matrixWorld),
      );
      for (let corner = 0; corner < 3; corner++) {
        const pair = [pointKey(triangle[corner]), pointKey(triangle[(corner + 1) % 3])].sort();
        assert.notEqual(pair[0], pair[1], 'no collapsed boundary edges');
        const edge = pair.join('|');
        edges.set(edge, (edges.get(edge) ?? 0) + 1);
      }
    }
  });
  assert.ok(edges.size > 0);
  assert.ok(
    [...edges.values()].every((count) => count === 2),
    'every undirected triangle edge is shared by exactly two faces',
  );
}

test('camera payload hardware is reusable as independently registered purchased library units', () => {
  for (const id of componentIds) {
    const part = find(id);
    assert.equal(part.product.supply, 'purchased', id);
    assert.ok(part.presets.length > 0, id);
    for (const preset of part.presets)
      assert.deepEqual(
        validateParameters(part, preset.parameters, part.states?.[0]?.id ?? 'default'),
        [],
        `${id}/${preset.id}`,
      );
  }
});

test('the optical attachment establishes only its three printed outside dimensions', () => {
  const part = find('optical-dome-window');
  const preset = part.presets.find((candidate) => candidate.id === 'user-23-17-6')!;
  assert.ok(preset);
  assert.equal(preset.parameters.flangeDiameter, 23);
  assert.equal(preset.parameters.domeDiameter, 17);
  assert.equal(preset.parameters.height, 6);
  assert.equal(preset.catalog?.sourceKind, 'attachment');
  assert.deepEqual(preset.catalog?.verifiedParameters.slice().sort(), [
    'domeDiameter',
    'flangeDiameter',
    'height',
  ]);
  assert.equal(preset.catalog?.sourceName, 'User-supplied dimensioned optical image');
  assert.equal(preset.catalog?.sourceUrl, '');
  assert.equal(preset.catalog?.geometryEvidence?.sourceUrl, '');
  assert.match(preset.catalog?.geometryEvidence?.limitations ?? '', /not dimensioned/);
  assert.ok(!preset.catalog?.verifiedParameters.includes('wall'));
  assert.ok(!preset.catalog?.verifiedParameters.includes('flangeThickness'));
});

test('the dome is open from the rear and has finite material between its optical surfaces', async () => {
  const part = find('optical-dome-window');
  const p = part.defaults;
  await inspect(part, p, (model) => {
    const bounds = new Box3().setFromObject(model, true);
    assert.ok(Math.abs(bounds.min.z) < 1e-6, 'flat rear mounting datum Z=0');
    assert.ok(Math.abs(bounds.max.z - Number(p.height)) < 1e-6, 'optical apex points +Z');
    const rear = new Raycaster(new Vector3(0, 0, -1), new Vector3(0, 0, 1)).intersectObject(
      model,
      true,
    )[0];
    assert.ok(rear, 'the optical axis eventually meets the inner cap');
    assert.ok(
      Math.abs(rear.point.z - (Number(p.height) - Number(p.wall))) < 0.02,
      'the rear center is open up to the inner apex',
    );
    const front = new Raycaster(
      new Vector3(0, 0, Number(p.height) + 1),
      new Vector3(0, 0, -1),
    ).intersectObject(model, true)[0];
    assert.ok(front);
    assert.ok(Math.abs(front.point.z - Number(p.height)) < 0.02);
    assert.ok(volume(model) > 0);
    assertClosedTriangleMesh(model);
  });
  const invalid: Parameters[] = [
    { wall: 0 },
    { wall: Number(p.height) - Number(p.flangeThickness) },
    { flangeDiameter: p.domeDiameter },
    { height: p.flangeThickness },
  ];
  for (const change of invalid)
    assert.ok(
      validateParameters(part, { ...p, ...change }, 'default').length > 0,
      JSON.stringify(change),
    );
});

test('the CSI camera preserves the user body depth and objective projection without invented mounting holes', async () => {
  const part = find('board-camera-19');
  const p = part.defaults;
  assert.equal(p.bodyWidth, 19);
  assert.equal(p.bodyHeight, 19);
  assert.equal(p.bodyDepth, 12);
  assert.equal(p.lensLength, 15);
  assert.equal(Number(p.bodyDepth) + Number(p.lensLength), 27);
  assert.match(part.notes ?? '', /CSI is the requested interface/);
  assert.match(part.notes ?? '', /supplier SKU/);
  await inspect(part, p, (model) => {
    const firstAt = (z: number) =>
      new Raycaster(new Vector3(30, 0, z), new Vector3(-1, 0, 0)).intersectObject(model, true)[0];
    const body = firstAt(6),
      objective = firstAt(20);
    assert.ok(body && objective);
    assert.ok(Math.abs(body.point.x - 9.5) < 0.02);
    assert.ok(Math.abs(objective.point.x - Number(p.lensDiameter) / 2) < 0.02);
    const front = new Raycaster(new Vector3(0, 0, 40), new Vector3(0, 0, -1)).intersectObject(
      model,
      true,
    )[0];
    assert.ok(front);
    assert.ok(Math.abs(front.point.z - 27) < 0.02);
    const expected = 19 * 19 * 12 + Math.PI * (Number(p.lensDiameter) / 2) ** 2 * 15;
    assert.ok(Math.abs(volume(model) - expected) < expected * 0.01);
  });
  assert.ok(validateParameters(part, { ...p, lensDiameter: 20 }, 'default').length > 0);
});

test('IMX577 retains its existing identity with the user-measured stepped objective and no vendor claim', async () => {
  const part = find('board-camera-19');
  const generic = part.presets.find((preset) => preset.id === 'user-csi-19-12-27')!;
  const module = part.presets.find((preset) => preset.id === 'imx577-19x19-rear-mipi-m25')!;
  assert.doesNotMatch(generic.name + generic.description, /IMX577/);
  assert.match(module.name, /IMX577/);
  assert.match(module.description, /user-measured/i);
  assert.equal(
    module.catalog,
    undefined,
    'No manufacturer/SKU record is invented from a sensor name.',
  );
  assert.equal(
    part.parameters.some((field) => field.key === 'sensor'),
    false,
  );
  assert.deepEqual(part.dimensions(generic.parameters, 'default'), [19, 19, 27]);
  assert.deepEqual(part.dimensions(module.parameters, 'default'), [19, 19, 27.5]);
  assert.deepEqual(
    [
      generic.parameters.lensProfile,
      generic.parameters.lensDiameter,
      generic.parameters.lensCollarHeight,
    ],
    ['cylindrical', 12, 0],
  );
  assert.deepEqual(
    [
      module.parameters.lensProfile,
      module.parameters.lensCollarDiameter,
      module.parameters.lensCollarHeight,
    ],
    ['stepped', 16, 5],
  );
  const collarField = part.parameters.find((field) => field.key === 'lensCollarHeight')!;
  assert.equal(collarField.visibleWhen!(generic.parameters), false);
  assert.equal(collarField.visibleWhen!(module.parameters), true);
  assert.deepEqual(
    [
      module.parameters.bodyDepth,
      module.parameters.lensDiameter,
      module.parameters.lensLength,
      module.parameters.sideMountOffset,
      module.parameters.sideHoleDepth,
    ],
    [12, 14.8, 15, 7.5, 2.5],
  );
  assert.deepEqual(
    [
      module.parameters.rearConnectorWidth,
      module.parameters.rearConnectorHeight,
      module.parameters.rearConnectorProjection,
    ],
    [17, 2, 0.5],
  );
  await inspect(part, module.parameters, (model) => {
    for (const [z, radius] of [
      [14, 8],
      [19, 7.4],
    ]) {
      const hit = new Raycaster(new Vector3(20, 0, z), new Vector3(-1, 0, 0)).intersectObject(
        model,
        true,
      )[0];
      assert.ok(hit);
      assert.ok(Math.abs(hit.point.x - radius) < 0.02, `Objective radius at Z${z}`);
    }
  });
});

test('unused collar controls preserve cylindrical camera identity while measured steps remain physical', () => {
  const part = find('board-camera-19');
  const generic = part.presets.find((preset) => preset.id === 'user-csi-19-12-27')!;
  const measured = part.presets.find((preset) => preset.id === 'imx577-19x19-rear-mipi-m25')!;
  const {
    lensProfile: _profile,
    lensCollarDiameter: _diameter,
    lensCollarHeight: _height,
    ...originalGeneric
  } = generic.parameters;
  const originalDefinition = { ...part, identityParameters: undefined };
  assert.deepEqual(productIdentityParameters(part, generic.parameters), originalGeneric);
  assert.equal(
    eskdIdentity(part, generic.parameters, 'default').configurationKey,
    eskdIdentity(originalDefinition, originalGeneric, 'default').configurationKey,
  );
  const editedCylinder = {
    ...generic.parameters,
    lensDiameter: 13,
    lensCollarDiameter: 16,
    lensCollarHeight: 5,
  };
  assert.equal(
    eskdIdentity(part, editedCylinder, 'default').configurationKey,
    eskdIdentity(originalDefinition, { ...originalGeneric, lensDiameter: 13 }, 'default')
      .configurationKey,
  );
  assert.equal(productIdentityParameters(part, measured.parameters).lensProfile, 'stepped');
  assert.notEqual(
    eskdIdentity(part, measured.parameters, 'default').configurationKey,
    eskdIdentity(part, { ...measured.parameters, lensCollarHeight: 4 }, 'default').configurationKey,
  );
});

test('the three SSD lengths share a 22 mm module width and leave their rear retention notch open', async () => {
  const part = find('m2-ssd');
  for (const [format, length] of [
    ['2230', 30],
    ['2242', 42],
    ['2280', 80],
  ] as const) {
    const p: Parameters = { format };
    assert.deepEqual(part.dimensions(p, 'default'), [length, 22, 3.5]);
    await inspect(part, p, (model) => {
      const notch = new Raycaster(
        new Vector3(-length / 2, 0, -1),
        new Vector3(0, 0, 1),
      ).intersectObject(model, true);
      assert.equal(notch.length, 0, `${format}: rear half-hole is open`);
      assert.ok(volume(model) > 0);
    });
  }
  assert.ok(validateParameters(part, { format: '2250' }, 'default').length > 0);
});

test('the Pi 5 Ethernet connector opens at +X and the nose installation rotation faces it toward +Z', () => {
  const ethernet = pi5Pieces('assembled').find((piece) => piece.label === 'Ethernet RJ45');
  assert.ok(ethernet);
  assert.equal(ethernet.shape.kind, 'subtract');
  if (ethernet.shape.kind !== 'subtract') return;
  const [body, opening] = ethernet.shape.children;
  assert.equal(body.kind, 'box');
  assert.equal(opening.kind, 'box');
  if (body.kind !== 'box' || opening.kind !== 'box') return;
  assert.ok(opening.origin[0] > body.origin[0], 'metal remains behind the RJ45 cavity at -X');
  assert.ok(
    opening.origin[0] + opening.size[0] > body.origin[0] + body.size[0],
    'RJ45 cavity passes through the +X end',
  );
  const forward = new Vector3(1, 0, 0).applyEuler(new Euler(0, -Math.PI / 2, 0, 'ZYX'));
  assert.ok(
    forward.distanceTo(new Vector3(0, 0, 1)) < 1e-12,
    'R[0,-90,0] faces Ethernet toward the nose',
  );
});

test('the UPS and adapter mounting bores retain their actual four-hole pitch and stay open', async () => {
  const cases = [
    { id: 'waveshare-ups-3s', holes: upsInterface.holes, pitch: [86, 46], diameter: 3.1 },
    { id: 'waveshare-pcie-m2-d', holes: adapterInterface.holes, pitch: [58, 49], diameter: 2.7 },
  ];
  for (const entry of cases) {
    const part = find(entry.id);
    const xs = [...new Set(entry.holes.map((hole) => hole.x))].sort((a, b) => a - b);
    const ys = [...new Set(entry.holes.map((hole) => hole.y))].sort((a, b) => a - b);
    assert.deepEqual([xs[1] - xs[0], ys[1] - ys[0]], entry.pitch);
    assert.equal(entry.holes.length, 4);
    assert.ok(entry.holes.every((hole) => hole.diameter === entry.diameter));
    await inspect(part, part.defaults, (model) => {
      const pcb = model.children.find((child) => child.name.startsWith('PCB with'));
      assert.ok(pcb, entry.id + ': independently named PCB');
      for (const hole of entry.holes) {
        const at = (x: number, y: number): boolean =>
          new Raycaster(new Vector3(x, y, 10), new Vector3(0, 0, -1)).intersectObject(pcb, true)
            .length > 0;
        assert.equal(at(hole.x, hole.y), false, `${entry.id}: open bore at ${hole.x},${hole.y}`);
        assert.equal(
          at(hole.x + hole.diameter / 2 + 0.2, hole.y),
          true,
          `${entry.id}: material remains beside each bore`,
        );
      }
    });
    assert.ok(
      validateParameters(part, { ...part.defaults, boardLength: 100 }, 'default').length > 0,
      'fixed supplier dimensions cannot be silently overridden',
    );
  }
  const aligned = adapterInterface.holes.map((hole) =>
    new Vector3(hole.x, hole.y, 0)
      .applyEuler(new Euler(0, 0, Math.PI, 'ZYX'))
      .add(new Vector3(...adapterInterface.pi5Alignment.translation)),
  );
  for (const x of [-39, 19])
    for (const y of [-24.5, 24.5])
      assert.ok(
        aligned.some((hole) => hole.distanceTo(new Vector3(x, y, 0)) < 1e-10),
        'adapter alignment matches nominal Pi 5 hole centers',
      );
});

test('UPS terminals, auxiliary header and BOOT button sit on the holder face with edge clearance', async () => {
  const part = find('waveshare-ups-3s');
  await inspect(part, part.defaults, (model) => {
    const bounds = (label: string) => {
      const matches = model.children.filter((child) => child.name.startsWith(label));
      assert.equal(matches.length, 1, label + ': one independently named component');
      return new Box3().setFromObject(matches[0], true);
    };
    const pcb = bounds('PCB with');
    const holder = bounds('Empty three-cell holder');
    const terminals = [
      '5 V output terminal',
      'Battery series terminal',
      'Switch terminal',
      'Charge input terminal',
    ].map(bounds);
    const header = bounds('I2C and auxiliary header ·');
    const contacts = bounds('I2C and auxiliary header contacts');
    const button = bounds('BOOT button');
    for (const item of [...terminals, header, contacts, button]) {
      assert.ok(item.min.z < pcb.min.z, 'connector and control bodies extend toward the cells');
      assert.ok(item.max.z <= pcb.min.z + 1e-6, 'connector and control bodies stay below the PCB');
      assert.ok(item.min.x >= pcb.min.x && item.max.x <= pcb.max.x, 'fits within the board length');
      assert.ok(item.min.y >= pcb.min.y && item.max.y <= pcb.max.y, 'fits within the board width');
    }
    for (const terminal of terminals)
      assert.ok(terminal.min.x > holder.max.x, 'each two-pin socket clears the holder at +X');
    for (const item of [header, contacts, button])
      assert.ok(item.max.x < holder.min.x, 'the header and BOOT button clear the holder at -X');
    assert.ok(
      !header.union(contacts).intersectsBox(button),
      'BOOT remains accessible beside the auxiliary header and its contacts',
    );
    for (let i = 0; i < terminals.length; i++)
      for (let j = i + 1; j < terminals.length; j++)
        assert.ok(!terminals[i].intersectsBox(terminals[j]), 'the four sockets remain separate');
    for (const label of ['Regulator inductor', 'Control package'])
      assert.ok(
        bounds(label).min.z >= pcb.max.z - 1e-6,
        'electronics retain the opposite PCB face',
      );
  });
});

test('all three UPS holder channels leave the separate nominal 18650 cells unobstructed', async () => {
  const part = find('waveshare-ups-3s');
  assert.equal(upsInterface.cellSeats.length, 3);
  assert.deepEqual(
    upsInterface.cellSeats.map((seat) => seat.center[1]),
    [-19.5, 0, 19.5],
  );
  await inspect(part, part.defaults, (model) => {
    const holder = model.children.find((child) => child.name.startsWith('Empty three-cell holder'));
    assert.ok(holder);
    for (const seat of upsInterface.cellSeats) {
      const origin = new Vector3(...seat.center);
      const directions = [
        new Vector3(1, 0, 0),
        new Vector3(-1, 0, 0),
        new Vector3(0, 1, 0),
        new Vector3(0, -1, 0),
        new Vector3(0, 0, 1),
      ];
      for (const direction of directions) {
        const wall = new Raycaster(origin, direction).intersectObject(holder, true)[0];
        assert.ok(wall, 'each channel has its specified end, side and roof walls');
        const required = direction.x === 0 ? seat.referenceDiameter / 2 : 65.2 / 2;
        assert.ok(
          wall.distance > required + 0.1,
          `cell channel at Y=${seat.center[1]} has positive clearance along ${direction.toArray()}`,
        );
      }
      assert.ok(seat.maximumLength > 65.2);
    }
    const pcb = model.children.find((child) => child.name.startsWith('PCB with'));
    assert.ok(pcb);
    const boardBottom = new Box3().setFromObject(pcb, true).min.z;
    assert.ok(
      upsInterface.cellSeats.every(
        (seat) => seat.center[2] + seat.referenceDiameter / 2 < boardBottom,
      ),
      'cell cylinders remain below the PCB',
    );
  });
});

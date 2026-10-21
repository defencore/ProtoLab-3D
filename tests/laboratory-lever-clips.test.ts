import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Box3, DoubleSide, Mesh, Raycaster, Vector3 } from 'three';
import type { Group, Material } from 'three';
import part from '../src/parts/laboratory-terminal/part';
import { pieces, selected } from '../src/parts/laboratory-terminal/lib/model';
import evidence from '../src/parts/laboratory-terminal/lib/clip-evidence.json';

const originalIds = ['lever-clip-55', 'lever-clip-bank-6', 'lever-clip-101'];
const bottomIds = ['lever-clip-55-bottom', 'lever-clip-bank-6-bottom'];
const ids = [...originalIds, ...bottomIds];
const isBank = (id: string) => id.includes('bank-6');
const listingUrls = [
  'https://www.aliexpress.com/item/4001315701627.html',
  'https://www.aliexpress.com/item/4000167641521.html',
];
function meshes(group: Group) {
  const result: Mesh[] = [];
  group.traverse((object) => {
    if (object instanceof Mesh) result.push(object);
  });
  return result;
}
function dispose(group: Group) {
  for (const mesh of meshes(group)) {
    mesh.geometry.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
      (material as Material).dispose();
  }
}
function volumeAndManifold(mesh: Mesh) {
  const positions = mesh.geometry.getAttribute('position'),
    index = mesh.geometry.index,
    count = index?.count ?? positions.count,
    edges = new Map<string, { count: number; orientation: number }>();
  const point = (i: number) => new Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
  const key = (i: number) =>
    point(i)
      .toArray()
      .map((value) => Math.round(value * 1e5))
      .join(',');
  let volume = 0;
  for (let i = 0; i < count; i += 3) {
    const indices = [0, 1, 2].map((offset) => (index ? index.getX(i + offset) : i + offset)),
      points = indices.map(point),
      keys = indices.map(key);
    assert.ok(
      points.every((p) => p.toArray().every(Number.isFinite)),
      mesh.name + ': finite vertices',
    );
    volume += points[0].dot(points[1].clone().cross(points[2])) / 6;
    if (new Set(keys).size < 3) continue;
    for (let edge = 0; edge < 3; edge++) {
      const a = keys[edge],
        b = keys[(edge + 1) % 3],
        name = [a, b].sort().join('/'),
        current = edges.get(name) ?? { count: 0, orientation: 0 };
      current.count++;
      current.orientation += a < b ? 1 : -1;
      edges.set(name, current);
    }
  }
  assert.ok(volume > 0, mesh.name + ': positive closed volume');
  const invalid = [...edges.values()].filter((edge) => edge.count !== 2 || edge.orientation !== 0);
  assert.equal(invalid.length, 0, mesh.name + ': closed, consistently oriented preview');
  return volume;
}
function upwardHits(group: Group, x: number, y: number, label?: RegExp) {
  for (const mesh of meshes(group))
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
      material.side = DoubleSide;
  // The front paddle legitimately overhangs an ear high above the base. Check
  // the hole and fastener-head zone rather than requiring an empty column to infinity.
  return new Raycaster(new Vector3(x, y, -1), new Vector3(0, 0, 1), 0, 17)
    .intersectObject(group, true)
    .filter((hit) => !label || label.test(hit.object.name));
}
function containsMaterial(mesh: Mesh, coordinates: [number, number, number]) {
  const point = new Vector3(...coordinates);
  if (!new Box3().setFromObject(mesh, true).containsPoint(point)) return false;
  for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
    material.side = DoubleSide;
  const hits = new Raycaster(
    point,
    new Vector3(1, 0.371, 0.219).normalize(),
    0.00001,
    1000,
  ).intersectObject(mesh, true);
  const distances: number[] = [];
  for (const hit of hits)
    if (!distances.some((distance) => Math.abs(distance - hit.distance) < 0.0001))
      distances.push(hit.distance);
  return distances.length % 2 === 1;
}

test('spring clips retain fixed purchased executions and identify the reconstructed six-way board', () => {
  assert.equal(part.product!.supply, 'purchased');
  assert.equal(part.catalogSelectionOnly, true);
  assert.deepEqual(
    part.parameters.map((parameter) => parameter.key),
    ['model'],
  );
  for (const [index, id] of ids.entries()) {
    const model = selected({ model: id }),
      preset = part.presets!.find((preset) => preset.id === id)!;
    assert.equal(model.kind, 'spring-lever-clip');
    assert.equal(model.poles, isBank(id) ? 6 : 1);
    assert.equal(model.clipSize, index === 2 ? 'large' : 'compact');
    assert.equal(model.clipBase, isBank(id));
    assert.equal(
      model.clipTermination,
      id.endsWith('-bottom') ? 'bottom-tab' : index === 2 ? 'bottom-m4' : 'rear-tab',
    );
    assert.deepEqual(preset.parameters, { model: id });
    assert.deepEqual(part.validate(preset.parameters, 'assembled'), []);
    assert.deepEqual(preset.catalog!.verifiedParameters, ['model']);
    assert.equal(preset.catalog!.manufacturer, 'Unspecified');
    assert.equal(preset.catalog!.attributes!.contacts, model.poles);
    assert.ok(listingUrls.includes(preset.catalog!.sourceUrl));
    assert.equal(preset.catalog!.sourceUrl, model.source);
    assert.equal(
      preset.catalog!.geometryEvidence!.kind,
      isBank(id) ? 'envelope' : 'source-dimensions',
    );
    assert.match(preset.catalog!.geometryEvidence!.limitations, /reconstruct/i);
    assert.match(preset.catalog!.geometryEvidence!.limitations, /unconfirmed/i);
    assert.match(preset.catalog!.geometryEvidence!.limitations, /not verified electrical ratings/i);
    assert.ok(
      !Object.keys(preset.catalog!.attributes!).some((key) => /amp|current|rating/i.test(key)),
    );
    assert.ok(part.validate({ model: id, wires: true }, 'assembled').length);
  }
  const compact = part.presets!.find((preset) => preset.id === ids[0])!.catalog!,
    bank = part.presets!.find((preset) => preset.id === ids[1])!.catalog!,
    large = part.presets!.find((preset) => preset.id === ids[2])!.catalog!;
  assert.equal(compact.attributes!.width, 18);
  assert.equal(compact.attributes!.depth, 55);
  assert.equal(compact.attributes!.length, undefined, 'nominal body and lever height are distinct');
  assert.match(compact.geometryEvidence!.limitations, /9\.6.*not a pivot height/);
  for (const key of ['width', 'depth', 'length', 'terminalPitch', 'mountPitch', 'mountHole'])
    assert.equal(bank.attributes![key], undefined, 'photo-derived bank dimension: ' + key);
  assert.equal(large.attributes!.mountPitch, 86);
  assert.equal(large.attributes!.mountHole, 4.8);
  assert.equal(
    large.attributes!.jawWidth,
    undefined,
    'approximate jaw width remains a specification',
  );
  const bottom = part.presets!.find((preset) => preset.id === bottomIds[0])!.catalog!,
    bottomBank = part.presets!.find((preset) => preset.id === bottomIds[1])!.catalog!;
  assert.equal(bottom.attributes!.mountPitch, 9.6);
  assert.equal(
    bottom.attributes!.width,
    undefined,
    'body width is inherited from the related variant',
  );
  assert.equal(bottom.attributes!.mountHole, undefined, 'mounting hole diameter is reconstructed');
  for (const key of ['width', 'depth', 'length', 'terminalPitch', 'mountPitch', 'mountHole'])
    assert.equal(bottomBank.attributes![key], undefined, 'photo-derived bank dimension: ' + key);
  for (const preset of [bottom, bottomBank])
    assert.equal(preset.attributes!.termination, 'bottom-tab');
});

test('supplied photograph evidence is retained verbatim with reproducible hashes', () => {
  assert.deepEqual(evidence.listingUrls, listingUrls);
  assert.match(evidence.listingVariantAssociation, /unconfirmed/i);
  assert.match(evidence.ratingScope, /seller photo labels only/i);
  assert.equal(evidence.images.length, 6);
  for (const image of evidence.images) {
    assert.match(image.sha256, /^[a-f0-9]{64}$/);
    const bytes = readFileSync(
      new URL('../src/parts/laboratory-terminal/lib/' + image.file, import.meta.url),
    );
    assert.equal(createHash('sha256').update(bytes).digest('hex'), image.sha256, image.file);
  }
});

test('single clips and the six-way bank have closed positive components in both inspection states', () => {
  for (const id of ids)
    for (const state of ['assembled', 'exploded']) {
      const group = part.buildGeometry({ model: id }, state),
        components = pieces({ model: id }, state);
      try {
        group.updateMatrixWorld(true);
        const labels = components.map((component) => component.label),
          expectedClips = isBank(id) ? 6 : 1;
        assert.equal(new Set(labels).size, labels.length, id + ': unique component labels');
        assert.equal(labels.filter((label) => /molded housing$/.test(label)).length, expectedClips);
        assert.equal(
          labels.filter((label) => /ridged pivot lever$/.test(label)).length,
          expectedClips,
        );
        assert.equal(
          labels.filter((label) => /moving brass jaw$/.test(label)).length,
          expectedClips,
        );
        assert.equal(
          labels.filter((label) => /steel pivot pin$/.test(label)).length,
          expectedClips,
        );
        assert.equal(
          labels.filter((label) => /compression spring$/.test(label)).length,
          expectedClips,
        );
        assert.ok(labels.every((label) => !/\bwire(?:s)?\b|common bus/i.test(label)));
        assert.equal(
          meshes(group).length,
          components.length,
          id + ': one mesh per physical component',
        );
        for (const mesh of meshes(group)) volumeAndManifold(mesh);
        const size = new Box3().setFromObject(group, true).getSize(new Vector3()).toArray();
        for (const [axis, expected] of part.dimensions({ model: id }, state).entries())
          assert.ok(Math.abs(size[axis] - expected) < 0.0005, id + '/' + state + ': dimensions');
      } finally {
        dispose(group);
      }
    }
});

test('six-way contacts occupy separate conductive groups rather than a shared electrical bus', () => {
  for (const id of [originalIds[1], bottomIds[1]]) {
    const group = part.buildGeometry({ model: id }, 'assembled');
    try {
      group.updateMatrixWorld(true);
      const conductors = Array.from({ length: 6 }, (_, i) => {
        const components = meshes(group).filter((mesh) =>
          new RegExp(`^Clip ${i + 1} .*fixed contact|^Clip ${i + 1} .*moving brass jaw`).test(
            mesh.name,
          ),
        );
        assert.equal(components.length, 2, 'each pole has its own fixed and moving conductor');
        const bounds = new Box3();
        for (const component of components) bounds.union(new Box3().setFromObject(component, true));
        return bounds;
      });
      for (let i = 1; i < conductors.length; i++)
        assert.ok(
          conductors[i].min.x - conductors[i - 1].max.x > 1,
          `contacts ${i} and ${i + 1} remain physically separated`,
        );
    } finally {
      dispose(group);
    }
  }
});

test('wire-entry windows expose the brass jaw rather than a plastic cover from above', () => {
  for (const id of ids) {
    const group = part.buildGeometry({ model: id }, 'assembled');
    try {
      group.updateMatrixWorld(true);
      const count = isBank(id) ? 6 : 1,
        jawY = id === ids[2] ? 27.5 : 19.5;
      for (const mesh of meshes(group))
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
          material.side = DoubleSide;
      for (let i = 0; i < count; i++) {
        const x = (i - (count - 1) / 2) * 18,
          hits = new Raycaster(
            new Vector3(x, jawY, 60),
            new Vector3(0, 0, -1),
            0,
            61,
          ).intersectObject(group, true);
        assert.ok(hits.length > 0, id + ': visible contact');
        assert.equal(
          hits[0].object.name,
          `Clip ${i + 1} · moving brass jaw`,
          id + ': open wire-entry window',
        );
      }
    } finally {
      dispose(group);
    }
  }
});

test('large mounting ears and all four mounting-board holes remain open through the assembly', () => {
  for (const [id, holes] of [
    [
      ids[2],
      [
        [0, -43, 4.8],
        [0, 43, 4.8],
      ],
    ],
    [ids[1], [-59, 59].flatMap((x) => [-25, 25].map((y) => [x, y, 4.5]))],
    [bottomIds[1], [-59, 59].flatMap((x) => [-25, 25].map((y) => [x, y, 4.5]))],
    [bottomIds[0], [-4.8, 4.8].map((x) => [x, 3, 3.2])],
    [
      bottomIds[1],
      Array.from({ length: 6 }, (_, i) => (i - 2.5) * 18).flatMap((x) =>
        [-4.8, 4.8].map((offset) => [x + offset, 3, 3.2]),
      ),
    ],
  ] as [string, number[][]][]) {
    const group = part.buildGeometry({ model: id }, 'assembled');
    try {
      group.updateMatrixWorld(true);
      for (const [x, y, diameter] of holes)
        for (const [dx, dy] of [
          [0, 0],
          [diameter * 0.45, 0],
          [-diameter * 0.45, 0],
          [0, diameter * 0.45],
          [0, -diameter * 0.45],
        ])
          assert.equal(
            upwardHits(group, x + dx, y + dy).length,
            0,
            `${id}: unobstructed mounting bore at ${x + dx},${y + dy}`,
          );
    } finally {
      dispose(group);
    }
  }
});

test('bottom-contact clips have pierced downward blades and clearance through the housing and board', () => {
  for (const id of bottomIds) {
    const group = part.buildGeometry({ model: id }, 'assembled');
    try {
      group.updateMatrixWorld(true);
      const count = isBank(id) ? 6 : 1,
        offset = isBank(id) ? 3 : 0,
        allMeshes = meshes(group);
      for (const mesh of allMeshes)
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
          material.side = DoubleSide;
      for (let i = 0; i < count; i++) {
        const x = (i - (count - 1) / 2) * 18,
          contact = allMeshes.find(
            (mesh) => mesh.name === `Clip ${i + 1} · fixed contact and downward solder tab`,
          )!;
        assert.ok(contact, id + ': continuous downward contact');
        assert.equal(
          upwardHits(group, x, -21).length,
          0,
          id + ': front mounting slot remains open',
        );
        const bounds = new Box3().setFromObject(contact, true);
        assert.ok(
          Math.abs(bounds.min.z - (-14 + offset)) < 0.001,
          id + ': blade extends below the base',
        );
        assert.ok(bounds.max.y <= 27.5 + 0.001, id + ': no rear-facing solder tag');
        for (const [dx, dz] of [
          [0, 0],
          [1.7, 0],
          [-1.7, 0],
          [0, 1.7],
          [0, -1.7],
        ]) {
          const hits = new Raycaster(
            new Vector3(x + dx, 16, -9 + offset + dz),
            new Vector3(0, 1, 0),
            0,
            10,
          ).intersectObject(group, true);
          assert.equal(hits.length, 0, id + ': transverse four millimeter contact hole');
        }
        const rim = new Raycaster(
          new Vector3(x + 2.5, 16, -9 + offset),
          new Vector3(0, 1, 0),
          0,
          10,
        ).intersectObject(contact, true);
        assert.ok(rim.length > 0, id + ': solid brass remains beside the hole');
        for (const [dx, dy] of [
          [0, 0],
          [3.65, 0],
          [-3.65, 0],
          [0, 1.0],
          [0, -1.0],
        ]) {
          const hits = new Raycaster(
            new Vector3(x + dx, 20.8 + dy, -1),
            new Vector3(0, 0, 1),
            0,
            17,
          )
            .intersectObject(group, true)
            .filter((hit) =>
              /molded housing|common insulating mounting base/.test(hit.object.name),
            );
          assert.equal(
            hits.length,
            0,
            id + ': plastic clearance around the contact through both bases',
          );
        }
      }
    } finally {
      dispose(group);
    }
  }
});

test('compact housings retain the square L silhouette, thick forefoot and open underside pockets', () => {
  for (const id of ids.filter((id) => id !== 'lever-clip-101')) {
    const group = part.buildGeometry({ model: id }, 'assembled');
    try {
      group.updateMatrixWorld(true);
      const count = isBank(id) ? 6 : 1,
        offset = isBank(id) ? 3 : 0;
      for (let i = 0; i < count; i++) {
        const x = (i - (count - 1) / 2) * 18,
          housing = meshes(group).find((mesh) => mesh.name === `Clip ${i + 1} · molded housing`)!;
        assert.ok(!containsMaterial(housing, [x + 8.2, -3, 20 + offset]), id + ': open front of L');
        assert.ok(containsMaterial(housing, [x + 8.2, 3, 20 + offset]), id + ': vertical L head');
        assert.ok(
          containsMaterial(housing, [x + 8.2, 0.5, 30 + offset]),
          id + ': square head rather than a diagonal ramp',
        );
        assert.ok(
          containsMaterial(housing, [x, -3, 9.5 + offset]),
          id + ': ten millimeter forefoot',
        );
        assert.ok(
          !containsMaterial(housing, [x, -3, 10.5 + offset]),
          id + ': forefoot top remains near ten millimeters',
        );
        assert.ok(
          !containsMaterial(housing, [x + 5, -14, 3 + offset]),
          id + ': open underside pocket',
        );
        assert.ok(
          containsMaterial(housing, [x + 5, -14, 8.5 + offset]),
          id + ': intact deck over pocket',
        );
        for (const material of Array.isArray(housing.material)
          ? housing.material
          : [housing.material])
          material.side = DoubleSide;
        const below = new Raycaster(
          new Vector3(x + 5, -14, -1 + offset),
          new Vector3(0, 0, 1),
          0,
          20,
        ).intersectObject(housing, true);
        assert.ok(below.length > 0);
        assert.ok(
          Math.abs(below[0].point.z - (7.5 + offset)) < 0.001,
          id + ': pocket opens from the underside',
        );
        const above = new Raycaster(
          new Vector3(x + 5, -14, 15 + offset),
          new Vector3(0, 0, -1),
          0,
          20,
        ).intersectObject(housing, true);
        assert.ok(above.length > 0);
        assert.ok(Math.abs(above[0].point.z - (10 + offset)) < 0.001, id + ': continuous top deck');
      }
    } finally {
      dispose(group);
    }
  }
});

test('compact clips have three locating pegs and matching blind receiving bores', () => {
  for (const id of ids.filter((id) => id !== 'lever-clip-101')) {
    const group = part.buildGeometry({ model: id }, 'assembled');
    try {
      group.updateMatrixWorld(true);
      const count = isBank(id) ? 6 : 1,
        offset = isBank(id) ? 3 : 0;
      for (let i = 0; i < count; i++) {
        const x = (i - (count - 1) / 2) * 18,
          housing = meshes(group).find((mesh) => mesh.name === `Clip ${i + 1} · molded housing`)!;
        for (const [y, z] of [
          [-23, 5],
          [13.5, 6],
          [13, 30],
        ]) {
          assert.ok(
            containsMaterial(housing, [x + 9.2, y, z + offset]),
            id + ': protruding locating peg',
          );
          assert.ok(
            !containsMaterial(housing, [x - 8.6, y, z + offset]),
            id + ': open receiving bore',
          );
          assert.ok(
            containsMaterial(housing, [x - 8.6, y + 1.3, z + offset]),
            id + ': material surrounding receiving bore',
          );
        }
        for (const [y, z] of [
          [10, 10],
          [23, 24],
        ])
          assert.ok(
            !containsMaterial(housing, [x + 9.2, y, z + offset]),
            id + ': superseded peg positions are absent',
          );
      }
    } finally {
      dispose(group);
    }
  }
});

test('large clip cheeks follow the long shallow ramp visible in the reference photograph', () => {
  const group = part.buildGeometry({ model: 'lever-clip-101' }, 'assembled');
  try {
    group.updateMatrixWorld(true);
    const housing = meshes(group).find((mesh) => mesh.name === 'Clip 1 · molded housing')!;
    assert.ok(containsMaterial(housing, [9.5, -30, 12]), 'long ramp begins near the forefoot');
    assert.ok(!containsMaterial(housing, [9.5, -30, 20]), 'air above the shallow front ramp');
    assert.ok(containsMaterial(housing, [9.5, -20, 20]), 'ramp continues through the middle');
    assert.ok(!containsMaterial(housing, [9.5, -20, 30]), 'ramp is not a solid rectangular tower');
    for (const y of [-25, 0]) {
      assert.ok(!containsMaterial(housing, [0, y, 2]), 'large underside core cell');
      assert.ok(containsMaterial(housing, [0, y, 4.5]), 'two millimeter large top deck');
    }
    assert.ok(containsMaterial(housing, [6, -13, 2]), 'rib between the two large core cells');
  } finally {
    dispose(group);
  }
});

test('the gap between fixed and moving jaws remains open across the contact width', () => {
  for (const id of ids) {
    const group = part.buildGeometry({ model: id }, 'assembled');
    try {
      group.updateMatrixWorld(true);
      const count = isBank(id) ? 6 : 1,
        offset = isBank(id) ? 3 : 0,
        y = id === 'lever-clip-101' ? 27.5 : 19.5,
        z = (id === 'lever-clip-101' ? 47.7 : 30.8) + offset;
      for (const mesh of meshes(group))
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
          material.side = DoubleSide;
      for (let i = 0; i < count; i++) {
        const x = (i - (count - 1) / 2) * 18;
        const hits = new Raycaster(
          new Vector3(x - 5.5, y, z),
          new Vector3(1, 0, 0),
          0.00001,
          11,
        ).intersectObject(group, true);
        assert.equal(hits.length, 0, id + ': clear gap between the brass jaws');
      }
    } finally {
      dispose(group);
    }
  }
});

test('the original rear-tab executions retain rear projections rather than downward contacts', () => {
  for (const id of originalIds.slice(0, 2)) {
    const group = part.buildGeometry({ model: id }, 'assembled');
    try {
      group.updateMatrixWorld(true);
      const contacts = meshes(group).filter((mesh) =>
        /fixed contact and solder tag$/.test(mesh.name),
      );
      assert.equal(contacts.length, isBank(id) ? 6 : 1);
      for (const contact of contacts) {
        const bounds = new Box3().setFromObject(contact, true);
        assert.ok(bounds.max.y > 30, id + ': original rear projection');
        assert.ok(bounds.min.z > 0, id + ': no substituted downward blade');
      }
    } finally {
      dispose(group);
    }
  }
});

test('explosion moves existing clip components rigidly without creating hardware or changing shape', () => {
  for (const id of ids) {
    const assembled = pieces({ model: id }, 'assembled'),
      exploded = pieces({ model: id }, 'exploded');
    assert.equal(assembled.length, exploded.length);
    for (const [index, component] of assembled.entries()) {
      assert.equal(component.label, exploded[index].label);
      assert.deepEqual(component.shape, exploded[index].shape);
      assert.ok(Number.isFinite(exploded[index].z));
    }
  }
});

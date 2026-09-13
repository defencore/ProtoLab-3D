import assert from 'node:assert/strict';
import test from 'node:test';
import { geometrySamples } from './catalog-samples';
import * as THREE from 'three';
import bolt from "../src/parts/bolt-screw/part";
import setScrew from "../src/parts/set-screw/part";
import wingScrew from "../src/parts/wing-screw/part";
import swingEyeBolt from "../src/parts/swing-eye-bolt/part";
import liftingEyeBolt from "../src/parts/lifting-eye-bolt/part";
import sourceInventory from '../src/catalog/data/gvyntok-fasteners.json';
import { supplierFasteners, supplierFamily } from '../src/catalog/fasteners';
import { fastenerValues } from "../src/parts/bolt-screw/lib/core/fasteners";
import { validateParameters } from '../src/core/validation';
import type { Parameters } from '../src/core/types';

function solidMetrics(model: THREE.Group, checkEdges = false) {
  const meshes: THREE.Mesh[] = [];
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) meshes.push(child);
  });
  assert.equal(meshes.length, 1, 'A fastener exports one exterior shell.');
  const mesh = meshes[0],
    geometry = mesh.geometry;
  const p = geometry.getAttribute('position');
  const indices = geometry.getIndex()?.array ?? Array.from({ length: p.count }, (_, i) => i);
  const edges = new Map<string, number>();
  let volume = 0;
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  for (let i = 0; i < indices.length; i += 3) {
    a.fromBufferAttribute(p, indices[i]);
    b.fromBufferAttribute(p, indices[i + 1]);
    c.fromBufferAttribute(p, indices[i + 2]);
    volume += a.dot(b.clone().cross(c)) / 6;
    if (!checkEdges) continue;
    const keys = [a, b, c].map((v) =>
      v
        .toArray()
        .map((x) => Math.round(x * 100000))
        .join(','),
    );
    assert.equal(new Set(keys).size, 3, 'Export contains no collapsed triangles.');
    for (let side = 0; side < 3; side++) {
      const edge = [keys[side], keys[(side + 1) % 3]].sort().join('|');
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  if (checkEdges)
    for (const [edge, count] of edges) assert.equal(count, 2, `Closed shell edge ${edge}`);
  assert.ok(volume > 0, 'Triangle winding faces out of the solid.');
  model.updateMatrixWorld(true);
  return { volume, mesh };
}

function dispose(model: THREE.Group) {
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      for (const m of Array.isArray(child.material) ? child.material : [child.material])
        m.dispose();
    }
  });
}

test('bolt and grub screw variants and catalogue boundaries export closed outward meshes', () => {
  for (const part of [bolt, setScrew])
    for (const preset of geometrySamples(part)) {
      assert.deepEqual(validateParameters(part, preset.parameters, 'default'), [], preset.id);
      const model = part.buildGeometry(preset.parameters, 'default');
      try {
        solidMetrics(model, true);
      } finally {
        dispose(model);
      }
    }
});

test('every recessed drive has a real floor and removes its expected volume', () => {
  for (const drive of ['hex', 'slot', 'cross', 'star', 'square', 'polygon']) {
    const parameters = {
      ...bolt.defaults,
      head: 'socket-cap',
      headSize: 12,
      headHeight: 6,
      drive,
      driveWidth: 3,
      driveThickness: 0.8,
      driveDepth: 2,
      threadMode: 'none',
    };
    assert.deepEqual(validateParameters(bolt, parameters, 'default'), []);
    const model = bolt.buildGeometry(parameters, 'default');
    // A zero-depth baseline retains the same exterior circle tessellation.
    const filled = bolt.buildGeometry({ ...parameters, driveDepth: 0 }, 'default');
    try {
      const cutMetrics = solidMetrics(model),
        fullMetrics = solidMetrics(filled);
      const { total } = fastenerValues(parameters);
      const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, total), new THREE.Vector3(0, 0, -1));
      const hit = ray.intersectObject(model, true)[0];
      assert.ok(hit, drive);
      assert.ok(
        Math.abs(hit.point.z - (total / 2 - parameters.driveDepth)) < 1e-5,
        `${drive}: recessed floor`,
      );
      const removed = fullMetrics.volume - cutMetrics.volume;
      assert.ok(removed > 0, `${drive}: cavity removes material`);
      const expectedArea =
        drive === 'hex'
          ? (Math.sqrt(3) * 3 ** 2) / 2
          : drive === 'square'
            ? 9
            : drive === 'slot'
              ? 3 * 0.8
              : drive === 'cross'
                ? 2 * 3 * 0.8 - 0.8 ** 2
                : undefined;
      if (expectedArea)
        assert.ok(Math.abs(removed - expectedArea * 2) < 0.001, `${drive}: cavity dimensions`);
    } finally {
      dispose(model);
      dispose(filled);
    }
  }
});

test('countersunk length includes the head while raised heads use under-head length', () => {
  const countersunk = { ...bolt.defaults, head: 'countersunk', length: 20, headHeight: 3 };
  assert.equal(bolt.dimensions(countersunk, 'default')[2], 20);
  assert.equal(fastenerValues(countersunk).shaftLength, 17);
  assert.equal(bolt.dimensions({ ...countersunk, head: 'socket-cap' }, 'default')[2], 23);
});

test('partial threads keep the specified smooth shoulders and have helical rather than stacked ridges', () => {
  const parameters = {
    ...bolt.defaults,
    tip: 'flat',
    threadSpan: 'partial',
    threadStart: 4,
    threadLength: 10,
    shankDiameter: 8,
  };
  const model = bolt.buildGeometry(parameters, 'default');
  try {
    model.updateMatrixWorld(true);
    const { total, rootR } = fastenerValues(parameters);
    const radialHit = (z: number, a: number) => {
      const direction = new THREE.Vector3(-Math.cos(a), -Math.sin(a), 0);
      const ray = new THREE.Raycaster(
        new THREE.Vector3(10 * Math.cos(a), 10 * Math.sin(a), z - total / 2),
        direction,
      );
      const hit = ray.intersectObject(model, true)[0];
      assert.ok(hit);
      return Math.hypot(hit.point.x, hit.point.y);
    };
    assert.ok(Math.abs(radialHit(2, 0) - 4) < 1e-5, 'Smooth tip-side shoulder');
    assert.ok(Math.abs(radialHit(20, 0) - 4) < 1e-5, 'Smooth head-side shoulder');
    assert.ok(Math.abs(radialHit(8, 0) - 3) < 0.02, 'Thread crest');
    assert.ok(
      Math.abs(radialHit(8, Math.PI) - rootR) < 0.02,
      'Half a turn changes the crest to a root',
    );
    assert.ok(Math.abs(radialHit(8.5, Math.PI) - 3) < 0.02, 'Helix advances by half a pitch');
  } finally {
    dispose(model);
  }
});

test('impossible thread, drive, shoulder and point combinations are rejected', () => {
  const invalid: Parameters[] = [
    { pitch: 4 },
    { length: 100, pitch: 0.5 },
    { threadSpan: 'partial', threadStart: 20, threadLength: 10 },
    { threadSpan: 'partial', shankDiameter: 5 },
    { drive: 'hex', driveWidth: 10 },
    { drive: 'hex', driveDepth: 4 },
    { tip: 'cone', tipLength: 25 },
    { tip: 'dog', tipDiameter: 0 },
    { tip: 'cup', tipDiameter: 6 },
    { head: 'countersunk', headHeight: 26 },
    { drive: 'polygon', driveSides: 4.5 },
    { head: 'polygon', headSides: 4.5 },
  ];
  for (const patch of invalid)
    assert.ok(
      validateParameters(bolt, { ...bolt.defaults, ...patch }, 'default').length,
      JSON.stringify(patch),
    );
  assert.ok(
    validateParameters(setScrew, { ...setScrew.defaults, driveDepth: 7 }, 'default').length,
  );
});

test('the requested M2.5 × 8 grub screw has a 0.45 mm pitch, 1.3 mm socket and 90-degree cone', () => {
  const p = setScrew.defaults;
  assert.equal(p.diameter, 2.5);
  assert.equal(p.length, 8);
  assert.equal(p.pitch, 0.45);
  assert.equal(p.drive, 'hex');
  assert.equal(p.driveWidth, 1.3);
  assert.equal(p.tip, 'cone');
  assert.equal(Number(p.tipLength) * 2, p.diameter);
});

test('the complete supplier inventory is retained and every supported SKU is mapped', () => {
  assert.equal(sourceInventory.categories.length, 55);
  assert.equal(sourceInventory.products.length, 5901);
  assert.equal(
    sourceInventory.categories.reduce((sum, category) => sum + category.importedCount, 0),
    5901,
  );
  assert.ok(
    sourceInventory.categories.every(
      (category) =>
        category.errors.length === 0 && category.visibleCount === category.importedCount,
    ),
  );
  assert.deepEqual(
    supplierFasteners.map((row) => row.sku),
    sourceInventory.products.map((row) => row.sku),
  );
  const parts = [bolt, setScrew, wingScrew, swingEyeBolt, liftingEyeBolt];
  const represented = new Set(
    parts.flatMap((part) => part.presets.flatMap((preset) => preset.catalog?.productCodes ?? [])),
  );
  const unsupported = supplierFasteners.filter((row) => !represented.has(row.sku));
  assert.equal(
    unsupported.length,
    30,
    'All remaining rows are explicitly reported hook geometries.',
  );
  assert.deepEqual([...new Set(unsupported.map(supplierFamily))].sort(), [
    'C hook',
    'L hook',
    'O eye',
    'Q hook',
  ]);
  assert.equal(represented.size, 5871);
});

test('every imported fastener preset validates with verified dimensions present', () => {
  for (const part of [bolt, setScrew, wingScrew, swingEyeBolt, liftingEyeBolt])
    for (const preset of part.presets) {
      assert.deepEqual(
        validateParameters(part, preset.parameters, 'default'),
        [],
        part.id + '/' + preset.id,
      );
      for (const key of preset.catalog?.verifiedParameters ?? [])
        assert.ok(Object.hasOwn(preset.parameters, key), preset.id + '/' + key);
    }
});

test('supplier diameter-length-pitch order, requested grub screw and dog-point length bands are preserved', () => {
  const fine = bolt.presets.find((p) => p.catalog?.productCodes?.includes('030-250-001'))!;
  assert.equal(fine.parameters.diameter, 8);
  assert.equal(fine.parameters.length, 35);
  assert.equal(fine.parameters.pitch, 1);
  const grub = setScrew.presets.find((p) => p.catalog?.productCodes?.includes('040-270-014'))!;
  assert.equal(grub.parameters.diameter, 2.5);
  assert.equal(grub.parameters.length, 8);
  assert.equal(grub.parameters.driveWidth, 1.3);
  assert.equal(grub.parameters.pitch, 0.45);
  assert.equal(grub.parameters.tip, 'cone');
  const dog = (length: number) =>
    setScrew.presets.find(
      (p) =>
        p.catalog?.standard === 'DIN 915' &&
        p.parameters.diameter === 6 &&
        p.parameters.length === length,
    )!;
  assert.equal(dog(8).parameters.tipLength, 1.75);
  assert.equal(dog(10).parameters.tipLength, 3.25);
  assert.equal(dog(10).parameters.tipDiameter, 4);
  assert.ok(
    bolt.presets.some((p) => (p.catalog?.productCodes?.length ?? 0) > 2),
    'Material and coating duplicates retain all supplier codes.',
  );
});

test('wing and eye catalogue variants export closed connected boundaries with positive winding', () => {
  for (const part of [wingScrew, swingEyeBolt, liftingEyeBolt]) {
    const samples =
      part === liftingEyeBolt
        ? [
            { id: 'default', parameters: part.defaults },
            ...part.presets,
            {
              id: 'custom-eye',
              parameters: {
                ...part.defaults,
                diameter: 12,
                length: 23,
                collarDiameter: 29,
                collarHeight: 9,
                eyeDiameter: 51,
                eyeBore: 27,
                headHeight: 50,
              },
            },
          ]
        : geometrySamples(part);
    for (const preset of samples) {
      const model = part.buildGeometry(preset.parameters, 'default');
      try {
        solidMetrics(model, true);
      } finally {
        dispose(model);
      }
    }
  }
});

test('both eye families leave a real transverse opening and use their distinct nominal lengths', () => {
  for (const part of [swingEyeBolt, liftingEyeBolt]) {
    const p = part.defaults,
      model = part.buildGeometry(p, 'default');
    try {
      model.updateMatrixWorld(true);
      const radius = Number(p.eyeDiameter) / 2;
      const height =
        part === swingEyeBolt ? Number(p.length) + radius : Number(p.length) + Number(p.headHeight);
      const centreZ = part === swingEyeBolt ? Number(p.length) - height / 2 : height / 2 - radius;
      const ray = new THREE.Raycaster(
        new THREE.Vector3(0, 100, centreZ),
        new THREE.Vector3(0, -1, 0),
      );
      assert.equal(ray.intersectObject(model, true).length, 0, part.id + ' eye bore is open');
      assert.ok(
        Math.abs(part.dimensions(p, 'default')[2] - height) < 1e-5,
        part.id + ' nominal length convention',
      );
    } finally {
      dispose(model);
    }
  }
});

import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { BufferGeometry, Float32BufferAttribute, Mesh, Vector3 } from 'three';
import {
  initializeManifoldGeometry,
  manifoldBoundaryComponent,
} from '../src/core/assembly/manifold-boundary';
import { disposeModel } from '../src/core/mechanical';
import { printedCreasedNormals } from '../src/parts/handheld-lora-controller/lib/appearance';
import { details } from '../src/parts/handheld-lora-controller/lib/details';
import part from '../src/parts/handheld-lora-controller/part';

before(async () => initializeManifoldGeometry());

function strip(angleDegrees: number, upward = false): BufferGeometry {
  const geometry = new BufferGeometry().setAttribute(
    'position',
    new Float32BufferAttribute(
      [
        -1,
        -1,
        0,
        0,
        -1,
        0,
        0,
        1,
        0,
        -1,
        1,
        0,
        1,
        -1,
        Math.tan((angleDegrees * Math.PI) / 180),
        1,
        1,
        Math.tan((angleDegrees * Math.PI) / 180),
      ],
      3,
    ),
  );
  const triangles = [0, 2, 1, 0, 3, 2, 1, 5, 4, 1, 2, 5];
  if (upward)
    for (let i = 0; i < triangles.length; i += 3)
      [triangles[i + 1], triangles[i + 2]] = [triangles[i + 2], triangles[i + 1]];
  return geometry.setIndex(triangles);
}

test('The actual Palm Lock sole stays planar and tangent through its first rounded strip', () => {
  const preset = part.presets.find((item) => item.id === 'heltec-v4-web-grip-internal-fpc')!,
    shape = details({ ...part.defaults, ...preset.parameters }).find(
      (item) => item.id === 'base',
    )!.shape,
    model = manifoldBoundaryComponent(shape, 'Actual sole shading control', 0xffffff);
  let flats = 0,
    curvedCorners = 0;
  try {
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const original = object.geometry,
        beforePositions = original.getAttribute('position').array.slice(),
        beforeIndex = original.index?.array.slice(),
        expected = original.index ? original.toNonIndexed() : original.clone(),
        result = printedCreasedNormals(original, true),
        positions = result.getAttribute('position'),
        normals = result.getAttribute('normal');
      try {
        assert.deepEqual(original.getAttribute('position').array, beforePositions);
        assert.deepEqual(original.index?.array, beforeIndex);
        assert.deepEqual(positions.array, expected.getAttribute('position').array);
        assert.equal(result.index, null);
        let soleZ = Infinity;
        for (let i = 0; i < positions.count; i++) soleZ = Math.min(soleZ, positions.getZ(i));
        const solePoints = new Set<string>(),
          a = new Vector3(),
          b = new Vector3(),
          c = new Vector3(),
          first = new Vector3(),
          second = new Vector3(),
          normal = new Vector3();
        for (let i = 0; i < positions.count; i += 3) {
          a.fromBufferAttribute(positions, i);
          b.fromBufferAttribute(positions, i + 1);
          c.fromBufferAttribute(positions, i + 2);
          normal.crossVectors(first.subVectors(b, a), second.subVectors(c, a)).normalize();
          if (
            ![a, b, c].every((point) => Math.abs(point.z - soleZ) < 1e-6) ||
            normal.z > -1 + 1e-10
          )
            continue;
          flats++;
          for (let j = 0; j < 3; j++) {
            solePoints.add(
              [a, b, c][j]
                .toArray()
                .map((value) => Math.round(value * 1e5))
                .join(','),
            );
            assert.deepEqual(
              [normals.getX(i + j), normals.getY(i + j), normals.getZ(i + j)],
              [0, 0, -1],
            );
          }
        }
        // Check the other face at the tangent too: a planar-only fix leaves a
        // visible lighting seam between the sole and its first curved facet.
        for (let i = 0; i < positions.count; i += 3) {
          a.fromBufferAttribute(positions, i);
          b.fromBufferAttribute(positions, i + 1);
          c.fromBufferAttribute(positions, i + 2);
          if ([a, b, c].every((point) => Math.abs(point.z - soleZ) < 1e-6)) continue;
          for (let j = 0; j < 3; j++) {
            const key = [a, b, c][j]
              .toArray()
              .map((value) => Math.round(value * 1e5))
              .join(',');
            if (!solePoints.has(key)) continue;
            curvedCorners++;
            assert.deepEqual(
              [normals.getX(i + j), normals.getY(i + j), normals.getZ(i + j)],
              [0, 0, -1],
            );
          }
        }
      } finally {
        expected.dispose();
        if (result !== original) result.dispose();
      }
    });
    assert.ok(flats > 100, 'Inspect the actual broad triangulated sole');
    assert.ok(curvedCorners > 100, 'Inspect its actual rounded perimeter');
  } finally {
    disposeModel(model);
  }
});

test('Sole shading changes only normals and preserves indexed and nonindexed triangle bytes', () => {
  for (const indexed of [true, false]) {
    const source = strip(2),
      geometry = indexed ? source : source.toNonIndexed(),
      expected = geometry.index ? geometry.toNonIndexed() : geometry.clone(),
      positions = geometry.getAttribute('position').array.slice(),
      indices = geometry.index?.array.slice(),
      result = printedCreasedNormals(geometry, true);
    try {
      assert.deepEqual(geometry.getAttribute('position').array, positions);
      assert.deepEqual(geometry.index?.array, indices);
      assert.deepEqual(
        result.getAttribute('position').array,
        expected.getAttribute('position').array,
      );
      assert.equal(result.index, null);
      const p = result.getAttribute('position'),
        n = result.getAttribute('normal');
      for (let i = 0; i < p.count; i++)
        if (p.getZ(i) === 0) assert.deepEqual([n.getX(i), n.getY(i), n.getZ(i)], [0, 0, -1]);
    } finally {
      if (result !== geometry) result.dispose();
      expected.dispose();
      geometry.dispose();
      if (geometry !== source) source.dispose();
    }
  }
});

test('Upper planes and steep bevels keep their existing angle-weighted preview normals', () => {
  for (const [angle, upward] of [
    [20, false],
    [2, true],
  ] as const) {
    const geometry = strip(angle, upward),
      original = printedCreasedNormals(geometry),
      tangent = printedCreasedNormals(geometry, true);
    try {
      assert.deepEqual(tangent.getAttribute('normal').array, original.getAttribute('normal').array);
    } finally {
      original.dispose();
      tangent.dispose();
      geometry.dispose();
    }
  }
});

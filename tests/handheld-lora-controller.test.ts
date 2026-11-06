import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { Box3, DoubleSide, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import part from '../src/parts/handheld-lora-controller/part';
before(async () => {
  await part.initializeGeometry?.(part.defaults, 'assembled');
});
import { configuredPieces, libraries } from '../src/parts/handheld-lora-controller/lib/model';
import { componentGeometry } from '../src/core/assembly/detail-instances';
import { reinforcement } from '../src/parts/handheld-lora-controller/lib/reinforcement';
import { layout } from '../src/parts/handheld-lora-controller/lib/layout';
import { details } from '../src/parts/handheld-lora-controller/lib/details';
import {
  guardedOuter,
  guardedShell,
  guardSurface,
} from '../src/parts/handheld-lora-controller/lib/button-guard';
import { caseOutline, shellLoft } from '../src/parts/handheld-lora-controller/lib/shapes';
import { gripProfile, gripRings } from '../src/parts/handheld-lora-controller/lib/grip';
import {
  webButton,
  webBaseAdditions,
  webBaseCutouts,
  webLidAdditions,
  webPlungerAtTravel,
  webSliderAtTravel,
} from '../src/parts/handheld-lora-controller/lib/web-button';
import { component as boundaryComponent } from '../src/core/assembly/boundary/shapes';
import type { Shape } from '../src/core/assembly/boundary/shapes';
import { manifoldBoundaryComponent } from '../src/core/assembly/manifold-boundary';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import type { Parameters } from '../src/core/types';

const states = ['assembled', 'open', 'exploded', 'print-layout', 'base-only', 'lid-only'];
const parameters = (extra: Parameters = {}): Parameters => ({ ...part.defaults, ...extra });
const previousEnvelopeVolume = 70 * 132 * 36;
const previousPrintedVolume = 85438.59660319137;

function closedPositive(mesh: Mesh, label: string) {
  const position = mesh.geometry.getAttribute('position'),
    index = mesh.geometry.index;
  const count = index?.count ?? position.count,
    edges = new Map<string, { uses: number; balance: number }>();
  const keys = Array.from({ length: position.count }, (_, i) =>
    [position.getX(i), position.getY(i), position.getZ(i)]
      .map((value) => Math.round(value * 1e5))
      .join(','),
  );
  assert.ok(position.count > 0 && [...position.array].every(Number.isFinite), label);
  assert.equal(count % 3, 0, label);
  let volume = 0;
  for (let i = 0; i < count; i += 3) {
    const ids = [0, 1, 2].map((j) => (index ? index.getX(i + j) : i + j));
    const [a, b, c] = ids.map((id) => new Vector3().fromBufferAttribute(position, id));
    volume += a.dot(b.clone().cross(c)) / 6;
    if (new Set(ids.map((id) => keys[id])).size < 3) continue;
    for (let j = 0; j < 3; j++) {
      const a = keys[ids[j]],
        b = keys[ids[(j + 1) % 3]],
        edge = [a, b].sort().join('/'),
        record = edges.get(edge) ?? { uses: 0, balance: 0 };
      record.uses++;
      record.balance += a < b ? 1 : -1;
      edges.set(edge, record);
    }
  }
  assert.ok(
    edges.size && [...edges.values()].every(({ uses, balance }) => uses === 2 && balance === 0),
    label + ': closed consistently oriented manifold',
  );
  assert.ok(volume > 0, label + ': positive volume');
  return volume;
}

function outlineArea(points: readonly (readonly number[])[]) {
  return (
    points.reduce((sum, a, i) => {
      const b = points[(i + 1) % points.length];
      return sum + a[0] * b[1] - a[1] * b[0];
    }, 0) / 2
  );
}

function leftOutlineAt(points: readonly (readonly number[])[], y: number) {
  return Math.min(
    ...points.flatMap((a, i) => {
      const b = points[(i + 1) % points.length];
      if (Math.abs(b[1] - a[1]) < 1e-10) return Math.abs(y - a[1]) < 1e-10 ? [a[0], b[0]] : [];
      const t = (y - a[1]) / (b[1] - a[1]);
      return t >= 0 && t <= 1 ? [a[0] + t * (b[0] - a[0])] : [];
    }),
  );
}

test('tail fasteners retain a complete material rim inside the actual case polygons', () => {
  const outer = caseOutline(),
    top = caseOutline(1);
  for (const [inset, minimum] of [
    [0, 4.8],
    [1, 3.405],
  ]) {
    const polygon = inset === 0 ? outer : top;
    for (const x of [-11.5, 11.5]) {
      const y = -44.5;
      let crossings = 0;
      const distance = Math.min(
        ...polygon.map((a, i) => {
          const b = polygon[(i + 1) % polygon.length],
            dx = b[0] - a[0],
            dy = b[1] - a[1],
            t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
          if (a[1] > y !== b[1] > y && x < a[0] + ((y - a[1]) * dx) / dy) crossings++;
          return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
        }),
      );
      assert.equal(crossings % 2, 1, 'The fastener center is inside its material polygon');
      assert.ok(
        distance >= minimum,
        `Tail fastener ${x}, ${y}, inset ${inset}: ${distance} mm edge distance preserves its full rim`,
      );
    }
  }

  const positiveBranch = [
    [9, -53],
    [10.176205684, -52.94221672],
    [11.341083864, -52.769423365],
    [12.483416127, -52.483284029],
    [13.592201188, -52.08655439],
    [14.656760842, -51.583055172],
    [15.666842796, -50.977635348],
    [16.61271941, -50.27612544],
    [17.485281374, -49.485281374],
    [18.27612544, -48.61271941],
    [18.977635348, -47.666842796],
    [19.583055172, -46.656760842],
    [20.08655439, -45.592201188],
    [20.483284029, -44.483416127],
    [20.769423365, -43.341083864],
    [20.94221672, -42.176205684],
    [21, -41],
    [21, 39],
    [20.932586173, 40.372239965],
    [20.730993926, 41.731264508],
    [20.3971647, 43.063985482],
    [19.934313455, 44.357568053],
    [19.346897701, 45.599554316],
    [18.640574572, 46.777983262],
    [17.822146347, 47.881505978],
    [16.899494937, 48.899494937],
    [15.881505978, 49.822146347],
    [14.777983262, 50.640574572],
    [13.599554316, 51.346897701],
    [12.357568053, 51.934313455],
    [11.063985482, 52.3971647],
    [9.731264508, 52.730993926],
    [8.372239965, 52.932586173],
    [7, 53],
  ];
  outer
    .slice(17, 51)
    .forEach((point, i) =>
      assert.ok(
        Math.hypot(point[0] - positiveBranch[i][0], point[1] - positiveBranch[i][1]) < 1e-8,
        'The right branch used to sew the button guard retains its original stations',
      ),
    );
  for (const inset of [0, 0.2, 0.36, 0.9, 1, 2.2, 2.4, 2.5, 2.6, 4.4]) {
    const points = caseOutline(inset);
    assert.equal(points.length, 78, 'All loft layers have matching vertex topology');
    assert.ok(points.flat().every(Number.isFinite));
    assert.ok(outlineArea(points) > 0, 'All layers retain outward winding');
    assert.ok(
      points
        .slice(17, 51)
        .every(([x], i, branch) => x > 0 && (i === 0 || branch[i - 1][1] < branch[i][1])),
    );
    assert.deepEqual(
      points
        .filter(([x, y]) => x < 0 && y >= -40 && y <= -31)
        .map(([, y]) => y)
        .sort((a, b) => a - b),
      [-40, -39, -38, -37, -36, -35, -34, -33, -32, -31],
      'The local shoulder has corresponding stations on every inset layer',
    );
    assert.ok(
      Math.max(...points.map(([x]) => x)) - Math.min(...points.map(([x]) => x)) <= 42 + 1e-8,
    );
  }
  for (const [y, expected] of [
    [-53, -3],
    [-31, -15.784469290046435],
    [-25, -16.234891362985778],
    [0, -18.111650000233045],
    [17.5, -19.425381046306132],
    [39, -20.985351337691572],
    [52, -12.151754010029803],
    [53, -7],
  ])
    assert.ok(
      Math.abs(leftOutlineAt(outer, y) - expected) < 1e-8,
      `The local tail shoulder leaves the previous contour unchanged outside its zone at Y=${y}`,
    );
});

test('matching grip sections preserve the palm swell after adding local tail stock', () => {
  // Reference the original 68-point case before the local head stock existed.
  // Its original closing-edge samples must survive without moving the palm curve.
  const rawOutline = (inset: number) => {
    const tangent = Math.atan2(80, 4) - Math.acos(-2 / Math.hypot(80, 4));
    return [
      [7, 39, 14 - inset, tangent, Math.PI / 2],
      [-7, 39, 14 - inset, Math.PI / 2, Math.PI],
      [-9, -41, 12 - inset, Math.PI, Math.PI * 1.5],
      [3, -41, 12 - inset, Math.PI * 1.5, Math.PI * 2 + tangent],
    ]
      .flatMap(([x, y, r, start, end]) =>
        Array.from({ length: 17 }, (_, i) => {
          const angle = start + ((end - start) * i) / 16;
          return [-x - r * Math.cos(angle), y + r * Math.sin(angle)];
        }),
      )
      .reverse();
  };
  const referenceSwell = (y: number) => {
    const lobe = (from: number, to: number) =>
      y <= from || y >= to ? 0 : Math.sin((Math.PI * (y - from)) / (to - from)) ** 2;
    return 2.8 * lobe(-5, 40) + 1.4 * lobe(-43, -23);
  };
  for (const bodyModel of ['original', 'contoured', 'web-grip']) {
    const rings = gripRings(parameters({ bodyModel })),
      anchors =
        bodyModel === 'original'
          ? [
              [0, 4, 0],
              [4, 0, 0],
              [5, 0, 0],
              [28, 0, 0],
            ]
          : [
              [-2.2, 5, 1],
              [2.8, 0, 1],
              [5, 0, 1],
              [14, 0, 0.85],
              [23, 0, 0.35],
              [28, 0, 0],
            ];
    assert.ok(rings.length >= anchors.length);
    for (const ring of rings) {
      assert.equal(ring.length, bodyModel === 'original' ? 78 : 158);
      assert.ok(outlineArea(ring) > 0);
      assert.ok(ring.every((point) => point[2] === ring[0][2]));
    }
    assert.ok(rings.every((ring, i) => i === 0 || ring[0][2] > rings[i - 1][0][2]));
    for (const [z, inset, scale] of anchors) {
      const ring = rings.find((points) => Math.abs(points[0][2] - z) < 1e-10);
      assert.ok(ring, `${bodyModel}: the original Z=${z} anchor remains present`);
      assert.deepEqual(
        ring.slice(17, 51).map(([x, y]) => [x, y]),
        caseOutline(inset).slice(17, 51),
        'Resampling the palm edge does not move the guard sewing branch',
      );
      if (bodyModel === 'original') continue;
      const raw = rawOutline(inset),
        a = raw.at(-1)!,
        b = raw[0];
      assert.equal(raw.length, 68);
      let preserved = 0;
      for (let sample = 1; sample <= 80; sample++) {
        const t = sample / 81,
          y = a[1] + t * (b[1] - a[1]);
        if (y < -31) continue;
        const x = a[0] + t * (b[0] - a[0]) - scale * referenceSwell(y);
        assert.ok(
          ring.some((point) => Math.hypot(point[0] - x, point[1] - y) < 1e-8),
          `${bodyModel}, Z=${z}: original palm station ${sample} remains exact outside the local head`,
        );
        preserved++;
      }
      assert.ok(preserved >= 65, 'Compare a populated original palm curve on every layer');
    }
    if (bodyModel === 'original') continue;
    for (const [z, upper] of [
      [5, 1.4],
      [14, 1.19],
      [23, 0.49],
      [28, 0],
    ]) {
      const ring = rings.find((points) => points[0][2] === z)!,
        [, inset, scale] = anchors.find(([height]) => height === z)!,
        raw = rawOutline(inset),
        a = raw.at(-1)!,
        b = raw[0],
        reference = [
          ...raw,
          ...Array.from({ length: 80 }, (_, i) => {
            const t = (i + 1) / 81;
            return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
          }),
        ].map(([x, y]) => [x - (x < -2 ? scale * referenceSwell(y) : 0), y]);
      assert.ok(ring);
      assert.ok(
        Math.abs(leftOutlineAt(reference, 17.5) - leftOutlineAt(ring, 17.5)) < 1e-8,
        'The interpolated palm contour matches the original 80-station curve exactly',
      );
      assert.ok(
        Math.abs(leftOutlineAt(caseOutline(), -33) - leftOutlineAt(ring, -33) - upper) < 0.002,
      );
    }
  }
});

test('palm section profile preserves anchors without overshoot or derivative breaks', () => {
  const anchors = [
    [-2.2, 5, 1],
    [2.8, 0, 1],
    [5, 0, 1],
    [14, 0, 0.85],
    [23, 0, 0.35],
    [28, 0, 0],
  ];
  for (const [z, inset, swell] of anchors) assert.deepEqual(gripProfile(z), [inset, swell]);
  assert.deepEqual(gripProfile(-10), [5, 1]);
  assert.deepEqual(gripProfile(40), [0, 0]);
  for (let i = 0; i + 1 < anchors.length; i++) {
    const a = anchors[i],
      b = anchors[i + 1];
    for (let step = 0; step <= 128; step++) {
      const value = gripProfile(a[0] + ((b[0] - a[0]) * step) / 128);
      for (let axis = 0; axis < 2; axis++)
        assert.ok(
          value[axis] >= Math.min(a[axis + 1], b[axis + 1]) - 1e-10 &&
            value[axis] <= Math.max(a[axis + 1], b[axis + 1]) + 1e-10,
          'The grip remains inside the neighboring section dimensions',
        );
    }
  }
  const h = 1e-5;
  for (const [z] of anchors.slice(1, -1)) {
    const before = gripProfile(z - h),
      at = gripProfile(z),
      after = gripProfile(z + h);
    for (let axis = 0; axis < 2; axis++)
      assert.ok(
        Math.abs((at[axis] - before[axis]) / h - (after[axis] - at[axis]) / h) < 1e-4,
        `The palm profile has no slope discontinuity at Z=${z}`,
      );
  }
});

test('palm exterior no longer has horizontal bands between the original sections', () => {
  const boundary = guardSurface(parameters({ bodyModel: 'contoured' }));
  assert.equal(boundary.kind, 'boundary');
  if (boundary.kind !== 'boundary') return;
  const points = boundary.points.map((point) => new Vector3(...point.map(Math.fround))),
    edges = new Map<string, { a: Vector3; b: Vector3; normals: Vector3[] }>(),
    key = (point: Vector3) =>
      point
        .toArray()
        .map((value) => Math.round(value * 1e5))
        .join(',');
  for (const face of boundary.faces.filter((face) => face.length === 3)) {
    const vertices = face.map((index) => points[index]),
      normal = vertices[1]
        .clone()
        .sub(vertices[0])
        .cross(vertices[2].clone().sub(vertices[0]))
        .normalize();
    for (let index = 0; index < 3; index++) {
      const a = vertices[index],
        b = vertices[(index + 1) % 3],
        edgeKey = [key(a), key(b)].sort().join('/'),
        edge = edges.get(edgeKey) ?? { a, b, normals: [] };
      edge.normals.push(normal);
      edges.set(edgeKey, edge);
    }
  }
  let checked = 0,
    maximumAngle = 0;
  for (const { a, b, normals } of edges.values()) {
    if (normals.length !== 2 || normals.some((normal) => normal.x >= -0.1)) continue;
    const center = a.clone().add(b).multiplyScalar(0.5);
    if (center.y < 5 || center.y > 35 || center.z < -2 || center.z > 27) continue;
    checked++;
    maximumAngle = Math.max(
      maximumAngle,
      (Math.acos(Math.max(-1, Math.min(1, normals[0].dot(normals[1])))) * 180) / Math.PI,
    );
  }
  assert.ok(checked >= 500, 'Inspect a populated actual Float32 palm surface');
  assert.ok(maximumAngle <= 12, `The palm has a sharp horizontal ridge of ${maximumAngle} degrees`);
});

test('concave shell loft caps cover their polygon and form a closed positive solid', () => {
  for (const inset of [0, 1, 2.4]) {
    const polygon = caseOutline(inset),
      expectedArea = outlineArea(polygon),
      shape = shellLoft([
        [0, inset],
        [3, inset],
      ]);
    assert.equal(shape.kind, 'boundary');
    if (shape.kind !== 'boundary') continue;
    assert.ok(shape.faces.every((face) => face.length === 3));
    for (const z of [0, 3]) {
      const caps: number[][] = shape.faces.filter((face) =>
        face.every((id) => shape.points[id][2] === z),
      );
      let area = 0;
      assert.ok(caps.length > 0);
      for (const face of caps) {
        const vertices: number[][] = face.map((id) => shape.points[id]);
        const signedArea = outlineArea(vertices),
          x = vertices.reduce((sum, point) => sum + point[0], 0) / 3,
          y = vertices.reduce((sum, point) => sum + point[1], 0) / 3;
        assert.ok(z === 0 ? signedArea < 0 : signedArea > 0, 'Cap normals face out of the solid');
        const crossings = polygon.reduce((sum, a, i) => {
          const b = polygon[(i + 1) % polygon.length];
          return (
            sum +
            Number(a[1] > y !== b[1] > y && x < a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]))
          );
        }, 0);
        assert.equal(crossings % 2, 1, 'Each cap triangle lies within the concave case outline');
        area += Math.abs(signedArea);
      }
      assert.ok(Math.abs(area - expectedArea) < 1e-7, 'Cap triangles cover the full polygon area');
    }
    const model = boundaryComponent(shape, 'Concave enclosure loft', 0xffffff, [0, 0, 0], 0, {
      edgeTolerance: 1e-7,
      minimumTriangleArea: 1e-12,
    });
    try {
      let volume = 0,
        meshes = 0;
      model.traverse((item) => {
        if (item instanceof Mesh) {
          meshes++;
          volume += closedPositive(item, `Concave shell inset ${inset}`);
        }
      });
      assert.equal(meshes, 1);
      assert.ok(Math.abs(volume - expectedArea * 3) < expectedArea * 3e-6);
    } finally {
      disposeModel(model);
    }
  }
});

test('hollow shell retains a complete floor and closed boundary for every enclosure preset', () => {
  const cavityArea = outlineArea(caseOutline(2.2)),
    missingFloorSamples = [
      [-5.3429281, -21.40671285],
      [-6, -21],
      [-4, -22.49],
    ];
  assert.ok(part.presets.length >= 7, 'Exercise every existing enclosure configuration');
  for (const preset of part.presets) {
    const p = parameters(preset.parameters),
      outer = guardedOuter(p),
      hollow = guardedShell(p),
      label = `${preset.id} hollow shell`;
    assert.equal(outer.kind, 'boundary', label);
    assert.equal(hollow.kind, 'boundary', label);
    if (outer.kind !== 'boundary' || hollow.kind !== 'boundary') continue;
    const outerBounds = new Box3().setFromPoints(
        outer.points.map((point) => new Vector3(...point.map(Math.fround))),
      ),
      sourceEdges = new Map<string, { uses: number; balance: number }>();
    let outerVolume = 0;
    for (const face of outer.faces) {
      assert.equal(face.length, 3, label + ': triangular exterior');
      const [a, b, c] = face.map((id) => new Vector3(...outer.points[id]));
      outerVolume += a.dot(b.clone().cross(c)) / 6;
    }
    for (const face of hollow.faces) {
      assert.equal(face.length, 3, label + ': triangular hollow boundary');
      const [a, b, c] = face.map((id) => new Vector3(...hollow.points[id].map(Math.fround)));
      assert.ok(
        b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-18,
        label + ': no degenerate Float32 triangle',
      );
      for (let i = 0; i < 3; i++) {
        const a = face[i],
          b = face[(i + 1) % 3],
          key = a < b ? `${a}:${b}` : `${b}:${a}`,
          edge = sourceEdges.get(key) ?? { uses: 0, balance: 0 };
        edge.uses++;
        edge.balance += a < b ? 1 : -1;
        sourceEdges.set(key, edge);
      }
    }
    assert.ok(
      [...sourceEdges.values()].every(({ uses, balance }) => uses === 2 && balance === 0),
      label + ': the authored shell is closed and consistently oriented before rendering',
    );
    // The independent cavity is the existing straight polygon from Z=2 to 28.
    // Its prism stays inside every authored exterior section; no Boolean result
    // is used as an oracle for this regression of the missing floor triangle.
    const expectedVolume = outerVolume - cavityArea * 26,
      model = boundaryComponent(hollow, label, 0xffffff, [0, 0, 0], 0, {
        edgeTolerance: 1e-7,
        minimumTriangleArea: 1e-12,
      });
    try {
      let volume = 0,
        meshes = 0;
      model.updateMatrixWorld(true);
      model.traverse((item) => {
        if (!(item instanceof Mesh)) return;
        meshes++;
        volume += closedPositive(item, label);
      });
      assert.equal(meshes, 1, label + ': one rendered shell');
      assert.ok(
        Math.abs(volume - expectedVolume) <= expectedVolume * 1e-5,
        `${label}: the exact cavity preserves material volume (${volume} versus ${expectedVolume})`,
      );
      const renderedBounds = new Box3().setFromObject(model);
      for (const end of ['min', 'max'] as const)
        assert.ok(
          renderedBounds[end].distanceTo(outerBounds[end]) < 1e-5,
          label + ': the complete exterior envelope remains exact',
        );
      for (const [x, y] of missingFloorSamples)
        for (const dx of [-0.015, 0, 0.015])
          for (const dy of [-0.015, 0, 0.015]) {
            const hits = new Raycaster(
              new Vector3(x + dx, y + dy, 3),
              new Vector3(0, 0, -1),
              0,
              10,
            ).intersectObject(model, true);
            assert.ok(hits.length, label + ': the cavity floor intercepts the inspection ray');
            assert.ok(
              Math.abs(hits[0].point.z - 2) < 1e-5,
              `${label}: a missing floor near ${x + dx}, ${y + dy} exposes the bottom skin`,
            );
          }
    } finally {
      disposeModel(model);
    }
  }
});

test('upper bezel roots remain smoothly faceted without folded exterior ridges', () => {
  for (const bodyModel of ['original', 'contoured', 'web-grip']) {
    for (const guardProjection of [5.5, 6]) {
      const boundary = guardSurface(parameters({ bodyModel, guardProjection }));
      assert.equal(boundary.kind, 'boundary');
      if (boundary.kind !== 'boundary') continue;
      const points = boundary.points.map((point) => new Vector3(...point.map(Math.fround)));
      const edges = new Map<string, { a: Vector3; b: Vector3; normals: Vector3[] }>();
      const key = (point: Vector3) =>
        point
          .toArray()
          .map((value) => Math.round(value * 1e5))
          .join(',');
      for (const face of boundary.faces.filter((face) => face.length === 3)) {
        const vertices = face.map((index) => points[index]);
        const normal = vertices[1]
          .clone()
          .sub(vertices[0])
          .cross(vertices[2].clone().sub(vertices[0]))
          .normalize();
        for (let index = 0; index < 3; index++) {
          const a = vertices[index],
            b = vertices[(index + 1) % 3],
            edgeKey = [key(a), key(b)].sort().join('/'),
            edge = edges.get(edgeKey) ?? { a, b, normals: [] };
          edge.normals.push(normal);
          edges.set(edgeKey, edge);
        }
      }
      let checked = 0,
        maximumAngle = 0;
      for (const { a, b, normals } of edges.values()) {
        if (normals.length !== 2 || normals.some((normal) => normal.x <= 0.05)) continue;
        const center = a.clone().add(b).multiplyScalar(0.5),
          dy = Math.abs(center.y + 35);
        // Exclude aperture walls and the intentional case return at Z27.8.
        // This is the exterior B-collar root where the original fold appeared.
        if (
          center.x <= 21.05 ||
          center.x > 26 ||
          dy < 8.25 ||
          dy > 11.5 ||
          center.z < 24.2 ||
          center.z > 27.4
        )
          continue;
        checked++;
        maximumAngle = Math.max(
          maximumAngle,
          (Math.acos(Math.max(-1, Math.min(1, normals[0].dot(normals[1])))) * 180) / Math.PI,
        );
      }
      const label = `${bodyModel}, guard ${guardProjection}`;
      assert.ok(checked >= 100, label + ': inspect a populated exterior-root patch');
      assert.ok(maximumAngle < 30, label + ': exterior ridge angle ' + maximumAngle);
    }
  }
});

test('handheld enclosure validates supported battery envelopes and independent momentary poses', () => {
  assert.equal(part.id, 'handheld-lora-controller');
  assert.equal(part.defaults.antennaType, 'external');
  assert.equal(part.defaults.externalMount, 'compact-top');
  assert.equal(part.defaults.bodyModel, 'contoured');
  assert.equal(part.defaults.safetyPosition, 'locked');
  assert.ok(
    !part.parameters.some((parameter) => ['gripStyle', 'antennaMount'].includes(parameter.key)),
  );
  assert.ok(!('gripStyle' in part.defaults) && !('antennaMount' in part.defaults));
  assert.deepEqual(part.states?.map((state) => state.id).sort(), [...states].sort());
  for (const state of states)
    for (const preset of part.presets)
      assert.deepEqual(
        validateParameters(part, preset.parameters, state),
        [],
        preset.id + '/' + state,
      );
  for (const extra of [
    { batteryLength: 40, batteryWidth: 20, batteryHeight: 5, guardProjection: 5.5 },
    { batteryLength: 43, batteryWidth: 25, batteryHeight: 10, guardProjection: 6 },
    { buttonA: 'last', buttonB: 'first' },
    { buttonA: 'first', buttonB: 'last' },
    { buttonA: 'first', buttonB: 'first', powerButton: 'last' },
    { antennaType: 'internal' },
    { antennaType: 'external', externalMount: 'bottom' },
    { antennaType: 'external', externalMount: 'top', bodyModel: 'contoured' },
    { antennaType: 'internal', bodyModel: 'original' },
    { antennaType: 'internal', bodyModel: 'contoured' },
    { antennaType: 'external', externalMount: 'compact-top' },
    { bodyModel: 'web-grip', safetyPosition: 'locked' },
    { bodyModel: 'web-grip', safetyPosition: 'unlocked', buttonA: 'last' },
  ] as Parameters[])
    assert.deepEqual(validateParameters(part, parameters(extra), 'assembled'), []);
  for (const extra of [
    { batteryLength: 51 },
    { batteryWidth: 26 },
    { batteryHeight: 11 },
    { batteryLength: 39 },
    { batteryWidth: 19 },
    { batteryHeight: 4 },
    { batteryLength: NaN },
    { batteryWidth: Infinity },
    { batteryHeight: '7' },
    { guardProjection: 5 },
    { guardProjection: 6.5 },
    { buttonA: 'latched' },
    { buttonB: 'center' },
    { powerButton: 'latched' },
    { module: 'invented-board' },
    { antennaType: 'rp-sma' },
    { externalMount: 'invented' },
    { bodyModel: 'invented' },
    { safetyPosition: 'invented' },
    { gripStyle: 'original' },
    { antennaMount: 'external-sma' },
    { bodyModel: 'web-grip', safetyPosition: 'locked', buttonA: 'last' },
  ] as Parameters[])
    assert.ok(
      validateParameters(part, parameters(extra), 'assembled').length,
      JSON.stringify(extra),
    );
  assert.ok(validateParameters(part, part.defaults, 'unknown-state').length);
});

test('two side buttons and the Heltec remain canonical purchased library occurrences', () => {
  const p = parameters({
    bodyModel: 'original',
    antennaType: 'external',
    externalMount: 'bottom',
    buttonB: 'last',
    powerButton: 'last',
  });
  const pieces = configuredPieces(p, 'assembled').map((piece) => piece.component);
  assert.equal(pieces.length, 23, '22 physical occurrences plus one battery reference');
  assert.equal(pieces.filter((piece) => piece.libraryId === 'bolt-screw').length, 6);
  assert.equal(pieces.filter((piece) => piece.libraryId === 'hex-nut').length, 6);
  assert.equal(
    pieces.filter((piece) => piece.manufacturing?.processes.includes('cutting')).length,
    2,
  );
  assert.ok(pieces.every((piece) => piece.quantity === 1));
  const buttons = pieces.filter(
    (piece) => piece.libraryId === 'panel-switch' && piece.parameters.model === 'daier-ds-225',
  );
  assert.equal(buttons.length, 2);
  const [upper, lower] = [...buttons].sort(
    (a, b) => a.placement.translation[1] - b.placement.translation[1],
  );
  assert.equal(upper.id, 'button-b');
  assert.equal(upper.parameters.capColour, 'red');
  assert.equal(lower.id, 'button-a');
  assert.equal(lower.parameters.capColour, 'black');
  const buttonPreview = componentGeometry(
    libraries,
    configuredPieces(p, 'assembled').filter((piece) =>
      ['button-a', 'button-b'].includes(piece.component.id),
    ),
  );
  try {
    buttonPreview.children.forEach((button) => {
      const expected = button.name.startsWith('Upper') ? 0xdc3e35 : 0x272e35;
      let actuators = 0;
      button.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (!(material instanceof MeshStandardMaterial)) continue;
          if (object.name.endsWith(' / DS-225 button actuator')) {
            assert.equal(material.color.getHex(), expected);
            actuators++;
          }
          if (object.name.includes(' / DS-225 mounting barrel'))
            assert.equal(material.color.getHex(), 0x272e35);
        }
      });
      assert.ok(actuators > 0, 'The canonical actuator renders with its requested colour');
    });
  } finally {
    disposeModel(buttonPreview);
  }
  assert.deepEqual(buttons.map((button) => button.parameters.position).sort(), ['first', 'last']);
  assert.ok(
    Math.abs(buttons[0].placement.translation[1] - buttons[1].placement.translation[1]) >= 20,
    'Separate finger positions leave room for two rectangular bezels',
  );
  assert.equal(buttons[0].placement.translation[0], buttons[1].placement.translation[0]);
  assert.equal(buttons[0].placement.translation[2], buttons[1].placement.translation[2]);
  for (const button of buttons) {
    assert.equal(button.parameters.model, 'daier-ds-225');
    assert.equal(button.parameters.panelThickness, layout(p).wall);
    assert.equal(button.supply, 'purchased');
    assert.deepEqual(button.placement.rotation, [0, 90, 0]);
    assert.ok(
      button.placement.translation[0] > 0,
      'Right-hand controls lie on the positive-X wall',
    );
  }
  const powerKeys = pieces.filter((piece) => piece.id === 'power-switch');
  assert.equal(powerKeys.length, 1);
  assert.equal(powerKeys[0].libraryId, 'manufactured-detail');
  assert.equal(powerKeys[0].supply, 'purchased');
  assert.equal(powerKeys[0].manufacturing, undefined);
  assert.ok(String(powerKeys[0].parameters.recipe).length > 0);
  assert.match(powerKeys[0].procurement?.manufacturer ?? '', /Unspecified.*user-owned/);
  assert.match(powerKeys[0].procurement?.source ?? '', /User measurements/);
  assert.ok(powerKeys[0].placement.rotation.every((angle) => Math.abs(angle) < 1e-9));
  assert.ok(
    powerKeys[0].placement.translation[1] < -40,
    'The directly pressed tactile switch occupies the tail opposite USB',
  );
  assert.ok(
    pieces.every(
      (piece) => piece.id !== 'power-cap' && !/^power-(?:retainer|screw|nut)/.test(piece.id),
    ),
    'The lid retains the real switch without a separate plastic cap, retainer or extra hardware',
  );
  const modules = pieces.filter((piece) => piece.libraryId === 'lora-module');
  assert.equal(modules.length, 1);
  assert.deepEqual(modules[0].parameters, { model: 'heltec-wifi-lora32-v4' });
  assert.equal(modules[0].supply, 'purchased');
  assert.deepEqual(
    modules[0].placement.rotation,
    [0, 0, 0],
    'The real Heltec board keeps its canonical orientation',
  );
  const pigtails = pieces.filter((piece) => piece.libraryId === 'rf-pigtail');
  assert.equal(pigtails.length, 1, 'One purchased kit supplies the jack and internal hardware');
  assert.equal(pigtails[0].supply, 'purchased');
  assert.deepEqual(pigtails[0].parameters, {
    model: 'amphenol-095-902-545-100',
    panelThickness: layout(p).wall,
  });
  assert.deepEqual(pigtails[0].placement.translation, layout(p).antenna.position);
  assert.deepEqual(pigtails[0].placement.rotation, [-90, 0, 0]);
  assert.ok(
    pigtails[0].placement.translation[1] > 50,
    'The antenna sits at the USB end, opposite the power key',
  );
  const route = layout(p).antenna.shrinkPath;
  const length = route
    .slice(1)
    .reduce(
      (sum, point, index) => sum + new Vector3(...point).distanceTo(new Vector3(...route[index])),
      0,
    );
  assert.ok(Math.abs(length - 12.7) < 0.01, 'The reserved first lead includes the full shrink');
  assert.ok(route[0][1] < 42.99, 'The flexible reservation starts behind the rigid metal end');
  assert.ok(route.at(-1)![2] > 16, 'The first lead rises above the battery bridge');
  assert.ok(
    pieces.every((piece) => !/^(?:antenna|rf)-(?:cable|heatshrink|amc)(?:-|$)/.test(piece.id)),
    'Unrouted flexible leads and loose mating plugs are not fictitious physical occurrences',
  );
  assert.ok(
    pieces.every((piece) => !/^pcb-(?:retainer|screw|nut)(?:-|$)/.test(piece.id)),
    'The lid retains the PCB without a separate bridge or its fasteners',
  );
  const canonicalIds = (state: string) =>
    configuredPieces(p, state)
      .filter((piece) => piece.component.supply !== 'reference')
      .map((piece) => piece.component.id)
      .sort();
  assert.deepEqual(canonicalIds('open'), canonicalIds('assembled'));
  assert.deepEqual(canonicalIds('exploded'), canonicalIds('assembled'));
});

test('every handheld configuration retains the switch with the lid and removes one printed occurrence', () => {
  for (const preset of part.presets) {
    const p = parameters(preset.parameters),
      components = part.composition!(p).components,
      prints = configuredPieces(p, 'print-layout').map((piece) => piece.component);
    assert.equal(
      components.length,
      (p.antennaType === 'internal' ? 21 : 22) + (p.bodyModel === 'web-grip' ? 5 : 0),
      preset.id + ': physical occurrences',
    );
    assert.equal(prints.length, p.bodyModel === 'web-grip' ? 5 : 3, preset.id);
    assert.ok(components.every((component) => component.id !== 'power-cap'));
    assert.ok(prints.every((component) => component.id !== 'power-cap'));
    assert.equal(
      components.filter((component) => component.libraryId === 'bolt-screw').length,
      p.bodyModel === 'web-grip' ? 7 : 6,
    );
    assert.equal(components.filter((component) => component.libraryId === 'hex-nut').length, 6);
    assert.equal(components.filter((component) => component.id === 'power-switch').length, 1);
    assert.ok(components.every((component) => component.id !== 'web-rotor'));
    const clamp = components.filter((component) => component.id.startsWith('clamp-'));
    if (p.bodyModel === 'web-grip') {
      assert.equal(prints.filter((component) => component.id === 'web-slider').length, 1);
      assert.deepEqual(clamp.map((component) => [component.id, component.libraryId]).sort(), [
        ['clamp-nut', 'nyloc-nut'],
        ['clamp-screw', 'bolt-screw'],
        ['clamp-washer', 'washer'],
      ]);
      assert.ok(clamp.every((component) => component.supply !== 'manufactured'));
    } else assert.equal(clamp.length, 0);
  }
});

test('Palm Lock rounded housing has no zero-area cap faces or inverted boundary seams', () => {
  const boundaries: Extract<Shape, { kind: 'boundary' }>[] = [];
  const visit = (shape: Shape) => {
    if (shape.kind === 'boundary') {
      boundaries.push(shape);
      shape.nativeCuts?.forEach(visit);
    } else if (shape.kind === 'transform') visit(shape.child);
    else if ('children' in shape) shape.children.forEach(visit);
  };
  const p = parameters({ bodyModel: 'web-grip' });
  visit(webBaseAdditions(p));
  visit(webLidAdditions(p));
  assert.ok(boundaries.length >= 2, 'Inspect both authored housing halves');
  for (const boundary of boundaries) {
    const points = boundary.points.map((point) => new Vector3(...point.map(Math.fround))),
      edges = new Map<string, { uses: number; balance: number }>(),
      key = (point: Vector3) =>
        point
          .toArray()
          .map((value) => Math.round(value * 1e5))
          .join(',');
    let volume = 0;
    for (const face of boundary.faces) {
      assert.equal(face.length, 3, 'Housing faces have explicit triangulation');
      const [a, b, c] = face.map((index) => points[index]),
        normal = b.clone().sub(a).cross(c.clone().sub(a));
      assert.ok(normal.lengthSq() > 1e-18, 'Rounded housing contains a zero-area cap triangle');
      volume += a.dot(b.clone().cross(c)) / 6;
      const keys = [a, b, c].map(key);
      for (let index = 0; index < 3; index++) {
        const from = keys[index],
          to = keys[(index + 1) % 3],
          edgeKey = [from, to].sort().join('/'),
          edge = edges.get(edgeKey) ?? { uses: 0, balance: 0 };
        edge.uses++;
        edge.balance += from < to ? 1 : -1;
        edges.set(edgeKey, edge);
      }
    }
    assert.ok(volume > 0, 'Housing boundary faces point outwards');
    assert.ok(
      [...edges.values()].every(({ uses, balance }) => uses === 2 && balance === 0),
      'Rounded housing forms a closed consistently oriented boundary',
    );
  }
});

test('Palm Lock fixed stock preserves the PCB support and lets the slider and lid assemble', () => {
  const p = parameters({ bodyModel: 'web-grip' }),
    site = reinforcement.pcbSupports[0],
    x = (site.x + site.wallX) / 2,
    origin = [x - 0.15, site.y - 1.4, 2.1] as [number, number, number],
    size = [0.3, 2.8, reinforcement.pcbWallTopZ - 2.7] as [number, number, number],
    witness: Shape = { kind: 'box', origin, size },
    expectedVolume = size.reduce(
      (volume, extent, i) => volume * (Math.fround(origin[i] + extent) - Math.fround(origin[i])),
      1,
    ),
    measure = (shape: Shape, label: string) => {
      const model = manifoldBoundaryComponent(shape, label, 0xffffff);
      try {
        let meshes = 0,
          volume = 0;
        model.traverse((item) => {
          if (!(item instanceof Mesh)) return;
          meshes++;
          volume += closedPositive(item, label);
        });
        assert.equal(meshes, 1);
        return volume;
      } finally {
        disposeModel(model);
      }
    };
  const retained = measure(
    { kind: 'subtract', children: [witness, webBaseCutouts(p)] },
    'Original PCB floor-to-wall support witness after every web-control cutter',
  );
  assert.ok(
    Math.abs(retained - expectedVolume) < 1e-6,
    'The lid-owned endcap must not cut away the original 2.8 mm wide support through Z=9.4',
  );
  const baseStock: Shape = {
    kind: 'subtract',
    children: [webBaseAdditions(p), webBaseCutouts(p)],
  };
  for (const travel of [8.4, 22.4, 36.4]) {
    const slider = webSliderAtTravel(travel),
      original = measure(slider, `Loading slider at ${travel}`),
      clear = measure(
        { kind: 'subtract', children: [slider, baseStock] },
        `Loading slider clear of the complete fixed pod at ${travel}`,
      );
    assert.ok(
      Math.abs(original - clear) < 1e-5,
      `The base-owned lower endcap obstructs the slider loading path at ${travel} mm`,
    );
  }
  for (const travel of [0, 4.2, 8.4]) {
    const slider = webSliderAtTravel(travel),
      original = measure(slider, `Slider at assembly inspection position ${travel}`);
    for (const lift of [20, 10, 6, 3, 1, 0.3, 0]) {
      const liftedHood: Shape = {
          kind: 'transform',
          child: webLidAdditions(p),
          translation: [0, 0, lift],
          rotation: [0, 0, 0],
        },
        clear = measure(
          { kind: 'subtract', children: [slider, liftedHood] },
          `Slider clear of the lid at ${lift} mm lift and ${travel} mm selector travel`,
        );
      assert.ok(
        Math.abs(original - clear) < 1e-5,
        `The lid sweeps through the closed slider loop at ${lift} mm lift and ${travel} mm travel`,
      );
    }
  }
});

test('Palm Lock moving prints stay closed and use separate linear selector and button travel', () => {
  const shapes = [
    ['released paddle', webPlungerAtTravel(0)],
    ['pressed paddle', webPlungerAtTravel(1.5)],
    ['locked slider', webSliderAtTravel(0)],
    ['unlocked slider', webSliderAtTravel(8.4)],
  ] as const;
  const metrics = shapes.map(([label, shape]) => {
    const model = boundaryComponent(shape, label, 0xffffff, [0, 0, 0], 0, {
      edgeTolerance: 1e-7,
      minimumTriangleArea: 1e-12,
    });
    try {
      model.updateMatrixWorld(true);
      let meshes = 0,
        volume = 0;
      model.traverse((item) => {
        if (item instanceof Mesh) {
          meshes++;
          volume += closedPositive(item, label);
        }
      });
      assert.equal(meshes, 1, label + ': one printable mesh');
      return { box: new Box3().setFromObject(model, true), volume };
    } finally {
      disposeModel(model);
    }
  });
  const [released, pressed, locked, unlocked] = metrics,
    normal = new Vector3(...webButton.frame.outward),
    pressDelta = pressed.box.min.clone().sub(released.box.min),
    sliderDelta = unlocked.box.min.clone().sub(locked.box.min);
  assert.equal(webButton.paddle.stroke, 1.5);
  assert.equal(webButton.paddle.takeUp, 0.5);
  assert.ok(Math.abs(pressDelta.dot(normal) + 1.5) < 1e-5);
  assert.ok(pressDelta.clone().addScaledVector(normal, 1.5).length() < 1e-5);
  assert.ok(Math.abs(sliderDelta.length() - 8.4) < 1e-5);
  assert.ok(Math.abs(sliderDelta.dot(normal)) < 1e-5);
  assert.ok(Math.abs(sliderDelta.z) < 1e-5, 'The selector remains in its captured rail plane');
  for (const [a, b] of [
    [released, pressed],
    [locked, unlocked],
  ]) {
    assert.ok(a.box.getSize(new Vector3()).distanceTo(b.box.getSize(new Vector3())) < 1e-5);
    assert.ok(Math.abs(a.volume - b.volume) < a.volume * 1e-5);
  }
});

test('direct power control uses the user-owned body and exposed actuator in both inspection poses', () => {
  const bounds: Box3[] = [];
  for (const powerButton of ['first', 'last']) {
    const p = parameters({ powerButton }),
      piece = configuredPieces(p, 'assembled').find(
        (piece) => piece.component.id === 'power-switch',
      )!,
      model = componentGeometry(libraries, [piece]);
    try {
      model.updateMatrixWorld(true);
      const box = new Box3().setFromObject(model, true);
      bounds.push(box);
      for (const [actual, expected] of [
        [box.min.x, -6],
        [box.max.x, 6],
        [box.min.y, powerButton === 'first' ? -52.5 : -52.3],
        [box.max.y, -42.5],
        [box.min.z, 15],
        [box.max.z, 27],
      ])
        assert.ok(Math.abs(actual - expected) < 0.001, `${powerButton}: authored switch package`);
      const crossSection = (y: number) =>
        [-1, 1].map(
          (sign) =>
            new Raycaster(
              new Vector3(sign * 20, y, 21),
              new Vector3(-sign, 0, 0),
              0,
              40,
            ).intersectObject(model, true)[0]?.point.x ?? NaN,
        );
      const bodySection = crossSection(-44.5),
        actuatorSection = crossSection(-50.5);
      assert.ok(Math.abs(bodySection[0] + 6) < 0.001 && Math.abs(bodySection[1] - 6) < 0.001);
      assert.ok(
        Math.abs(actuatorSection[0] + 3) < 0.001 && Math.abs(actuatorSection[1] - 3) < 0.001,
        'The exposed diameter-6 actuator is the real switch, without a printed extension',
      );
      assert.equal(layout(p).powerButton.faceRecess, 0.5);
    } finally {
      disposeModel(model);
    }
  }
  assert.ok(Math.abs(bounds[1].min.y - bounds[0].min.y - 0.2) < 0.001);
  assert.ok(bounds[0].max.distanceTo(bounds[1].max) < 0.001);
});

test('power switch drops into an open cradle and the closed lid supplies its retaining faces', () => {
  const p = parameters(),
    definitions = configuredPieces(p, 'assembled'),
    selected = ['base', 'lid', 'power-switch'].map((id) =>
      definitions.find((piece) => piece.component.id === id)!,
    ),
    model = componentGeometry(libraries, selected);
  try {
    model.updateMatrixWorld(true);
    const [base, lid] = model.children;
    for (const x of [-5.9, 0, 5.9])
      for (const y of [-46.4, -44.5, -42.6]) {
        const floor = new Raycaster(
          new Vector3(x, y, 35),
          new Vector3(0, 0, -1),
          0,
          40,
        ).intersectObject(base, true)[0]?.point.z;
        assert.ok(
          floor !== undefined && Math.abs(floor - 15) < 0.001,
          `The complete switch body can lower vertically to its floor at ${x}, ${y}`,
        );
      }
    for (const x of [-3.5, 0, 3.5]) {
      const bearing = new Raycaster(
        new Vector3(x, -44.5, 21),
        new Vector3(0, 0, 1),
        0,
        15,
      ).intersectObject(lid, true)[0]?.point.z;
      assert.ok(
        bearing !== undefined && Math.abs(bearing - 27) < 0.001,
        'The broad lid bearing meets the top of the 12 mm body',
      );
    }
    for (const x of [-2.8, 0, 2.8]) {
      const hit = new Raycaster(
        new Vector3(x, -60, 21),
        new Vector3(0, 1, 0),
        0,
        25,
      ).intersectObject(model, true)[0];
      assert.ok(hit && Math.abs(hit.point.y + 52.5) < 0.001);
      assert.equal(
        hit.object.name,
        selected[2].label,
        'The real switch actuator remains directly accessible through the closed round opening',
      );
    }
    const roof = new Raycaster(
      new Vector3(0, -51.3, 21),
      new Vector3(0, 0, 1),
      0,
      15,
    ).intersectObject(lid, true)[0]?.point.z;
    assert.ok(
      roof !== undefined && roof >= 24.29,
      'The lid closes the loading slot above the actuator without a loose snap-on piece',
    );
    for (const side of [-1, 1])
      for (const y of [-46.5, -44.5, -42.5])
        for (const z of [24.8, 25.2, 25.6]) {
          const post = new Raycaster(
              new Vector3(0, y, z),
              new Vector3(side, 0, 0),
              0,
              15,
            ).intersectObject(base, true)[0],
            rail = new Raycaster(
              new Vector3(side * 12, y, z),
              new Vector3(-side, 0, 0),
              0,
              12,
            ).intersectObject(lid, true)[0];
          assert.ok(post && rail, 'Both the lid rail and adjacent base post have a solid face');
          const clearance = Math.abs(post.point.x) - Math.abs(rail.point.x);
          assert.ok(
            clearance >= 0.15,
            `The lid rail clears the real tail-post boss at ${side}, ${y}, ${z}: ${clearance}`,
          );
        }
  } finally {
    disposeModel(model);
  }
});

test('compact lanyard admits a 3.6 mm swept cord envelope through every complete base', () => {
  const cord = reinforcement.lanyard;
  assert.equal(cord.profile, 'compact-u-teardrop');
  assert.equal(cord.roofAngleDegrees, 45);
  for (const bodyModel of ['original', 'contoured', 'web-grip']) {
    const model = part.buildGeometry(parameters({ bodyModel }), 'base-only');
    try {
      model.updateMatrixWorld(true);
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          material.side = DoubleSide;
        });
      });
      for (let segment = 0; segment + 1 < cord.cordPath.length; segment++) {
        const first = new Vector3(...cord.cordPath[segment]),
          last = new Vector3(...cord.cordPath[segment + 1]);
        for (const radius of [0, 1.8])
          for (let sample = 0; sample < (radius ? 48 : 1); sample++) {
            const angle = (sample * Math.PI) / 24;
            const offset = (index: number) => {
              const direction = cord.cordDirections[index];
              return new Vector3(
                direction[1] * radius * Math.cos(angle),
                -direction[0] * radius * Math.cos(angle),
                radius * Math.sin(angle),
              );
            };
            const start = first.clone().add(offset(segment)),
              end = last.clone().add(offset(segment + 1)),
              delta = end.clone().sub(start);
            assert.equal(
              new Raycaster(start, delta.clone().normalize(), 0, delta.length()).intersectObject(
                model,
                true,
              ).length,
              0,
              `${bodyModel}: uninterrupted swept cord at segment ${segment}, angle ${sample * 7.5}`,
            );
          }
      }
    } finally {
      disposeModel(model);
    }
  }
});

test('compact scalloped guard keeps its supporting plane beyond both released caps', () => {
  for (const guardProjection of [5.5, 6]) {
    const p = parameters({ guardProjection }),
      d = layout(p);
    assert.equal(d.flatSurfaceClearance, guardProjection - 5);
    assert.ok(d.flatSurfaceClearance >= 0.5 && d.flatSurfaceClearance <= 1);
    assert.equal(d.guardPlane, d.buttons[0].x + guardProjection);
    assert.equal(d.guardPlane - d.releasedCapPlane, d.flatSurfaceClearance);
    for (const bodyModel of ['original', 'contoured', 'web-grip']) {
      const boundary = guardSurface(parameters({ bodyModel, guardProjection }));
      assert.equal(boundary.kind, 'boundary');
      if (boundary.kind !== 'boundary') continue;
      const crest = boundary.points.reduce((maximum, [x]) => Math.max(maximum, x), -Infinity);
      assert.ok(
        Math.abs(crest - d.guardPlane) < 1e-8,
        `${bodyModel}: the modeled supporting crest leaves ${d.flatSurfaceClearance} mm above the released cap`,
      );
      assert.ok(
        boundary.points.every(([x]) => x <= d.releasedCapPlane + 1 + 1e-8),
        bodyModel + ': no protective crest rises more than 1 mm above the released cap',
      );
    }
  }
  const d = layout(part.defaults),
    model = part.buildGeometry(part.defaults, 'assembled');
  try {
    model.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(model, true),
      size = bounds.getSize(new Vector3());
    assert.ok(Math.abs(bounds.max.x - d.guardPlane) < 0.001);
    assert.ok(
      size.x * size.y * size.z <= previousEnvelopeVolume * 0.8,
      'Measured enclosure envelope is at least 20% smaller than the rejected bulky design',
    );
    const definitions = configuredPieces(part.defaults, 'assembled');
    const buttons = definitions.flatMap(({ component }, index) =>
      component.libraryId === 'panel-switch' && component.parameters.model === 'daier-ds-225'
        ? [model.children[index]]
        : [],
    );
    const module = model.children.find((child) => child.userData.libraryId === 'lora-module')!;
    assert.ok(
      new Box3().setFromObject(module, true).max.z <= d.seam - 0.3,
      'The complete module stays below the open case edge with at least 0.3 mm clearance',
    );
    const faces: Box3[] = [];
    module.traverse((mesh) => {
      if (mesh instanceof Mesh && mesh.name.endsWith('OLED active face'))
        faces.push(new Box3().setFromObject(mesh, true));
    });
    assert.equal(faces.length, 1, 'The canonical module contains its modeled display face');
    const lidIndex = definitions.findIndex(({ component }) => component.id === 'lid');
    const baseIndex = definitions.findIndex(({ component }) => component.id === 'base');
    const base = model.children[baseIndex];
    const lidTop = new Box3().setFromObject(model.children[lidIndex], true).max.z;
    const recess = lidTop - faces[0].max.z;
    assert.ok(recess >= 0.8 && recess <= 1.7, 'The display face lies close to the external cover');
    assert.equal(buttons.length, 2);
    for (const button of buttons)
      assert.ok(
        d.guardPlane - new Box3().setFromObject(button, true).max.x >=
          d.flatSurfaceClearance - 0.001,
        'All released button geometry clears the selected flat supporting surface',
      );
    const frontAt = (y: number, z: number) => {
      const ray = new Raycaster(new Vector3(35, y, z), new Vector3(-1, 0, 0), 0, 17);
      return ray.intersectObject(base, true)[0]?.point.x ?? -Infinity;
    };
    for (const button of d.buttons) {
      for (const [dy, dz] of [
        [-9, 0],
        [9, 0],
        // The rounded return curves away farther out. Sample the collar
        // 0.5 mm outside the bezel and 0.25 mm outside its clearance opening.
        [0, -8],
        [0, 8],
      ]) {
        const front = frontAt(button.y + dy, button.z + dz);
        assert.ok(
          front > button.x + 1.5 && front < button.x + 3,
          'A continuous shoulder approaches the bezel while leaving its front exposed',
        );
      }
      for (const [dy, dz] of [
        [-7.625, 0],
        [7.625, 0],
        [0, -7.625],
        [0, 7.625],
      ])
        assert.ok(
          frontAt(button.y + dy, button.z + dz) <= button.x + 0.02,
          'The fairing leaves a running gap around the purchased bezel sides',
        );
    }
  } finally {
    disposeModel(model);
  }
});

const antennaVariants = [
  { antennaType: 'external', externalMount: 'bottom' },
  { antennaType: 'external', externalMount: 'top' },
  { antennaType: 'internal', externalMount: 'compact-top' },
];
for (const preset of part.presets)
  test(`${preset.id} packaging references are excluded from physical exports and composition`, () => {
    const p = parameters(preset.parameters),
      pieces = configuredPieces(p, 'assembled');
    const references = pieces.filter((piece) => piece.component.supply === 'reference');
    assert.equal(references.length, p.antennaType === 'internal' ? 2 : 1);
    assert.ok(references.some((piece) => piece.component.id === 'battery-reference'));
    assert.equal(
      references.some((piece) => piece.component.id === 'internal-fpc-reference'),
      p.antennaType === 'internal',
    );
    const rf = pieces.filter((piece) => piece.component.libraryId === 'rf-pigtail');
    assert.equal(rf.length, p.antennaType === 'internal' ? 0 : 1);
    assert.equal(
      pieces.length - references.length,
      (p.antennaType === 'internal' ? 21 : 22) + (p.bodyModel === 'web-grip' ? 5 : 0),
    );
    assert.ok(part.buildExportGeometry && part.exportDimensions);
    assert.ok(
      part.composition!(p).components.every((component) => component.supply !== 'reference'),
    );
    const preview = part.buildGeometry(p, 'assembled'),
      physical = part.buildExportGeometry!(p, 'assembled');
    try {
      assert.equal(preview.children.length, physical.children.length + references.length);
      assert.equal(physical.children.length, pieces.length - references.length);
      for (const reference of references)
        assert.ok(!physical.children.some((child) => child.name === reference.label));
    } finally {
      disposeModel(preview);
      disposeModel(physical);
    }
    const d = layout(p);
    assert.ok(
      d.battery.z + d.battery.height < Math.min(...d.buttons.map((button) => button.z)),
      'Compact packaging deliberately staggers the battery below the buttons',
    );
  });

test('lid-mounted FPC follows the cover while all variants preserve the real electronics orientation', () => {
  const p = parameters({ antennaType: 'internal', bodyModel: 'contoured' });
  for (const state of ['assembled', 'open', 'exploded']) {
    const pieces = configuredPieces(p, state),
      lid = pieces.find((piece) => piece.component.id === 'lid')!,
      fpc = pieces.find((piece) => piece.component.id === 'internal-fpc-reference')!,
      battery = pieces.find((piece) => piece.component.id === 'battery-reference')!;
    assert.deepEqual(fpc.position ?? [0, 0, 0], lid.position ?? [0, 0, 0]);
    assert.deepEqual(battery.position ?? [0, 0, 0], [0, 0, 0]);
  }
  const baseline = configuredPieces(part.defaults, 'assembled')
    .filter((piece) =>
      ['heltec-board', 'power-switch', 'button-a', 'button-b'].includes(piece.component.id),
    )
    .map((piece) => ({ id: piece.component.id, placement: piece.component.placement }));
  assert.equal(baseline.length, 4);
  for (const variant of antennaVariants)
    for (const bodyModel of ['original', 'contoured']) {
      const actual = configuredPieces(parameters({ ...variant, bodyModel }), 'assembled')
        .filter((piece) => baseline.some((item) => item.id === piece.component.id))
        .map((piece) => ({ id: piece.component.id, placement: piece.component.placement }));
      assert.deepEqual(
        actual,
        baseline,
        `${variant.antennaType}/${variant.externalMount}/${bodyModel}: electronic datums`,
      );
    }
});

for (const preset of part.presets)
  test(`${preset.id} print layout has separate closed pieces on the bed`, () => {
    const p = parameters(preset.parameters),
      definitions = configuredPieces(p, 'print-layout');
    assert.deepEqual(
      definitions.map((piece) => piece.component.id).sort(),
      details(p)
        .map((detail) => detail.id)
        .sort(),
    );
    assert.equal(definitions.length, p.bodyModel === 'web-grip' ? 5 : 3);
    assert.ok(definitions.every((piece) => piece.component.id !== 'power-cap'));
    assert.ok(
      definitions.every(
        (piece) =>
          piece.component.supply === 'manufactured' &&
          piece.component.manufacturing?.processes.includes('printing'),
      ),
    );
    const model = part.buildGeometry(p, 'print-layout');
    try {
      model.updateMatrixWorld(true);
      let printedVolume = 0;
      const boxes = model.children.map((child, i) => {
        let meshes = 0;
        child.traverse((mesh) => {
          if (mesh instanceof Mesh) {
            meshes++;
            printedVolume += closedPositive(mesh, definitions[i].component.id);
          }
        });
        assert.equal(meshes, 1, 'Each printed item is one mesh');
        const box = new Box3().setFromObject(child, true);
        assert.ok(
          Math.abs(box.min.z) < 0.001,
          definitions[i].component.id + ': rests on print bed',
        );
        return box;
      });
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++)
          assert.ok(
            !boxes[i].intersectsBox(boxes[j]),
            'Printed parts have separate bed footprints',
          );
      const actual = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray(),
        expected = part.dimensions(p, 'print-layout');
      assert.ok(actual.every((value, i) => Math.abs(value - expected[i]) < 0.001));
      assert.ok(
        printedVolume <= previousPrintedVolume * 0.9,
        'Measured printed material is at least 10% below the rejected bulky design',
      );
    } finally {
      disposeModel(model);
    }
  });

import { ShapeUtils, Vector2 } from 'three';
import type { Parameters } from '../../../core/types';
import type { Shape, Vec } from '../../../core/assembly/boundary/shapes';
import { caseOutline } from './shapes';
import { floorCapCenter, gripRings } from './grip';
import { applyBezelPockets, bezelSeat } from './bezel-pockets';
import { layout, shell } from './layout';

const ease = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
const roundedDistance = (y: number, z: number, width: number, height: number, radius: number) => {
  const u = Math.abs(y) - width / 2 + radius,
    v = Math.abs(z) - height / 2 + radius;
  return Math.hypot(Math.max(u, 0), Math.max(v, 0)) + Math.min(Math.max(u, v), 0) - radius;
};
const smoothMaximum = (a: number, b: number) => {
  // A broad blend preserves the rounded collar return with the lower crests.
  const blend = 3.5,
    h = Math.max(0, blend - Math.abs(a - b)) / blend;
  return Math.max(a, b) + (h * h * blend) / 4;
};

/** One continuous exterior replaces the intersecting cheek, toe and bezel lofts. */
function guardProfile(p: Parameters) {
  const d = layout(p),
    buttons = d.buttons.filter((button) => button.x > 0),
    projection = Number(p.guardProjection),
    gripStart = p.bodyModel === 'web-grip' ? -22.5 : 3,
    radius = 11.3,
    lip = 0.65,
    tangentY = Math.sqrt(radius * radius + 2 * radius * lip),
    joinY = (tangentY * radius) / (radius + lip),
    lipOffsets = Array.from(
      { length: 5 },
      (_, i) => bezelSeat.width / 2 + bezelSeat.lipRadius * (1 - Math.cos((i * Math.PI) / 8)),
    ),
    zLevels = [
      ...new Set([
        3.8,
        5,
        7,
        9.2,
        9.5,
        10.5,
        11.2,
        12.8,
        14,
        18.5,
        24.2,
        27.8,
        ...Array.from({ length: 51 }, (_, i) => 23 + i * 0.1),
        ...buttons.flatMap((button) =>
          lipOffsets.flatMap((offset) => [button.z - offset, button.z + offset]),
        ),
      ]),
    ].sort((a, b) => a - b),
    ys = [
      ...new Set([
        ...Array.from({ length: 87 }, (_, i) => -51.5 + (103 * i) / 86),
        ...[0, 0.36, d.wall].flatMap((inset) => caseOutline(inset).map(([, y]) => y)),
        ...buttons.flatMap((button) =>
          [
            ...Array.from({ length: 101 }, (_, i) => -12.5 + i * 0.25),
            ...Array.from({ length: 76 }, (_, i) => 8.5 + i * 0.05),
            ...lipOffsets,
            0,
            4.5,
            7.75,
            9,
            10,
            11,
            12,
            joinY,
            tangentY,
            12.5,
          ].flatMap((offset) => [button.y - offset, button.y + offset]),
        ),
        ...d.guardSupportYs,
        -47.1,
        gripStart,
        44,
        45.5,
      ]),
    ]
      .filter((y) => y >= -51.5 && y <= 51.5)
      .sort((a, b) => a - b)
      .filter((y, i, all) => i === 0 || y - all[i - 1] > 1e-6);
  const camX = (y: number) => {
    let depth = projection;
    for (const button of buttons) {
      const dy = Math.abs(y - button.y);
      if (dy < joinY) depth = Math.min(depth, projection - Math.sqrt(radius * radius - dy * dy));
      else if (dy < tangentY)
        depth = Math.min(
          depth,
          projection - lip + Math.sqrt(Math.max(0, lip * lip - (dy - tangentY) ** 2)),
        );
    }
    if (y > gripStart && y < 44)
      depth = Math.min(
        depth,
        1 + (projection - 1) * Math.cos((Math.PI * (y - gripStart)) / (44 - gripStart)) ** 2,
      );
    return 21 + depth;
  };
  const collarX = (y: number, z: number, wall: number) => {
    let result = wall - 0.65;
    for (const button of buttons) {
      const dy = y - button.y,
        dz = z - button.z,
        // A single distance field gives the collar a rounded shoulder instead of
        // folding between almost coincident nested section rims.
        distance = roundedDistance(dy, dz, 24, 18.6, 2.5),
        rise = ease(-distance / 1.8),
        face = bezelSeat.shoulderFront - 0.08 * (dy / 12) ** 2 - 0.08 * (dz / 9.3) ** 2,
        fade = ease((12 - Math.abs(dy)) / 2);
      result = Math.max(result, wall - 0.65 + fade * rise * (face - wall + 0.65));
    }
    return result;
  };
  const front = (y: number, z: number, wall: number) => {
    const vertical = z < 12.8 ? ease((z - 3.8) / 9) : z > 24.2 ? ease((27.8 - z) / 3.6) : 1,
      end = Math.min(ease((y + 51.5) / 4.4), ease((51.5 - y) / 6)),
      guard = wall - 0.65 + vertical * end * (Math.max(0, camX(y) - wall) + 0.65);
    let lipReturn = 0;
    for (const button of buttons) {
      const distance = roundedDistance(
          y - button.y,
          z - button.z,
          bezelSeat.width,
          bezelSeat.width,
          bezelSeat.cornerRadius,
        ),
        remaining = bezelSeat.lipRadius - Math.max(0, Math.min(bezelSeat.lipRadius, distance));
      // A quarter-circle rolls the front into the straight pocket wall. It
      // leaves the purchased bezel clearance and the X21 mounting datum intact.
      lipReturn = Math.max(
        lipReturn,
        bezelSeat.lipRadius - Math.sqrt(Math.max(0, bezelSeat.lipRadius ** 2 - remaining ** 2)),
      );
    }
    const projection = smoothMaximum(guard, collarX(y, z, wall)) - wall - lipReturn;
    // A five-micron return is below the authored curve approximation. Ending it
    // on the exact wall avoids a near-tangent skin at the Boolean junction.
    return projection < 0.005 ? wall : Math.min(d.guardPlane, wall + projection);
  };
  return { d, buttons, zLevels, ys, front };
}

/** Sew the existing right case branch directly into the rounded guard field. */
export function guardedSkin(p: Parameters) {
  const profile = guardProfile(p),
    rings = gripRings(p),
    stride = rings[0].length,
    points = rings.flat().map((v): Vec => [...v]),
    ids = new Map(points.map((point, i) => [point.map((v) => Math.round(v * 1e8)).join(','), i])),
    shellFaces: number[][] = [],
    frontFaces: number[][] = [];
  const intern = (point: Vec) => {
    const key = point.map((v) => Math.round(v * 1e8)).join(','),
      existing = ids.get(key);
    if (existing !== undefined) return existing;
    points.push(point);
    ids.set(key, points.length - 1);
    return points.length - 1;
  };
  const zs = [...new Set([...rings.map((ring) => ring[0][2]), ...profile.zLevels])]
    .sort((a, b) => a - b)
    .filter(
      (z, i, all) =>
        z >= rings[0][0][2] && z <= rings.at(-1)![0][2] && (i === 0 || z - all[i - 1] > 1e-8),
    );
  const cases = zs.map((z) => {
    let layer = rings.findIndex((ring) => ring[0][2] >= z - 1e-9);
    if (layer < 0) layer = rings.length - 1;
    if (Math.abs(rings[layer][0][2] - z) < 1e-8) return rings[layer].slice(17, 51);
    const lower = rings[layer - 1],
      upper = rings[layer],
      t = (z - lower[0][2]) / (upper[0][2] - lower[0][2]);
    return upper
      .slice(17, 51)
      .map((point, i): Vec => [
        lower[i + 17][0] + t * (point[0] - lower[i + 17][0]),
        lower[i + 17][1] + t * (point[1] - lower[i + 17][1]),
        z,
      ]);
  });
  const caseX = (row: number, y: number) => {
    const arc = cases[row];
    for (let i = 0; i + 1 < arc.length; i++) {
      const a = arc[i],
        b = arc[i + 1];
      if (y >= a[1] - 1e-8 && y <= b[1] + 1e-8) {
        const t = (y - a[1]) / (b[1] - a[1]);
        return a[0] + t * (b[0] - a[0]);
      }
    }
    throw new Error('The guard station must lie on the positive case branch.');
  };
  const fieldX = (row: number, y: number) => {
    const wall = caseX(row, y),
      z = zs[row];
    return z >= 3.8 && y >= -51.5 && y <= 51.5 ? Math.max(wall, profile.front(y, z, wall)) : wall;
  };
  const sampledRows = zs.map((z, row) => {
    const arc = cases[row],
      low = arc[0][1],
      high = arc.at(-1)![1],
      candidates = [
        ...new Set([
          ...profile.ys.filter((y) => y > low + 1e-8 && y < high - 1e-8),
          ...arc.map((point) => point[1]),
        ]),
      ]
        .sort((a, b) => a - b)
        .filter((y, i, all) => i === 0 || y - all[i - 1] > 1e-8),
      xs = candidates.map((y) => fieldX(row, y)),
      selected = new Set([0, candidates.length - 1]);
    candidates.forEach((y, i) => {
      if (
        (Math.abs(xs[i] - caseX(row, y)) < 1e-8 &&
          arc.some((point) => Math.abs(y - point[1]) < 1e-8)) ||
        (z >= 12.8 && z <= 24.2 && profile.d.guardSupportYs.some((v) => Math.abs(y - v) < 1e-8))
      )
        selected.add(i);
    });
    const anchors = [...selected].sort((a, b) => a - b),
      stack = anchors.slice(1).map((last, i) => [anchors[i], last]);
    while (stack.length) {
      const [first, last] = stack.pop()!;
      let worst = z >= 25.7 && z <= 26.3 ? 0.001 : 0.005,
        split = -1;
      for (let i = first + 1; i < last; i++) {
        const t = (candidates[i] - candidates[first]) / (candidates[last] - candidates[first]),
          error = Math.abs(xs[i] - xs[first] - t * (xs[last] - xs[first]));
        if (error > worst) {
          worst = error;
          split = i;
        }
      }
      if (split >= 0) {
        selected.add(split);
        stack.push([first, split], [split, last]);
      }
    }
    return [...selected].sort((a, b) => a - b).map((i) => candidates[i]);
  });
  const rows = sampledRows.map((row, j) => {
      // The circular lip introduces close Z stations. A common Y sampling on
      // those thin strips avoids long diagonal fans and artificial ridges.
      let first = j,
        last = j;
      while (first > 0 && zs[first] - zs[first - 1] < 0.025) first--;
      while (last + 1 < zs.length && zs[last + 1] - zs[last] < 0.025) last++;
      return [...new Set(sampledRows.slice(Math.max(0, first - 1), last + 2).flat())]
        .filter((y) => y >= cases[j][0][1] - 1e-8 && y <= cases[j].at(-1)![1] + 1e-8)
        .sort((a, b) => a - b)
        .filter((y, i, all) => i === 0 || y - all[i - 1] > 1e-8);
    }),
    frontIds = rows.map((row, j) => row.map((y) => intern([fieldX(j, y), y, zs[j]])));
  for (let j = 0; j + 1 < rows.length; j++) {
    let a = 0,
      b = 0;
    while (a + 1 < rows[j].length || b + 1 < rows[j + 1].length) {
      const nextA = rows[j][a + 1] ?? Infinity,
        nextB = rows[j + 1][b + 1] ?? Infinity;
      if (Math.abs(nextA - nextB) < 1e-8) {
        frontFaces.push(
          [frontIds[j][a], frontIds[j][a + 1], frontIds[j + 1][b + 1]],
          [frontIds[j][a], frontIds[j + 1][b + 1], frontIds[j + 1][b]],
        );
        a++;
        b++;
      } else if (nextA < nextB) {
        frontFaces.push([frontIds[j][a], frontIds[j][a + 1], frontIds[j + 1][b]]);
        a++;
      } else {
        frontFaces.push([frontIds[j][a], frontIds[j + 1][b + 1], frontIds[j + 1][b]]);
        b++;
      }
    }
  }
  for (let layer = 0; layer + 1 < rings.length; layer++) {
    // Keep every face of the purchased-electronics/palm side exactly as before.
    for (let i = 0; i < stride; i++) {
      if (i >= 16 && i <= 50) continue;
      const a = layer * stride + i,
        b = layer * stride + ((i + 1) % stride);
      shellFaces.push([a, b, b + stride], [a, b + stride, a + stride]);
    }
    const inside = zs.flatMap((z, row) =>
      z >= rings[layer][0][2] - 1e-8 && z <= rings[layer + 1][0][2] + 1e-8 ? [row] : [],
    );
    for (const [left, top] of [
      [16, false],
      [51, true],
    ] as const) {
      const anchor = layer * stride + left,
        opposite = (layer + 1) * stride + left,
        edge = inside.map((row) => (top ? frontIds[row].at(-1)! : frontIds[row][0]));
      for (let j = 0; j + 1 < edge.length; j++)
        shellFaces.push(top ? [anchor, edge[j + 1], edge[j]] : [anchor, edge[j], edge[j + 1]]);
      shellFaces.push(top ? [anchor, opposite, edge.at(-1)!] : [anchor, edge.at(-1)!, opposite]);
    }
  }
  for (const [layer, row, top] of [
    [0, 0, false],
    [rings.length - 1, rows.length - 1, true],
  ] as const) {
    const boundary = [
        ...frontIds[row],
        ...Array.from({ length: stride - 51 }, (_, i) => layer * stride + 51 + i),
        ...Array.from({ length: 17 }, (_, i) => layer * stride + i),
      ],
      center = intern([...floorCapCenter, zs[row]]);
    for (let i = 0; i < boundary.length; i++) {
      const face = [center, boundary[i], boundary[(i + 1) % boundary.length]];
      shellFaces.push(top ? face : face.reverse());
    }
  }
  return { points, shellFaces, frontFaces, buttons: profile.buttons };
}

/** Closed outer solid with bezel pockets authored as part of the same boundary. */
export function guardedOuter(p: Parameters): Shape {
  const skin = guardedSkin(p);
  return applyBezelPockets(skin.points, skin.shellFaces, skin.frontFaces, skin.buttons);
}

/** Hollow case with planar inner faces sewn directly to the unchanged exterior. */
export function guardedShell(p: Parameters): Shape {
  const outer = guardedOuter(p);
  if (outer.kind !== 'boundary') throw Error('The guarded exterior must be an authored boundary.');
  const points: Vec[] = outer.points.map((p) => [...p]);
  const top = (id: number) => Math.abs(points[id][2] - shell.seam) < 1e-8;
  const faces = outer.faces.filter((face) => !face.every(top)).map((face) => [...face]);
  const edges = new Map<string, { a: number; b: number; count: number }>();
  for (const face of faces)
    for (let i = 0; i < face.length; i++) {
      const a = face[i],
        b = face[(i + 1) % face.length],
        key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const e = edges.get(key) ?? { a, b, count: 0 };
      e.count++;
      edges.set(key, e);
    }
  const rim = [...edges.values()].filter((e) => e.count === 1 && top(e.a) && top(e.b));
  const next = new Map<number, number>();
  for (const e of rim) {
    if (next.has(e.b)) throw Error('Branched top rim');
    next.set(e.b, e.a);
  }
  const loop: number[] = [];
  let id = rim[0].b;
  do {
    loop.push(id);
    const n = next.get(id);
    if (n === undefined) throw Error('Open top rim');
    id = n;
    if (loop.length > rim.length) throw Error('Invalid top rim cycle');
  } while (id !== loop[0]);
  if (loop.length !== rim.length) throw Error('The top rim must have one cycle.');
  const signedArea = (ids: number[]) =>
    ids.reduce((sum, id, i) => {
      const p = points[id],
        q = points[ids[(i + 1) % ids.length]];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0);
  if (signedArea(loop) < 0) throw Error('The exterior top rim must wind outward.');
  let inner = caseOutline(shell.wall);
  if (
    inner.reduce((sum, p, i) => {
      const q = inner[(i + 1) % inner.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0) < 0
  )
    inner = [...inner].reverse();
  const floor = inner.map(([x, y]) => {
    points.push([x, y, shell.floor]);
    return points.length - 1;
  });
  const roof = inner.map(([x, y]) => {
    points.push([x, y, shell.seam]);
    return points.length - 1;
  });
  for (let i = 0; i < inner.length; i++) {
    const j = (i + 1) % inner.length,
      a = floor[i],
      b = floor[j],
      c = roof[j],
      d = roof[i];
    faces.push([a, c, b], [a, d, c]);
  }
  // Earcut can omit collinear boundary vertices. Split every surviving cap edge
  // at the exact sewn loop points before triangulating the resulting triangle.
  const cap = (boundary: number[], holes: number[][] = []) => {
    const all = [...boundary, ...holes.flat()],
      vectors = (ids: number[]) => ids.map((id) => new Vector2(points[id][0], points[id][1]));
    for (const triangle of ShapeUtils.triangulateShape(vectors(boundary), holes.map(vectors))) {
      let ids = triangle.map((i) => all[i]);
      const [va, vb, vc] = ids.map((id) => points[id].map(Math.fround));
      const area = (vb[0] - va[0]) * (vc[1] - va[1]) - (vb[1] - va[1]) * (vc[0] - va[0]);
      const [pa, pb, pc] = ids.map((id) => points[id]);
      const exactArea = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]);
      const longest = Math.max(
        Math.hypot(pb[0] - pa[0], pb[1] - pa[1]),
        Math.hypot(pc[0] - pa[0], pc[1] - pa[1]),
        Math.hypot(pc[0] - pb[0], pc[1] - pb[1]),
      );
      if (Math.abs(exactArea) <= 1e-8 * longest || area * area < 1e-18) continue;
      if (area < 0) ids.reverse();
      const refined: number[] = [];
      for (let i = 0; i < 3; i++) {
        const a = ids[i],
          b = ids[(i + 1) % 3],
          pa = points[a],
          pb = points[b],
          dx = pb[0] - pa[0],
          dy = pb[1] - pa[1],
          l2 = dx * dx + dy * dy;
        const mids = all
          .filter((id) => id !== a && id !== b)
          .flatMap((id) => {
            const q = points[id],
              t = ((q[0] - pa[0]) * dx + (q[1] - pa[1]) * dy) / l2;
            return t > 1e-10 &&
              t < 1 - 1e-10 &&
              Math.hypot(q[0] - pa[0] - t * dx, q[1] - pa[1] - t * dy) < 1e-8
              ? [{ id, t }]
              : [];
          })
          .sort((a, b) => a.t - b.t);
        refined.push(a, ...mids.map((v) => v.id));
      }
      if (refined.length === 3) {
        faces.push(refined);
        continue;
      }
      const center: Vec = [0, 1, 2].map(
        (axis) => ids.reduce((sum, id) => sum + points[id][axis], 0) / 3,
      ) as Vec;
      points.push(center);
      const c = points.length - 1;
      for (let i = 0; i < refined.length; i++)
        faces.push([c, refined[i], refined[(i + 1) % refined.length]]);
    }
  };
  cap(floor);
  cap(loop, [[...roof].reverse()]);
  return { kind: 'boundary', points, faces };
}

/** Raw sewn skin used to audit the exterior before its bezel pockets are applied. */
export function guardSurface(p: Parameters): Shape {
  const { points, shellFaces, frontFaces } = guardedSkin(p);
  return { kind: 'boundary', points, faces: [...shellFaces, ...frontFaces] };
}

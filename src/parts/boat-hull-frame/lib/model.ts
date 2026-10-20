import type { Parameters } from '../../../core/types';
import type { AssemblyComponent } from '../../../core/product-types';
import { detailComponent } from '../../../core/component-recipes';
import type { Shape, Vec } from '../../../core/assembly/boundary/shapes';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';

export type Point = [number, number];
export interface Panel {
  id: string;
  label: string;
  outline: Point[];
  holes: Point[][];
  translation: Vec;
  rotation: Vec;
}
export const area = (p: Point[]) =>
  p.reduce((sum, a, i) => {
    const b = p[(i + 1) % p.length];
    return sum + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
const ccw = (p: Point[]) => (area(p) < 0 ? [...p].reverse() : p);
/** Convex inward offset: every perimeter edge keeps the requested normal web. */
export function inset(poly: Point[], distance: number): Point[] {
  const p = ccw(poly).filter((b, i, list) => {
    const a = list[(i + list.length - 1) % list.length],
      c = list[(i + 1) % list.length];
    return Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) > 1e-9;
  });
  const lines = p.map((a, i) => {
    const b = p[(i + 1) % p.length],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      length = Math.hypot(dx, dy);
    return {
      a: [a[0] - (dy / length) * distance, a[1] + (dx / length) * distance] as Point,
      d: [dx, dy] as Point,
    };
  });
  return lines.map((line, i) => {
    const prior = lines[(i + lines.length - 1) % lines.length];
    const det = prior.d[0] * line.d[1] - prior.d[1] * line.d[0];
    const dx = line.a[0] - prior.a[0],
      dy = line.a[1] - prior.a[1];
    const t = (dx * line.d[1] - dy * line.d[0]) / det;
    return [prior.a[0] + prior.d[0] * t, prior.a[1] + prior.d[1] * t];
  });
}
function clip(poly: Point[], limit: number, side: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    const ai = side * (a[0] - limit) >= 0,
      bi = side * (b[0] - limit) >= 0;
    if (ai) out.push(a);
    if (ai !== bi) {
      const t = (limit - a[0]) / (b[0] - a[0]);
      out.push([limit, a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}
export function widthAt(p: Parameters, u: number): number {
  const nodes: Point[] = [
    [0, 0.12],
    [0.16, 0.57],
    [0.43, 1],
    [0.7, 0.98],
    [1, +p.sternBeam / 100],
  ];
  const i = Math.max(
      1,
      nodes.findIndex((s) => s[0] >= u),
    ),
    a = nodes[i - 1],
    b = nodes[i];
  return +p.beam * (a[1] + ((b[1] - a[1]) * (u - a[0])) / (b[0] - a[0]));
}
export const bottomAt = (p: Parameters, u: number) => +p.rocker * (1 - u) ** 2;
export const topAt = (p: Parameters, u: number) => +p.depth + +p.sheer * (1 - u) ** 3;
export const frameStations = (p: Parameters) => {
  const us = Array.from(
    { length: +p.frameCount },
    (_, i) => 0.14 + (0.8 * i) / (+p.frameCount - 1),
  );
  const mid = us.reduce(
    (best, u, i) => (Math.abs(u - 0.43) < Math.abs(us[best] - 0.43) ? i : best),
    0,
  );
  us[mid] = 0.43;
  return us.map((u) => {
    return {
      u,
      x: (u - 0.5) * +p.length,
      width: widthAt(p, u),
      bottom: bottomAt(p, u),
      top: topAt(p, u),
    };
  });
};
export function panels(p: Parameters): Panel[] {
  const stations = frameStations(p),
    slot = +p.thickness + +p.fitClearance,
    half = slot / 2;
  const keelOutline: Point[] = [[-+p.length / 2, bottomAt(p, 0)]];
  // The same ruled lower/top boundaries are used at every lap joint.
  for (const s of stations) keelOutline.push([s.x - half, s.bottom], [s.x + half, s.bottom]);
  keelOutline.push([+p.length / 2, 0], [+p.length / 2, +p.keelHeight]);
  for (const s of [...stations].reverse()) {
    const joint = s.bottom + +p.keelHeight / 2;
    keelOutline.push(
      [s.x + half, s.bottom + +p.keelHeight],
      [s.x + half, joint],
      [s.x - half, joint],
      [s.x - half, s.bottom + +p.keelHeight],
    );
  }
  keelOutline.push([-+p.length / 2, +p.rocker + +p.keelHeight]);
  const result: Panel[] = [
    {
      id: 'keel',
      label: 'Longitudinal keel',
      outline: ccw(keelOutline),
      holes: [],
      translation: [0, +p.thickness / 2, 0],
      rotation: [90, 0, 0],
    },
  ];
  const tangent = Math.tan((+p.deadrise * Math.PI) / 180);
  for (const [i, s] of stations.entries()) {
    const chine = s.width * 0.35,
      chineZ = s.bottom + chine * tangent;
    const boundary: Point[] = [
      [-s.width / 2, s.top],
      [-chine, chineZ],
      [0, s.bottom],
      [chine, chineZ],
      [s.width / 2, s.top],
    ];
    const joint = s.bottom + +p.keelHeight / 2;
    const outline = ccw([
      boundary[0],
      boundary[1],
      [-half, s.bottom + half * tangent],
      [-half, joint],
      [half, joint],
      [half, s.bottom + half * tangent],
      boundary[3],
      boundary[4],
    ]);
    const centerWeb = Math.max(+p.web, slot + 2 * +p.web);
    const inner = inset(boundary, +p.web);
    const holes = p.lightening
      ? [-1, 1]
          .map((side) => clip(inner, (side * centerWeb) / 2, side))
          .filter(
            (hole) =>
              hole.length >= 3 &&
              area(hole) > 50 &&
              Math.max(...hole.map(([x]) => x)) - Math.min(...hole.map(([x]) => x)) > 6,
          )
      : [];
    result.push({
      id: 'frame-' + (i + 1),
      label: `Transverse frame ${i + 1} / X ${s.x.toFixed(1)} mm`,
      outline,
      holes,
      translation: [s.x - +p.thickness / 2, 0, 0],
      rotation: [90, 0, 90],
    });
  }
  return result;
}
export function flatPanels(p: Parameters): Panel[] {
  let x = 0,
    y = 0,
    row = 0;
  return panels(p).map((panel) => {
    const xs = panel.outline.map(([a]) => a),
      ys = panel.outline.map(([, b]) => b);
    const w = Math.max(...xs) - Math.min(...xs),
      h = Math.max(...ys) - Math.min(...ys);
    if (x && x + w > +p.length + 1) {
      x = 0;
      y += row + 16;
      row = 0;
    }
    const result = {
      ...panel,
      translation: [x - Math.min(...xs), y - Math.min(...ys), 0] as Vec,
      rotation: [0, 0, 0] as Vec,
    };
    x += w + 16;
    row = Math.max(row, h);
    return result;
  });
}
export function occurrence(p: Parameters, panel: Panel): AssemblyComponent {
  const flat: Shape = {
    kind: 'plate',
    outline: panel.outline,
    holes: panel.holes,
    z: 0,
    height: +p.thickness,
  };
  const component = detailComponent(panel.id, panel.label, {
    kind: 'transform',
    child: flat,
    translation: panel.translation,
    rotation: panel.rotation,
  });
  component.manufacturing = {
    material: 'Plywood; specify marine/birch grade, ply direction and adhesive system',
    blank: `${+p.thickness} mm sheet`,
    processes: ['cutting'],
    requirements: [
      'Cut the labelled closed contours at measured stock thickness. Qualify kerf, slot clearance and cutter corner relief with a coupon.',
      'Use the common deck/keel datums during adhesive assembly. Add qualified skin, gunwales and longitudinal reinforcement.',
    ],
  };
  return component;
}
export function pieces(p: Parameters, state: string): ConfiguredPiece[] {
  let selected = state === 'cut' ? flatPanels(p) : panels(p);
  if (state === 'keel') selected = selected.slice(0, 1);
  if (state === 'frame') selected = [selected[1 + Math.floor(+p.frameCount / 2)]];
  return selected.map((panel, i) => ({
    component: occurrence(p, panel),
    label: panel.label,
    color: i === 0 ? 0xb3814c : 0xd7b983,
    requireSingleSolid: true,
    position: [0, 0, state === 'exploded' ? i * +p.explodedGap : 0] as Vec,
  }));
}
export function cuttingDxf(p: Parameters): string {
  const lines = [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$ACADVER',
    '1',
    'AC1015',
    '9',
    '$INSUNITS',
    '70',
    '4',
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'ENTITIES',
  ];
  for (const [i, panel] of flatPanels(p).entries()) {
    for (const [index, path] of [panel.outline, ...panel.holes].entries()) {
      const contour = index && area(path) > 0 ? [...path].reverse() : path;
      lines.push(
        '0',
        'LWPOLYLINE',
        '100',
        'AcDbEntity',
        '8',
        panel.id,
        '100',
        'AcDbPolyline',
        '90',
        String(contour.length),
        '70',
        '1',
      );
      for (const [x, y] of contour)
        lines.push('10', String(x + panel.translation[0]), '20', String(y + panel.translation[1]));
    }
    lines.push(
      '0',
      'TEXT',
      '100',
      'AcDbEntity',
      '8',
      'LABELS',
      '100',
      'AcDbText',
      '10',
      String(panel.translation[0] + Math.min(...panel.outline.map(([x]) => x))),
      '20',
      String(panel.translation[1] + Math.min(...panel.outline.map(([, y]) => y)) - 5),
      '40',
      '3',
      '1',
      `${i + 1}: ${panel.id}, stock ${p.thickness} mm`,
    );
  }
  return [...lines, '0', 'ENDSEC', '0', 'EOF', ''].join('\n');
}

import { n } from '../../../core/geometry';
import type { Parameters } from '../../../core/types';
import { box, prism, subtract, type Shape, type Vec } from './shapes';
import type { Piece } from './assembly';

// A modest polygonal section keeps both the browser mesh and editable CAD light.
// This is an illustrative symmetric section, not a claimed aerodynamic profile.
const ordinates = [
  [0, 0],
  [0.03, 0.25],
  [0.12, 0.45],
  [0.3, 0.5],
  [0.6, 0.35],
  [0.8, 0.18],
  [1, 0],
];
function heightAt(u: number): number {
  const i = ordinates.findIndex(([x]) => x >= u);
  if (i <= 0) return 0;
  const [a, b] = [ordinates[i - 1], ordinates[i]];
  return a[1] + ((u - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
}
function section(x: number, y: number, c: number, h: number, z: number, from = 0, to = 1): Vec[] {
  const samples = [from, ...ordinates.map(([u]) => u).filter((u) => u > from && u < to), to];
  const upper: Vec[] = samples.map((u) => [x + c * u, y, z + h * heightAt(u)]);
  const lower: Vec[] = [...samples]
    .reverse()
    .filter((u) => heightAt(u) > 0)
    .map((u) => [x + c * u, y, z - h * heightAt(u)]);
  return [...upper, ...lower];
}
interface Panel {
  x: number;
  y0: number;
  y1: number;
  root: number;
  tip: number;
  sweep: number;
  z: number;
  rise: number;
  thickness: number;
}
function panelRing(p: Panel, f: number, from = 0, to = 1): Vec[] {
  const chord = p.root + (p.tip - p.root) * f;
  return section(
    p.x + p.sweep * f,
    p.y0 + (p.y1 - p.y0) * f,
    chord,
    chord * p.thickness,
    p.z + p.rise * f,
    from,
    to,
  );
}
function panelShape(p: Panel): Shape {
  return { kind: 'loft', rings: [panelRing(p, 0), panelRing(p, 1)] };
}

export function pieces(p: Parameters, state: string): Piece[] {
  const L = n(p, 'length'),
    W = n(p, 'bodyWidth'),
    H = n(p, 'bodyHeight'),
    t = n(p, 'wall');
  const wingOnly = p.layout === 'flying-wing',
    twin = p.layout === 'twin-boom';
  const root = n(p, 'rootChord'),
    tip = n(p, 'tipChord'),
    span = n(p, 'span');
  const thickness = n(p, 'wingThickness') / 100;
  const gap = n(p, 'hingeGap'),
    hinge = 1 - n(p, 'controlChord') / 100;
  const wingX = wingOnly ? -root / 2 : L * (n(p, 'wingStation') / 100 - 0.5);
  const wingZ = wingOnly
    ? 0
    : (p.wingMount === 'high' ? 0.36 : p.wingMount === 'low' ? -0.36 : 0) * H;
  const exploded = state === 'exploded';
  let outer: Shape, body: Shape;
  if (wingOnly) {
    outer = {
      kind: 'loft',
      rings: [
        section(wingX, -W / 2, root, root * thickness, 0),
        section(wingX, W / 2, root, root * thickness, 0),
      ],
    };
    const cavity = box(
      [root * 0.4, W - 2 * t, root * thickness * 0.3],
      [wingX + root * 0.16, -W / 2 + t, -root * thickness * 0.15],
    );
    const hatch = box(
      [root * 0.32, W * 0.55, root * thickness],
      [wingX + root * 0.2, -W * 0.275, 0],
    );
    body = subtract(outer, cavity, hatch);
  } else {
    const bodyLength = twin ? L * 0.62 : L;
    const stations = [
      [0, 0.08],
      [0.07, 0.55],
      [0.2, 0.95],
      [0.38, 1],
      [0.55, 0.8],
      [0.78, 0.3],
      [1, 0.08],
    ];
    const ellipse = (x: number, w: number, h: number): Vec[] =>
      Array.from({ length: 24 }, (_, i) => [
        x,
        (w / 2) * Math.cos((i * Math.PI) / 12),
        (h / 2) * Math.sin((i * Math.PI) / 12),
      ]);
    outer = {
      kind: 'loft',
      rings: stations.map(([u, s]) => ellipse(-L / 2 + u * bodyLength, W * s, H * s)),
    };
    const inner: Shape = {
      kind: 'loft',
      rings: stations
        .slice(1, -1)
        .map(([u, s]) => ellipse(-L / 2 + u * bodyLength, W * s - 2 * t, H * s - 2 * t)),
    };
    const hatch = box(
      [bodyLength * 0.28, W * 0.5, H],
      [-L / 2 + bodyLength * 0.2, -W * 0.25, H * 0.15],
    );
    body = subtract(outer, inner, hatch);
  }
  const result: Piece[] = [
    {
      label: wingOnly
        ? 'Wing centre section · equipment bay'
        : twin
          ? 'Equipment pod · open hatch'
          : 'Fuselage shell · open equipment hatch',
      shape: body,
      color: 0xd9e2e6,
    },
  ];
  if (state === 'body') return result;

  const wingSolids: Shape[] = [],
    tailSolids: Shape[] = [];
  function addPanel(
    panel: Panel,
    label: string,
    controls: { name: string; a: number; b: number }[],
    cutBody: boolean,
    explodeZ: number,
  ) {
    const full = panelShape(panel);
    const cutters: Shape[] = [],
      moving: Piece[] = [];
    for (const control of controls) {
      const chordAt = (f: number) => panel.root + (panel.tip - panel.root) * f;
      const cutRing = (f: number): Vec[] => {
        const x = panel.x + panel.sweep * f,
          y = panel.y0 + (panel.y1 - panel.y0) * f,
          z = panel.z + panel.rise * f;
        return [
          [x + chordAt(f) * hinge, y, z - root],
          [x + chordAt(f) * 1.1, y, z - root],
          [x + chordAt(f) * 1.1, y, z + root],
          [x + chordAt(f) * hinge, y, z + root],
        ];
      };
      cutters.push({ kind: 'loft', rings: [cutRing(control.a), cutRing(control.b)] });
      const inset = gap / Math.abs(panel.y1 - panel.y0);
      const a = control.a + inset,
        b = control.b - inset;
      const surface: Shape = {
        kind: 'loft',
        rings: [
          panelRing(panel, a, hinge + gap / chordAt(a)),
          panelRing(panel, b, hinge + gap / chordAt(b)),
        ],
      };
      moving.push({
        label: `${label} · ${control.name}`,
        shape: cutBody ? subtract(surface, outer) : surface,
        color: 0xe9aa67,
        z: exploded ? explodeZ + H * 0.35 : 0,
      });
    }
    result.push(
      {
        label: `${label} · fixed panel`,
        shape: subtract(full, ...(cutBody ? [outer] : []), ...cutters),
        color: 0xdce4e8,
        z: exploded ? explodeZ : 0,
      },
      ...moving,
    );
    return full;
  }
  const half = span / 2;
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'Port' : 'Starboard';
    const start = wingOnly ? W / 2 : 0;
    const panel: Panel = {
      x: wingX,
      y0: side * start,
      y1: side * half,
      root,
      tip,
      sweep: (half - start) * Math.tan((n(p, 'sweep') * Math.PI) / 180),
      z: wingZ,
      rise: (half - start) * Math.tan((n(p, 'dihedral') * Math.PI) / 180),
      thickness,
    };
    const controls =
      p.wingControl === 'none'
        ? []
        : p.wingControl === 'flaps-ailerons'
          ? [
              { name: 'flap', a: 0.2, b: 0.53 },
              { name: 'aileron', a: 0.55, b: 0.97 },
            ]
          : [
              {
                name:
                  p.wingControl === 'elevons'
                    ? 'elevon · pitch / roll'
                    : p.wingControl === 'flaperons'
                      ? 'flaperon · roll / lift'
                      : 'aileron · roll',
                a: 0.3,
                b: 0.97,
              },
            ];
    wingSolids.push(
      addPanel(
        panel,
        `${label} ${p.layout === 'tandem' ? 'forward wing' : 'wing'}`,
        controls,
        !wingOnly,
        H,
      ),
    );
  }
  const tailSpan = n(p, 'tailSpan'),
    chord = n(p, 'tailChord'),
    finH = n(p, 'finHeight');
  const tailX = p.layout === 'canard' ? -L * 0.39 : L / 2 - chord;
  const tailZ = twin ? wingZ : p.tail === 't-tail' ? finH : 0;
  if (p.tail !== 'none') {
    for (const side of [-1, 1]) {
      const label = side < 0 ? 'Port' : 'Starboard';
      const panel: Panel = {
        x: tailX,
        y0: 0,
        y1: (side * tailSpan) / 2,
        root: chord,
        tip: chord * 0.65,
        sweep: chord * 0.35,
        z: tailZ,
        rise: p.tail === 'v-tail' ? tailSpan * 0.3 : 0,
        thickness: 0.05,
      };
      const name =
        p.tail === 'v-tail'
          ? 'ruddervator · pitch / yaw'
          : p.layout === 'canard'
            ? 'elevator · foreplane pitch'
            : 'elevator · pitch';
      tailSolids.push(
        addPanel(
          panel,
          `${label} ${p.layout === 'canard' ? 'canard' : p.layout === 'tandem' ? 'aft wing' : 'tailplane'}`,
          p.layout === 'canard' && !p.foreplaneControl ? [] : [{ name, a: 0, b: 1 }],
          !twin,
          H * 1.8,
        ),
      );
    }
  }
  if (p.tail !== 'v-tail' && (!wingOnly || p.winglets)) {
    const finYs = wingOnly
      ? [-half + t / 2, half - t / 2]
      : twin
        ? [-tailSpan * 0.36, tailSpan * 0.36]
        : [0];
    for (const y of finYs) {
      const finChord = wingOnly ? tip * 0.8 : chord * 0.65;
      const x = wingOnly
        ? wingX + (half - W / 2) * Math.tan((n(p, 'sweep') * Math.PI) / 180) + tip * 0.2
        : L / 2 - finChord;
      const base = wingOnly
        ? (half - W / 2) * Math.tan((n(p, 'dihedral') * Math.PI) / 180)
        : twin
          ? wingZ
          : 0;
      const height = wingOnly ? Math.min(finH, tip) : finH;
      const fin = (start: number, end: number): Shape =>
        prism(
          [
            [x + start * finChord, base],
            [x + end * finChord, base],
            [x + end * finChord, base + height],
            [x + (0.3 + start * 0.7) * finChord, base + height],
          ],
          t,
          y - t / 2,
          'y',
        );
      const label = wingOnly
        ? `${y < 0 ? 'Port' : 'Starboard'} winglet`
        : twin
          ? `${y < 0 ? 'Port' : 'Starboard'} vertical tail`
          : 'Vertical tail';
      if (wingOnly) {
        result.push({
          label,
          shape: subtract(fin(0, 1), ...wingSolids),
          color: 0xdce4e8,
          z: exploded ? H * 3.5 + finH + chord : 0,
        });
      } else {
        // Keep the rudder hinge straight; unlike the fin leading edge it does not sweep.
        const hingeX = x + finChord * 0.73;
        const full = fin(0, 1);
        const cutter = box([finChord, t * 3, height + 2], [hingeX, y - t * 1.5, base - 1]);
        const rudder = box([finChord * 0.27 - gap, t, height], [hingeX + gap, y - t / 2, base]);
        const trim = [...(!twin ? [outer] : []), ...tailSolids];
        result.push(
          {
            label: `${label} · fixed fin`,
            shape: subtract(full, cutter, ...trim),
            color: 0xdce4e8,
            z: exploded ? H * 3.5 + finH + chord : 0,
          },
          {
            label: `${label} · rudder · yaw`,
            shape: subtract(rudder, ...trim),
            color: 0xe9aa67,
            z: exploded ? H * 4 + finH + chord : 0,
          },
        );
      }
    }
  }
  if (twin) {
    const size = Math.max(4 * t, H * 0.12);
    const start = wingX + root * 0.3,
      end = L / 2 - chord * 0.7;
    for (const side of [-1, 1])
      result.push({
        label: `${side < 0 ? 'Port' : 'Starboard'} tail boom`,
        shape: subtract(
          box([end - start, size, size], [start, side * tailSpan * 0.36 - size / 2, wingZ - size]),
          ...wingSolids,
          ...tailSolids,
        ),
        color: 0x596b75,
        z: exploded ? -H : 0,
      });
  }
  return result;
}

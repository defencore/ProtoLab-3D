import type { Parameters } from '../../../core/types';
import catalog from './models.json';
import { box, cylinder, roundedRect, ring, subtract, type Shape } from './shapes';
import type { Piece } from './assembly';
import { thermalStack, type ThermalStackGeometry } from './thermal-stack';
interface CameraModel {
  id: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  form: string;
  geometry: {
    stack?: ThermalStackGeometry;
    projection?: number;
    lensDiameter?: number;
    sideHole?: number;
    color?: number;
    pcb?: number;
    rear?: number;
    centerY?: number;
    lenses?: number[];
    mountHoles?: { x: number; y: number; diameter: number }[];
  };
}
export const models: CameraModel[] = catalog;
export function model(p: Parameters) {
  const m = models.find((m) => m.id === p.model);
  if (!m) throw new Error('Select a supported camera model.');
  return m;
}
/** One component description drives the preview, dimensions and native CAD export. */
export function pieces(p: Parameters, state: string): Piece[] {
  const m = model(p),
    d = m.geometry,
    W = m.width,
    H = m.height,
    D = m.depth;
  const gap = state === 'exploded' ? Math.min(W, H) * 0.45 : 0;
  const out: Piece[] = [];
  const add = (label: string, shape: Shape, color: number, z = 0) =>
    out.push({ label, shape, color, z });
  const glass = 0x244858,
    dark = 0x292d32,
    silver = 0xaeb8c0,
    green = 0x246b4c;
  const color = d.color ?? dark;
  function optics(x: number, y: number, r: number, start: number, end: number, index = '') {
    const bezel = Math.min(0.8, (end - start) * 0.2);
    add(
      `Lens barrel${index}`,
      ring(r * 0.89, r * 0.65, start, end - start - bezel, x, y),
      dark,
      gap,
    );
    add(`Lens retaining ring${index}`, ring(r, r * 0.66, end - bezel, bezel, x, y), 0x41474d, gap);
    add(
      `Optical window${index}`,
      cylinder(r * 0.64, bezel * 0.45, [x, y, end - bezel * 0.65]),
      glass,
      gap * 1.5,
    );
  }
  function rearSocket(
    width: number,
    height: number,
    depth: number,
    z: number,
    y: number,
    label: string,
  ) {
    add(
      label,
      subtract(
        box([width, height, depth], [-width / 2, y - height / 2, z]),
        box(
          [width - 1, height - 1, depth * 0.6],
          [-width / 2 + 0.5, y - height / 2 + 0.5, z - 0.01],
        ),
      ),
      0xc3bca8,
      -gap,
    );
  }
  if (m.form === 'thermal-stack') return thermalStack(m.depth, d.stack!, state);
  if (m.form === 'fpv') {
    const projection = d.projection!,
      r = d.lensDiameter! / 2;
    const bodyDepth = D - projection,
      wall = Math.min(1.1, W * 0.07);
    const body = roundedRect(W, H, 1.3, -D + wall, bodyDepth - wall);
    const cuts: Shape[] = [
      roundedRect(W - wall * 2, H - wall * 2, 0.5, -D + wall - 0.1, bodyDepth - wall * 2 + 0.1),
      cylinder(r * 0.67, wall + 1, [0, 0, -projection - wall - 0.2]),
    ];
    if (d.sideHole) {
      const mountZ = m.id === 'baby-ratel2' ? -9 : -D + bodyDepth * 0.55;
      cuts.push(cylinder(d.sideHole / 2, W + 2, [-W / 2 - 1, 0, mountZ], 'x'));
    }
    add('Camera housing', subtract(body, ...cuts), color);
    add('Rear cover', roundedRect(W, H, 1.3, -D, wall - 0.08), dark, -gap);
    add(
      'Sensor PCB envelope',
      roundedRect(W - wall * 2 - 0.2, H - wall * 2 - 0.2, 0.4, -D + wall + 0.15, 0.6),
      green,
    );
    add('Image sensor envelope', box([r, r, 0.45], [-r / 2, -r / 2, -D + wall + 0.8]), 0x31353d);
    optics(0, 0, r, -projection, 0);
  } else if (['pi-board', 'thermal-board', 'cs-board'].includes(m.form)) {
    const pcb = d.pcb ?? 1.1,
      rear = d.rear ?? 0;
    const z = -D + rear,
      cy = d.centerY ?? 0,
      r = d.lensDiameter! / 2;
    const holes = (d.mountHoles ?? []).map((h) =>
      cylinder(h.diameter / 2, pcb + 2, [h.x, h.y, z - 1]),
    );
    add(
      'Camera PCB',
      subtract(roundedRect(W, H, 1.4, z, pcb), ...holes),
      m.form === 'cs-board' ? dark : green,
    );
    for (const [i, h] of (d.mountHoles ?? []).entries())
      add(
        `Mounting pad ${i + 1}`,
        ring(h.diameter / 2 + 0.65, h.diameter / 2 + 0.03, z + pcb, 0.035, h.x, h.y),
        0xb7a774,
      );
    if (rear)
      rearSocket(Math.min(19.61, W * 0.8), 4.6, rear, -D, -H / 2 + 4, 'FPC connector envelope');
    if (m.form === 'cs-board') {
      add('CS lens mount', ring(17.4, 11.2, z + pcb + 0.08, D - pcb - 0.48), dark, gap);
      add('Focus ring', ring(18, 11.2, -0.4, 0.4), silver, gap);
      add('Sensor window', box([7, 5, 0.3], [-3.5, -2.5, z + pcb + 0.1]), glass);
    } else if (m.form === 'thermal-board') {
      const sensorBase = z + pcb + 0.05;
      add('Thermal sensor can', ring(r, r * 0.61, sensorBase, -sensorBase - 0.6), silver, gap);
      add('Thermal sensor rim', ring(r, r * 0.62, -0.6, 0.6), silver, gap);
      add('LWIR window', cylinder(r * 0.6, 0.25, [0, 0, -0.45]), glass, gap * 1.5);
      for (const side of [-1, 1])
        add(
          `STEMMA QT socket ${side}`,
          subtract(
            box([4, 5, 2.5], [side * (W / 2 - 3) - 2, -2.5, z + pcb + 0.05]),
            box([2.8, 3.4, 1.8], [side * (W / 2 - 3) - 1.4, -1.7, z + pcb + 0.9]),
          ),
          0xbbb2a1,
        );
    } else {
      const projection = d.projection!,
        block = 10.8,
        base = z + pcb + 0.05;
      add(
        'Autofocus / sensor package',
        subtract(
          box([block, block, -projection - base], [-block / 2, cy - block / 2, base]),
          cylinder(r * 0.66, -projection - base + 2, [0, cy, base - 1]),
        ),
        dark,
      );
      optics(0, cy, r, -projection, 0);
      add('Sensor window', cylinder(r * 0.6, 0.2, [0, cy, base + 0.1]), glass);
    }
    // A few separate envelopes communicate PCB topology without claiming a PCB layout.
    if (m.form !== 'cs-board')
      for (let i = 0; i < 3; i++)
        add(
          `PCB component envelope ${i + 1}`,
          box([1.7, 1.1, 0.5], [-W / 2 + 3 + i * 2.8, H / 2 - 3, z + pcb + 0.05]),
          dark,
        );
  } else if (m.form === 'lepton') {
    add('32-pin socket envelope', roundedRect(W, H, 0.5, -D + 0.4, 0.8), dark, -gap);
    const core = roundedRect(W - 0.3, H - 0.4, 0.8, -D + 1.3, D - 2.7);
    add('Thermal core and shutter housing', subtract(core, cylinder(2.9, D, [0, 0, -D])), color);
    optics(0, 0, 2.9, -1.4, 0);
    for (let i = 0; i < 16; i++)
      for (const side of [-1, 1])
        add(
          `Socket contact ${side}:${i + 1}`,
          box([0.35, 0.5, 0.4], [side * (W / 2 - 0.65) - 0.175, -4.875 + i * 0.65, -D]),
          0xc7a960,
          -gap,
        );
  } else if (m.form === 'stereo') {
    const wall = 1.4,
      lensXs = d.lenses!;
    add(
      'Stereo camera shell',
      subtract(
        roundedRect(W, H, H * 0.3, -D, D - 1),
        roundedRect(W - 2 * wall, H - 2 * wall, H * 0.22, -D + wall, D - wall - 0.8),
      ),
      color,
    );
    add(
      'Front optical bezel',
      subtract(
        roundedRect(W - 0.1, H - 0.1, H * 0.29, -1, 1),
        ...lensXs.map((x) => cylinder(4.5, 3, [x, 0, -2])),
      ),
      dark,
      gap,
    );
    for (const [i, x] of lensXs.entries()) {
      add(`Imager / projector barrel ${i + 1}`, ring(4.45, 3.4, -4, 3, x, 0), dark);
      add(`Optical window ${i + 1}`, cylinder(3.35, 0.5, [x, 0, -0.75]), glass, gap);
    }
    add(
      'Vision processor PCB envelope',
      roundedRect(W - 5, H - 5, H * 0.22 - 1.1, -D + wall + 0.2, 1),
      green,
    );
    add('Vision processor package', box([9, 9, 1.2], [-4.5, -4.5, -D + wall + 1.3]), dark);
  } else if (m.form === 'ip-bullet') {
    const R = W / 2;
    add('Mounting base envelope', cylinder(R * 0.81, 8, [0, 0, -D]), color, -gap);
    add('Articulated mount envelope', cylinder(9, D - 106, [0, 0, -D + 8]), silver, -gap * 0.5);
    add(
      'Bullet housing',
      subtract(cylinder(R, 98, [0, 0, -98]), cylinder(R - 2.5, 96.1, [0, 0, -96])),
      color,
    );
    const holes = Array.from({ length: 18 }, (_, i) => {
      const a = (i * 2 * Math.PI) / 18;
      return [Math.cos(a) * 24, Math.sin(a) * 24] as const;
    });
    add(
      'IR illuminator face',
      subtract(
        cylinder(R - 2.6, 2, [0, 0, -3.9]),
        cylinder(9.1, 4, [0, 0, -5]),
        ...holes.map(([x, y]) => cylinder(2.1, 4, [x, y, -5])),
      ),
      dark,
      gap,
    );
    for (const [i, [x, y]] of holes.entries())
      add(`IR LED ${i + 1}`, cylinder(2, 0.8, [x, y, -3]), 0x612a39, gap);
    optics(0, 0, 9, -3.8, -0.1);
  } else if (m.form === 'ip-turret') {
    const R = W / 2;
    add('Turret mounting base', cylinder(R, 12, [0, 0, -D]), color, -gap);
    const profile: [number, number][] = [
      [0, -D + 12.2],
      [R * 0.91, -D + 12.2],
      [R * 0.91, -D + 25],
      [R * 0.82, -28],
      [R * 0.61, -7],
      [0, -7],
    ];
    add('Turret housing envelope', { kind: 'revolve', profile }, color);
    add('Front IR panel', ring(R * 0.59, 9.1, -6.9, 5.9), dark, gap);
    optics(0, 0, 9, -6.9, 0);
    for (let i = 0; i < 18; i++) {
      const a = (i * 2 * Math.PI) / 18;
      add(
        `IR LED ${i + 1}`,
        cylinder(1.8, 0.7, [Math.cos(a) * 22, Math.sin(a) * 22, -0.9]),
        0x612a39,
        gap,
      );
    }
  } else throw new Error(`Unsupported camera construction: ${m.form}`);
  return out;
}

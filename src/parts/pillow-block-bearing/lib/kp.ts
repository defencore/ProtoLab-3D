import { Group } from 'three';
import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import { cylinder, prism, union, subtract, component, pythonShape, type Shape } from './shapes';

type Point = [number, number];

function roundedFoot(length: number, depth: number): Point[] {
  const radius = Math.min(1.2, depth / 10);
  return Array.from({ length: 4 }, (_, corner) => {
    const angle = (corner * Math.PI) / 2;
    const x = (corner === 0 || corner === 3 ? 1 : -1) * (length / 2 - radius);
    const y = (corner < 2 ? 1 : -1) * (depth / 2 - radius);
    return Array.from({ length: 9 }, (_, i): Point => [
      x + radius * Math.cos(angle + (i * Math.PI) / 16),
      y + radius * Math.sin(angle + (i * Math.PI) / 16),
    ]);
  }).flat();
}

export function layout(p: Parameters) {
  const radius = n(p, 'outer') / 2;
  const bore = n(p, 'bore') / 2;
  const seat = radius * 0.82;
  const hub = bore + (seat - bore) * 0.43;
  const depth = n(p, 'width');
  const insertWidth = n(p, 'insertWidth');
  const offset = n(p, 'insertOffset');
  const raceWidth = Math.min(depth * 0.65, insertWidth - 2 * Math.abs(offset));
  return { radius, bore, seat, hub, depth, insertWidth, offset, raceWidth };
}

export function components(p: Parameters) {
  const a = layout(p);
  const height = n(p, 'centerHeight');
  const top = n(p, 'totalHeight') - height;
  const footZ = -height;
  const footTop = footZ + n(p, 'baseThickness');
  const pitch = n(p, 'mountPitch');
  const hole = n(p, 'hole');
  const flare = Math.min(a.radius + 3, (pitch - n(p, 'slotLength')) / 2 - 1.2);
  const outline: Point[] = [
    [-flare, footTop - 0.4],
    [flare, footTop - 0.4],
    [a.radius * 1.03, -a.radius * 0.25],
    ...Array.from({ length: 97 }, (_, i): Point => {
      const angle = (Math.PI * i) / 96;
      return [a.radius * Math.cos(angle), top * Math.sin(angle)];
    }),
    [-a.radius * 1.03, -a.radius * 0.25],
  ];
  const foot = prism(
    roundedFoot(n(p, 'baseWidth'), n(p, 'baseDepth')),
    n(p, 'baseThickness'),
    footZ,
  );
  // A thinner web behind the raised circular seat and side ribs gives the cast
  // housing its recessed faces. These undimensioned details are illustrative.
  const web = prism(outline, a.depth * 0.68, -a.depth * 0.34, 'y');
  const boss = cylinder(Math.min(a.radius, top) * 0.94, a.depth, [0, -a.depth / 2, 0], 'y');
  const ribs = [-1, 1].map((side) =>
    prism(
      [
        [side * flare, footTop - 0.4],
        [side * (flare - 2), footTop - 0.4],
        [side * a.radius * 0.81, -a.radius * 0.2],
        [side * a.radius * 0.98, -a.radius * 0.13],
      ],
      a.depth,
      -a.depth / 2,
      'y',
    ),
  );
  const mountingCuts = [-1, 1].map((side) => {
    const x = (side * pitch) / 2;
    const half = (n(p, 'slotLength') - hole) / 2;
    const end = (dx: number) =>
      cylinder(hole / 2, n(p, 'baseThickness') + 2, [x + dx, 0, footZ - 1]);
    if (half === 0) return end(0);
    return union(
      end(-half),
      end(half),
      prism(
        [
          [x - half, -hole / 2],
          [x + half, -hole / 2],
          [x + half, hole / 2],
          [x - half, hole / 2],
        ],
        n(p, 'baseThickness') + 2,
        footZ - 1,
      ),
    );
  });
  const housing = subtract(
    union(foot, web, boss, ...ribs),
    cylinder(a.seat, n(p, 'baseDepth') + 2, [0, -n(p, 'baseDepth') / 2 - 1, 0], 'y'),
    ...mountingCuts,
  );
  const annulus = (outer: number, inner: number, width: number, y: number) =>
    subtract(
      cylinder(outer, width, [0, y, 0], 'y'),
      cylinder(inner, width + 2, [0, y - 1, 0], 'y'),
    );
  const raceInner = a.seat - Math.max(0.8, (a.seat - a.hub) * 0.3);
  const race = annulus(a.seat, raceInner, a.raceWidth, -a.raceWidth / 2);
  const screwRadius = Math.min(1.5, (a.hub - a.bore) * 0.42);
  const front = a.offset - a.insertWidth / 2;
  const screwY = front + screwRadius + 0.25;
  const rotate = (child: Shape, angle: number): Shape => ({ kind: 'rotateY', child, angle });
  const angles = [0, -120];
  const collar = subtract(
    annulus(a.hub, a.bore, a.insertWidth, front),
    ...angles.map((angle) =>
      rotate(cylinder(screwRadius, a.hub - a.bore + 1, [0, screwY, a.bore - 0.5]), angle),
    ),
  );
  const screw = subtract(
    cylinder(screwRadius, a.hub - a.bore - 0.1, [0, screwY, a.bore + 0.1]),
    prism(
      Array.from({ length: 6 }, (_, i): Point => [
        screwRadius * 0.56 * Math.cos((i * Math.PI) / 3),
        screwY + screwRadius * 0.56 * Math.sin((i * Math.PI) / 3),
      ]),
      0.8,
      a.hub - 0.6,
    ),
  );
  const sealThickness = Math.min(0.5, a.raceWidth / 6);
  return [
    { label: 'Cast KP housing', shape: housing, color: 0xb8bec5 },
    { label: 'Bearing outer ring', shape: race, color: 0x87929d },
    { label: 'Inner ring and locking collar', shape: collar, color: 0xcbd0d6 },
    ...[-1, 1].map((side) => ({
      label: side < 0 ? 'Front bearing seal' : 'Rear bearing seal',
      shape: annulus(
        raceInner - 0.02,
        a.hub + 0.05,
        sealThickness,
        side < 0 ? -a.raceWidth / 2 : a.raceWidth / 2 - sealThickness,
      ),
      color: 0x30363c,
    })),
    ...angles.map((angle, i) => ({
      label: `Locking set screw ${i + 1}`,
      shape: rotate(screw, angle),
      color: 0x606b76,
    })),
  ];
}

export function geometry(p: Parameters) {
  return new Group().add(...components(p).map((c) => component(c.shape, c.label, c.color)));
}

export function python(p: Parameters) {
  const pieces = components(p);
  return `def _kp_rotate(shape, angle):
    shape.rotate(App.Vector(0, 0, 0), App.Vector(0, 1, 0), angle)
    return shape
component_labels = ${JSON.stringify(pieces.map((c) => c.label))}
component_colors = ${JSON.stringify(pieces.map((c) => [16, 8, 0].map((shift) => ((c.color >> shift) & 255) / 255)))}
components = [${pieces.map((c) => `${pythonShape(c.shape)}.removeSplitter()`).join(',\n')}]
shape = Part.makeCompound(components)`;
}

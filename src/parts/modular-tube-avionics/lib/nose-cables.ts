import {
  box,
  cylinder,
  prism,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { at, datums, intersect } from './shared';
import { annularSectorPoints } from '../../../core/analytic-geometry';

/** Two loose harnesses are laid into open side grooves before the fairing is fitted. */
export const noseCableInterface = {
  aftX: datums.nose.aft,
  foreX: -175,
  transitionLength: 20,
  foreY: 30.5,
  foreZ: -17.5,
  gaugeDiameter: datums.cableDiameter,
  toolDiameter: datums.channelDiameter,
  loading: 'Outward, with the fairing removed; no preassembled plug passage is asserted.',
} as const;

function curvedHarness(sign: number, radius: number): Shape {
  const c = noseCableInterface;
  const aftY = Math.abs(datums.channelY[0]);
  const dy = aftY - c.foreY;
  const dz = c.foreZ - datums.channelZ;
  const shift = Math.hypot(dy, dz);
  const length = c.transitionLength;
  const bend = (length ** 2 + shift ** 2) / (4 * shift);
  const angle = 2 * Math.atan2(shift, length);
  const arc = (cx: number, cy: number, start: number, end: number): Shape =>
    intersect(
      at(
        {
          kind: 'revolve',
          profile: Array.from({ length: 24 }, (_, i) => [
            bend + radius * Math.cos((i * Math.PI) / 12),
            radius * Math.sin((i * Math.PI) / 12),
          ]),
          segments: 96,
          native: { kind: 'torus', major: bend, minor: radius, z: 0 },
        },
        [cx, cy, 0],
      ),
      prism(
        [
          [cx, cy],
          [cx + 100 * Math.cos(start), cy + 100 * Math.sin(start)],
          [cx + 100 * Math.cos(end), cy + 100 * Math.sin(end)],
        ],
        100,
        -50,
      ),
    );
  return at(
    union(
      arc(0, bend, -Math.PI / 2, -Math.PI / 2 + angle),
      arc(length, shift - bend, Math.PI / 2, Math.PI / 2 + angle),
      cylinder(radius, c.aftX - length - c.foreX, [length, shift, 0], 'x'),
    ),
    [c.aftX, sign * aftY, datums.channelZ],
    [(Math.atan2(dz, sign * dy) * 180) / Math.PI, 0, 180],
  );
}

/** Ordered -Y,+Y; the aft end is exactly the shared face X=-70 with axial tangent. */
export function noseCableGauges(): Shape[] {
  return [-1, 1].map((sign) => curvedHarness(sign, noseCableInterface.gaugeDiameter / 2));
}

/** Closed nominal diameters for clearance checks; these exclude the open loading mouths. */
export function noseCableReserves(): Shape[] {
  return [-1, 1].map((sign) => curvedHarness(sign, noseCableInterface.toolDiameter / 2));
}

/** Circular native paths plus broad outward mouths prevent trapped leads and thin outer caps. */
export function noseCableTools(): Shape[] {
  const c = noseCableInterface;
  return [-1, 1].map((sign) =>
    union(
      curvedHarness(sign, c.toolDiameter / 2),
      box(
        [c.transitionLength + 2, 22, 19],
        [c.aftX - c.transitionLength - 1, sign > 0 ? c.foreY : -c.foreY - 22, -25],
      ),
      box(
        [c.aftX - c.transitionLength - c.foreX + 1, 22, c.toolDiameter],
        [c.foreX, sign > 0 ? c.foreY : -c.foreY - 22, c.foreZ - c.toolDiameter / 2],
      ),
    ),
  );
}

/** Native circular side-step joins the source OV mouth to the rear installation bay. */
function ov9281CsiPassage(): Shape {
  const radius = (11 ** 2 + 10 ** 2) / (4 * 10);
  const angle = (2 * Math.atan2(10, 11) * 180) / Math.PI;
  const band = (cx: number, cy: number, start: number, end: number): Shape => {
    const native = {
      kind: 'annular-sector' as const,
      inner: radius - 1.5,
      outer: radius + 1.5,
      start,
      end,
      z: -9.1,
      depth: 18.2,
      translation: [cx, cy, 0] as [number, number, number],
    };
    return {
      kind: 'prism',
      axis: 'z',
      origin: -9.1,
      depth: 18.2,
      points: annularSectorPoints(native).map(([x, y]) => [x + cx, y + cy]),
      native,
    };
  };
  return union(
    // The explicit transform also positions the browser profile; native coordinates stay local.
    at({ ...band(0, 0, -90 - angle, -90) }, [-225, 8 + radius, 0]),
    at({ ...band(0, 0, 90 - angle, 90) }, [-236, 18 - radius, 0]),
    box([13.1, 3, 35.1], [-226, 6.5, -9.1]),
  );
}

export interface CameraRibbonStation {
  point: Vec;
  tangent: Vec;
  width: Vec;
  normal: Vec;
  bendRadius: number;
}

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Vec): Vec => scale(a, 1 / Math.hypot(...a));
const smooth = (u: number) => 6 * u ** 5 - 15 * u ** 4 + 10 * u ** 3;
const smoothD1 = (u: number) => 30 * u ** 2 * (u - 1) ** 2;
const smoothD2 = (u: number) => 60 * u * (2 * u ** 2 - 3 * u + 1);

/** The proven Pi/PCIe detour stays fixed through X=-194. Fore of that plane the
 * clockwise camera's width stays based on -Y; the former quarter-turn to Z is
 * absent. Width/thickness are authored fitting envelopes, not a selected lead.
 */
export const camera19CsiInterface = {
  piMouth: [-158.33, 19.505, 2.286] as Vec,
  rearBendRadius: 4,
  rearBendHeight: 12.2,
  detourEnd: [-162.33, 13, 16.2] as Vec,
  portsCleared: [-194, 13, 16.2] as Vec,
  cameraMouth: [-227.5, -1, 5.5] as Vec,
  cameraApproach: [-1, 0, 0] as Vec,
  cameraWidth: [0, -1, 0] as Vec,
  ribbonWidth: 11.5,
  assumedThickness: 0.3,
  reserveExtraWidth: 1,
  reserveThickness: 1,
  mouthExclusion: 0.2,
  scope:
    'Mechanical fitting reference only. Select an electrically compatible Pi5 camera lead and verify its insertion, latch access, minimum bend radius and actual thickness separately.',
} as const;

function ribbonStation(point: Vec, velocity: Vec, acceleration: Vec): CameraRibbonStation {
  const tangent = unit(velocity);
  const basis: Vec = [0, -1, 0];
  const width = unit(add(basis, scale(tangent, -dot(basis, tangent))));
  const bending = Math.hypot(...cross(velocity, acceleration));
  return {
    point,
    tangent,
    width,
    normal: unit(cross(tangent, width)),
    bendRadius: bending > 1e-12 ? Math.hypot(...velocity) ** 3 / bending : Infinity,
  };
}

/** Source mouth to source mouth; repeated seams are omitted. No insertion length
 * is inferred from a connector envelope. Native checks trim only the stated
 * 0.2 mm mouth-face exclusions, never an entire purchased component.
 */
export function camera19CsiRoute(samplesPerSegment = 64): CameraRibbonStation[] {
  if (!Number.isInteger(samplesPerSegment) || samplesPerSegment < 8)
    throw new Error('Use at least eight whole samples per CSI route segment.');
  const c = camera19CsiInterface;
  const vertical = c.rearBendHeight - c.piMouth[2];
  const initialLength = vertical + (c.rearBendRadius * Math.PI) / 2;
  const initial = (u: number): CameraRibbonStation => {
    const s = u * initialLength;
    const y = c.piMouth[1] + (13 - c.piMouth[1]) * smooth(u);
    const dy = ((13 - c.piMouth[1]) * smoothD1(u)) / initialLength;
    const ddy = ((13 - c.piMouth[1]) * smoothD2(u)) / initialLength ** 2;
    if (s <= vertical)
      return ribbonStation([c.piMouth[0], y, c.piMouth[2] + s], [0, dy, 1], [0, ddy, 0]);
    const a = (s - vertical) / c.rearBendRadius;
    return ribbonStation(
      [
        c.detourEnd[0] + c.rearBendRadius * Math.cos(a),
        y,
        c.rearBendHeight + c.rearBendRadius * Math.sin(a),
      ],
      [-Math.sin(a), dy, Math.cos(a)],
      [-Math.cos(a) / c.rearBendRadius, ddy, -Math.sin(a) / c.rearBendRadius],
    );
  };
  const rearStraight = (u: number): CameraRibbonStation =>
    ribbonStation(
      [c.detourEnd[0] + (c.portsCleared[0] - c.detourEnd[0]) * u, 13, 16.2],
      [-1, 0, 0],
      [0, 0, 0],
    );
  const fore = (u: number): CameraRibbonStation => {
    const delta = add(c.cameraMouth, scale(c.portsCleared, -1));
    return ribbonStation(
      [
        c.portsCleared[0] + delta[0] * u,
        c.portsCleared[1] + delta[1] * smooth(u),
        c.portsCleared[2] + delta[2] * smooth(u),
      ],
      [delta[0], delta[1] * smoothD1(u), delta[2] * smoothD1(u)],
      [0, delta[1] * smoothD2(u), delta[2] * smoothD2(u)],
    );
  };
  return [initial, rearStraight, fore].flatMap((segment, index) =>
    Array.from({ length: samplesPerSegment + (index === 0 ? 1 : 0) }, (_, i) =>
      segment((i + (index === 0 ? 0 : 1)) / samplesPerSegment),
    ),
  );
}

function ribbonRings(stations: CameraRibbonStation[], width: number, thickness: number): Vec[][] {
  return stations.map((station) =>
    (
      [
        [1, 1],
        [-1, 1],
        [-1, -1],
        [1, -1],
      ] as const
    ).map(([w, n]) =>
      add(
        station.point,
        add(scale(station.width, (w * width) / 2), scale(station.normal, (n * thickness) / 2)),
      ),
    ),
  );
}

/** Chunked native lofts preserve real freeform routing faces rather than mesh facets. */
function ribbonEnvelope(stations: CameraRibbonStation[], width: number, thickness: number): Shape {
  const rings = ribbonRings(stations, width, thickness);
  const chunks: Shape[] = [];
  for (let start = 0; start < rings.length - 1; start += 8)
    chunks.push({
      kind: 'smooth-loft',
      sections: rings.slice(start, start + 9).map((ring) => ({
        segments: ring.map((point, index) => ({
          kind: 'line',
          points: [point, ring[(index + 1) % ring.length]],
        })),
      })),
    });
  return union(...chunks);
}

export function camera19CsiRibbonGauges(): { id: string; shape: Shape }[] {
  const c = camera19CsiInterface;
  const complete = camera19CsiRoute();
  const route = complete.filter(
    ({ point }) =>
      point[2] >= c.piMouth[2] + c.mouthExclusion &&
      point[0] >= c.cameraMouth[0] + c.mouthExclusion,
  );
  const first = complete[0],
    last = complete.at(-1)!;
  route.unshift({ ...first, point: [c.piMouth[0], c.piMouth[1], c.piMouth[2] + c.mouthExclusion] });
  route.push({
    ...last,
    point: [c.cameraMouth[0] + c.mouthExclusion, c.cameraMouth[1], c.cameraMouth[2]],
  });
  return [
    {
      id: 'camera-19-csi-ribbon-assumed',
      shape: ribbonEnvelope(route, c.ribbonWidth, c.assumedThickness),
    },
    {
      id: 'camera-19-csi-clearance',
      shape: ribbonEnvelope(route, c.ribbonWidth + c.reserveExtraWidth, c.reserveThickness),
    },
  ];
}

/** OV9281 is the canonical default. Its inherited common cut remains for rev-A
 * salvage; the clocked IMX adds only an upper passage and never restores stock.
 */
export function cameraCsiPassage(cameraSetup = 'ov9281'): Shape {
  const inherited = ov9281CsiPassage();
  if (cameraSetup === 'ov9281') return inherited;
  if (cameraSetup !== 'camera-19')
    throw new Error('Choose a supported camera setup for the CSI passage.');
  const c = camera19CsiInterface;
  const fore = camera19CsiRoute().filter(({ point }) => point[0] <= c.portsCleared[0] + 1e-8);
  return union(
    inherited,
    ribbonEnvelope(fore, c.ribbonWidth + c.reserveExtraWidth, c.reserveThickness),
  );
}

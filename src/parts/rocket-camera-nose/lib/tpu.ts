import type { Parameters, PartDefinition, Preset } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { box, cylinder, union, subtract, type Shape } from '../../../core/assembly/boundary/shapes';
import { n } from '../../../core/geometry';
import detail from '../../manufactured-detail/part';
import pi from '../../raspberry-pi/part';
import ups from '../../waveshare-ups-3s/part';
import adapter from '../../waveshare-pcie-m2-d/part';
import camera from '../../board-camera-19/part';
import dome from '../../optical-dome-window/part';
import cell from '../../li-ion-cell/part';
import ssd from '../../m2-ssd/part';

type Vec = [number, number, number];
type Piece = ConfiguredPiece & { fixed: boolean };
export const tpuCoordinates = {
  piX: -6.456,
  piZ: -40,
  adapterX: -24.762,
  upsX: 3.844,
  upsZ: -44,
  ssdX: -28.762,
  partitionMin: -4.481,
  partitionMax: -3.281,
};
export interface NoseFactory {
  custom: (
    id: string,
    name: string,
    shape: Shape,
    fixed?: boolean,
    meshBackend?: 'jscad' | 'manifold',
  ) => Piece;
  occurrence: (
    part: PartDefinition,
    id: string,
    name: string,
    parameters: Parameters,
    translation: Vec,
    rotation: Vec,
    fixed?: boolean,
    preset?: Preset,
  ) => Piece;
  screw: (
    id: string,
    d: number,
    l: number,
    bearing: Vec,
    axis: 'x' | '-x' | 'y' | '-y' | 'z' | '-z',
    fixed?: boolean,
  ) => Piece;
  hexNut: (id: string, d: number, center: Vec, axis?: 'x' | 'y' | 'z', fixed?: boolean) => Piece;
  lockNut: (
    id: string,
    d: number,
    center: Vec,
    axis?: 'x' | '-x' | 'y' | '-y' | 'z',
    fixed?: boolean,
  ) => Piece;
  washer: (
    id: string,
    d: number,
    bore: number,
    thickness: number,
    center: Vec,
    axis?: 'x' | 'y' | 'z',
  ) => Piece;
  sleeve: (
    id: string,
    d: number,
    bore: number,
    length: number,
    center: Vec,
    axis?: 'x' | 'y' | 'z',
  ) => Piece;
  outerRadius: (p: Parameters, z: number) => number;
}
const radialBox = (
  r0: number,
  r1: number,
  width: number,
  z: number,
  height: number,
  angle: number,
): Shape => ({
  kind: 'transform',
  child: box([r1 - r0, width, height], [r0, -width / 2, z]),
  rotation: [0, 0, angle],
  translation: [0, 0, 0],
});
export function tpuHousingShape(
  p: Parameters,
  radius: (p: Parameters, z: number) => number,
): Shape {
  const l = n(p, 'noseLength'),
    wall = n(p, 'wall');
  const internal = p.packaging === 'tpu-ogive';
  const outer: Array<[number, number]> = Array.from({ length: 65 }, (_, i) => {
    const z = (l * i) / 64;
    return [radius(p, z), z];
  });
  if (internal) {
    // The wide glass flange sits behind an integral lip, reached from the open base.
    // The lip follows a short bevel; it cannot be a pointed continuation of this dome.
    outer.push(
      [13.25, l + 0.6],
      [12.9, l + 1],
      [12.2, l + 1.5],
      [11.1, l + 2],
      [9.8, l + 2.35],
      [9.2, l + 2.4],
    );
    const inside: Array<[number, number]> = [
      [8, l + 2.4],
      [8.7, l + 1],
      [11.7, l + 1],
      [11.7, l - 1.3],
      [12.4, l - 1.3],
      [12.4, l - 10],
    ];
    for (let i = 0; i <= 64; i++) {
      const z = ((l - 11) * (64 - i)) / 64;
      inside.push([radius(p, z) - wall, z]);
    }
    const body: Shape = { kind: 'revolve', segments: 64, profile: [...outer, ...inside] };
    const r = (n(p, 'tubeID') - n(p, 'shoulderClearance')) / 2;
    return subtract(
      body,
      ...[0, 120, 240].map((angle) => radialBox(r - 0.3, r + 4, 6.6, 4.8, 4.4, angle)),
      ...[0, 120, 240].map((angle) => radialBox(12.1, 13.3, 3.4, l - 8, 1.4, angle)),
    );
  }
  const inside: Array<[number, number]> = [
    [8.7, l],
    [8.7, l - 3],
  ];
  for (let i = 0; i <= 64; i++) {
    const z = l - 3 - ((l - 3) * i) / 64;
    inside.push([radius(p, z) - wall, z]);
  }
  const body: Shape = { kind: 'revolve', segments: 48, profile: [...outer, ...inside] };
  const r = (n(p, 'tubeID') - n(p, 'shoulderClearance')) / 2;
  return subtract(
    body,
    ...[0, 120, 240].map((angle) => radialBox(r - 0.3, r + 4, 6.6, 4.8, 4.4, angle)),
    ...[0, 120, 240].map((angle) => {
      const t = (angle * Math.PI) / 180;
      return cylinder(1.1, 6, [13 * Math.cos(t), 13 * Math.sin(t), l - 4]);
    }),
  );
}
/** A separate compliant collar stays in the housing when the equipment is withdrawn. */
export function internalWindowRetainerShape(p: Parameters): Shape {
  const l = n(p, 'noseLength');
  return union(
    subtract(cylinder(11.45, 1.4, [0, 0, l - 1.6]), cylinder(7.8, 2, [0, 0, l - 1.9])),
    ...[0, 120, 240].flatMap((angle) => [
      radialBox(11, 12.2, 3, l - 9, 7.6, angle),
      radialBox(12, 13, 3, l - 7.8, 1, angle),
      radialBox(8.2, 10.7, 3, l - 0.3, 0.3, angle),
    ]),
  );
}
export function tpuCarrierShape(p: Parameters): Shape {
  const a = tpuCoordinates,
    s = n(p, 'shoulderLength'),
    wall = n(p, 'wall'),
    r = (n(p, 'tubeID') - n(p, 'shoulderClearance')) / 2,
    inside = r - wall,
    cam = n(p, 'noseLength') - 28.5;
  const partitionHalf = Math.sqrt(
    (r - 0.2) ** 2 - Math.max(Math.abs(a.partitionMin), Math.abs(a.partitionMax)) ** 2,
  );
  const bandOuter = a.upsX + 22.8,
    bandHalf = Math.sqrt((inside + 0.5) ** 2 - bandOuter ** 2);
  const parts: Shape[] = [
    subtract(
      cylinder(r, s + 12, [0, 0, -s]),
      cylinder(inside, s + 13 - 1.6, [0, 0, -s + 1.6]),
      cylinder(9, 3, [0, 0, -s - 0.5]),
    ),
    box([1.2, 2 * partitionHalf, s + 10.4], [a.partitionMin, -partitionHalf, -s + 1.6]),
    box([24, 3, 2], [-12, 9, 10]),
  ];
  const cuts: Shape[] = [];
  // Source bores are used by forked printed retaining posts; no board holes are invented.
  for (const x of [-39, 19])
    for (const y of [-24.5, 24.5]) {
      const z = a.piZ + x,
        piBack = a.piX - 0.03,
        piFront = a.piX - 1.306,
        adapterFront = a.adapterX - 1.6;
      parts.push(
        cylinder(1.2, a.partitionMin + 0.2 - (adapterFront - 0.5), [adapterFront - 0.5, y, z], 'x'),
        cylinder(2.75, piFront - a.adapterX, [a.adapterX, y, z], 'x'),
        cylinder(2.25, a.partitionMin + 0.2 - piBack, [piBack, y, z], 'x'),
        cylinder(1.6, 0.5, [adapterFront - 0.5, y, z], 'x'),
      );
      cuts.push(
        box([2.6, 0.5, 4], [adapterFront - 0.6, y - 0.25, z - 2]),
        box([2.6, 0.5, 4], [piFront - 0.1, y - 0.25, z - 2]),
      );
    }
  for (const x of [-43, 43])
    for (const y of [-23, 23]) {
      const z = a.upsZ + x,
        front = a.upsX - 1.6;
      parts.push(
        cylinder(2.75, front - (a.partitionMax - 0.2), [a.partitionMax - 0.2, y, z], 'x'),
        cylinder(1.4, 2.1, [front, y, z], 'x'),
        cylinder(1.8, 0.5, [a.upsX, y, z], 'x'),
      );
      cuts.push(box([2.6, 0.5, 4], [front - 0.15, y - 0.25, z - 2]));
    }
  // Two bands join the outer skin and limit motion through the holder's open face.
  for (const z of [a.upsZ - 20, a.upsZ + 20])
    parts.push(box([1.2, 2 * bandHalf, 4], [a.upsX + 21.6, -bandHalf, z - 2]));
  // Short positive-Y supports keep the Ethernet insertion corridor entirely unobstructed.
  for (const x of [-10.5, 10.5]) parts.push(box([3, 3, cam - 12.4], [x - 1.5, 9, 11]));
  const floor = subtract(
    box([23, 23, 2], [-11.5, -11.5, cam - 2]),
    box([16, 12, 4], [-8, -6, cam - 3]),
  );
  const channel = subtract(
    box([23, 23, 12], [-11.5, -11.5, cam]),
    box([19.4, 23.4, 14], [-9.7, -9.7, cam - 1]),
  );
  const lip = subtract(
    box([23, 23, 1.2], [-11.5, -11.5, cam + 12]),
    cylinder(6.2, 3, [0, 0, cam + 11.5]),
    box([12.4, 13, 3], [-6.2, 0, cam + 11.5]),
  );
  const latch = box([20.7, 1.2, 4], [-11.5, 9.7, cam + 4]);
  const cameraMount = union(floor, channel, lip, latch);
  parts.push(
    p.packaging === 'tpu-ogive'
      ? { kind: 'intersect', children: [cameraMount, cylinder(15, 17, [0, 0, cam - 3])] }
      : cameraMount,
  );
  // Releasable integral detents engage windows in the short fore housing above the tube end.
  for (const angle of [0, 120, 240]) {
    parts.push(radialBox(r - 0.3, r + 1.4, 6, 5, 4, angle));
    for (const side of [-1, 1])
      cuts.push({
        kind: 'transform',
        child: box([wall + 2, 0.8, 8], [inside - 0.5, side > 0 ? 3.3 : -4.1, 2.5]),
        rotation: [0, 0, angle],
        translation: [0, 0, 0],
      });
    cuts.push(radialBox(inside - 0.5, r + 2, 6.6, 10, 0.7, angle));
  }
  return subtract(union(...parts), ...cuts);
}
export async function initializeTPU(): Promise<void> {
  await detail.initializeGeometry?.(
    { ...detail.defaults, meshBackend: 'manifold', meshConform: false },
    'default',
  );
}
export function tpuPieces(p: Parameters, make: NoseFactory): Piece[] {
  const a = tpuCoordinates,
    l = n(p, 'noseLength'),
    cam = l - 28.5,
    items: Piece[] = [];
  items.push(
    make.custom(
      'nose-shell',
      p.packaging === 'tpu-ogive'
        ? 'Ogive housing with integral window lip'
        : 'Short lens fore housing',
      tpuHousingShape(p, make.outerRadius),
      true,
    ),
  );
  const internal = p.packaging === 'tpu-ogive';
  const bezel: Shape = {
    kind: 'revolve',
    segments: 48,
    profile: [
      [12, 0],
      [16, 0],
      [16, 3],
      [8.75, 3],
      [8.75, 1],
      [12, 1],
    ],
  };
  const retained = subtract(
    bezel,
    ...[0, 120, 240].map((angle) => {
      const t = (angle * Math.PI) / 180;
      return cylinder(1.1, 5, [13 * Math.cos(t), 13 * Math.sin(t), -1]);
    }),
  );
  const ring = make.custom(
    'window-retainer',
    internal ? 'Internal printed optical window snap collar' : 'Optical window retaining bezel',
    internal ? internalWindowRetainerShape(p) : retained,
    true,
  );
  if (internal) {
    ring.component.manufacturing = {
      material: 'TPU grade and hardness to be selected and physically qualified',
      blank: 'One printed spring collar',
      processes: ['printing'],
      requirements: [
        'Insert the D23 flange from the base, then press the collar until all three lugs enter the closed internal pockets.',
        'Three contact pads touch the flange rear; the integral housing lip retains its front face.',
        'Qualify spring travel, optical retention and service fits with the delivered glass and filament.',
        'Release the tongues with a long tool through the base after removing the equipment cassette.',
      ],
    };
  } else ring.component.placement.translation = [0, 0, l];
  items.push(ring);
  items.push(
    make.occurrence(
      dome,
      'optical-window',
      'D23 / D17 optical dome window',
      { ...dome.defaults },
      [0, 0, l],
      [0, 0, 0],
      true,
    ),
  );
  if (!internal)
    for (const [i, angle] of [0, 120, 240].entries()) {
      const t = (angle * Math.PI) / 180,
        x = 13 * Math.cos(t),
        y = 13 * Math.sin(t);
      items.push(
        make.screw(`window-screw-${i}`, 2, 8, [x, y, l + 3], 'z', true),
        make.hexNut(`window-nut-${i}`, 2, [x, y, l - 3.8], 'z', true),
      );
    }
  const carrier = make.custom(
    'tpu-carrier',
    'One-piece TPU insert and camera carrier',
    tpuCarrierShape(p),
  );
  carrier.component.parameters.meshBackend = 'manifold';
  carrier.component.parameters.meshConform = false;
  carrier.component.manufacturing = {
    material: 'TPU grade and hardness to be selected and physically qualified',
    blank: 'One continuous printed carrier',
    processes: ['printing'],
    requirements: [
      'Measure actual board and optical components before setting clip and slide clearances.',
      'Qualify layer orientation, forked clips, battery retention, heat exposure and service cycling.',
      'The model shows the assembled shape, not elastic insertion or structural stiffness.',
    ],
  };
  carrier.color = 0x466f78;
  items.push(carrier);
  items.push(
    make.occurrence(
      pi,
      'pi5',
      'Raspberry Pi 5',
      { model: 'raspberry-pi-5', detail: 'lightweight' },
      [a.piX, 0, a.piZ],
      [0, -90, 0],
    ),
  );
  items.push(
    make.occurrence(
      adapter,
      'nvme-adapter',
      'Waveshare PCIe TO M.2 Board (D)',
      { ...adapter.defaults },
      [a.adapterX, 0.25, a.piZ],
      [180, 90, 0],
    ),
  );
  items.push(
    make.occurrence(
      ups,
      'ups3s',
      'Waveshare UPS Module 3S',
      { ...ups.defaults },
      [a.upsX, 0, a.upsZ],
      [0, -90, 0],
    ),
  );
  for (const [i, y] of [-19.5, 0, 19.5].entries())
    items.push(
      make.occurrence(
        cell,
        `ups-cell-${i}`,
        'Molicel P28A 18650 cell',
        { model: 'molicel-p28a' },
        [a.upsX + 11.4, y, a.upsZ - 32.6],
        [0, 0, 0],
      ),
    );
  items.push(
    make.occurrence(
      ssd,
      'nvme-ssd',
      'M.2 2280 NVMe module',
      { format: '2280' },
      [a.ssdX, -9.7, a.piZ + 2.5],
      [180, 90, 0],
    ),
  );
  items.push(
    make.sleeve('ssd-screw-washer', 4, 2.2, 1, [a.ssdX - 1.5, -9.7, a.piZ + 42.5], 'x'),
    make.screw('ssd-retention-screw', 2, 4, [a.ssdX - 2, -9.7, a.piZ + 42.5], '-x'),
  );
  items.push(
    make.occurrence(
      camera,
      'csi-camera',
      '19 mm CSI camera body',
      { ...camera.defaults },
      [0, 0, cam],
      [0, 0, 0],
    ),
  );
  return items;
}

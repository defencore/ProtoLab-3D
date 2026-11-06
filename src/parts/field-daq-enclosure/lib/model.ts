import type { Parameters, PartDefinition } from '../../../core/types';
import type { AssemblyComponent, AssemblyDefinition } from '../../../core/product-types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import { roundedRectPoints, roundedRectShape } from '../../../core/analytic-geometry';
import {
  box,
  cylinder,
  prism,
  union,
  subtract,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import manufactured from '../../manufactured-detail/part';
import bolt from '../../bolt-screw/part';
import nut from '../../hex-nut/part';
import washer from '../../washer/part';
import waterproof from '../../waterproof-connector/part';
import { layout } from './layout';
import { baseNutBoss, baseNutBossRelief } from './closure';
import { boardRetention, retentionLayout } from './board-retention';

export const libraries: PartDefinition[] = [manufactured, bolt, nut, washer, waterproof];
export interface EnclosurePiece {
  id: string;
  label: string;
  shape: Shape;
  color: number;
  material: 'PETG' | 'TPU' | 'reference';
  reference?: boolean;
}
export const printIds = [
  'base',
  'wall',
  'lid',
  'panel',
  'board-retainer',
  'base-gasket',
  'lid-gasket',
  'panel-gasket',
  ...Array.from({ length: 4 }, (_, i) => `clamp-pad-${i + 1}`),
  ...Array.from({ length: 4 }, (_, i) => `screw-seal-${i + 1}`),
];
const move = (child: Shape, translation: Vec, rotation: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation,
});
const rounded = (w: number, h: number, r: number, z: number, t: number): Shape => {
  const native = roundedRectShape(w, h, r, z, t);
  return {
    kind: 'prism',
    points: roundedRectPoints(native),
    depth: t,
    origin: z,
    axis: 'z',
    native,
  };
};
const band = (w: number, h: number, r: number, width: number, z: number, t: number): Shape =>
  subtract(
    rounded(w, h, r, z, t),
    rounded(w - 2 * width, h - 2 * width, Math.max(0.4, r - width), z - 0.1, t + 0.2),
  );

/** Supplier drawing: two opposing flats; SP20 has F2F D-1, SP16 D-1.2. */
export function sensorOpening(
  diameter: number,
  height: number,
  origin: Vec,
  axis: 'x' | 'y' | 'z' = 'y',
  flatReduction = 1,
): Shape {
  const [x, y, z] = origin,
    r = diameter / 2,
    half = (diameter - flatReduction) / 2;
  return subtract(
    cylinder(r, height, origin, axis),
    ...(axis === 'z'
      ? [
          box([diameter + 2, 2, height + 0.2], [x - r - 1, y + half, z - 0.1]),
          box([diameter + 2, 2, height + 0.2], [x - r - 1, y - half - 2, z - 0.1]),
        ]
      : axis === 'y'
        ? [
            box([diameter + 2, height + 0.2, 2], [x - r - 1, y - 0.1, z + half]),
            box([diameter + 2, height + 0.2, 2], [x - r - 1, y - 0.1, z - half - 2]),
          ]
        : [
            box([height + 0.2, diameter + 2, 2], [x - 0.1, y - r - 1, z + half]),
            box([height + 0.2, diameter + 2, 2], [x - 0.1, y - r - 1, z - half - 2]),
          ]),
  );
}

/** Corner envelopes are open toward the inter-board gap, with short bridge roofs. */
export function cornerPocket(p: Parameters, x: number, y: number, dx: number, dy: number): Shape {
  const d = layout(p),
    c = d.clearance;
  const footprint = prism(
    [
      [x - 1.8 * dx, y + 1.8 * dy],
      [x + 10.5 * dx, y + 1.8 * dy],
      [x - 1.8 * dx, y - 10.5 * dy],
    ],
    d.boardTop + c + 2 - 3,
    3,
  );
  const slot = box(
    [40, 80 + 2 * c, d.boardThickness + c],
    [dx === 1 ? x - c : x - 40 + c, -40 - c, 8],
  );
  return subtract(footprint, slot);
}

export function pieces(p: Parameters): EnclosurePiece[] {
  const d = layout(p),
    c = d.clearance,
    out: EnclosurePiece[] = [];
  const retention = boardRetention(p);
  const add = (
    id: string,
    label: string,
    shape: Shape,
    material: EnclosurePiece['material'] = 'PETG',
    color = material === 'PETG' ? 0x929b9f : 0x20272b,
  ) => out.push({ id, label, shape, color, material, reference: material === 'reference' });
  const axes = d.screwAxes;
  const L = d.panelLeft,
    R = d.panelRight,
    P = d.panelWidth;
  const end = (shape: Shape) => move(shape, [52, 12, 0], [0, 0, -90]);
  const screwCuts = (z: number, t: number, r = 1.75) =>
    axes.map(([x, y]) => cylinder(r, t, [x, y, z]));
  const gasket = (z: number, t: number) => band(217.35, d.width - 2.65, 8.675, 1.35, z, t);
  const sealGroove = (z: number) => band(218, d.width - 2, 9, 2, z, 0.98);
  const key = (z: number) =>
    subtract(
      band(211, d.width - 9, 5.5, 1.6, z, 2),
      ...axes.map(([x, y]) => cylinder(8.1, 2.4, [x, y, z - 0.2])),
    );
  const keyGroove = (z: number) =>
    subtract(
      band(211 + 2 * c, d.width - 9 + 2 * c, 5.5 + c, 1.6 + 2 * c, z - 0.05, 2.1),
      ...axes.map(([x, y]) => cylinder(8.1 - c, 2.5, [x, y, z - 0.2])),
    );
  const pocketShapes = d.boards.flatMap((b) =>
    [-1, 1].map((s) => cornerPocket(p, b.outerX, s * 40, b.direction, s)),
  );
  const ledges = d.boards.flatMap((b) =>
    [-24, 24].map((y) => box([4, 10, 5], [b.direction === 1 ? b.innerX - 4 : b.innerX, y - 5, 3])),
  );
  const baseBosses = axes.map(([x, y]) => baseNutBoss(p, x, y));
  add(
    'base',
    'Lower cover / PCB envelopes, split central grooves and nut towers',
    subtract(
      union(
        rounded(220, d.width, 10, 0, 3),
        key(3),
        ...pocketShapes,
        ...ledges,
        ...retention.innerSeats,
        retention.base,
        ...baseBosses,
      ),
      sealGroove(2.04),
    ),
    'PETG',
    0xa5adb0,
  );

  const shell = subtract(
    rounded(220, d.width, 10, 3, 40),
    rounded(211.6, d.width - 8.4, 5.8, 2.9, 40.2),
  );
  const towers = axes.map(([x, y]) => cylinder(7.8, 40, [x, y, 3]));
  const rearRails = end(
    union(
      box([4, 8, 36], [L - 4, 50, 7]),
      box([4, 8, 36], [R, 50, 7]),
      box([P + 8, 8, 4], [L - 4, 50, 3]),
      box([P + 8, 1.6, 3.5], [L - 4, 50, 7]),
    ),
  );
  const panelOpening = end(box([P + 2 * c, 9.5, 36.2], [L - c, 52.75, 7]));
  // The forward slot face is the seating datum; gasket pressure holds the tongue here.
  const railSlots = [L - 2.25, R - 0.25].map((x) => end(box([2.5, 2.4, 36.4], [x, 51.6, 7])));
  // Integral SP16 land is 3 mm thick; remaining shell stays 4.2 mm.
  add(
    'wall',
    'Perimeter wall / keyed cassette rails and corner compression columns',
    subtract(
      union(shell, ...towers, rearRails),
      panelOpening,
      ...railSlots,
      sensorOpening(d.sp16Hole, 8, [-112, 0, 25], 'x', 1.2),
      box([1.3, 34, 32], [-107, -17, 9]),
      ...screwCuts(2.9, 40.2),
      ...axes.map(([x, y]) => baseNutBossRelief(p, x, y)),
      keyGroove(3),
      keyGroove(41),
    ),
    'PETG',
    0x303b42,
  );

  const panelPlate = box([P - 2 * c, 3, 36], [L + c, 55, 7]);
  const panelTongues = union(
    box([5, 1.2, 35.75], [L - 2, 52.8, 7.25]),
    box([5, 1.2, 35.75], [R - 3, 52.8, 7.25]),
    box([2.5, 2.5, 35.75], [L + 0.5, 53, 7.25]),
    box([2.5, 2.5, 35.75], [R - 3, 53, 7.25]),
    box([P + 4, 1.2, 2], [L - 2, 52.8, 7.25]),
    box([P - 1, 2.4, 2], [L + 0.5, 53, 7.25]),
    box([P - 4, 3.8, 0.8], [L + 2, 51.7, 9.6]),
    box([P - 2, 2.7, 2.5], [L + 1, 52.8, 40.5]),
  );
  add(
    'panel',
    `Sensor cassette / ${d.sensorCount || 'blank'} SP20`,
    end(
      d.sensorCount
        ? subtract(
            union(panelPlate, panelTongues),
            ...d.sensorXs.map((x) => sensorOpening(d.sp20Hole, 10, [x, 50, 25])),
          )
        : union(panelPlate, panelTongues),
    ),
    'PETG',
    0xa5adb0,
  );
  // Free-state U seal: assembly depicts 0.3 mm interference with its compression land.
  add(
    'panel-gasket',
    'TPU cassette U-seal / 1.5 mm free, 1.2 mm installed',
    end(
      union(
        box([1.6, 1.5, 35.99], [L - 2, 51.3, 7.25]),
        box([1.6, 1.5, 35.99], [R + 0.4, 51.3, 7.25]),
        box([P + 4, 1.5, 1.6], [L - 2, 51.3, 7.25]),
      ),
    ),
    'TPU',
  );

  const lidRibs = subtract(
    union(
      band(202, d.width - 20, 5, 3, 38, 5),
      ...[-78, -5, 68].map((x) => box([2.4, d.width - 20, 3], [x, -d.width / 2 + 10, 40])),
      box([10, 66, 5], [-34, -33, 38]),
      box([3.7, P - 2, 2.5], [101, -(P - 2) / 2, 40.5]),
    ),
    ...axes.map(([x, y]) => cylinder(7.8 + c, 5.2, [x, y, 37.9])),
  );
  const lidBody = subtract(
    union(
      rounded(222.4, d.width + 2.4, 11.2, 43, 3),
      subtract(key(41), end(box([P + 8, 8, 2.2], [L - 4, 50, 40.9]))),
      retention.lidStop,
      lidRibs,
    ),
    sealGroove(43),
    ...screwCuts(42.9, 3.3),
    ...axes.map(([x, y]) => cylinder(3.7, 1.9, [x, y, 44.2])),
    move(band(96, 44, 4, 0.6, 45.65, 0.5), [12, 0, 0]),
  );
  const headSeats = axes.map(([x, y]) =>
    subtract(cylinder(3.6, 0.6, [x, y, 44.2]), cylinder(2.9, 0.8, [x, y, 44.1])),
  );
  add(
    'lid',
    'Upper cover / retainer safety stop and protected label field',
    union(lidBody, ...headSeats),
    'PETG',
    0xa5adb0,
  );
  add('base-gasket', 'TPU lower perimeter gasket / free 1.2 mm', gasket(2.04, 1.2), 'TPU');
  add('lid-gasket', 'TPU upper perimeter gasket / free 1.2 mm', gasket(42.76, 1.2), 'TPU');
  add('board-retainer', 'Central PCB groove key / bayonet feet and release latch', retention.key);
  retention.pads.forEach((pad, i) =>
    add(`clamp-pad-${i + 1}`, 'TPU central groove pad / free 1.2 mm', pad.shape, 'TPU'),
  );
  axes.forEach(([x, y], i) =>
    add(
      `screw-seal-${i + 1}`,
      'TPU under-washer seal / free 0.8 mm',
      subtract(cylinder(2.42, 0.8, [x, y, 44.2]), cylinder(1.4, 1, [x, y, 44.1])),
      'TPU',
    ),
  );
  if (p.showReferences) {
    d.boards.forEach((b) =>
      add(
        `reference-${b.id}`,
        `${b.id === 'psu' ? 'PSU 60 x 80' : 'MCU + ADC 120 x 80'} PCB / user outline`,
        box([b.length, b.width, d.boardThickness], [b.x, b.y, 8]),
        'reference',
        0x297866,
      ),
    );
    d.boards.forEach((b) =>
      add(
        `reference-${b.id}-components`,
        'Maximum component envelope / keep connector and retention margins clear',
        box(
          [
            Math.min(b.x + b.length - 4, 84) - Math.max(b.x + 4, -84),
            64,
            Number(p.componentHeight),
          ],
          [Math.max(b.x + 4, -84), -32, d.boardTop],
        ),
        'reference',
        0x59676c,
      ),
    );
  }
  return out;
}

function occurrence(v: EnclosurePiece): ConfiguredPiece {
  const component = detailComponent(v.id, v.label, v.shape, { preserveAuthoredFrame: true });
  if (v.reference) component.supply = 'reference';
  else
    component.manufacturing = {
      material: v.material,
      blank: `${v.material} filament`,
      processes: ['printing'],
      requirements: [
        v.material === 'TPU'
          ? 'Print separately in free state; qualify compression and retention.'
          : 'Qualify first-layer fit, dimensional coupons and watertightness before field use.',
      ],
    };
  return { component, label: v.label, color: v.color, requireSingleSolid: !v.reference };
}

export function hardware(p: Parameters): ConfiguredPiece[] {
  const d = layout(p);
  return d.screwAxes.flatMap(([x, y], i) => {
    const make = (
      library: PartDefinition,
      id: string,
      label: string,
      parameters: Parameters,
      z: number,
      standard: string,
    ): ConfiguredPiece => ({
      component: {
        id,
        name: label,
        libraryId: library.id,
        parameters,
        state: 'default',
        quantity: 1,
        supply: 'standard',
        placement: { translation: [x, y, z], rotation: [0, 0, 0] },
        procurement: {
          designation: label,
          manufacturer: 'User stock / verify execution',
          source: 'User stock; nominal standard dimensions',
          standard,
        },
      },
      label,
      color: 0xb2bac0,
    });
    return [
      make(
        bolt,
        `screw-${i + 1}`,
        `M3 x ${d.screwLength} socket cap screw`,
        {
          ...bolt.defaults,
          diameter: 3,
          shankDiameter: 3,
          length: d.screwLength,
          head: 'socket-cap',
          headSize: 5.5,
          headHeight: 3,
          drive: 'hex',
          driveWidth: 2.5,
          driveDepth: 1.3,
          pitch: 0.5,
          tip: 'flat',
          tipDiameter: 2,
        },
        d.underheadZ - (d.screwLength - 3) / 2,
        'ISO 4762',
      ),
      make(
        nut,
        `nut-${i + 1}`,
        'M3 hex nut / 5.5 AF x 2.4',
        { ...nut.defaults, bore: 3, acrossFlats: 5.5, height: 2.4, pitch: 0.5 },
        d.nutInstalledZ,
        'ISO 4032',
      ),
      make(
        washer,
        `head-washer-${i + 1}`,
        'M3 flat washer / 3.2 x 7 x 0.5',
        { bore: 3.2, outerDiameter: 7, thickness: 0.5 },
        d.headSeatZ + 0.25,
        'DIN 125',
      ),
    ];
  });
}

export function fitCoupon(p: Parameters): EnclosurePiece {
  const d = layout(p);
  return {
    id: 'fit-coupon',
    label: 'Fit coupon / connector profiles, PCB pocket and captive nut trap',
    material: 'PETG',
    color: 0xa5adb0,
    shape: union(
      subtract(
        box([88, 40, 3], [-44, -20, 0]),
        sensorOpening(d.sp16Hole, 3.2, [-25, 0, -0.1], 'z', 1.2),
        sensorOpening(d.sp20Hole, 3.2, [3, 0, -0.1], 'z'),
      ),
      cornerPocket(p, 30, 10, 1, 1),
      baseNutBoss(p, 26, -8),
    ),
  };
}

/** Reuse the actual production key on a small base before committing to the full shell. */
export function retentionCoupon(p: Parameters): EnclosurePiece {
  const d = layout(p);
  return {
    id: 'retention-coupon',
    label: 'Central groove fit coupon / use with the production key and bare PCB strips',
    material: 'PETG',
    color: 0xa5adb0,
    shape: union(
      box([34, 104, 3], [-46, -48, 0]),
      ...boardRetention(p).innerSeats,
      boardRetention(p).base,
      ...d.boards.flatMap((b) =>
        [-24, 24].map((y) =>
          box([4, 10, 5], [b.direction === 1 ? b.innerX - 4 : b.innerX, y - 5, 3]),
        ),
      ),
    ),
  };
}

/** Canonical definitions stay unchanged; inspection poses belong to occurrences. */
export function configuredPieces(p: Parameters, state: string): ConfiguredPiece[] {
  if (state === 'fit-coupon') return [occurrence(fitCoupon(p))];
  if (state === 'retention-coupon') return [occurrence(retentionCoupon(p))];
  let selected = pieces(p);
  const single: Record<string, string[]> = {
    base: ['base'],
    wall: ['wall'],
    lid: ['lid'],
    panel: ['panel'],
    retainer: ['board-retainer'],
    gasket: ['base-gasket'],
  };
  if (single[state]) selected = selected.filter((v) => single[state].includes(v.id));
  if (state === 'print-layout') selected = selected.filter((v) => printIds.includes(v.id));
  const physical = selected.map(occurrence);
  const connectorInstance = (
    model: string,
    id: string,
    label: string,
    translation: Vec,
    rotation: Vec,
  ): ConfiguredPiece => ({
    component: {
      id,
      name: label,
      libraryId: waterproof.id,
      parameters: { model, panelThickness: 3 },
      state: 'assembled',
      quantity: 1,
      supply: 'reference',
      placement: { translation, rotation },
    },
    label,
    color: 0x303b42,
    preserveLibraryAppearance: true,
  });
  if (p.showReferences && ['assembled', 'open', 'board-service', 'exploded'].includes(state)) {
    physical.push(
      connectorInstance(
        'sp16-5-panel-socket',
        'reference-sp16',
        'SP16-5 panel socket / library model',
        [-110, 0, 25],
        [-90, 0, 90],
      ),
    );
    layout(p).sensorYs.forEach((y, i) =>
      physical.push(
        connectorInstance(
          i === 0 ? 'sp20-4-panel-socket' : 'sp20-3-panel-socket',
          `reference-sp20-${i + 1}`,
          `SP20-${i === 0 ? '4' : '3'} panel socket / library model`,
          [110, y, 25],
          [-90, 0, -90],
        ),
      ),
    );
  }
  if (['assembled', 'open', 'board-service', 'exploded'].includes(state))
    physical.push(...hardware(p));
  return physical.map((v, i) => {
    const id = v.component.id;
    if (state === 'print-layout' || single[state]) {
      const original = selected.find((s) => s.id === id)!;
      let rotation: Vec = [0, 0, 0],
        translation: Vec = [0, 0, 0];
      if (id === 'lid') {
        rotation = [180, 0, 0];
        translation = [0, 0, 46];
      } else if (id === 'board-retainer') {
        rotation = [180, 0, 0];
        translation = [0, 0, retentionLayout(p).capTop];
      } else if (id === 'wall') translation = [0, 0, -3];
      else if (id === 'panel') {
        rotation = [0, 90, 0];
        translation = [0, 0, 110];
      } else if (id === 'panel-gasket') {
        rotation = [0, -90, 0];
        translation = [0, 0, -103.3];
      } else if (id === 'base-gasket') translation = [0, 0, -2.04];
      else if (id === 'lid-gasket') translation = [0, 0, -42.76];
      else if (id.startsWith('clamp-pad')) translation = [0, 0, -layout(p).boardTop + 0.24];
      else if (id.startsWith('screw-seal')) translation = [0, 0, -44.2];
      if (state === 'print-layout') translation[0] += i * 240;
      return occurrence({ ...original, shape: move(original.shape, translation, rotation) });
    }
    let z = 0,
      x = 0,
      y = 0;
    if (
      ['open', 'board-service'].includes(state) &&
      (id === 'lid' ||
        id === 'lid-gasket' ||
        id.startsWith('screw-') ||
        id.startsWith('head-washer-'))
    )
      z = 60;
    if (state === 'board-service' && (id === 'board-retainer' || id.startsWith('clamp-pad'))) {
      z = 30;
      y = -retentionLayout(p).travel;
    }
    if (state === 'exploded') {
      if (
        id === 'lid' ||
        id === 'lid-gasket' ||
        id.startsWith('screw-') ||
        id.startsWith('head-washer-')
      )
        z = 75;
      else if (id === 'board-retainer' || id.startsWith('clamp-pad')) {
        z = 35;
        y = -retentionLayout(p).travel;
      } else if (id === 'wall') z = 30;
      else if (id === 'panel' || id === 'panel-gasket') {
        z = 30;
        x = 45;
      } else if (id.startsWith('reference')) z = 14;
    }
    return { ...v, position: [x, y, z] };
  });
}
export function composition(p: Parameters): AssemblyDefinition {
  return {
    components: [
      ...pieces({ ...p, showReferences: false }).map((v) => occurrence(v).component),
      ...hardware(p).map((v) => v.component),
    ],
    issues: [
      'Verify the delivered SP16/SP20 sockets against the sourced two-flat mounting profiles, retaining nuts and rear wiring clearances.',
      'Measure PCB outline, thickness, solder clearance and component keepouts at each outer pocket and central groove. Fit and release the key before installing electronics.',
      'Qualify PETG/TPU material compatibility, four-screw gasket pressure, rain ingress, temperature and vibration. No IP or chemical-resistance rating is assigned.',
    ],
  };
}

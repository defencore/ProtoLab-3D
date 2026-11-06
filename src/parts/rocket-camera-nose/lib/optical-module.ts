import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import {
  box,
  cylinder,
  prism,
  union,
  subtract,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import type { NoseFactory } from './tpu';
import { csiRibbonReserve } from './csi';
import { at, opticalLayout, opticalOuterRadius } from './optical-layout';
import {
  windowRetainerShape,
  windowRearGasketShape,
  windowFrontGasketShape,
  windowFrontSeatShape,
} from './window-mount';
import { tpuCameraPocketShape } from './camera-mount';
import ov9281, { ov9281Interface } from '../../waveshare-ov9281-110/part';
import dome from '../../optical-dome-window/part';

const oldTurn: Vec = [0, 0, -90];
const oldOffset: Vec = [-15, -5, 0];
const intersect = (...children: Shape[]): Shape => ({ kind: 'intersect', children });
function disk(p: Parameters, z: number, h: number) {
  return cylinder(opticalOuterRadius(p, z + h) - n(p, 'wall') - 0.3, h, [0, 0, z]);
}
export function ovTray(p: Parameters, extra = 0): Shape {
  const a = opticalLayout(p).ov.center;
  // Coordinates here are already in the installed 180-degree board orientation.
  const base = box(
    [30 + extra * 2, 28.86 + extra * 2, 8.4 + extra],
    [a[0] - 15 - extra, -11.86 - extra, a[2] - 5],
  );
  if (extra) return base;
  return subtract(
    base,
    box([25.4, 24.26, 6], [a[0] - 12.7, -9.56, a[2] - 1]),
    box([19, 15, 6], [a[0] - 9.5, -5.5, a[2] - 5.2]),
    box([17.6, 5, 6], [a[0] - 8.8, 10.3, a[2] - 1.2]),
    box([18, 20, 12], [-12.2, 7.75, a[2] - 5.2]),
    csiRibbonReserve(p),
    ...ov9281Interface.mountingHoles.map((h) =>
      cylinder(2.5, 3, [a[0] - h.x, -h.y - 0.5, a[2] + 1.6]),
    ),
    ...ov9281Interface.mountingHoles.map((h) =>
      cylinder(1.1, 8.5, [a[0] - h.x, -h.y - 0.5, a[2] - 5.2]),
    ),
  );
}
export function oldPocket(p: Parameters): Shape {
  return subtract(
    at(tpuCameraPocketShape(p), oldOffset, oldTurn),
    box([18, 20, 35], [-12.2, 7.75, 84.55]),
  );
}
export function opticalFrameClearances(p: Parameters): Shape[] {
  const a = opticalLayout(p),
    l = n(p, 'noseLength');
  return [
    // Positive side clearance; tray rear face bears directly on a thick printed landing.
    ovTray(p, 0.2),
    ...ov9281Interface.mountingHoles.flatMap((h) => [
      cylinder(1.2, 13, [a.ov.center[0] - h.x, -h.y - 0.5, a.ov.center[2] - 8.2]),
      cylinder(2.5, 3, [a.ov.center[0] - h.x, -h.y - 0.5, a.ov.center[2] + 1.6]),
      cylinder(2.6, 2.2, [a.ov.center[0] - h.x, -h.y - 0.5, a.ov.center[2] - 6.8]),
    ]),
    ...(a.dual
      ? [
          at(box([29, 29, 17], [-14.5, -14.5, l - 28.8]), oldOffset, oldTurn),
          cylinder(5.1, 70, [-15, -40, l - 17.5], 'y'),
        ]
      : []),
    ...a.capBolts.flatMap(([x, y]) => [
      cylinder(1.7, 12, [x, y, l - 27]),
      prism(
        Array.from({ length: 6 }, (_, i) => {
          const angle = ((i * 60 + 30) * Math.PI) / 180;
          return [
            x + (5.7 / Math.sqrt(3)) * Math.cos(angle),
            y + (5.7 / Math.sqrt(3)) * Math.sin(angle),
          ] as [number, number];
        }),
        4.2,
        l - 24.2,
      ),
    ]),
  ];
}
/** Thick annular landings join the existing skin; no isolated camera posts. */
export function opticalFrameAdds(p: Parameters): Shape {
  const a = opticalLayout(p),
    l = n(p, 'noseLength');
  const skin: Shape = {
    kind: 'revolve',
    segments: 96,
    profile: [
      ...[99.8, 108, 116, 124.6].map(
        (z) => [opticalOuterRadius(p, z) - n(p, 'wall') - 0.3, z] as [number, number],
      ),
      ...[124.6, 116, 108, 99.8].map(
        (z) => [opticalOuterRadius(p, z) - n(p, 'wall') - 3.8, z] as [number, number],
      ),
    ],
  };
  // A continuous 1:1 inward roof grows from the lower skin, rather than a floating disk.
  const r0 = opticalOuterRadius(p, 99.8) - n(p, 'wall') - 3.8;
  const lands: Shape = {
    kind: 'revolve',
    segments: 96,
    profile: [
      ...[99.8, 108, 116, 124.6].map(
        (z) => [opticalOuterRadius(p, z) - n(p, 'wall') - 0.3, z] as [number, number],
      ),
      [Math.max(8, r0 - (124.6 - 99.8)), 124.6],
      [r0, 99.8],
    ],
  };
  return subtract(
    union(skin, lands),
    // Open rear access and camera/connector population reserves.
    box([23, 22, 35], [a.ov.center[0] - 11.5, -8.8, l - 34]),
    ...(a.dual ? [box([22, 22, 35], [-26, -16, l - 34])] : []),
    ...opticalFrameClearances(p),
    ...cameraPassages(p),
  );
}
function cameraPassages(p: Parameters): Shape[] {
  const a = opticalLayout(p),
    l = n(p, 'noseLength');
  return [
    box([14.8, 14.8, 16], [a.ov.center[0] - 7.4, -7.9, l - 16]),
    box([17.6, 5, 1.4], [a.ov.center[0] - 8.8, 10.3, l - 15.6]),
    ...a.windows.map((w) => cylinder(8.2, 20, [w.x, w.y, l - 17])),
    ...(a.dual ? [box([19.6, 19.6, 2.8], [-24.8, -14.8, l - 15.6])] : []),
  ];
}
export function opticalDeck(p: Parameters): Shape {
  const a = opticalLayout(p),
    l = n(p, 'noseLength');
  return subtract(
    disk(p, a.deckRear, a.deckFront - a.deckRear),
    ...cameraPassages(p),
    ...(a.dual
      ? [
          at(box([25, 25, 3.4], [-12.5, -12.5, l - 15.6]), oldOffset, oldTurn),
          cylinder(5.2, 70, [-15, -40, l - 17.5], 'y'),
        ]
      : []),
    ...a.capBolts.flatMap(([x, y]) => [
      cylinder(1.7, 6, [x, y, a.deckRear - 0.2]),
      cylinder(3.2, 3.5, [x, y, a.deckFront - 3.3]),
    ]),
    ...ov9281Interface.mountingHoles.map((h) =>
      cylinder(2.5, 1.2, [a.ov.center[0] - h.x, -h.y - 0.5, a.deckRear - 0.2]),
    ),
  );
}
export function opticalModulePieces(p: Parameters, make: NoseFactory) {
  const a = opticalLayout(p),
    l = n(p, 'noseLength');
  const printed = (id: string, name: string, shape: Shape, tpu = false, fixed = false) => {
    const item = make.custom(id, name, shape, fixed, 'jscad');
    item.component.manufacturing = {
      material: tpu ? 'TPU fitted camera support' : 'PETG printed optical load deck',
      blank: 'One connected printed body',
      processes: ['printing'],
      requirements: [
        'Measure the delivered lens holder, rear components and connector before printing the final pocket.',
        'Prototype fit, preload, vibration, layer orientation and flight loads require physical qualification.',
      ],
    };
    item.component.parameters.printPose = ['optical-deck', 'camera-pocket'].includes(id)
      ? 'front-down'
      : 'rear-down';
    item.color = tpu ? 0x466f78 : 0xe0e0d8;
    return item;
  };
  const items = [
    printed('optical-deck', 'Removable full-section optical backing deck', opticalDeck(p)),
    printed('ov9281-tray', 'TPU OV9281 PCB pocket and rear landing', ovTray(p), true),
    make.occurrence(
      ov9281,
      'ov9281-camera',
      'Waveshare 21653 OV9281-110',
      { ...ov9281.defaults },
      a.ov.center,
      a.ov.rotation,
    ),
  ];
  if (a.dual)
    items.push(printed('camera-pocket', 'Rear-open TPU 19 mm camera pocket', oldPocket(p), true));
  for (const [i, w] of a.windows.entries()) {
    const offset: Vec = [w.x, w.y, 0],
      tag = a.dual ? (w.ov ? 'ov9281' : 'camera19') : 'ov9281';
    const lensHolderCut = w.ov ? [box([14.8, 14.8, 2], [-7.4, -7.4, l - 11])] : [];
    items.push(
      printed(
        `window-retainer-${tag}`,
        `Internal window retaining ring ${i + 1}`,
        at(
          lensHolderCut.length
            ? subtract(windowRetainerShape(p), ...lensHolderCut)
            : windowRetainerShape(p),
          offset,
        ),
        false,
        true,
      ),
      printed(
        `window-rear-gasket-${tag}`,
        `TPU rear window gasket ${i + 1}`,
        at(windowRearGasketShape(p), offset),
        true,
        true,
      ),
      printed(
        `window-front-gasket-${tag}`,
        `TPU front window gasket ${i + 1}`,
        at(windowFrontGasketShape(p), offset),
        true,
        true,
      ),
      printed(
        `window-front-seat-${tag}`,
        `PETG front window bearing ${i + 1}`,
        at(windowFrontSeatShape(p), offset),
        false,
        true,
      ),
      make.occurrence(
        dome,
        `optical-window-${tag}`,
        `D23 / D17 optical dome ${i + 1}`,
        { ...dome.defaults },
        [w.x, w.y, l],
        [0, 0, 0],
        true,
      ),
    );
  }
  for (const [i, [x, y]] of a.capBolts.entries()) {
    items.push(
      make.screw(`optical-deck-screw-${i}`, 3, 12, [x, y, a.deckFront - 3.3], 'z'),
      make.lockNut(`optical-deck-nut-${i}`, 3, [x, y, l - 22]),
    );
  }
  for (const [i, h] of ov9281Interface.mountingHoles.entries()) {
    const x = a.ov.center[0] - h.x,
      y = -h.y - 0.5;
    // Board, rear fitting envelope, 4 mm TPU floor and M2 locknut.
    items.push(
      make.washer(`ov9281-washer-${i}`, 4.5, 2.2, 0.4, [x, y, a.ov.center[2] + 1.8]),
      make.screw(`ov9281-screw-${i}`, 2, 10, [x, y, a.ov.center[2] + 2], 'z'),
      make.hexNut(`ov9281-nut-${i}`, 2, [x, y, a.ov.center[2] - 5.8]),
    );
  }
  return items;
}

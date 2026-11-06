import source from './lib/pi5/native.json';

type Vec = readonly [number, number, number];
export interface Pi5Bounds {
  readonly min: Vec;
  readonly max: Vec;
}
const boundsFor = (ids: readonly number[]): Pi5Bounds => {
  const bounds = ids.map((id) => source.components[id].bounds);
  return Object.freeze({
    min: Object.freeze([0, 1, 2].map((axis) => Math.min(...bounds.map((b) => b[axis])))) as Vec,
    max: Object.freeze([3, 4, 5].map((axis) => Math.max(...bounds.map((b) => b[axis])))) as Vec,
  });
};

/** Source-solid groups used by the unchanged Pi 5 lightweight purchased model. */
const sourceGroups: [string, number[], string, number][] = [
  ['USB-A dual port 1', [1339], 'dual-east', 0xaab4bc],
  ['USB-A dual port 2', [1340], 'dual-east', 0xaab4bc],
  ['Ethernet RJ45', [1600, 1601], 'east', 0xaab4bc],
  ['USB-C power', [1939, 1940], 'south', 0xaab4bc],
  ['GPIO 40-pin header', Array.from({ length: 41 }, (_, i) => 1341 + i), 'block', 0x303439],
  ['PoE header', [1382, 1383, 1384, 1385, 1386], 'block', 0x303439],
  ['MIPI connector 1', [1259, 1262], 'slot', 0xc8c0b3],
  ['MIPI connector 2', [1307, 1310], 'slot', 0xc8c0b3],
  ['PCIe connector', [1911, 1913], 'slot', 0xc8c0b3],
  ['Power button', [1875, 1876, 1877], 'block', 0x50545a],
  ['microSD socket', [2680, 2681], 'west', 0xaab4bc],
  ['BCM2712 package', [553, 554, 555], 'block', 0x777d82],
  ['RAM package', [0], 'block', 0x292e33],
  ['RP1 package', [1602], 'block', 0x292e33],
  ['Wireless module', [1417], 'block', 0x777d82],
  ['Power component 1', [491], 'block', 0x444a50],
  ['Power component 2', [1209], 'block', 0x444a50],
  ['Power component 3', [546], 'block', 0x444a50],
  ['Underside component', [2684], 'block', 0x444a50],
];

const packages = sourceGroups.map(([label, ids, kind, color]) => {
  const sourceBounds = boundsFor(ids);
  // Match the purchased model: omit solder tails beneath above-board packages.
  const min: Vec = Object.freeze([
    sourceBounds.min[0],
    sourceBounds.min[1],
    sourceBounds.max[2] > 0.1 ? Math.max(sourceBounds.min[2], 1.34) : sourceBounds.min[2],
  ]);
  return Object.freeze({
    label,
    sourceSolids: Object.freeze(ids),
    kind,
    color,
    sourceBounds,
    bounds: Object.freeze({ min, max: sourceBounds.max }),
  });
});
const pcbBounds = boundsFor([2688]);
function connector(label: string, pins: number) {
  const item = packages.find((p) => p.label === label)!;
  const { min, max } = item.bounds;
  return Object.freeze({
    label,
    pins,
    bounds: item.bounds,
    mouth: Object.freeze([(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, max[2]]) as Vec,
    exit: Object.freeze([0, 0, 1]) as Vec,
    widthAxis: Object.freeze([0, 1, 0]) as Vec,
    evidence:
      'Housing top-face center and long axis from retained source CAD. The PCIe +Z entry is visible in the linked installation image; MIPI uses the source-housing top face as a routing reference. Actual contact location, insertion depth and cable bend radius are not dimensioned.',
  });
}

/** Standard-header numbering is bound to the retained pin solid positions. */
const gpioPins = (
  [
    [1, '3V3', 1360],
    [2, '5V', 1380],
    [4, '5V', 1379],
    [6, 'GND', 1378],
  ] as const
).map(([number, signal, sourceSolid]) => {
  const bounds = source.components[sourceSolid].bounds;
  return Object.freeze({
    number,
    signal,
    sourceSolid,
    tip: Object.freeze([
      (bounds[0] + bounds[3]) / 2,
      (bounds[1] + bounds[4]) / 2,
      bounds[5],
    ]) as Vec,
  });
});

/** Public local mechanical datums for raspberry-pi:raspberry-pi-5 only. Millimetres. */
export const pi5Interface = Object.freeze({
  source: Object.freeze({
    kind: 'manufacturer-cad',
    sha256: source.sourceSha256,
    sourceSolidCount: source.sourceSolids,
    url: 'https://pip.raspberrypi.com/categories/892-raspberry-pi-5',
    connectionImage:
      'https://www.waveshare.com/img/devkit/accBoard/PCIe-TO-M.2-Board-D/PCIe-TO-M.2-Board-D-details-15.jpg',
  }),
  pcb: Object.freeze({
    bounds: pcbBounds,
    length: pcbBounds.max[0] - pcbBounds.min[0],
    width: pcbBounds.max[1] - pcbBounds.min[1],
    thickness: pcbBounds.max[2] - pcbBounds.min[2],
    holes: Object.freeze(
      [-39, 19].flatMap((x) =>
        [-24.5, 24.5].map((y) => Object.freeze({ x, y, z: pcbBounds.min[2], diameter: 2.7 })),
      ),
    ),
    evidence:
      'Exact retained source PCB bounds and four source-aligned D2.7 mounting references; thickness is the source solid thickness, not a rounded nominal PCB stock value.',
  }),
  packages: Object.freeze(packages),
  gpio: Object.freeze({
    pins: Object.freeze(gpioPins),
    plasticSourceSolid: 1341,
    seatZ: source.components[1341].bounds[5],
    pitch: 2.54,
    sourceUrl: 'https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#gpio',
    evidence:
      'Official standard-header numbering places pin 1 at the lower-left; pins 2/4 are 5V and pin 6 is GND. Tip centers come from the corresponding retained source pin solids. These four identified pins do not establish a mating connector, wire or current rating.',
  }),
  connectors: Object.freeze({
    pcie: connector('PCIe connector', 16),
    cam1: connector('MIPI connector 1', 22),
    cam0: connector('MIPI connector 2', 22),
  }),
  scope:
    'Source-bound package envelopes for mounting clearances. Above-board lightweight packages omit solder tails and use simple cavities. Full source detail remains available; these envelopes do not establish the actual connector mating interface or populated-board bare contact lands.',
});

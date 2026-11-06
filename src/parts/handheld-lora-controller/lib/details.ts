import type { Parameters } from '../../../core/types';
import { prism, type Shape } from '../../../core/assembly/boundary/shapes';
import { B, C, rounded, hex, union, subtract, move, outline, shellLoft, casePrism } from './shapes';
import {
  board,
  boardClamps,
  gpioPadYs,
  lidScrews,
  batteryScrews,
  batteryBridge,
  batteryMount,
  usb,
  display,
  lidMount,
  layout,
  shell,
  floorRootZ,
} from './layout';
import { guardedShell } from './button-guard';
import { powerBase, powerLid, powerCutouts } from './power-button';
import { boardBaseSupports } from './board-supports';
import { batteryNutPocket, batteryPostSupports } from './battery-supports';
import {
  antennaCradle,
  antennaCutout,
  antennaRetainerRelief,
  upperAntennaTunnel,
} from './antenna-seat';
import { palmTexture, lidTexture, roundedFloorEnvelope } from './grip';
import { baseReinforcement, lidReinforcement, reinforcementCutouts } from './reinforcement';
import { webBaseAdditions, webBaseCutouts, webLidAdditions, webPrintDetails } from './web-button';

export interface Detail {
  id: string;
  label: string;
  shape: Shape;
  color: number;
  material: string;
}
const blindNut = (x: number, y: number, z: number, af: number, h: number, axis: 'x' | 'y'): Shape =>
  union(
    hex(af, z, h, x, y),
    axis === 'y'
      ? B(af, 8, h, x, y - Math.sign(y) * 4, z)
      : B(8, (2 * af) / Math.sqrt(3), h, x - Math.sign(x) * 4, y, z),
  );
const endWindow = (
  width: number,
  height: number,
  radius: number,
  y: number,
  depth: number,
): Shape => move(rounded(width, height, radius, 0, depth), [0, y + depth, usb.centerZ], [90, 0, 0]);

/** Blind tip wells accept the declared longer screws without drilling through the floor. */
export function screwMountCutouts(): Shape[] {
  return [
    ...lidScrews.flatMap(([x, y]) => [
      C(lidMount.boreDiameter, shell.seam + 1 - lidMount.boreBottom, lidMount.boreBottom, x, y),
      // The front pockets enter across the cavity, preserving the outer wall
      // beside the Palm Lock slider's separate assembly channel.
      blindNut(x, y, lidMount.nutPocketBottom, 4.3, 2, y > 0 ? 'x' : 'y'),
      C(6.6, shell.seam + 1 - lidMount.bossBottom, lidMount.bossBottom, x, y),
    ]),
    ...batteryScrews.flatMap(([x, y]) => [
      C(
        batteryMount.boreDiameter,
        batteryBridge.top + 0.1 - batteryMount.boreBottom,
        batteryMount.boreBottom,
        x,
        y,
      ),
      batteryNutPocket(x, y),
    ]),
  ];
}

export function details(p: Parameters, forPrint = false): Detail[] {
  const d = layout(p);
  const mountingHoles = d.buttons
    .filter((b) => b.x > 0)
    .map((b) =>
      move(
        subtract(C(12.7, 8, -4), B(10, 30, 10, 10.7, 0, -5), B(10, 30, 10, -10.7, 0, -5)),
        [b.x - 2, b.y, b.z],
        [0, 90, 0],
      ),
    );
  const posts = lidScrews.map(([x, y]) =>
    C(6.2, lidMount.bossBottom - floorRootZ, floorRootZ, x, y),
  );
  const postCuts = screwMountCutouts();
  const tray = union(
    ...[-13.4, 13.4].map((x) => B(1.2, 52, shell.floor + 8.5 - floorRootZ, x, 3, floorRootZ)),
    B(27, 0.8, shell.floor + 2.2 - floorRootZ, 0, -22.9, floorRootZ),
    B(27, 0.8, shell.floor + 2.2 - floorRootZ, 0, 28.9, floorRootZ),
  );
  const usbWindow = endWindow(usb.width, usb.height, 0.7, 47, 8);
  const plugRelief = endWindow(usb.reliefWidth, usb.reliefHeight, 1.1, usb.reliefBottomY, 3);
  // This follows the chamfered PCB nose; it leaves at least 1.3 mm of the rounded end wall.
  const nosePocket = prism(
    [
      [-13.05, 47],
      [-13.05, 48.8],
      [-10.66, 51.15],
      [10.66, 51.15],
      [13.05, 48.8],
      [13.05, 47],
    ],
    5.5,
    board.pcbBottom - 0.3,
  );
  // Join the internal structure before fusing it to the case floor, so the
  // shared floor contacts form one continuous boundary across all variants.
  const internalStock = union(
    ...posts,
    baseReinforcement(),
    boardBaseSupports(),
    batteryPostSupports(),
    tray,
    powerBase(),
    ...(d.antenna.external ? [antennaCradle(p)] : []),
    ...(p.bodyModel === 'web-grip' ? [webBaseAdditions(p)] : []),
  );
  const internalStructure: Shape = {
    kind: 'intersect',
    children: [internalStock, roundedFloorEnvelope(p)],
  };
  const base = subtract(
    union(internalStructure, guardedShell(p)),
    ...mountingHoles,
    ...postCuts,
    ...d.buttons
      .filter((b) => b.x > 0)
      // Half a millimetre radial allowance around each nominal 15 mm washer.
      .map((b) => move(C(16, 0.8), [18.9, b.y, b.z], [0, -90, 0])),
    usbWindow,
    plugRelief,
    nosePocket,
    ...(d.antenna.external ? [antennaCutout(p)] : []),
    ...(d.antenna.top ? [upperAntennaTunnel(p)] : []),
    ...(p.bodyModel !== 'original' ? [palmTexture()] : []),
    reinforcementCutouts(),
    ...(p.bodyModel === 'web-grip' ? [webBaseCutouts(p)] : []),
    powerCutouts(),
  );
  const lip = subtract(
    union(casePrism(2.6, shell.seam - 1.4, 1.8), casePrism(1.6, shell.seam, 0.9)),
    casePrism(3.6, shell.seam - 2, 4),
  );
  const clampFeet = boardClamps.map(({ x, y }) =>
    union(
      B(1.4, 6, 0.4, x, y, board.pcbTop),
      B(2.6, 6, shell.seam + 0.1 - (board.pcbTop + 0.4), x, y, board.pcbTop + 0.4),
    ),
  );
  // Relieve all GPIO annuli, including adjacent rows crossing the ends of each foot.
  const gpioReliefs = [-11.43, 11.43].flatMap((x) =>
    gpioPadYs.map((y) => C(2.1, 0.6, board.pcbTop - 0.1, x, y)),
  );
  const viewportChamfer: Shape = {
    kind: 'loft',
    rings: [
      outline(display.windowWidth, display.windowLength, 0.5, display.x, display.y).map(
        ([x, y]) => [x, y, 28.4],
      ),
      outline(display.chamferWidth, display.chamferLength, 1, display.x, display.y).map(
        ([x, y]) => [x, y, shell.height + 0.1],
      ),
    ],
  };
  const lidCuts: Shape[] = [
    rounded(display.windowWidth, display.windowLength, 0.5, 27, 5, display.x, display.y),
    viewportChamfer,
    ...lidScrews.flatMap(([x, y]) => [
      C(2.2, 12, shell.seam - 3, x, y),
      C(4.4, 4, lidMount.screwSeat, x, y),
    ]),
    ...gpioReliefs,
  ];
  if (p.bodyModel !== 'original') lidCuts.push(lidTexture());
  else
    for (const y of [-7, -14, -21, -28, -35])
      lidCuts.push(rounded(22, 1.2, 0.5, shell.height - 0.2, 1, 1, y));
  // Keep the outer protective-frame clearance centered while its display aperture is offset.
  const roofBacking = subtract(
    casePrism(2.6, 27.6, 1.4),
    rounded(20, 34.4, 1.2, 26, display.maskBottom - 26, board.x, board.screenY),
  );
  const lid = subtract(
    union(
      shellLoft([
        [shell.seam, 0],
        [28.2, 0],
        [shell.height, 1],
      ]),
      roofBacking,
      rounded(
        16,
        27.2,
        1,
        display.maskBottom,
        shell.height - display.maskBottom,
        display.x,
        display.y,
      ),
      lip,
      ...lidScrews.map(([x, y]) =>
        C(6.2, shell.seam + 0.1 - lidMount.bossBottom, lidMount.bossBottom, x, y),
      ),
      ...clampFeet,
      lidReinforcement(),
      powerLid(),
      ...(p.bodyModel === 'web-grip' ? [webLidAdditions(p)] : []),
    ),
    ...lidCuts,
  );
  const cableRelief = antennaRetainerRelief(p);
  const batteryRetainer = subtract(
    union(
      rounded(26.6, 7, 3, batteryBridge.z, 2, 0, batteryBridge.y),
      rounded(14, 20, 2, batteryBridge.z, 2, 0, 23.5),
    ),
    ...batteryScrews.map(([x, y]) => C(2.2, 4, batteryBridge.z - 1, x, y)),
    ...(cableRelief ? [cableRelief] : []),
  );
  return [
    {
      id: 'base',
      label: 'Integral guarded base with Heltec cradle',
      shape: base,
      color: 0x343e4a,
      material: 'PETG / verify grade',
    },
    {
      id: 'lid',
      label: 'Lid with integral relieved PCB clamps',
      shape: lid,
      color: 0x678492,
      material: 'PETG / verify grade',
    },
    {
      id: 'battery-retainer',
      label: 'Transverse battery bridge',
      shape: batteryRetainer,
      color: 0xe4a45d,
      material: 'PETG / insulating',
    },
    ...(p.bodyModel === 'web-grip' ? webPrintDetails(p, forPrint) : []),
  ];
}

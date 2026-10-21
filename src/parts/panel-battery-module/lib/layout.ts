import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import holderModels from '../../li-ion-battery-holder/lib/models.json';

export function layout(p: Parameters) {
  const cells = p.pack === '3S' ? 3 : 4;
  const holder = holderModels.find((m) => m.id === `mpd-bk-18650-pc${cells * 2}`)!;
  const boardLength = 100;
  const boardCentre: [number, number] = [-5, 0];
  const boardWidth = cells === 3 ? 70 : 100;
  const bodyLength = 152,
    bodyWidth = boardWidth + 20;
  const bodyCentre: [number, number] = [16, 0];
  const bodyLeft = -60,
    bodyRight = 92;
  const openingLength = holder.length + 4;
  const openingWidth = holder.width + 4;
  const lidLength = openingLength + 8,
    lidWidth = openingWidth + 12;
  const caseHoles = [-55, 87].flatMap((x) =>
    [-1, 1].map((y) => [x, y * (bodyWidth / 2 - 5)] as [number, number]),
  );
  const panelHoles = [-65.5, 97.5].flatMap((x) =>
    [-1, 1].map((y) => [x, y * (bodyWidth / 2 + 5.5)] as [number, number]),
  );
  const boardHoles = [-1, 1].flatMap((x) =>
    [-1, 1].map(
      (y) =>
        [cells === 3 ? x * 41.5 : x < 0 ? -47 : 41.5, y * (cells === 3 ? 31.5 : 45.72)] as [
          number,
          number,
        ],
    ),
  );
  const holderHoles = holder.mountHoles as [number, number][];
  const holderClampX = cells === 3 ? 50 : 52;
  const holderClampY = holder.width / 2 - 8;
  const holderClampAxes = [-1, 1].flatMap((x) =>
    [-1, 1].map((y) => [x * holderClampX, y * holderClampY] as [number, number]),
  );
  const pinRows = Array.from({ length: cells }, (_, i) => (i - (cells - 1) / 2) * 19.3);
  const holderPins = [-36.65, 36.25].flatMap((x) => pinRows.map((y) => [x, y] as [number, number]));
  const balanceCentre: [number, number] = [-50.5, 0];
  const balancePins = Array.from(
    { length: cells + 1 },
    (_, i) => [balanceCentre[0], (cells / 2 - i) * 2.54] as [number, number],
  );
  const panelThickness = n(p, 'panelThickness');
  const panelBoltLength = [12, 16, 20].find((l) => l >= panelThickness + 9.7)!;
  return {
    cells,
    holder,
    boardLength,
    boardCentre,
    boardLeft: boardCentre[0] - boardLength / 2,
    balanceSupportAxes: [
      [-52.5, -11],
      [-52.5, 11],
    ] as [number, number][],
    boardWidth,
    bodyLength,
    bodyWidth,
    bodyCentre,
    bodyLeft,
    bodyRight,
    flangeLength: 176,
    flangeWidth: bodyWidth + 24,
    flangeBottom: 0,
    flangeTop: 4,
    wall: 3,
    baseBottom: -36,
    baseTop: -33,
    frameBottom: -33,
    boardBottom: -26.5,
    boardTop: -25,
    holderZ: -25,
    cellZ: -13.3,
    cellDiameter: 18.3,
    cellLength: 68,
    pinRows,
    openingLength,
    openingWidth,
    lidLength,
    lidWidth,
    lidBottom: 4,
    lidTop: 7.2,
    strapWidth: 12,
    strapThickness: 0.4,
    caseHoles,
    panelHoles,
    boardHoles,
    holderHoles,
    holderClampAxes,
    holderClampX,
    holderClampY,
    holderContactX: holder.length / 2 - 0.7,
    holderContactZ: -3.46,
    boardReliefs: holderClampAxes.filter(([x]) => x < 0),
    holderPins,
    xtCentre: [73, -25] as [number, number],
    xtZ: 4,
    balanceCentre,
    balancePins,
    panelThickness,
    panelBoltLength,
    headerPins: cells + 1,
    cutoutLength: bodyLength + 0.8,
    cutoutWidth: bodyWidth + 0.8,
    cutoutRadius: 5.4,
  };
}

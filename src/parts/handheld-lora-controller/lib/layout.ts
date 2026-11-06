import type { Parameters } from '../../../core/types';
import { powerSwitch } from './power-button';
import { antennaLayout } from './antenna-seat';
import { webButton } from './web-button';
import { shell } from './case-datums';
export { shell, floorRootZ } from './case-datums';

export const board = {
  x: 0,
  y: 25,
  z: 16.9,
  width: 25.4,
  length: 51.69,
  height: 10.7,
  pcbBottom: 20.5,
  pcbTop: 22.1,
  screenY: 19.65,
};
export const display = {
  // +X is left and -Y is up in the exterior working view, with buttons at upper left.
  x: 2,
  y: board.screenY - 1,
  frameTop: board.z + 10.7,
  faceZ: board.z + 10.6,
  windowWidth: 11.8,
  windowLength: 22.4,
  chamferWidth: 12.8,
  chamferLength: 23.4,
  maskBottom: 27.95,
};
export const lidMount = {
  bossBottom: 25.8,
  screwSeat: 27,
  screwLength: 8,
  supportedScrewLengths: [6, 8, 10, 12],
  nutPocketBottom: 21,
  nutBottom: 21.2,
  nutHeight: 1.6,
  boreDiameter: 2.2,
  boreBottom: 3.2,
};
export const lidScrews: [number, number][] = [
  [-16.3, 29],
  [16.3, 29],
  // Keep the through-bores outside the full-width upper antenna pedestal legs.
  [-11.5, -44.5],
  [11.5, -44.5],
];
export const boardClampLocalYs = [-7.7, 14.25];
export const boardClamps = boardClampLocalYs.flatMap((y) =>
  [-12.2, 12.2].map((x) => ({ x, y: board.y + y })),
);
export const gpioPadYs = Array.from({ length: 18 }, (_, i) => board.y + 0.8255 + (i - 8.5) * 2.54);
export const usb = {
  centerZ: board.z + 6.69,
  faceY: board.y + 26.6,
  width: 10.4,
  height: 4.4,
  reliefWidth: 12.6,
  reliefHeight: 5.8,
  reliefBottomY: 52,
};
export const batteryScrews: [number, number][] = [
  [-10.5, 33.5],
  [10.5, 33.5],
];
export const batteryBridge = { z: 13.4, top: 15.4, y: 33.5 };
export const batteryMount = {
  screwSeat: batteryBridge.top,
  screwLength: 6,
  supportedScrewLengths: [6, 8, 10],
  nutPocketBottom: 9.2,
  nutPocketAcrossFlats: 4.4,
  nutPocketHeight: 2.2,
  nutBottom: 9.6,
  nutHeight: 1.6,
  boreDiameter: 2.2,
  boreBottom: 3.2,
};
export function layout(p: Parameters) {
  const battery = {
    x: 0,
    y: 3,
    z: shell.floor + Number(p.batteryTapeThickness),
    width: Number(p.batteryWidth),
    length: Number(p.batteryLength),
    height: Number(p.batteryHeight),
    tapeThickness: Number(p.batteryTapeThickness),
  };
  return {
    ...shell,
    bodyModel: String(p.bodyModel),
    battery,
    buttons: [-10, -35].map((y, index) => ({
      id: index ? 'button-b' : 'button-a',
      label: index ? 'Upper' : 'Lower',
      finger: index ? 'index' : 'middle',
      capColour: index ? 'red' : 'black',
      y,
      x: 21,
      z: 18.5,
      position: String(index ? p.buttonB : p.buttonA),
      rotation: [0, 90, 0] as [number, number, number],
      ...(p.bodyModel === 'web-grip' && index === 0
        ? {
            label: 'Recessed',
            finger: 'thumb web',
            x: webButton.stock.position[0],
            y: webButton.stock.position[1],
            z: webButton.stock.position[2],
            rotation: webButton.stock.rotation,
          }
        : {}),
    })),
    guardPlane: 21 + Number(p.guardProjection),
    guardCenterZ: 18.5,
    guardBottom: 11.2,
    guardTop: 25.8,
    guardSupportYs: p.bodyModel === 'web-grip' ? [-47.1, -22.5, 45.5] : [-47.1, -22.5, 2.4, 45.5],
    releasedCapPlane: 26,
    flatSurfaceClearance: Number(p.guardProjection) - 5,
    terminalTipX: -2.5,
    board,
    boardClamps,
    usb,
    display,
    lidMount,
    batteryMount,
    antenna: antennaLayout(p),
    webButton:
      p.bodyModel === 'web-grip'
        ? { ...webButton, safetyPosition: String(p.safetyPosition) }
        : null,
    powerButton: { ...powerSwitch, inspectionPosition: String(p.powerButton) },
  };
}

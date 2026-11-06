import { platformAxes, gpsCentre, gpsAngle, usbCentre, buzzerCentre, transformedXY } from './model';

/** Current source assembly placements, measured from the lower platform underside. */
export const mountingLayout = {
  sourceWorldLowerUndersideZ: 155,
  lower: {
    sourceId: 140,
    model: 'lower-platform-current',
    translation: [0, 0, 0],
    rotation: [0, 0, 0],
  },
  upper: {
    sourceId: 248,
    model: 'upper-clamp-disc-current',
    translation: [0, 0, 13],
    rotation: [0, 0, 0],
  },
  gps: {
    sourceId: 233,
    translation: [...gpsCentre, 3],
    rotation: [0, 0, gpsAngle],
    datum: 'Source GPS complete underside envelope; PCB bottom is 0.5 mm above it',
  },
  buzzer: {
    sourceId: 234,
    translation: [...buzzerCentre, 3],
    rotation: [0, 0, 90],
    datum: 'Source nominal 26 x 17 x 15 envelope bottom',
  },
  usb: {
    sourceId: 326,
    translation: [...usbCentre, 5],
    rotation: [0, 0, 90],
    datum: 'Source USB PCB bottom; underside SMD extends down by 1.5 mm',
  },
  gpsPads: [
    { sourceId: 159, model: 'gps-pad-159-current', centre: [-2, -9.4] },
    { sourceId: 160, model: 'gps-pad-plain-current', centre: [-2, 9.4] },
    { sourceId: 161, model: 'gps-pad-161-current', centre: [2, -9.4] },
    { sourceId: 162, model: 'gps-pad-plain-current', centre: [2, 9.4] },
  ].map(({ centre, ...pad }) => ({
    ...pad,
    translation: [...transformedXY(centre[0], centre[1], gpsCentre, gpsAngle), 4.3],
    rotation: [0, 0, gpsAngle],
  })),
  interdiscPosts: platformAxes.map(([x, y], i) => ({
    sourceId: 356 + i,
    translation: [x, y, 3],
    rotation: [0, 0, 0],
    designation: 'M2.5 x 10 FF, AF5, nominal through internal thread',
    supply: 'reference',
  })),
  topScrews: platformAxes.map(([x, y], i) => ({
    sourceId: 372 + i,
    translation: [x, y, 16],
    rotation: [0, 180, 0],
    designation: 'Candidate ISO 4762 M2.5 x 6; thread engagement 3 mm through upper disc',
  })),
  usbScrews: {
    sourceIds: [330, 331],
    designation: 'Candidate ISO 4762 M2.5 x 8; actual PCB thickness and length unresolved',
  },
  usbNuts: {
    sourceIds: [334, 335],
    designation: 'M2.5, assumed AF5 x 2; underside nut access unresolved',
  },
  buzzerTies: { sourceProcurementPosition: 315, quantity: 2, installedPathModelled: false },
} as const;

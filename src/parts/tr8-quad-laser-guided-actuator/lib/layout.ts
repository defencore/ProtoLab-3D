import { cncLayout, type CncLayout } from '../../tr8-quad-cnc-actuator/part';

/** Original 50 mm drive geometry; a 3 mm fixed plate replaces the 5 mm CNC base. */
export const laserLayout: CncLayout = {
  ...cncLayout('coplanar-64'),
  middleBase: [-18, -15],
};
export const frameLayout = {
  discThickness: 3,
  plateStations: [-51, -18, 15],
  clearSpans: [30, 30],
  guideShoulders: [-15, 15],
  guideTenon: 8,
  guideSocket: 8.1,
  tabDepth: 2.7,
  cheekPlanes: [[11.1, 14.1], [14.9, 17.9]],
  cheekBore: 10.02,
  cheekPilot: 9.8,
  cheekSlot: 3.1,
} as const;

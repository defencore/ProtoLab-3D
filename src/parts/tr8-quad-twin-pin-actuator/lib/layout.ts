import { layout as base } from '../../tr8-quad-laser-guided-actuator/part';
import { nutTravel } from '../../tr8-quad-cnc-actuator/part';

export const layout = {...base};
export const twinPin = {
  nutLength:8, nutRadius:6.5, nutFlatHalfWidth:5,
  pinDiameter:4, innerPinEnd:-8.2, outerPinEnd:9.7,
  guideLowY:-8.05, guideHighY:-5.05, guideBottom:-4.15, guideTop:14.55,
  guideSlotWidth:4.1, guideSlotHalfTravel:nutTravel(layout,20)+.05,
  innerBearingCentre:-5.7, innerBearingBore:3, innerBearingOuter:6,
  innerBearingWidth:2.5, innerBearingFlange:7.2, innerBearingFlangeWidth:.6,
  shaftEnd:-7.45, journalShoulder:-4.45, mainShaftStart:-4.05,
  sleeveFrom:9.55, sleeveTo:15.5,
} as const;

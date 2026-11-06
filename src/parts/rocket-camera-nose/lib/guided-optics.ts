import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import { ov9281Interface } from '../../waveshare-ov9281-110/part';
import type { Vec } from '../../../core/assembly/boundary/shapes';
import { guidedProfileInterface } from './guided-profile';

/** One real case/cage accepts either source-specific removable camera cartridge. */
export const guidedOpticalInterface = {
  apertureRadius: guidedProfileInterface.apertureRadius,
  linerOuterRadius: 11.5,
  rearStopBackOffset: 32,
  rearStopFrontOffset: 28,
  ovFocusExtension: 10,
} as const;
export function guidedOptics(p: Parameters) {
  const l = n(p, 'noseLength'),
    ov = p.cameraSetup === 'ov9281';
  const projection = ov
    ? ov9281Interface.boardThickness +
      ov9281Interface.fixedProjection +
      guidedOpticalInterface.ovFocusExtension
    : 27;
  const rear = l + 2 - projection;
  return {
    ov,
    apertureRadius: guidedOpticalInterface.apertureRadius,
    linerOuterRadius: guidedOpticalInterface.linerOuterRadius,
    translation: [0, 0, rear] as Vec,
    rotation: [0, 0, ov ? 180 : 0] as Vec,
    rear,
    front: l + 2,
    linerFront: l + 1.5,
    rearStopBack: l - guidedOpticalInterface.rearStopBackOffset,
    rearStopFront: l - guidedOpticalInterface.rearStopFrontOffset,
    lensRadius: ov ? 7 : 6,
    boreRadius: ov ? 7.2 : 6.2,
  };
}

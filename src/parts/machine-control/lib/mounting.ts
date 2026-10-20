import type { Parameters } from '../../../core/types';
import type { Vec } from '../../../core/assembly/boundary/shapes';

export const controlMountingSources = {
  atv12: 'https://iportal.se.com/Contents/docs/SQD-ATV12HU22M2.PDF',
  lrs150: 'https://www.meanwell.com/Upload/PDF/LRS-150/LRS-150-SPEC.PDF',
  pnoz: 'https://www.pilz.com/download/open/PNOZ_X3_Operating_Manual_20547-EN-10.pdf',
  xb5: 'https://www.se.com/uk/en/download/document/BRU46063/',
  xb5Collar:
    'https://www.se.com/au/en/product/ZB5AZ009/body-fixing-collar-for-electrical-block-harmony-xb5-plastic/',
};

/** Native axes: width X, front +Y, height Z. These are source interfaces, not internal CAD. */
export function controlMounting(p: Parameters) {
  switch (p.model) {
    case 'atv12hu22m2':
      return {
        kind: 'rear-tabs' as const,
        source: controlMountingSources.atv12,
        holes: [
          [-46.5, 0, 137],
          [46.5, 0, 17],
        ] as Vec[],
        diameter: 5,
        // The manufacturer specifies the hole centers; tab/head-clearance contours remain illustrative.
        illustrativeTabThickness: 3,
        note: 'Published diagonal 93 x 120 mm, two D5 holes; rear tab contour/thickness must be checked on delivered CAD.',
      };
    case 'lrs15024':
      return {
        kind: 'rear-taps' as const,
        source: controlMountingSources.lrs150,
        holes: [
          [-55.5, 0, 32],
          [22.5, 0, 32],
        ] as Vec[],
        diameter: 3,
        pitch: 0.5,
        depth: 3,
        note: 'Case 241A bottom two M3 L=3.0 holes: 24/102 mm from left, 32 mm from bottom. Case is mounted vertically; confirm cooling derating for this orientation.',
      };
    case 'pnozx3':
      return {
        kind: 'din-rail' as const,
        source: controlMountingSources.pnoz,
        railWidth: 35,
        railHeight: 7.5,
        centerZ: 43.5,
        note: 'Manufacturer requires a 35 mm DIN rail and a retaining bracket for vertical rail installation; detailed latch dimensions are unpublished and modeled illustratively.',
      };
    case 'xb5as8444': {
      const thickness = Number(p.panelThickness);
      return {
        kind: 'panel-collar' as const,
        source: controlMountingSources.xb5,
        panelThickness: thickness,
        panelFront: 65,
        panelRear: 65 - thickness,
        hole: 22.5,
        note: 'Published D22.5 recommended cutout and 1..6 mm panel; supplied plastic fixing collar clamps the rear face. Collar/contact contours are illustrative, not a fabricated threaded nut.',
      };
    }
    case 'ddcs-v3-1':
    case 'ddcs-v4-1': {
      const v4 = p.model === 'ddcs-v4-1';
      return {
        kind: 'panel-clamps' as const,
        rearWidth: v4 ? 216 : 175,
        rearHeight: v4 ? 132 : 110,
        rearDepth: v4 ? 43 : 32,
        fasciaWidth: v4 ? 237 : 191,
        fasciaHeight: v4 ? 153.7 : 128,
        note: 'Authored rear clamping bars use the modeled rear enclosure and fascia, without OEM holes. Published cutout/depth statements conflict: approve delivered-unit measurements before machining.',
      };
    }
    default:
      return {
        kind: 'external-cradle' as const,
        note: 'No verified OEM hole coordinates. Authored removable cradle captures the source housing envelope; delivered housing, cooling and connector access need fixture approval.',
      };
  }
}

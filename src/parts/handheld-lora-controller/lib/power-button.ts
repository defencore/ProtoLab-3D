import type { Parameters } from '../../../core/types';
import { cylinder, type Shape, type Vec } from '../../../core/assembly/boundary/shapes';
import { B, subtract, union } from './shapes';
import { floorRootZ } from './case-datums';

/** User-owned switch: 12 x 12 x 4 mm body, with a 6 mm-high, diameter 6 mm actuator. */
export const powerSwitch = {
  model: 'user-tactile-12x12x4-d6-h6',
  position: [0, -42.5, 21] as Vec,
  rotation: [90, 0, 0] as Vec,
  bodyWidth: 12,
  bodyHeight: 12,
  bodyDepth: 4,
  bodyFrontY: -46.5,
  bodyBackY: -42.5,
  bodyBottomZ: 15,
  bodyTopZ: 27,
  actuatorDiameter: 6,
  actuatorProjection: 6,
  faceY: -52.5,
  faceRecess: 0.5,
  inspectionStroke: 0.2,
  guideDiameter: 6.6,
  guideCenter: [0, -53, 21] as Vec,
  pocketWidth: 12.4,
  pocketDepth: 4.4,
  pocketFrontY: -46.7,
  pocketBackY: -42.3,
  carrierWidth: 18.8,
  cheekThickness: 3.2,
  floorTopZ: 15,
  minimumArchRoof: 1.5,
  baseGuideTopZ: 24.5,
  lidGuideBottomZ: 24.7,
  guideSplitGap: 0.2,
  rearStopWidth: 6,
  rearStopDepth: 2.8,
  frontBridge: {
    frontY: -52.4,
    backY: -46.7,
    width: 12.4,
    bottomZ: 15,
    topZ: 25,
    shoulderWidth: 2.9,
  },
  rearT: {
    crossbarWidth: 6,
    crossbarDepth: 2.8,
    frontY: -42.3,
    crossbarBackY: -39.5,
    stemWidth: 3.2,
    backY: -38.2,
    baseBottomZ: floorRootZ,
    baseTopZ: 25,
    lidBottomZ: 25.2,
    lidTopZ: 28.3,
    minimumBodyXClearance: 0.5,
    minimumLugYClearance: 2.2,
    minimumFpcYClearance: 1.7,
  },
  lidBearingWidth: 8,
  lidBearingDepth: 3.6,
  lidBearingZ: 27,
  loadingDirection: [0, 0, -1] as Vec,
  wireGrooveWidth: 1.2,
};

const alongY = (diameter: number, length: number, y: number): Shape =>
  cylinder(diameter / 2, length, [0, y, powerSwitch.position[2]], 'y');

/** Direct actuation; body and actuator dimensions come from the user's actual switch. */
export function powerSwitchShape(p: Parameters): Shape {
  const stroke = p.powerButton === 'last' ? powerSwitch.inspectionStroke : 0;
  return union(B(12, 4, 12, 0, -44.5, 15), alongY(6, 6 - stroke, powerSwitch.faceY + stroke));
}

function actuatorOpening(): Shape {
  const mouth: Shape = {
    kind: 'loft',
    rings: [
      [-53.4, 8],
      [-52.4, 6.6],
    ].map(([y, diameter]) =>
      Array.from({ length: 64 }, (_, i): Vec => {
        const a = (i * Math.PI) / 32;
        return [(diameter / 2) * Math.cos(a), y, 21 + (diameter / 2) * Math.sin(a)];
      }),
    ),
  };
  return union(alongY(6.6, 10, -55), mouth);
}

function wireGrooves(): Shape {
  return union(
    // The delivered lead pattern is unspecified; these open channels reserve
    // room at either side without pretending to model a supplier terminal layout.
    ...[-1, 1].map((sign) => B(1.2, 4.4, 8, sign * 6.6, -44.5, 17)),
  );
}

/** The crossbar bears on the body; the central stem resists bending into the case. */
function rearTSupport(bottom: number, top: number): Shape {
  const t = powerSwitch.rearT;
  return union(
    B(t.crossbarWidth, t.crossbarDepth, top - bottom, 0, (t.frontY + t.crossbarBackY) / 2, bottom),
    B(t.stemWidth, t.backY - t.frontY, top - bottom, 0, (t.frontY + t.backY) / 2, bottom),
  );
}

/** An open-top round-bottom slot permits the complete switch to drop straight in. */
export function powerCutouts(): Shape {
  return union(actuatorOpening(), B(6.6, 9, 20, 0, -50.5, 21), wireGrooves());
}

/** Wide floor and side rails carry the body; no separate cap or loose retainer. */
export function powerBase(): Shape {
  const front = powerSwitch.frontBridge;
  return subtract(
    union(
      B(18.8, 6.2, 15 - floorRootZ, 0, -44, floorRootZ),
      ...[-1, 1].map((sign) => B(3.2, 4.6, 9.5, sign * 7.8, -44.5, 15)),
      // Carry both sides of the body-bearing wall right into the end-wall
      // aperture. The open-top slot still admits the complete switch vertically.
      B(
        front.width,
        front.backY - front.frontY,
        front.topZ - front.bottomZ,
        0,
        (front.frontY + front.backY) / 2,
        front.bottomZ,
      ),
      rearTSupport(powerSwitch.rearT.baseBottomZ, powerSwitch.rearT.baseTopZ),
    ),
    powerCutouts(),
  );
}

/** A rooted front key closes the slot; corner grooves and a broad pad retain the body. */
export function powerLid(): Shape {
  const frontKey = B(6.2, 3, 7.3, 0, -51.3, 21),
    upperRails = union(
      // Narrow upper rails clear the adjacent lid-post bosses during closure.
      ...[-1, 1].map((sign) => B(2, 4.6, 3.6, sign * 7.2, -44.5, 24.7)),
      B(12.4, 1.6, 3.1, 0, -47.5, 25.2),
      rearTSupport(powerSwitch.rearT.lidBottomZ, powerSwitch.rearT.lidTopZ),
      B(8, 3.6, 1.3, 0, -44.5, 27),
    );
  return subtract(union(frontKey, upperRails), actuatorOpening(), wireGrooves());
}

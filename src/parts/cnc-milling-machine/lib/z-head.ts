import { Euler, Vector3 } from 'three';
import type { Parameters } from '../../../core/types';
import type { Vec } from '../../../core/assembly/boundary/shapes';
import type { FrameHole } from '../../cnc-frame-part/part';
import rail, { railParameters, railMountingHoles } from '../../cnc-guide-rail/part';
import carriage, { carriageParameters, carriageMountingHoles } from '../../cnc-guide-carriage/part';
import spindle from '../../cnc-spindle/part';
import mount, { spindleMountLayout, spindleMountDefaults } from '../../cnc-spindle-mount/part';
import type { MillingBuilders } from './builders';
import type { millingLayout } from './layout';

type Layout = ReturnType<typeof millingLayout>;
type HeadBuilders = Pick<MillingBuilders, 'add' | 'fabricated' | 'fastener'>;
const rotate = (point: Vec, angles: Vec): Vec =>
  new Vector3(...point)
    .applyEuler(new Euler(...(angles.map((value) => (value * Math.PI) / 180) as Vec), 'ZYX'))
    .toArray() as Vec;
const clearance = (at: Vec, diameter: number, depth: number): FrameHole => ({
  axis: 'y',
  at,
  diameter: diameter + 0.6,
  depth,
});

/** Source Z-guide hardware fills the head drilling arrays before the final independent blanks. */
export function addZGuides(
  v: Layout,
  h: HeadBuilders,
  xPlateHoles: FrameHole[],
  zSaddleHoles: FrameHole[],
) {
  for (const side of [-1, 1]) {
    const parameters = railParameters(v.railZLength),
      origin: Vec = [side * 70, v.xPlateFront, v.railZCenter],
      rotation: Vec = [-90, -90, 0];
    h.add('z-guide-rail-' + side, rail, parameters, 'default', origin, rotation, 'x');
    for (const [i, [z]] of railMountingHoles(parameters).entries()) {
      xPlateHoles.push({
        axis: 'y',
        at: [side * 70, -2, z],
        diameter: 5,
        depth: 12,
        threadPitch: 0.8,
        threadDesignation: 'M5',
      });
      h.fastener(
        `z-rail-${side}-bolt-${i}`,
        5,
        20,
        [side * 70, v.xPlateFront + 9, v.railZCenter + z],
        [0, 1, 0],
        'x',
      );
    }
    for (const [i, z] of [-70, 70].entries()) {
      h.add(
        `z-carriage-${side}-${i}`,
        carriage,
        { ...carriageParameters(), threadFitAllowance: 0.05 },
        'assembled',
        [side * 70, v.xPlateFront, v.guideLow + 100 + z],
        rotation,
        'z',
      );
      for (const [j, hole] of carriageMountingHoles().entries()) {
        const turned = rotate(hole, rotation),
          x = side * 70 + turned[0],
          zz = z + turned[2];
        zSaddleHoles.push(
          clearance(
            [x, -v.movingPlateThickness / 2 - 0.1, v.guideLow + 100 + zz - v.saddleCenter],
            5,
            v.movingPlateThickness + 0.2,
          ),
        );
        h.fastener(
          `z-carriage-${side}-${i}-bolt-${j}`,
          5,
          v.movingPlateThickness + 5,
          [x, v.zPlateFront, v.guideLow + 100 + zz],
          [0, 1, 0],
          'z',
        );
      }
    }
  }
}

/** Build the real spindle mount and the two one-piece head blanks after all drive drilling is known. */
export function addZHead(
  p: Parameters,
  v: Layout,
  h: HeadBuilders,
  xPlateHoles: FrameHole[],
  zSaddleHoles: FrameHole[],
) {
  const mountParameters: Parameters = {
      ...spindleMountDefaults,
      threadFitAllowance: 0.05,
      bodyDiameter: v.spindle.bodyDiameter,
    },
    mounting = spindleMountLayout(mountParameters);
  for (const [i, [x, , z]] of mounting.rearMountHoleCenters.entries()) {
    zSaddleHoles.push(
      clearance(
        [x, -v.movingPlateThickness / 2 - 0.1, v.clampLow + 100 + z - v.saddleCenter],
        Number(mountParameters.mountBoltDiameter),
        v.movingPlateThickness + 0.2,
      ),
    );
    h.fastener(
      'spindle-mount-back-bolt-' + i,
      6,
      v.movingPlateThickness + 10,
      [x, v.zPlateBack, v.clampLow + 100 + z],
      [0, -1, 0],
      'z',
    );
  }
  for (const [i, [x, , z]] of mounting.clampBoltCenters.entries())
    h.fastener(
      'spindle-clamp-bolt-' + i,
      6,
      ({ 65: 55, 80: 65, 100: 75 } as Record<number, number>)[v.spindle.bodyDiameter],
      [x, v.spindleY + mounting.capFrontY, v.clampLow + 100 + z],
      [0, 1, 0],
      'z',
    );
  for (const component of ['back', 'cap'])
    h.add(
      'spindle-clamp-' + component,
      mount,
      { ...mountParameters, component },
      'default',
      [0, v.spindleY, v.clampLow + 100],
      [0, 0, 0],
      'z',
    );
  h.add(
    'cutting-spindle',
    spindle,
    { ...spindle.defaults, model: p.spindle },
    'default',
    [0, v.spindleY, v.noseLow + 100],
    [0, 0, 0],
    'z',
    'equipment',
  );
  h.fabricated(
    'x-z-fixed-saddle',
    'z-fixed-box',
    [v.fixedPlateWidth, v.fixedPlateThickness, v.fixedPlateHeight],
    [0, (v.xPlateBack + v.xPlateFront) / 2, v.fixedPlateCenter],
    xPlateHoles.map((hole) => ({
      ...hole,
      at: [hole.at[0], hole.at[1], hole.at[2] + v.railZCenter - v.fixedPlateCenter] as Vec,
    })),
    'x',
    'aluminium',
    {
      ribThickness: v.fixedRibThickness,
      ribDepth: v.fixedRibDepth,
      ribCenterX: v.fixedRibCenterX,
      internalFillet: 5,
    },
  );
  h.fabricated(
    'moving-z-saddle',
    'z-moving-box',
    [v.movingPlateWidth, v.movingPlateThickness, v.movingPlateHeight],
    [0, (v.zPlateBack + v.zPlateFront) / 2, v.saddleCenter],
    zSaddleHoles,
    'z',
    'aluminium',
    {
      ribThickness: v.movingRibThickness,
      ribDepth: v.movingRibDepth,
      ribCenterX: v.movingRibCenterX,
      internalFillet: 5,
      bossWidth: v.zNutCarrierWidth,
      bossDepth: v.zNutCarrierDepth,
      bossThickness: v.zNutCarrierThickness,
      bossCenterX: v.zNutPlatformCenterX,
      bossCenterY: v.zNutPlatformCenterY - (v.zPlateBack + v.zPlateFront) / 2,
      bossCenterZ:
        v.guideLow +
        100 +
        v.zNutPlatformBottomFromGuide +
        v.zNutCarrierThickness / 2 -
        v.saddleCenter,
      centralDrivePocket: JSON.stringify({
        axisY: v.zScrewY - (v.zPlateBack + v.zPlateFront) / 2,
        shaftDiameter: 20.1,
        nutDiameter: 34.05,
        nutBottomZ: v.guideLow + 100 + v.zNutPlatformBottomFromGuide - v.saddleCenter,
        nutHeight: 67,
        flangeDiameter: 57.1,
        flangeBottomZ: v.guideLow + 100 + v.zNutPlatformBottomFromGuide - 12 - v.saddleCenter,
        flangeHeight: 12,
        rearWidth: v.zRearChannelWidth,
        rearDepth: v.zRearChannelDepth,
        rearHeight: v.zRearChannelTop - v.movingPlateBottom,
        rootRadius: 5,
      }),
    },
  );
}

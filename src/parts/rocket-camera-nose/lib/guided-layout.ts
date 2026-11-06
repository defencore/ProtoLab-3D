import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import { Euler, Vector3 } from 'three';
import { box, type Shape, type Vec } from '../../../core/assembly/boundary/shapes';
import { guidedOptics } from './guided-optics';
export { guidedOuterRadius } from './guided-profile';
import { pi5Interface } from '../../raspberry-pi/part';

export const isGuided = (p: Parameters) =>
  p.packaging === 'structural-ogive' && ['camera-19', 'ov9281'].includes(String(p.cameraSetup));
export interface GuidedPose {
  translation: Vec;
  rotation: Vec;
}
export const guidedDatums = {
  pi: { translation: [4.5, -2, 46], rotation: [0, -90, 0] },
  ups: { translation: [2, 0, -44], rotation: [0, -90, 0] },
  adapter: { translation: [-9, 3, -40], rotation: [0, -90, 0] },
  ssd: { translation: [-13, 12.95, -42.5], rotation: [0, -90, 0] },
} satisfies Record<string, GuidedPose>;
export const guidedPowerPassage = { y: 28.5, z: 22, diameter: 4 } as const;
export function worldPoint(v: readonly number[], pose: GuidedPose): Vec {
  return new Vector3(v[0], v[1], v[2])
    .applyEuler(new Euler(...(pose.rotation.map((a) => (a * Math.PI) / 180) as Vec), 'ZYX'))
    .add(new Vector3(...pose.translation))
    .toArray() as Vec;
}
export function at(shape: Shape, pose: GuidedPose): Shape {
  return { kind: 'transform', child: shape, ...pose };
}
export function guidedLayout(p: Parameters) {
  const l = n(p, 'noseLength'),
    s = n(p, 'shoulderLength'),
    optics = guidedOptics(p);
  return {
    ...guidedDatums,
    camera: { translation: optics.translation, rotation: optics.rotation },
    cameraRear: optics.rear,
    cameraFront: l + 2,
    lensSleeveFront: l + 1.5,
    receiverRadius: (n(p, 'tubeID') - n(p, 'shoulderClearance')) / 2,
    boreRadius: (n(p, 'tubeID') - n(p, 'shoulderClearance')) / 2 - 2.4,
    extraction: l + s + 12,
    auxShifts: { 'aux-gps': [2, 0, 0] as Vec, 'aux-buzzer': [-2, -3.2, 0] as Vec },
  };
}
export function piPackageClearances(clearance = 0.3): Shape[] {
  return pi5Interface.packages.map((pkg) => {
    const min = pkg.bounds.min,
      max = pkg.bounds.max;
    return at(
      box(
        [
          max[0] - min[0] + 2 * clearance,
          max[1] - min[1] + 2 * clearance,
          max[2] - min[2] + 2 * clearance,
        ],
        [min[0] - clearance, min[1] - clearance, min[2] - clearance],
      ),
      guidedDatums.pi,
    );
  });
}
export const guidedEthernetReserve = () =>
  box(
    [18, 20, 35],
    [guidedDatums.pi.translation[0] - 17, -29.75, guidedDatums.pi.translation[2] + 45.55],
  );

/** Authored plug clearance from the source GPIO pin tips, not purchased connector geometry. */
export function guidedGpioReserve(): Shape {
  const pins = [4, 6].map((number) => pi5Interface.gpio.pins.find((pin) => pin.number === number)!);
  const x = (pins[0].tip[0] + pins[1].tip[0]) / 2;
  const y = (pins[0].tip[1] + pins[1].tip[1]) / 2;
  return at(box([8, 8, 10], [x - 4, y - 4, pins[0].tip[2]]), guidedDatums.pi);
}

/** Bench access to the pin4/6 plug after closing the rigid cage halves. */
export function guidedGpioServiceOpening(): Shape {
  const points = [4, 6].map((number) =>
    worldPoint(pi5Interface.gpio.pins.find((pin) => pin.number === number)!.tip, guidedDatums.pi),
  );
  const y = (points[0][1] + points[1][1]) / 2,
    z = (points[0][2] + points[1][2]) / 2;
  return box([10, 10, 10], [-30, y - 5, z - 5]);
}

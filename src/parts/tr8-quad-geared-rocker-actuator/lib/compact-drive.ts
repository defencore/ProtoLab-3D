import { Euler, Matrix4, Vector3 } from 'three';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import { subtract, union, type Shape } from '../../../core/assembly/boundary/shapes';
import { gearValues, involuteProfile } from '../../../core/hardware/gears';
import { shaftBoreDefaults, shaftBoreValues } from '../../../core/hardware/shaft-bore';
import { fixed as f } from './layout';
import { move } from './shapes';

const gearParameters = {
  ...shaftBoreDefaults(),
  module: 1,
  teeth: f.gearTeeth,
  pressureAngle: 20,
  backlash: 0.1,
  faceWidth: 5,
  bore: 0,
  hub: false,
};
const profile = involuteProfile(gearValues(gearParameters));
const axial = (radius: number, from: number, to: number): Shape => ({
  kind: 'cylinder',
  radius,
  height: to - from,
  origin: [from, 0, 0],
  axis: 'x',
});
const groove = (center: number): Shape =>
  subtract(axial(3.1, center - 0.32, center + 0.32), axial(1.6, center - 0.42, center + 0.42));

/** Shift only the quad journals and clips; retain the approved public thread and pin bore. */
export function compactScrew(source: Shape): Shape {
  const d = f.bearingFlangeWidth;
  return subtract(
    union(source, axial(3, -3 - d, -2.95), axial(3, 33.95, 34 + d), axial(2.5, 35.95, 36 + d)),
    subtract(axial(3.1, -4.64 - d, -3 - d), axial(2.5, -4.74 - d, -2.9 - d)),
    groove(-3.32 - d),
    groove(34.32 + d),
  );
}

/** Local quad gears keep the approved shaft pin stations and full 5 mm tooth face. */
export function compactGear(pinion: boolean): Shape {
  const bore = pinion ? 3.175 : 6.02;
  const tooth: Shape = {
    kind: 'curve-loft',
    previewSamples: 3,
    previewBoreSegments: 24,
    segments: profile.segments,
    shaftBore: shaftBoreValues({ ...gearParameters, bore, boreShape: 'round' }),
    layers: [
      { scale: 1, angle: 0, z: -2.5 },
      { scale: 1, angle: 0, z: 2.5 },
    ],
  };
  const hubEnd = -11 + f.gearFaceShift;
  const hubCylinder = (radius: number, height: number, x: number): Shape => ({
    kind: 'cylinder',
    radius,
    height,
    origin: [x, 0, 0],
    axis: 'x',
    previewSegments: 24,
  });
  const hub = subtract(
    hubCylinder(6, hubEnd + 15 + 0.05, -15),
    hubCylinder(bore / 2, hubEnd + 15 + 0.25, -15.1),
  );
  return subtract(union(move(tooth, [-8.5 + f.gearFaceShift, 0, 0], [0, 90, 0]), hub), {
    kind: 'cylinder',
    radius: pinion ? 0.5 : 1,
    height: 12.2,
    origin: [-13, 0, -6.1],
    axis: 'z',
    previewSegments: 12,
  });
}

/** Adapt the source drive to plain3mm sheet seats and closer motor spacing. */
export function compactDrive(piece: ConfiguredPiece): ConfiguredPiece {
  const id = piece.component.id;
  const component = {
    ...piece.component,
    parameters: { ...piece.component.parameters },
    placement: {
      translation: [...piece.component.placement.translation] as [number, number, number],
      rotation: [...piece.component.placement.rotation] as [number, number, number],
    },
  };
  const phaseDelta = 180 / f.gearTeeth - 7.5;
  if (id === 'screw') {
    if (typeof component.parameters.recipe !== 'string')
      throw new Error('The source screw requires its public physical recipe.');
    const rotation = component.placement.rotation;
    const pose = new Matrix4().makeRotationFromEuler(
      new Euler(
        ...(rotation.map((angle) => (angle * Math.PI) / 180) as [number, number, number]),
        'ZYX',
      ),
    );
    // The public recipe is reanchored, especially in Full mode. Recover its
    // neutral authored frame before adding coaxial journals, then retain the
    // screw rotation as occurrence placement rather than fabrication geometry.
    const anchor = new Vector3(...component.placement.translation)
      .applyMatrix4(pose.invert())
      .toArray()
      .map((value) => (Math.abs(value) < 1e-12 ? 0 : Number(value.toFixed(12)))) as [
      number,
      number,
      number,
    ];
    const authored = move(JSON.parse(component.parameters.recipe) as Shape, anchor);
    const replacement = detailComponent(
      id,
      component.name,
      move(compactScrew(authored), [0, 0, 0], rotation),
      { edgeTolerance: 1e-6, meshConform: true },
    );
    component.parameters = { ...component.parameters, ...replacement.parameters };
    component.placement = replacement.placement;
    component.manufacturing = {
      ...component.manufacturing!,
      requirements: [
        ...component.manufacturing!.requirements,
        'Quad plain-sheet seats: front journal extends to X=-3.6; front Ø5 clip neck is -5.24…-3.6 with groove center -3.92. Rear journal ends34.6; Ø5 tail ends36.6 with groove center34.92. Retain the public working thread0…31 and pin boreX=-13.',
      ],
    };
  }
  if (id === 'screw-front-bearing' || id === 'gear-clip')
    component.placement.translation[0] -= f.bearingFlangeWidth;
  if (id === 'screw-rear-bearing' || id === 'screw-rear-clip')
    component.placement.translation[0] += f.bearingFlangeWidth;
  if (id === 'driven-gear' || id === 'motor-pinion') {
    const pinion = id === 'motor-pinion';
    const rotation = component.placement.rotation[0] + (pinion ? phaseDelta : 0);
    const label = `${f.gearTeeth}-tooth module 1 ${pinion ? 'pinion' : 'driven gear'} · inward tooth face · pinned hub`;
    const next = detailComponent(
      id,
      label,
      move(compactGear(pinion), [0, pinion ? f.motorSpacing : 0, 0], [rotation, 0, 0]),
      { edgeTolerance: 1e-6, meshConform: true },
    );
    next.manufacturing = {
      ...component.manufacturing!,
      requirements: [
        ...component.manufacturing!.requirements,
        `Keep the 5 mm face width and original transverse pin station X=-13. The tooth face moves ${f.gearFaceShift} mm inward; its extended hub joins the face with 0.05 mm overlap and clears the shifted front clip by0.2mm.`,
      ],
    };
    return { ...piece, component: next, label };
  }
  if (id === 'motor' || id === 'motor-gear-pin' || id.startsWith('motor-bolt-'))
    component.placement.translation[1] += f.motorSpacing - 24;
  if (id === 'motor')
    component.parameters.shaftAngle = Number(component.parameters.shaftAngle) - phaseDelta;
  if (id === 'motor-gear-pin') component.placement.rotation[0] += phaseDelta;
  return { ...piece, component };
}

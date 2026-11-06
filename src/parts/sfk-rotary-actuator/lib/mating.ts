import { Euler, Matrix4, Vector3 } from 'three';
import { parseDetailRecipe } from '../../../core/component-recipes';
import { fastenerValues } from '../../../core/hardware/fasteners';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import type { Shape, Vec } from '../../../core/assembly/boundary/shapes';

export interface ActuatorMatingThread {
  componentId: string;
  origin: Vec;
  axis: Vec;
  radialReference: Vec;
  diameter: number;
  pitch: number;
  length: number;
  left: boolean;
  fixed: boolean;
}
const radians = Math.PI / 180;
const rotationMatrix = (angles: Vec) =>
  new Matrix4().makeRotationFromEuler(
    new Euler(...(angles.map((value) => value * radians) as Vec), 'ZYX'),
  );
const frameMatrix = (translation: Vec, rotation: Vec) =>
  rotationMatrix(rotation).setPosition(...translation);
const cylinderRotation = (axis: 'x' | 'y' | 'z'): Vec =>
  axis === 'x' ? [0, 90, 0] : axis === 'y' ? [-90, 0, 0] : [0, 0, 0];
const outerFrame = (piece: ConfiguredPiece) =>
  frameMatrix(piece.position ?? [0, 0, piece.z ?? 0], [0, 0, piece.angle ?? 0]);
const occurrenceFrame = (piece: ConfiguredPiece) =>
  outerFrame(piece).multiply(
    frameMatrix(piece.component.placement.translation, piece.component.placement.rotation),
  );

function datum(
  piece: ConfiguredPiece,
  frame: Matrix4,
  diameter: number,
  pitch: number,
  length: number,
  left: boolean,
  fixed: boolean,
): ActuatorMatingThread {
  return {
    componentId: piece.component.id,
    origin: new Vector3().applyMatrix4(frame).toArray() as Vec,
    axis: new Vector3(0, 0, 1).transformDirection(frame).toArray() as Vec,
    radialReference: new Vector3(1, 0, 0).transformDirection(frame).toArray() as Vec,
    diameter,
    pitch,
    length,
    left,
    fixed,
  };
}

/** Feature frames follow the recipe and occurrence transforms, never sampled mesh or labels. */
function recipeThreads(piece: ConfiguredPiece, internal: boolean): ActuatorMatingThread[] {
  const result: ActuatorMatingThread[] = [];
  const collect = (shape: Shape, frame: Matrix4): void => {
    if (shape.kind === 'transform') {
      collect(shape.child, frame.clone().multiply(frameMatrix(shape.translation, shape.rotation)));
    } else if (
      shape.kind === 'cylinder' &&
      shape.thread &&
      Boolean(shape.thread.internal) === internal
    ) {
      result.push(
        datum(
          piece,
          frame.clone().multiply(frameMatrix(shape.origin, cylinderRotation(shape.axis))),
          2 * shape.radius,
          shape.thread.pitch,
          shape.height,
          Boolean(shape.thread.left),
          internal,
        ),
      );
    } else if ('children' in shape) {
      shape.children.forEach((child) => collect(child, frame));
    } else if (shape.kind === 'boundary') {
      shape.nativeCuts?.forEach((child) => collect(child, frame));
    }
  };
  collect(parseDetailRecipe(String(piece.component.parameters.recipe)), occurrenceFrame(piece));
  return result;
}

export function actuatorMatingThreads(pieces: readonly ConfiguredPiece[]): ActuatorMatingThread[] {
  return pieces.flatMap((piece) => {
    const p = piece.component.parameters;
    if (piece.component.libraryId === 'manufactured-detail') return recipeThreads(piece, true);
    if (piece.component.libraryId !== 'hex-nut') return [];
    return [
      datum(
        piece,
        occurrenceFrame(piece),
        Number(p.bore),
        Number(p.pitch),
        Number(p.height),
        p.handedness === 'left',
        false,
      ),
    ];
  });
}

/** A stepped follower has independent base and terminal threads on one shared physical axis. */
export function actuatorExternalThreads(
  pieces: readonly ConfiguredPiece[],
): ActuatorMatingThread[] {
  return pieces.flatMap((piece) => {
    if (piece.component.libraryId === 'manufactured-detail') return recipeThreads(piece, false);
    if (piece.component.libraryId !== 'bolt-screw') return [];
    const p = piece.component.parameters;
    const band = fastenerValues(p);
    if (!band.threaded) return [];
    return [
      datum(
        piece,
        occurrenceFrame(piece).multiply(
          new Matrix4().makeTranslation(0, 0, band.start - band.total / 2),
        ),
        Number(p.diameter),
        Number(p.pitch),
        band.threadLength,
        p.handedness === 'left',
        false,
      ),
    ];
  });
}

function matches(male: ActuatorMatingThread, females: readonly ActuatorMatingThread[]) {
  const axis = new Vector3(...male.axis);
  const origin = new Vector3(...male.origin);
  const radial = new Vector3(...male.radialReference);
  return females
    .flatMap((female) => {
      if (
        female.componentId === male.componentId ||
        Math.abs(female.diameter - male.diameter) > 1e-8 ||
        Math.abs(female.pitch - male.pitch) > 1e-8 ||
        female.left !== male.left
      )
        return [];
      const femaleAxis = new Vector3(...female.axis);
      const direction = axis.dot(femaleAxis);
      if (Math.abs(Math.abs(direction) - 1) > 1e-8) return [];
      const delta = origin.clone().sub(new Vector3(...female.origin));
      const offset = delta.dot(femaleAxis);
      if (delta.addScaledVector(femaleAxis, -offset).length() > 1e-5) return [];
      const end = offset + direction * male.length;
      const overlap =
        Math.min(Math.max(offset, end), female.length) - Math.max(Math.min(offset, end), 0);
      if (overlap <= 1e-5) return [];
      const reference = new Vector3(...female.radialReference);
      const beta = Math.atan2(
        femaleAxis.dot(reference.clone().cross(radial)),
        reference.dot(radial),
      );
      return [{ male, female, direction, offset, overlap, beta }];
    })
    .sort((a, b) => b.overlap - a.overlap);
}

/** Rotate about the physical thread line even when a recipe anchor is not on that line. */
function roll<T extends ConfiguredPiece>(piece: T, thread: ActuatorMatingThread, angle: number): T {
  if (Math.abs(Math.sin(angle)) < 1e-10 && Math.cos(angle) > 0) return piece;
  const origin = new Vector3(...thread.origin);
  const worldRoll = new Matrix4()
    .makeTranslation(...thread.origin)
    .multiply(new Matrix4().makeRotationAxis(new Vector3(...thread.axis), angle))
    .multiply(new Matrix4().makeTranslation(...(origin.multiplyScalar(-1).toArray() as Vec)));
  const frame = outerFrame(piece).invert().multiply(worldRoll).multiply(occurrenceFrame(piece));
  const euler = new Euler().setFromRotationMatrix(frame, 'ZYX');
  const translation = new Vector3().setFromMatrixPosition(frame).toArray() as Vec;
  const placement = piece.component.placement;
  return {
    ...piece,
    component: {
      ...piece.component,
      placement: {
        translation: translation.every(
          (value, index) => Math.abs(value - placement.translation[index]) < 1e-8,
        )
          ? placement.translation
          : translation,
        rotation: [euler.x / radians, euler.y / radians, euler.z / radians] as Vec,
      },
    },
  };
}

/** Tapped stock sets each male phase, then free nuts turn about their unchanged axial datums. */
export function alignActuatorThreads<T extends ConfiguredPiece>(pieces: T[]): T[] {
  const fixed = actuatorMatingThreads(pieces).filter((female) => female.fixed);
  const aligned = pieces.map((piece) => {
    const candidates = actuatorExternalThreads([piece])
      .flatMap((male) => matches(male, fixed))
      .sort((a, b) => b.overlap - a.overlap);
    if (!candidates.length) return piece;
    const { male, female, direction, offset, beta } = candidates[0];
    return roll(
      piece,
      male,
      direction * (((female.left ? -1 : 1) * 2 * Math.PI * offset) / female.pitch - beta),
    );
  });
  const males = actuatorExternalThreads(aligned);
  return aligned.map((piece) => {
    if (piece.component.libraryId !== 'hex-nut') return piece;
    const female = actuatorMatingThreads([piece])[0];
    const candidates = males.flatMap((male) => matches(male, [female]));
    if (candidates.length > 1)
      throw new Error('An actuator nut cannot mate with more than one installed male thread.');
    if (!candidates.length) return piece;
    const { offset, beta } = candidates[0];
    return roll(
      piece,
      female,
      beta - ((female.left ? -1 : 1) * 2 * Math.PI * offset) / female.pitch,
    );
  });
}

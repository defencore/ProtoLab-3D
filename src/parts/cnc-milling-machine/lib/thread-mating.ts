import { Euler, Matrix4, Vector3 } from 'three';
import type { Vec } from '../../../core/assembly/boundary/shapes';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { frameHoles } from '../../cnc-frame-part/part';
import { carriageMountingHoles } from '../../cnc-guide-carriage/part';
import { spindleMountLayout } from '../../cnc-spindle-mount/part';
import { worktableLayout } from '../../cnc-worktable/part';
import { controlMounting } from '../../machine-control/part';
import { fastenerValues } from '../../../core/hardware/fasteners';
import { threadedRodFastenerParameters } from '../../threaded-rod/part';

export interface MatingThread {
  componentId: string;
  origin: Vec;
  axis: Vec;
  radialReference: Vec;
  diameter: number;
  pitch: number;
  length: number;
  left: boolean;
}
const degrees = Math.PI / 180;
const rotationMatrix = (rotation: Vec) =>
  new Matrix4().makeRotationFromEuler(
    new Euler(...(rotation.map((n) => n * degrees) as Vec), 'ZYX'),
  );
const axisRotation = (axis: 'x' | 'y' | 'z'): Vec =>
  axis === 'x' ? [0, 90, 0] : axis === 'y' ? [-90, 0, 0] : [0, 0, 0];
const coarse: Record<number, number> = { 3: 0.5, 4: 0.7, 5: 0.8, 6: 1, 8: 1.25, 10: 1.5 };
/** Machining features come from the authored part interfaces, never mesh or label inference. */
export function matingThreads(pieces: readonly ConfiguredPiece[]): MatingThread[] {
  const threads: MatingThread[] = [];
  for (const piece of pieces) {
    const component = piece.component,
      p = component.parameters,
      placement = component.placement!,
      outer = rotationMatrix(placement.rotation as Vec),
      translation = new Vector3(...placement.translation);
    const add = (
      origin: Vec,
      axis: 'x' | 'y' | 'z',
      diameter: number,
      pitch: number,
      length: number,
      left = false,
    ) => {
      const rotation = outer.clone().multiply(rotationMatrix(axisRotation(axis)));
      threads.push({
        componentId: component.id,
        origin: new Vector3(...origin).applyMatrix4(outer).add(translation).toArray() as Vec,
        axis: new Vector3(0, 0, 1).transformDirection(rotation).toArray() as Vec,
        radialReference: new Vector3(1, 0, 0).transformDirection(rotation).toArray() as Vec,
        diameter,
        pitch,
        length,
        left,
      });
    };
    if (component.libraryId === 'cnc-frame-part') {
      for (const hole of frameHoles(p))
        if (hole.threadPitch) add(hole.at, hole.axis, hole.diameter, hole.threadPitch, hole.depth);
    } else if (component.libraryId === 'cnc-guide-carriage') {
      for (const at of carriageMountingHoles()) add([at[0], at[1], at[2] - 6], 'z', 5, 0.8, 6);
    } else if (component.libraryId === 'cnc-spindle-mount' && p.component === 'back') {
      const layout = spindleMountLayout(p);
      for (const at of layout.clampBoltCenters)
        add(
          [at[0], layout.backSplitY - layout.clampThreadDepth, at[2]],
          'y',
          layout.clampBoltDiameter,
          coarse[layout.clampBoltDiameter],
          layout.clampThreadDepth,
        );
      for (const at of layout.rearMountHoleCenters)
        add(
          at,
          'y',
          layout.mountBoltDiameter,
          coarse[layout.mountBoltDiameter],
          layout.mountThreadDepth,
        );
    } else if (component.libraryId === 'cnc-worktable') {
      for (const hole of worktableLayout(p).holes)
        if (hole.threaded) add(hole.center, 'z', hole.diameter, coarse[hole.diameter], hole.depth);
    } else if (component.libraryId === 'machine-control') {
      const mounting = controlMounting(p);
      if (mounting.kind === 'rear-taps')
        for (const at of mounting.holes)
          add(at, 'y', mounting.diameter, mounting.pitch, mounting.depth);
    } else if (component.libraryId === 'hex-nut') {
      add(
        [0, 0, 0],
        'z',
        Number(p.bore),
        Number(p.pitch),
        Number(p.height),
        p.handedness === 'left',
      );
    }
  }
  return threads;
}
/** Actual male-thread datum, shared by headed screws and cut-to-length library studs. */
function externalThread(piece: ConfiguredPiece): MatingThread | undefined {
  const component = piece.component;
  if (!['bolt-screw', 'threaded-rod'].includes(component.libraryId)) return undefined;
  const rod = component.libraryId === 'threaded-rod',
    p = rod ? threadedRodFastenerParameters(component.parameters) : component.parameters,
    band = fastenerValues(p, rod);
  if (!band.threaded) return undefined;
  const placement = component.placement!,
    rotation = rotationMatrix(placement.rotation as Vec);
  return {
    componentId: component.id,
    origin: new Vector3(0, 0, band.start - band.total / 2)
      .applyMatrix4(rotation)
      .add(new Vector3(...placement.translation))
      .toArray() as Vec,
    axis: new Vector3(0, 0, 1).transformDirection(rotation).toArray() as Vec,
    radialReference: new Vector3(1, 0, 0).transformDirection(rotation).toArray() as Vec,
    diameter: Number(p.diameter),
    pitch: Number(p.pitch),
    length: band.threadLength,
    left: p.handedness === 'left',
  };
}
function matches(male: MatingThread, females: readonly MatingThread[]) {
  const axis = new Vector3(...male.axis),
    origin = new Vector3(...male.origin),
    radial = new Vector3(...male.radialReference);
  return females
    .flatMap((thread) => {
      if (
        thread.componentId === male.componentId ||
        Math.abs(thread.diameter - male.diameter) > 1e-8 ||
        Math.abs(thread.pitch - male.pitch) > 1e-8 ||
        thread.left !== male.left
      )
        return [];
      const g = new Vector3(...thread.axis),
        s = axis.dot(g);
      if (Math.abs(Math.abs(s) - 1) > 1e-8) return [];
      const delta = origin.clone().sub(new Vector3(...thread.origin)),
        offset = delta.dot(g);
      if (delta.addScaledVector(g, -offset).length() > 1e-5) return [];
      const end = offset + s * male.length,
        overlap =
          Math.min(Math.max(offset, end), thread.length) - Math.max(Math.min(offset, end), 0);
      if (overlap <= 1e-5) return [];
      const reference = new Vector3(...thread.radialReference),
        beta = Math.atan2(g.dot(reference.clone().cross(radial)), reference.dot(radial));
      return [{ thread, s, offset, overlap, beta }];
    })
    .sort((a, b) => b.overlap - a.overlap);
}
function rolled<T extends ConfiguredPiece>(piece: T, roll: number): T {
  if (Math.abs(Math.sin(roll)) < 1e-10 && Math.cos(roll) > 0) return piece;
  const placement = piece.component.placement!,
    final = rotationMatrix(placement.rotation as Vec).multiply(new Matrix4().makeRotationZ(roll)),
    euler = new Euler().setFromRotationMatrix(final, 'ZYX');
  return {
    ...piece,
    component: {
      ...piece.component,
      placement: {
        ...placement,
        rotation: [euler.x / degrees, euler.y / degrees, euler.z / degrees] as Vec,
      },
    },
  };
}
/** Fixed tapped stock sets the male phase; a free nut then turns to match that installed thread. */
export function alignMatingFasteners<T extends ConfiguredPiece>(pieces: T[]): T[] {
  const threads = matingThreads(pieces);
  const aligned = pieces.map((piece) => {
    const male = externalThread(piece);
    if (!male) return piece;
    const candidate = matches(male, threads)[0];
    if (!candidate) return piece;
    const { thread, s, offset, beta } = candidate;
    return rolled(
      piece,
      s * (((thread.left ? -1 : 1) * 2 * Math.PI * offset) / thread.pitch - beta),
    );
  });
  const males = aligned
    .map(externalThread)
    .filter((thread): thread is MatingThread => Boolean(thread));
  return aligned.map((piece) => {
    if (piece.component.libraryId !== 'hex-nut') return piece;
    const female = matingThreads([piece])[0];
    if (!female) return piece;
    const candidates = males.flatMap((male) =>
      matches(male, [female]).map((match) => ({ male, ...match })),
    );
    if (candidates.length > 1)
      throw new Error('A nut cannot be phased against more than one installed male thread.');
    if (!candidates.length) return piece;
    const { offset, beta } = candidates[0];
    return rolled(piece, beta - ((female.left ? -1 : 1) * 2 * Math.PI * offset) / female.pitch);
  });
}

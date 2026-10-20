import { Euler, Matrix4, Vector3 } from 'three';
import type { Vec } from '../../../core/assembly/boundary/shapes';
import { frameManufacturing, type FrameHole } from '../../cnc-frame-part/part';
import type { MillingPiece } from './composition';

/** Add a local tap from the installed bolt seat and actual intervening grip stack. */
export function addFrameTap(
  out: MillingPiece[], id: string, seat: Vec, normal: Vec, grip: number,
  diameter: number, pitch: number, depth: number,
) {
  if (![grip, diameter, pitch, depth].every(Number.isFinite) || grip < 0 || Math.min(diameter, pitch, depth) <= 0)
    throw new Error('Frame taps require a nonnegative grip and positive finite dimensions.');
  const host = out.find((item) => item.component.id === id);
  if (!host || host.component.libraryId !== 'cnc-frame-part')
    throw new Error('Fabricated mounting host is absent: ' + id);
  const { placement, parameters } = host.component;
  const rotation = new Euler(...(placement.rotation.map((value) => value * Math.PI / 180) as Vec), 'ZYX');
  const inverse = new Matrix4().makeRotationFromEuler(rotation).invert();
  const worldAxis = new Vector3(...normal).negate();
  const origin = new Vector3(...seat).addScaledVector(worldAxis, grip)
    .sub(new Vector3(...placement.translation)).applyMatrix4(inverse);
  const localAxis = worldAxis.clone().transformDirection(inverse);
  const dominant = ['x', 'y', 'z'].findIndex((_, index) => Math.abs(localAxis.getComponent(index)) > 0.999999);
  if (dominant < 0) throw new Error('Mount drilling axis must match a principal detail axis.');
  if (localAxis.getComponent(dominant) < 0) origin.addScaledVector(localAxis, depth);
  const holes: FrameHole[] = JSON.parse(String(parameters.holes));
  holes.push({ axis: ['x', 'y', 'z'][dominant] as FrameHole['axis'], at: origin.toArray() as Vec,
    diameter, depth, threadPitch: pitch, threadDesignation: `M${diameter}` });
  host.component.parameters = { ...parameters, holes: JSON.stringify(holes) };
  host.component.manufacturing = frameManufacturing(host.component.parameters);
}

import { Euler, Matrix4, Vector3 } from 'three';
import type { Parameters } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import type { CncLayout, Vec } from './layout';

export interface CncChannel {
  id: 'a' | 'b' | 'c' | 'd';
  unit: number;
  clock: number;
  origin: Vec;
  angle: number;
  neutralNutX: number;
}
export function cncChannels(p: Parameters, state: string, layout: CncLayout): CncChannel[] {
  return (['a', 'b', 'c', 'd'] as const).map((id, unit) => {
    const clock = layout.clock + unit * 90, theta = clock * Math.PI / 180;
    const angle = state === 'negative-limit' ? -20 : state === 'positive-limit' ? 20 : Number(p['angle' + id.toUpperCase()]);
    return { id, unit, clock, angle, neutralNutX: layout.outputStations[unit],
      origin: [0, layout.outputRadial * Math.cos(theta), layout.outputRadial * Math.sin(theta)] };
  });
}
export function placeCncPiece(piece: ConfiguredPiece, channel: CncChannel): ConfiguredPiece {
  if ((piece.position ?? [0, 0, 0]).some(v => Math.abs(v) > 1e-10) || Math.abs(piece.z ?? 0) > 1e-10 || Math.abs(piece.angle ?? 0) > 1e-10)
    throw new Error('CNC channel pieces must carry their complete occurrence placement.');
  const c = piece.component;
  const world = new Matrix4().makeRotationX(channel.clock * Math.PI / 180).setPosition(...channel.origin)
    .multiply(new Matrix4().makeRotationFromEuler(new Euler(...c.placement.rotation.map(v => v * Math.PI / 180) as Vec, 'ZYX')).setPosition(...c.placement.translation));
  const rotation = new Euler().setFromRotationMatrix(world, 'ZYX');
  const label = channel.id.toUpperCase() + ' · ' + piece.label;
  return { ...piece, label, component: { ...c, id: channel.id + '-' + c.id, name: label,
    placement: { translation: new Vector3().setFromMatrixPosition(world).toArray() as Vec,
      rotation: [rotation.x, rotation.y, rotation.z].map(v => v * 180 / Math.PI) as Vec } } };
}

import { tubeSection } from './profiles';
import type { Parameters } from '../../../core/types';
import { box, cylinder, subtract, type Shape, type Vec } from './shapes';
import type { MachinePiece } from './model';
export const paint = 0x285879,
  metal = 0xb9c4ce,
  dark = 0x303a42,
  pom = 0xe0c588;
export const pose = (child: Shape, translation: Vec, rotation: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation,
});
export const around = (child: Shape, pivot: Vec, rotation: Vec): Shape =>
  pose(pose(child, pivot.map((v) => -v) as Vec), pivot, rotation);
export function profile(p: Parameters) {
  const width = Number(p.tubeDiameter),
    height = p.profile === 'round' || p.profile === 'square' ? width : Number(p.profileHeight);
  return {
    width,
    height,
    center: 900 + height / 2,
    top: 900 + height,
    round: p.profile === 'round',
  };
}
export function profileSolid(p: Parameters, length: number, x: number): Shape {
  const s = profile(p),
    wall = Number(p.wall);
  return tubeSection(String(p.profile), s.width, s.height, wall, length, x, 900);
}
export function collection(group: string) {
  const pieces: MachinePiece[] = [];
  const add = (
    label: string,
    shape: Shape,
    color = metal,
    procurement: MachinePiece['procurement'] = 'MAKE',
    process = 'Machined or fabricated component; tolerances and final fastener stack require release review',
  ) => pieces.push({ label, shape, color, group, procurement, process });
  const screw = (x: number, y: number, z: number, d = 6, length = 20) => {
    add(
      `BUY ISO4762 M${d}x${length} 8.8 · nominal thread`,
      subtract(cylinder(d * 0.75, d, [x, y, z]), cylinder(d * 0.3, d * 0.65, [x, y, z + d * 0.4])),
      dark,
      'BUY',
    );
    add(
      `M${d} screw shank`,
      cylinder(d / 2, length, [x, y, z - length], 'z', {
        pitch: d === 6 ? 1 : d === 8 ? 1.25 : 1.5,
      }),
      dark,
      'BUY',
    );
  };
  return { pieces, add, screw };
}
// Long receiver: two ACE50X200SG cylinders drive a common 120 mm crank geometry.
export function trayLink(angle: number, x = 1530) {
  const t = (angle * Math.PI) / 180,
    pivot: Vec = [x, 245, 880],
    base: Vec = [x, 350, 510],
    tip: Vec = [x, 245 + 120 * Math.cos(t), 880 + 120 * Math.sin(t)];
  const dy = tip[1] - base[1],
    dz = tip[2] - base[2],
    length = Math.hypot(dy, dz);
  return {
    pivot,
    base,
    tip,
    length,
    extension: length - 293.5,
    rotation: (Math.atan2(-dy, dz) * 180) / Math.PI,
    momentArm: Math.abs((tip[1] - 245) * dz - (tip[2] - 880) * dy) / length,
  };
}

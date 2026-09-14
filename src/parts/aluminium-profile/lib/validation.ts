import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import { Vector2 } from 'three';
import { hasSideC, hasSideT, hasTopSlot, hasTwoTop } from '../configurator';
import { profileSection, sectionShape } from './geometry';

const cross = (a: Vector2, b: Vector2, c: Vector2) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function intersects(a: Vector2, b: Vector2, c: Vector2, d: Vector2): boolean {
  if (
    Math.max(a.x, b.x) < Math.min(c.x, d.x) - 1e-8 ||
    Math.max(c.x, d.x) < Math.min(a.x, b.x) - 1e-8 ||
    Math.max(a.y, b.y) < Math.min(c.y, d.y) - 1e-8 ||
    Math.max(c.y, d.y) < Math.min(a.y, b.y) - 1e-8
  )
    return false;
  return cross(a, b, c) * cross(a, b, d) <= 1e-12 && cross(c, d, a) * cross(c, d, b) <= 1e-12;
}
function inside(point: Vector2, ring: Vector2[]): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      result = !result;
  }
  return result;
}
export function validateProfile(p: Parameters): string[] {
  const errors: string[] = [];
  const w = n(p, 'width'),
    h = n(p, 'height'),
    r = n(p, 'cornerRadius');
  if (r >= Math.min(w, h) / 2) errors.push('Outside corner radius must fit inside the section.');
  const checkT = (opening: number, cavity: number, depth: number, floor: number, lip: number) => {
    if (cavity <= opening + 0.1 || cavity <= floor || depth - (cavity - floor) / 2 <= lip + 0.05)
      errors.push('T-slot undercuts need a wider cavity and space for their sloping floor.');
  };
  if (hasTopSlot(p)) {
    checkT(
      n(p, 'slotOpening'),
      n(p, 'slotCavityWidth'),
      n(p, 'slotDepth'),
      n(p, 'slotFloorWidth'),
      n(p, 'lipThickness'),
    );
    if (n(p, 'slotDepth') >= h - 0.1) errors.push('The top slot must leave a base wall.');
    if (
      n(p, 'slotStepDepth') >= n(p, 'lipThickness') ||
      (n(p, 'slotStepDepth') > 0 && n(p, 'slotOuterOpening') < n(p, 'slotOpening'))
    )
      errors.push('The surface step must be wider than the throat and shallower than the lip.');
    const reach = hasTwoTop(p) ? n(p, 'slotPitch') / 2 : 0;
    if (reach + n(p, 'slotCavityWidth') / 2 >= w / 2 - 0.1)
      errors.push('Top slot cavities must fit inside the profile width.');
    if (hasTwoTop(p) && n(p, 'slotPitch') <= n(p, 'slotCavityWidth') + 0.1)
      errors.push('Adjacent top slots need a separating web.');
  }
  if (hasSideC(p)) {
    if (
      n(p, 'sideOpening') >= n(p, 'sideCavityHeight') - 0.1 ||
      n(p, 'sideCavityHeight') >= h - 0.1 ||
      n(p, 'sideLipWidth') >= n(p, 'sideCavityDepth') - 0.1
    )
      errors.push('Side slots must retain their lips and top/bottom walls.');
    if (n(p, 'sideCavityDepth') * 2 >= w - 0.1) errors.push('Side slots must leave a central web.');
  }
  if (hasSideT(p))
    checkT(
      n(p, 'sideOpening'),
      p.profile === 'eu1540' ? n(p, 'sideCavityHeight') : n(p, 'slotCavityWidth'),
      p.profile === 'eu1540' ? n(p, 'sideCavityDepth') : n(p, 'slotDepth'),
      p.profile === 'eu1540' ? 4.8 : n(p, 'slotFloorWidth'),
      n(p, 'sideLipWidth'),
    );
  if (errors.length) return [...new Set(errors)];
  const shape = sectionShape(profileSection(p));
  const clean = (points: Vector2[]) =>
    points.filter(
      (point, index) =>
        point.distanceTo(points[(index + points.length - 1) % points.length]) > 1e-7,
    );
  const outer = clean(shape.getPoints(12));
  const holes = shape.holes.map((hole) => clean(hole.getPoints(12)));
  const rings = [outer, ...holes];
  for (let a = 0; a < rings.length; a++)
    for (let b = a; b < rings.length; b++) {
      const first = rings[a],
        second = rings[b];
      for (let i = 0; i < first.length; i++)
        for (let j = a === b ? i + 1 : 0; j < second.length; j++) {
          if (a === b && (j === i + 1 || (i === 0 && j === first.length - 1))) continue;
          if (
            intersects(
              first[i],
              first[(i + 1) % first.length],
              second[j],
              second[(j + 1) % second.length],
            )
          )
            return ['Section slots or internal holes intersect; increase the separating walls.'];
        }
    }
  for (let i = 0; i < holes.length; i++) {
    if (!holes[i].every((point) => inside(point, outer)))
      return ['A longitudinal bore or cavity leaves the profile material.'];
    for (let j = 0; j < holes.length; j++)
      if (i !== j && inside(holes[i][0], holes[j]))
        return ['Internal cavities must not overlap or contain one another.'];
  }
  return [];
}

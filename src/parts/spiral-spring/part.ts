import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import * as THREE from 'three';
import type { PartDefinition, Parameters } from '../../core/types';
import { extrude, n, num, numberParameter } from '../../core/geometry';
import { handedness, tau } from './lib/core/spring-geometry';

function values(p: Parameters) {
  const thickness = n(p, 'stripThickness'),
    width = n(p, 'stripWidth'),
    turns = n(p, 'turns');
  const start = n(p, 'innerDiameter') / 2 + thickness / 2,
    spacing = thickness + n(p, 'radialGap');
  const hand = p.handedness === 'left' ? -1 : 1,
    endAngle = (n(p, 'endAngle') * Math.PI) / 180;
  const totalAngle = tau * turns + endAngle,
    slope = spacing / tau;
  const count = Math.ceil((totalAngle / tau) * 96);
  const side = (offset: number) =>
    Array.from({ length: count + 1 }, (_, i) => {
      const angle = (totalAngle * i) / count,
        r = start + slope * angle;
      const x = r * Math.cos(angle),
        y = hand * r * Math.sin(angle);
      const dx = slope * Math.cos(angle) - r * Math.sin(angle),
        dy = hand * (slope * Math.sin(angle) + r * Math.cos(angle));
      const norm = Math.hypot(dx, dy);
      return [x - (offset * dy) / norm, y + (offset * dx) / norm];
    });
  const points = [...side(thickness / 2), ...side(-thickness / 2).reverse()];
  return { points, width, thickness, spacing, start };
}
const defaults = {
  innerDiameter: 10,
  stripThickness: 0.6,
  stripWidth: 6,
  turns: 4,
  radialGap: 1.8,
  endAngle: 90,
  handedness: 'right',
};
const part: PartDefinition = {
  id: 'spiral-spring',
  name: 'Flat spiral spring',
  category: 'SPRINGS',
  subgroup: 'SPIRAL SPRINGS',
  icon: 'spring',
  complexity: 'Flat strip',
  description:
    'A planar Archimedean spiral formed from a flat strip with controlled radial clearance.',
  keywords: ['spring', 'spiral', 'clock', 'flat', 'strip', 'power spring', 'ribbon'],
  parameters: [
    numberParameter('innerDiameter', 'Inner clear diameter', 'd', 'Coil', 2, 100),
    numberParameter('stripThickness', 'Radial strip thickness', 't', 'Coil', 0.2, 8),
    numberParameter('stripWidth', 'Axial strip width', 'B', 'Coil', 1, 50),
    { ...numberParameter('turns', 'Whole turns', 'n', 'Coil', 1, 20, 1), unit: '' },
    { ...numberParameter('endAngle', 'Additional end angle', 'α', 'Coil', 0, 355, 5), unit: '°' },
    numberParameter('radialGap', 'Gap between turns', 'g', 'Coil', 0.2, 12),
    handedness,
  ],
  presetMatchKeys: ['innerDiameter', 'stripThickness'],
  defaults,
  presets: modulePresets,
  validate(p) {
    const errors: string[] = [];
    if (n(p, 'innerDiameter') < 4 * n(p, 'stripThickness'))
      errors.push('Inner diameter must be at least four strip thicknesses.');
    if (!Number.isInteger(n(p, 'turns')))
      errors.push('Whole turns must be an integer; use the additional end angle for orientation.');
    return errors;
  },
  buildGeometry(p) {
    const { points, width } = values(p);
    return new THREE.Group().add(
      extrude(new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y))), width),
    );
  },
  python(p) {
    const { points, width } = values(p);
    return `outline = [App.Vector(x, y, ${num(-width / 2)}) for x, y in [\n${points.map((point) => `    (${point.map(num).join(', ')})`).join(',\n')}\n]]\noutline.append(outline[0])\nshape = Part.Face(Part.makePolygon(outline)).extrude(App.Vector(0, 0, ${num(width)}))`;
  },
  dimensions(p) {
    const { points, width } = values(p);
    const xs = points.map((point) => point[0]),
      ys = points.map((point) => point[1]);
    return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), width];
  },
  notes:
    'An open flat strip with square-cut ends. The spiral outline is sampled at 96 segments per turn in both preview and FreeCAD. Mounting slots, preload, force, torque and wound-state deformation are not modelled.',
};
export default { ...part, presets: modulePresets };

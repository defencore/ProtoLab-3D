import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import * as THREE from 'three';
import type { PartDefinition, Parameters } from '../../core/types';
import { material, n, num, numberParameter } from '../../core/geometry';
const values = (p: Parameters) => ({
  w: n(p, 'width'),
  d: n(p, 'depth'),
  h: n(p, 'height'),
  t: n(p, 'thickness'),
  bore: n(p, 'holeDiameter'),
});
function panel(width: number, depth: number, thickness: number, holeRadius: number, holeY: number) {
  const outline = new THREE.Shape();
  outline.moveTo(-width / 2, 0);
  outline.lineTo(width / 2, 0);
  outline.lineTo(width / 2, depth);
  outline.lineTo(-width / 2, depth);
  outline.closePath();
  for (const x of [-width / 4, width / 4]) {
    const hole = new THREE.Path();
    hole.absarc(x, holeY, holeRadius, 0, Math.PI * 2, true);
    outline.holes.push(hole);
  }
  return new THREE.Mesh(
    new THREE.ExtrudeGeometry(outline, {
      depth: thickness,
      bevelEnabled: false,
      curveSegments: 48,
    }),
    material(),
  );
}
const part: PartDefinition = {
  id: 'l-bracket',
  name: 'L bracket',
  category: 'STRUCTURAL',
  subgroup: 'BRACKETS & MOUNTS',
  icon: 'bracket',
  complexity: '5 parameters',
  description: 'A right-angle mounting bracket with two holes in each face.',
  keywords: ['bracket', 'angle', 'mount', 'support', 'hinge', 'structural'],
  parameters: [
    numberParameter('width', 'Width', 'W', 'Envelope', 10, 200),
    numberParameter('depth', 'Base depth', 'D', 'Envelope', 10, 200),
    numberParameter('height', 'Upright height', 'H', 'Envelope', 10, 200),
    numberParameter('thickness', 'Plate thickness', 't', 'Construction', 1, 15),
    numberParameter('holeDiameter', 'Mounting hole diameter', 'd', 'Construction', 1, 30),
  ],
  defaults: { width: 40, depth: 30, height: 35, thickness: 3, holeDiameter: 5.2 },
  presets: modulePresets,
  validate(p) {
    const { w, d, h, t, bore } = values(p);
    const errors: string[] = [];
    if (t >= Math.min(d, h))
      errors.push('Plate thickness must be less than the base depth and upright height.');
    if (bore >= w / 2) errors.push('Hole diameter must be less than half the bracket width.');
    if (bore / 2 >= Math.min(d / 3, (2 * d) / 3 - t, (h - t) / 2))
      errors.push('Mounting holes must fit inside each face with material around them.');
    return errors;
  },
  buildGeometry(p) {
    const { w, d, h, t, bore } = values(p);
    const g = new THREE.Group();
    const base = panel(w, d, t, bore / 2, (d * 2) / 3);
    base.position.set(0, -d / 2, -h / 2);
    g.add(base);
    const upright = panel(w, h - t, t, bore / 2, (h - t) / 2);
    upright.rotation.x = Math.PI / 2;
    upright.position.set(0, -d / 2 + t, -h / 2 + t);
    g.add(upright);
    return g;
  },
  python(p) {
    const { w, d, h, t, bore } = values(p);
    return `base = Part.makeBox(${num(w)}, ${num(d)}, ${num(t)}, App.Vector(${num(-w / 2)}, ${num(-d / 2)}, ${num(-h / 2)}))\nupright = Part.makeBox(${num(w)}, ${num(t)}, ${num(h)}, App.Vector(${num(-w / 2)}, ${num(-d / 2)}, ${num(-h / 2)}))\nshape = base.fuse(upright).removeSplitter()\nfor x in [${num(-w / 4)}, ${num(w / 4)}]:\n    base_hole = Part.makeCylinder(${num(bore / 2)}, ${num(t + 2)}, App.Vector(x, ${num(d / 6)}, ${num(-h / 2 - 1)}))\n    upright_hole = Part.makeCylinder(${num(bore / 2)}, ${num(t + 2)}, App.Vector(x, ${num(-d / 2 - 1)}, ${num(t / 2)}), App.Vector(0, 1, 0))\n    shape = shape.cut(base_hole).cut(upright_hole)`;
  },
  dimensions(p) {
    const { w, d, h } = values(p);
    return [w, d, h];
  },
  notes:
    'Square internal corner without a bend radius or gussets. Hole centers follow the bracket envelope. Add fillets and verify load capacity for the intended material.',
};
export default { ...part, presets: modulePresets };

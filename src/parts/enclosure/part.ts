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
  t: n(p, 'wall'),
});
const part: PartDefinition = {
  id: 'enclosure',
  name: 'Open enclosure',
  category: 'ENCLOSURES',
  subgroup: 'BOXES & CASES',
  icon: 'box',
  complexity: '4 parameters',
  description: 'An open-top rectangular project box with uniform walls and floor.',
  keywords: ['box', 'case', 'housing', 'container', 'electronics', 'enclosure'],
  parameters: [
    numberParameter('width', 'Outside width', 'W', 'Envelope', 10, 400),
    numberParameter('depth', 'Outside depth', 'D', 'Envelope', 10, 400),
    numberParameter('height', 'Outside height', 'H', 'Envelope', 5, 250),
    numberParameter('wall', 'Wall and floor', 't', 'Construction', 0.6, 20),
  ],
  defaults: { width: 80, depth: 55, height: 30, wall: 2.4 },
  presets: modulePresets,
  validate(p) {
    const { w, d, h, t } = values(p);
    const errors: string[] = [];
    if (2 * t >= Math.min(w, d))
      errors.push('Twice the wall thickness must be less than the width and depth.');
    if (t >= h) errors.push('Floor thickness must be less than the enclosure height.');
    return errors;
  },
  buildGeometry(p) {
    const { w, d, h, t } = values(p);
    const g = new THREE.Group();
    const corners = (width: number, depth: number, z: number) => [
      [-width / 2, -depth / 2, z],
      [width / 2, -depth / 2, z],
      [width / 2, depth / 2, z],
      [-width / 2, depth / 2, z],
    ];
    const points = [
      ...corners(w, d, -h / 2),
      ...corners(w, d, h / 2),
      ...corners(w - 2 * t, d - 2 * t, h / 2),
      ...corners(w - 2 * t, d - 2 * t, -h / 2 + t),
    ];
    const positions: number[] = [];
    const quad = (a: number, b: number, c: number, e: number) => {
      for (const vertex of [a, b, c, a, c, e]) positions.push(...points[vertex]);
    };
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      quad(i, j, j + 4, i + 4);
      quad(i + 4, j + 4, j + 8, i + 8);
      quad(i + 12, i + 8, j + 8, j + 12);
    }
    quad(12, 13, 14, 15);
    quad(3, 2, 1, 0);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    g.add(new THREE.Mesh(geometry, material(0xc9d1dc)));
    return g;
  },
  python(p) {
    const { w, d, h, t } = values(p);
    return `outer = Part.makeBox(${num(w)}, ${num(d)}, ${num(h)}, App.Vector(${num(-w / 2)}, ${num(-d / 2)}, ${num(-h / 2)}))\npocket = Part.makeBox(${num(w - 2 * t)}, ${num(d - 2 * t)}, ${num(h)}, App.Vector(${num(-w / 2 + t)}, ${num(-d / 2 + t)}, ${num(-h / 2 + t)}))\nshape = outer.cut(pocket)`;
  },
  dimensions(p) {
    const { w, d, h } = values(p);
    return [w, d, h];
  },
  notes:
    'Open top, square corners and a uniform floor. Add application-specific mounting posts, connectors, fillets and print clearances in FreeCAD.',
};
export default { ...part, presets: modulePresets };

import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import * as THREE from 'three';
import type { PartDefinition, Parameters } from '../../core/types';
import { material, n, num, numberParameter } from '../../core/geometry';
const values = (p: Parameters) => ({
  r: n(p, 'diameter') / 2,
  w: n(p, 'width'),
  bore: n(p, 'bore') / 2,
  hub: n(p, 'hubDiameter') / 2,
  hubLength: n(p, 'hubLength'),
});
const part: PartDefinition = {
  id: 'wheel',
  name: 'Utility wheel',
  category: 'STRUCTURAL PARTS',
  subgroup: 'WHEELS & ROLLERS',
  icon: 'wheel',
  complexity: '5 parameters',
  description: 'A compact wheel with a tire ring, recessed rim and open axle hub.',
  keywords: ['wheel', 'roller', 'tire', 'robot', 'cart', 'axle', 'hub'],
  parameters: [
    numberParameter('diameter', 'Wheel diameter', 'D', 'Wheel', 15, 300),
    numberParameter('width', 'Tire width', 'W', 'Wheel', 3, 100),
    numberParameter('bore', 'Axle bore', 'd', 'Hub', 1, 60),
    numberParameter('hubDiameter', 'Hub diameter', 'H', 'Hub', 4, 100),
    numberParameter('hubLength', 'Hub length', 'L', 'Hub', 3, 120),
  ],
  defaults: { diameter: 60, width: 18, bore: 5, hubDiameter: 18, hubLength: 24 },
  presets: modulePresets,
  validate(p) {
    const { r, bore, hub, hubLength, w } = values(p);
    const errors: string[] = [];
    if (hub <= bore) errors.push('Hub diameter must exceed the axle bore.');
    if (hub >= r * 0.78) errors.push('Hub diameter must be less than 78% of the wheel diameter.');
    if (hubLength < w * 0.6) errors.push('Hub length must be at least 60% of the tire width.');
    return errors;
  },
  buildGeometry(p) {
    const { r, w, bore, hub, hubLength } = values(p);
    const g = new THREE.Group();
    const profile = [
      { x: bore, y: -hubLength / 2, material: 0 },
      { x: hub, y: -hubLength / 2, material: 0 },
      { x: hub, y: -w * 0.3, material: 0 },
      { x: r * 0.78, y: -w * 0.3, material: 1 },
      { x: r * 0.78, y: -w / 2, material: 1 },
      { x: r, y: -w / 2, material: 1 },
      { x: r, y: w / 2, material: 1 },
      { x: r * 0.78, y: w / 2, material: 1 },
      { x: r * 0.78, y: w * 0.3, material: 0 },
      { x: hub, y: w * 0.3, material: 0 },
      { x: hub, y: hubLength / 2, material: 0 },
      { x: bore, y: hubLength / 2, material: 0 },
      { x: bore, y: -hubLength / 2, material: 0 },
    ].filter(
      (point, i, points) =>
        i === points.length - 1 || point.x !== points[i + 1].x || point.y !== points[i + 1].y,
    );
    const segments = 96;
    const geometry = new THREE.LatheGeometry(
      profile.map((point) => new THREE.Vector2(point.x, point.y)),
      segments,
    );
    geometry.rotateX(Math.PI / 2);
    for (let i = 0; i < segments; i++)
      for (let j = 0; j < profile.length - 1; j++)
        geometry.addGroup((i * (profile.length - 1) + j) * 6, 6, profile[j].material);
    g.add(new THREE.Mesh(geometry, [material(0xb3bcc8), material(0x343d48)]));
    return g;
  },
  python(p) {
    const { r, w, bore, hub, hubLength } = values(p);
    return `def annulus(outer_radius, inner_radius, length):\n    outer = Part.makeCylinder(outer_radius, length, App.Vector(0, 0, -length / 2))\n    inner = Part.makeCylinder(inner_radius, length + 2, App.Vector(0, 0, -length / 2 - 1))\n    return outer.cut(inner)\ntire = annulus(${num(r)}, ${num(r * 0.78)}, ${num(w)})\nrim = annulus(${num(r * 0.78)}, ${num(bore)}, ${num(w * 0.6)})\nhub = annulus(${num(hub)}, ${num(bore)}, ${num(hubLength)})\nshape = Part.makeCompound([tire, rim.fuse(hub).removeSplitter()])\ncomponent_labels = ["Tire", "Rim and hub"]\ncomponent_colors = [(0.20,0.24,0.28),(0.70,0.74,0.78)]`;
  },
  dimensions(p) {
    const { r, w, hubLength } = values(p);
    return [2 * r, 2 * r, Math.max(w, hubLength)];
  },
  notes:
    'The preview distinguishes tire and rim with color; the FreeCAD assembly separates the tire from the fused rim and hub. Smooth tire with no tread, bearings, keyway or axle retention.',
};
export default { ...part, presets: modulePresets };

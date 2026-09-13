import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Group, Vector3 } from 'three';
import type { PartDefinition } from '../../core/types';
import { n, num, numberParameter, cylinder, DARK_STEEL } from '../../core/geometry';
import { roundCircuit } from './lib/parts/guide-circuits';
import { roundInsert, roundInsertPython } from './lib/parts/round-guide-insert';
import { BoundaryMesh, circleSection } from '../../core/mechanical';

const defaults = {
  shaftDiameter: 8,
  length: 200,
  blockLength: 30,
  blockWidth: 24,
  blockHeight: 24,
  clearance: 0.1,
  position: 50,
  holeDiameter: 3.4,
  pitchX: 18,
  pitchY: 18,
};
const part: PartDefinition = {
  id: 'round-linear-guide',
  name: 'Round shaft guide',
  category: 'LINEAR MOTION',
  subgroup: 'ROUND SHAFT GUIDES',
  icon: 'rail',
  complexity: 'Shaft + block',
  description: 'A round guide shaft and sliding block with a shaft bore and mounting holes.',
  keywords: ['linear', 'shaft', 'rod', 'guide', 'round rail', 'slide', 'bushing'],
  parameters: [
    numberParameter('shaftDiameter', 'Shaft diameter', 'd', 'Shaft', 3, 50),
    numberParameter('length', 'Shaft length', 'L', 'Shaft', 40, 1000),
    numberParameter('blockLength', 'Block length', 'Lb', 'Sliding block', 10, 150),
    numberParameter('blockWidth', 'Block width', 'W', 'Sliding block', 10, 120),
    numberParameter('blockHeight', 'Block height', 'H', 'Sliding block', 10, 100),
    numberParameter('clearance', 'Radial bore clearance', 'c', 'Sliding block', 0.01, 1),
    {
      ...numberParameter('position', 'Travel position', 'x', 'Sliding block', 0, 100, 1),
      unit: '%',
    },
    numberParameter('holeDiameter', 'Mounting hole diameter', 'D', 'Mounting', 1, 12),
    numberParameter('pitchX', 'Hole spacing along shaft', 'Px', 'Mounting', 5, 120),
    numberParameter('pitchY', 'Hole spacing across shaft', 'Py', 'Mounting', 5, 100),
  ],
  presetMatchKeys: ['shaftDiameter'],
  defaults,
  presets: modulePresets,
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Shaft and block in their assembly positions.',
    },
    {
      id: 'cutaway',
      label: 'Cutaway · ball circuits',
      description: 'Open housing and cage expose four recirculating ball loops.',
    },
    { id: 'shaft', label: 'Shaft only', description: 'Export the round shaft.' },
    { id: 'block', label: 'Block only', description: 'Export the bored sliding block.' },
  ],
  validate(p) {
    const errors: string[] = [],
      d = n(p, 'shaftDiameter') + n(p, 'clearance') * 2;
    if (n(p, 'length') < n(p, 'blockLength') + 2)
      errors.push('Shaft length must exceed block length by at least 2 mm.');
    if (d + 2 >= Math.min(n(p, 'blockWidth'), n(p, 'blockHeight')))
      errors.push('Block dimensions must leave at least 1 mm around the shaft bore.');
    if (
      n(p, 'pitchX') + n(p, 'holeDiameter') >= n(p, 'blockLength') - 1 ||
      n(p, 'pitchY') + n(p, 'holeDiameter') >= n(p, 'blockWidth') - 1
    )
      errors.push('Mounting holes need edge clearance inside the sliding block.');
    if (n(p, 'pitchY') - n(p, 'holeDiameter') <= d + 0.5)
      errors.push('Mounting holes must not intersect the shaft bore.');
    if (n(p, 'pitchX') <= n(p, 'holeDiameter') + 0.5)
      errors.push('Mounting holes along the shaft need at least 0.5 mm of separation.');
    if (roundCircuit(p).radius <= 0.15)
      errors.push(
        'Shaft, block and mounting holes must leave room for the recirculating ball insert.',
      );
    return errors;
  },
  buildGeometry(p, state) {
    const g = new Group(),
      d = n(p, 'shaftDiameter'),
      l = n(p, 'length'),
      bl = n(p, 'blockLength'),
      bw = n(p, 'blockWidth'),
      bh = n(p, 'blockHeight'),
      x = (n(p, 'position') / 100 - 0.5) * (l - bl);
    const cutaway = state === 'cutaway',
      sleeve = roundCircuit(p);
    if (state !== 'block') {
      const shaft = cylinder(d / 2, l);
      shaft.rotation.y = Math.PI / 2;
      shaft.position.z = bh / 2;
      g.add(shaft);
    }
    if (state !== 'shaft') {
      const mesh = new BoundaryMesh(),
        left = x - bl / 2,
        right = x + bl / 2;
      const boreLeft = circleSection(sleeve.outer + 0.05, new Vector3(left, 0, bh / 2), 'x');
      const boreRight = circleSection(sleeve.outer + 0.05, new Vector3(right, 0, bh / 2), 'x');
      if (!cutaway) mesh.bridge(boreLeft, boreRight, true);
      else {
        const arc = (end: number) =>
          Array.from({ length: 73 }, (_, i) => {
            const a = -Math.PI / 2 - (Math.PI * i) / 72;
            return new Vector3(
              end,
              (sleeve.outer + 0.05) * Math.cos(a),
              bh / 2 + (sleeve.outer + 0.05) * Math.sin(a),
            );
          });
        boreLeft.splice(0, boreLeft.length, ...arc(left));
        boreRight.splice(0, boreRight.length, ...arc(right));
        for (let i = 1; i < boreLeft.length; i++)
          mesh.face(
            [boreLeft[i - 1], boreLeft[i], boreRight[i], boreRight[i - 1]],
            [],
            new Vector3(
              0,
              -(boreLeft[i].y + boreLeft[i - 1].y),
              bh - boreLeft[i].z - boreLeft[i - 1].z,
            ).normalize(),
          );
      }
      for (const [end, bore, sign] of [
        [left, boreLeft, -1],
        [right, boreRight, 1],
      ] as const) {
        mesh.face(
          cutaway
            ? [
                new Vector3(end, -bw / 2, 0),
                new Vector3(end, 0, 0),
                ...bore,
                new Vector3(end, 0, bh),
                new Vector3(end, -bw / 2, bh),
              ]
            : [
                new Vector3(end, -bw / 2, 0),
                new Vector3(end, bw / 2, 0),
                new Vector3(end, bw / 2, bh),
                new Vector3(end, -bw / 2, bh),
              ],
          cutaway ? [] : [bore],
          new Vector3(sign, 0, 0),
        );
      }
      for (const side of cutaway ? [-1] : [-1, 1])
        mesh.face(
          [
            new Vector3(left, (side * bw) / 2, 0),
            new Vector3(right, (side * bw) / 2, 0),
            new Vector3(right, (side * bw) / 2, bh),
            new Vector3(left, (side * bw) / 2, bh),
          ],
          [],
          new Vector3(0, side, 0),
        );
      if (cutaway)
        for (const [bottom, top] of [
          [0, bh / 2 - sleeve.outer - 0.05],
          [bh / 2 + sleeve.outer + 0.05, bh],
        ])
          mesh.face(
            [
              new Vector3(left, 0, bottom),
              new Vector3(right, 0, bottom),
              new Vector3(right, 0, top),
              new Vector3(left, 0, top),
            ],
            [],
            new Vector3(0, 1, 0),
          );
      const bottomHoles: Vector3[][] = [],
        topHoles: Vector3[][] = [];
      for (const sx of [-1, 1])
        for (const sy of cutaway ? [-1] : [-1, 1]) {
          const center = new Vector3(x + (sx * n(p, 'pitchX')) / 2, (sy * n(p, 'pitchY')) / 2, 0);
          const bottom = circleSection(n(p, 'holeDiameter') / 2, center),
            top = circleSection(n(p, 'holeDiameter') / 2, center.clone().setZ(bh));
          bottomHoles.push(bottom);
          topHoles.push(top);
          mesh.bridge(bottom, top, true);
        }
      for (const [z, holes, sign] of [
        [0, bottomHoles, -1],
        [bh, topHoles, 1],
      ] as const)
        mesh.face(
          [
            new Vector3(left, -bw / 2, z),
            new Vector3(right, -bw / 2, z),
            new Vector3(right, cutaway ? 0 : bw / 2, z),
            new Vector3(left, cutaway ? 0 : bw / 2, z),
          ],
          holes,
          new Vector3(0, 0, sign),
        );
      g.add(mesh.build(DARK_STEEL));
      const insert = roundInsert(p, cutaway);
      while (insert.children.length) g.add(insert.children[0]);
    }
    if (cutaway) {
      // Face the open half toward the default isometric view, preserving the shaft axis.
      g.rotation.x = Math.PI;
      g.position.z = bh;
    }
    return g;
  },
  python(p, state) {
    const d = n(p, 'shaftDiameter'),
      l = n(p, 'length'),
      bl = n(p, 'blockLength'),
      bw = n(p, 'blockWidth'),
      bh = n(p, 'blockHeight'),
      x = (n(p, 'position') / 100 - 0.5) * (l - bl);
    const cutaway = state === 'cutaway',
      sleeve = roundCircuit(p);
    return `shaft = Part.makeCylinder(${num(d / 2)}, ${num(l)}, App.Vector(${num(-l / 2)}, 0, ${num(bh / 2)}), App.Vector(1, 0, 0))\nblock = Part.makeBox(${num(bl)}, ${num(bw)}, ${num(bh)}, App.Vector(${num(x - bl / 2)}, ${num(-bw / 2)}, 0))\nbore = Part.makeCylinder(${num(sleeve.outer + 0.05)}, ${num(bl + 2)}, App.Vector(${num(x - bl / 2 - 1)}, 0, ${num(bh / 2)}), App.Vector(1, 0, 0))\nblock = block.cut(bore)\nfor sx in [-1, 1]:\n    for sy in [-1, 1]:\n        block = block.cut(Part.makeCylinder(${num(n(p, 'holeDiameter') / 2)}, ${num(bh + 2)}, App.Vector(${num(x)} + sx * ${num(n(p, 'pitchX') / 2)}, sy * ${num(n(p, 'pitchY') / 2)}, -1)))\n${cutaway ? `block = block.cut(Part.makeBox(${num(bl + 2)},${num(bw)},${num(bh + 2)},App.Vector(${num(x - bl / 2 - 1)},0,-1)))` : ''}\n${roundInsertPython(p, cutaway)}\nshape = ${state === 'shaft' ? 'shaft' : state === 'block' ? 'Part.makeCompound([block.removeSplitter()] + insert_parts)' : 'Part.makeCompound([shaft, block.removeSplitter()] + insert_parts)'}${cutaway ? `\nshape.rotate(App.Vector(0, 0, ${num(bh / 2)}), App.Vector(1, 0, 0), 180)` : ''}\ncomponent_labels = ${JSON.stringify(state === 'shaft' ? ['Guide shaft'] : [...(state === 'block' ? [] : ['Guide shaft']), 'Carriage housing', 'Return cage', 'Rear wiper', 'Front wiper', ...sleeve.points.map((_, i) => `Recirculating ball ${i + 1}`)])}`;
  },
  dimensions(p, state) {
    return state === 'shaft'
      ? [n(p, 'length'), n(p, 'shaftDiameter'), n(p, 'shaftDiameter')]
      : [
          n(p, state === 'block' ? 'blockLength' : 'length'),
          state === 'cutaway' ? n(p, 'blockWidth') / 2 + roundCircuit(p).outer : n(p, 'blockWidth'),
          n(p, 'blockHeight'),
        ];
  },
  notes:
    'Custom round-shaft assembly with four closed ball circuits, a slotted return cage and end wipers. The cutaway exposes the insert inside the bored housing. Ball sizes/counts and clearance chambers are representative; presets are not manufacturer-verified bushing or housing dimensions. Clearance is radial.',
};
export default { ...part, presets: modulePresets };

import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Group, Mesh, Vector2, Vector3 } from 'three';
import type { PartDefinition, Parameters } from '../../core/types';
import { n, num, numberParameter, DARK_STEEL } from '../../core/geometry';
import { ballMeshes, ballPython, profileCircuit } from './lib/parts/guide-circuits';
import { BoundaryMesh, circleSection } from '../../core/mechanical';
import { hiwinGuideReference } from './lib/catalog/linear-guides';

const defaults = {
  length: 200,
  railWidth: 12,
  railHeight: 8,
  railHole: 3.5,
  counterbore: 6,
  counterDepth: 4.5,
  holePitch: 25,
  endOffset: 10,
  blockLength: 45.4,
  blockWidth: 27,
  totalHeight: 13,
  baseClearance: 3,
  blockPitchX: 20,
  blockPitchY: 20,
  blockHole: 3,
  holeDepth: 3.5,
  position: 50,
  clearance: 0.15,
};
const dimensions = (p: Parameters) => ({
  l: n(p, 'length'),
  rw: n(p, 'railWidth'),
  rh: n(p, 'railHeight'),
  bl: n(p, 'blockLength'),
  bw: n(p, 'blockWidth'),
  h: n(p, 'totalHeight'),
  bottom: n(p, 'baseClearance'),
});
function holePositions(p: Parameters) {
  const { l } = dimensions(p),
    edge = n(p, 'endOffset'),
    pitch = n(p, 'holePitch');
  return Array.from(
    { length: Math.max(0, Math.min(80, Math.floor((l - edge * 2) / pitch) + 1)) },
    (_, i) => -l / 2 + edge + i * pitch,
  );
}
function position(p: Parameters) {
  const { l, bl } = dimensions(p);
  return (n(p, 'position') / 100 - 0.5) * (l - bl);
}
function sectionFaces(
  mesh: BoundaryMesh,
  section: Vector2[],
  left: number,
  right: number,
  omittedHeights: number[],
) {
  const first = section.map((point) => new Vector3(left, point.x, point.y));
  const last = section.map((point) => new Vector3(right, point.x, point.y));
  mesh.face(first, [], new Vector3(-1, 0, 0));
  mesh.face(last, [], new Vector3(1, 0, 0));
  for (let i = 0; i < section.length; i++) {
    const j = (i + 1) % section.length;
    if (
      omittedHeights.some(
        (z) => Math.abs(section[i].y - z) < 1e-8 && Math.abs(section[j].y - z) < 1e-8,
      )
    )
      continue;
    mesh.face(
      [first[i], first[j], last[j], last[i]],
      [],
      new Vector3(0, section[j].y - section[i].y, section[i].x - section[j].x).normalize(),
    );
  }
}
function rectangle(left: number, right: number, width: number, z: number) {
  return [
    new Vector3(left, -width / 2, z),
    new Vector3(right, -width / 2, z),
    new Vector3(right, width / 2, z),
    new Vector3(left, width / 2, z),
  ];
}
function makeRail(p: Parameters): Mesh {
  const { l, rw, rh } = dimensions(p);
  const mesh = new BoundaryMesh(),
    radius = rw * 0.1,
    center = rh * 0.62;
  const section = [new Vector2(-rw / 2, 0), new Vector2(rw / 2, 0)];
  for (let i = 0; i <= 36; i++)
    section.push(
      new Vector2(
        rw / 2 - radius * Math.sin((i * Math.PI) / 36),
        center - radius * Math.cos((i * Math.PI) / 36),
      ),
    );
  section.push(new Vector2(rw / 2, rh), new Vector2(-rw / 2, rh));
  for (let i = 0; i <= 36; i++)
    section.push(
      new Vector2(
        -rw / 2 + radius * Math.sin((i * Math.PI) / 36),
        center + radius * Math.cos((i * Math.PI) / 36),
      ),
    );
  sectionFaces(mesh, section, -l / 2, l / 2, [0, rh]);
  const topHoles: Vector3[][] = [],
    bottomHoles: Vector3[][] = [];
  for (const x of holePositions(p)) {
    const shoulder = rh - n(p, 'counterDepth');
    const bottom = circleSection(n(p, 'railHole') / 2, new Vector3(x, 0, 0));
    const inner = circleSection(n(p, 'railHole') / 2, new Vector3(x, 0, shoulder));
    const outer = circleSection(n(p, 'counterbore') / 2, new Vector3(x, 0, shoulder));
    const top = circleSection(n(p, 'counterbore') / 2, new Vector3(x, 0, rh));
    bottomHoles.push(bottom);
    topHoles.push(top);
    mesh.bridge(bottom, inner, true);
    mesh.bridge(outer, top, true);
    mesh.face(outer, [inner], new Vector3(0, 0, 1));
  }
  mesh.face(rectangle(-l / 2, l / 2, rw, 0), bottomHoles, new Vector3(0, 0, -1));
  mesh.face(rectangle(-l / 2, l / 2, rw, rh), topHoles, new Vector3(0, 0, 1));
  return mesh.build();
}
function makeBlock(p: Parameters, cutaway = false): Mesh {
  const { bl, bw, rh, rw, h, bottom } = dimensions(p),
    c = n(p, 'clearance'),
    x = position(p);
  const mesh = new BoundaryMesh(),
    channel = rw / 2 + c,
    roof = rh + c;
  const circuit = profileCircuit(p);
  const section = [
    [-bw / 2, bottom],
    [-channel, bottom],
    [-channel, circuit.low],
    [-circuit.chamber, circuit.low],
    [-circuit.chamber, circuit.high],
    [-channel, circuit.high],
    [-channel, roof],
    [channel, roof],
    [channel, circuit.high],
    [circuit.chamber, circuit.high],
    [circuit.chamber, circuit.low],
    [channel, circuit.low],
    [channel, bottom],
    [bw / 2, bottom],
    [bw / 2, h],
    [-bw / 2, h],
  ].map(([y, z]) => new Vector2(y, z));
  if (cutaway) {
    section.splice(0, 7, new Vector2(0, roof));
    section[section.length - 1] = new Vector2(0, h);
  }
  sectionFaces(mesh, section, x - bl / 2, x + bl / 2, [h]);
  const holes: Vector3[][] = [];
  for (const sx of [-1, 1])
    for (const sy of cutaway ? [1] : [-1, 1]) {
      const center = new Vector3(
        x + (sx * n(p, 'blockPitchX')) / 2,
        (sy * n(p, 'blockPitchY')) / 2,
        h,
      );
      const top = circleSection(n(p, 'blockHole') / 2, center),
        floor = circleSection(n(p, 'blockHole') / 2, center.clone().setZ(h - n(p, 'holeDepth')));
      holes.push(top);
      mesh.bridge(floor, top, true);
      mesh.face(floor, [], new Vector3(0, 0, 1));
    }
  const top = rectangle(x - bl / 2, x + bl / 2, bw, h);
  if (cutaway) {
    top[0].y = 0;
    top[1].y = 0;
  }
  mesh.face(top, holes, new Vector3(0, 0, 1));
  return mesh.build(DARK_STEEL);
}
const part: PartDefinition = {
  id: 'linear-guide',
  name: 'Profile linear guide',
  category: 'LINEAR MOTION',
  subgroup: 'PROFILE RAILS',
  icon: 'rail',
  complexity: 'Rail + carriage',
  standard: 'MGN envelopes',
  description: 'A drilled guide rail and movable carriage, with independent rail or block export.',
  keywords: ['linear', 'guide', 'rail', 'carriage', 'MGN9', 'MGN12H', 'MGN15H', 'HIWIN', 'slide'],
  parameters: [
    numberParameter('length', 'Rail length', 'L', 'Rail', 30, 1000),
    numberParameter('railWidth', 'Rail width', 'Wr', 'Rail', 5, 50),
    numberParameter('railHeight', 'Rail height', 'Hr', 'Rail', 3, 40),
    numberParameter('holePitch', 'Hole spacing', 'P', 'Rail mounting', 10, 100),
    numberParameter('endOffset', 'First hole from end', 'E', 'Rail mounting', 4, 80),
    numberParameter('railHole', 'Through-hole diameter', 'd', 'Rail mounting', 1, 15),
    numberParameter('counterbore', 'Counterbore diameter', 'D', 'Rail mounting', 2, 22),
    numberParameter('counterDepth', 'Counterbore depth', 'h', 'Rail mounting', 0.5, 15),
    numberParameter('blockLength', 'Carriage length', 'Lb', 'Carriage', 12, 150),
    numberParameter('blockWidth', 'Carriage width', 'W', 'Carriage', 12, 100),
    numberParameter('totalHeight', 'Assembly height', 'H', 'Carriage', 6, 80),
    numberParameter('baseClearance', 'Block base clearance', 'H1', 'Carriage', 0.5, 20),
    { ...numberParameter('position', 'Travel position', 'x', 'Carriage', 0, 100, 1), unit: '%' },
    numberParameter('clearance', 'Rail-to-block clearance', 'c', 'Carriage', 0.05, 1),
    numberParameter('blockPitchX', 'Mount spacing along rail', 'C', 'Carriage mounting', 5, 100),
    numberParameter('blockPitchY', 'Mount spacing across rail', 'B', 'Carriage mounting', 5, 80),
    numberParameter('blockHole', 'Mount bore diameter', 'M', 'Carriage mounting', 1, 12),
    numberParameter('holeDepth', 'Mount bore depth', 't', 'Carriage mounting', 0.5, 20),
  ],
  presetMatchKeys: ['railWidth', 'blockWidth', 'blockLength', 'totalHeight'],
  defaults,
  presets: modulePresets,
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Rail and carriage at the chosen travel position.',
    },
    {
      id: 'cutaway',
      label: 'Cutaway · ball circuits',
      description: 'Half the carriage is removed to expose the loaded and return ball paths.',
    },
    {
      id: 'rail',
      label: 'Rail only',
      description: 'Export the drilled rail as a separate component.',
    },
    {
      id: 'carriage',
      label: 'Carriage',
      description: 'Export only the carriage, preserving its assembly position.',
    },
  ],
  validate(p) {
    const { l, rw, rh, bl, bw, h, bottom } = dimensions(p),
      c = n(p, 'clearance'),
      errors: string[] = [];
    if (l < bl + 2) errors.push('Rail length must exceed carriage length by at least 2 mm.');
    if (n(p, 'counterbore') >= rw - 1 || n(p, 'railHole') >= n(p, 'counterbore'))
      errors.push('The rail needs material around a counterbore larger than the through hole.');
    if (n(p, 'counterDepth') >= rh - 0.5)
      errors.push('Counterbore depth must leave at least 0.5 mm below its shoulder.');
    if (rw * 0.1 >= rh * 0.38 - 0.05)
      errors.push('Rail height must contain the side grooves with material above and below.');
    if (n(p, 'counterbore') / 2 >= rw * 0.4 - 0.05)
      errors.push('Counterbores must leave material between the mounting holes and side grooves.');
    if (
      n(p, 'endOffset') <= n(p, 'counterbore') / 2 ||
      n(p, 'endOffset') * 2 >= l ||
      n(p, 'holePitch') <= n(p, 'counterbore') + 1
    )
      errors.push('Rail hole spacing or edge distance is too small.');
    if (Math.floor((l - 2 * n(p, 'endOffset')) / n(p, 'holePitch')) + 1 > 80)
      errors.push('Use at most 80 rail mounting holes.');
    if (bw <= rw + 2 * c + 2 || h <= rh + c + 1 || bottom >= rh - 0.5)
      errors.push('Carriage dimensions must enclose the rail with side walls and a top bridge.');
    if (
      n(p, 'blockPitchX') + n(p, 'blockHole') >= bl - 1 ||
      n(p, 'blockPitchY') + n(p, 'blockHole') >= bw - 1
    )
      errors.push('Carriage mounting holes must fit inside the block with edge clearance.');
    if (n(p, 'blockPitchY') - n(p, 'blockHole') <= rw + 2 * c)
      errors.push('Carriage mounting holes must lie outside the rail channel.');
    if (n(p, 'blockPitchX') <= n(p, 'blockHole') + 0.5)
      errors.push('Carriage mounting holes along the rail need at least 0.5 mm of separation.');
    if (n(p, 'holeDepth') >= h - bottom)
      errors.push('Blind mounting holes must stop above the bottom of the block.');
    const circuit = profileCircuit(p);
    if (circuit.radius <= 0.15 || bl <= 8 * circuit.radius)
      errors.push('Carriage walls and length must leave room for the ball return circuits.');
    if (h - n(p, 'holeDepth') <= circuit.high + 0.2)
      errors.push('Mounting bores must stop above the ball return chamber.');
    return errors;
  },
  buildGeometry(p, state) {
    const g = new Group();
    if (state !== 'carriage') g.add(makeRail(p));
    if (state !== 'rail') {
      g.add(makeBlock(p, state === 'cutaway'));
      const circuit = profileCircuit(p);
      g.add(...ballMeshes(circuit.points, circuit.radius));
    }
    return g;
  },
  python(p, state) {
    const { l, rw, rh, bl, bw, h, bottom } = dimensions(p),
      x = position(p),
      c = n(p, 'clearance');
    const circuit = profileCircuit(p);
    const chambers = `\nfor side in [-1, 1]:\n    block = block.cut(Part.makeBox(${num(bl + 2)}, ${num(circuit.chamber - circuit.loaded + 0.02)}, ${num(circuit.high - circuit.low)}, App.Vector(${num(x - bl / 2 - 1)}, side * ${num((circuit.chamber + circuit.loaded) / 2)} - ${num((circuit.chamber - circuit.loaded + 0.02) / 2)}, ${num(circuit.low)})))`;
    const cutaway =
      state === 'cutaway'
        ? `\nblock = block.cut(Part.makeBox(${num(bl + 2)}, ${num(bw)}, ${num(h + 2)}, App.Vector(${num(x - bl / 2 - 1)}, ${num(-bw)}, -1)))`
        : '';
    const balls = ballPython(circuit.points, circuit.radius).join(', ');
    return `rail = Part.makeBox(${num(l)}, ${num(rw)}, ${num(rh)}, App.Vector(${num(-l / 2)}, ${num(-rw / 2)}, 0))\nfor side in [-1, 1]:\n    rail = rail.cut(Part.makeCylinder(${num(rw * 0.1)}, ${num(l + 2)}, App.Vector(${num(-l / 2 - 1)}, side * ${num(rw / 2)}, ${num(rh * 0.62)}), App.Vector(1, 0, 0)))\nfor x in [${holePositions(p).map(num).join(', ')}]:\n    rail = rail.cut(Part.makeCylinder(${num(n(p, 'railHole') / 2)}, ${num(rh + 2)}, App.Vector(x, 0, -1)))\n    rail = rail.cut(Part.makeCylinder(${num(n(p, 'counterbore') / 2)}, ${num(n(p, 'counterDepth') + 1)}, App.Vector(x, 0, ${num(rh - n(p, 'counterDepth'))})))\nblock = Part.makeBox(${num(bl)}, ${num(bw)}, ${num(h - bottom)}, App.Vector(${num(x - bl / 2)}, ${num(-bw / 2)}, ${num(bottom)}))\nchannel = Part.makeBox(${num(bl + 2)}, ${num(rw + c * 2)}, ${num(rh + c + 1)}, App.Vector(${num(x - bl / 2 - 1)}, ${num(-rw / 2 - c)}, -1))\nblock = block.cut(channel)${chambers}\nfor sx in [-1, 1]:\n    for sy in [-1, 1]:\n        block = block.cut(Part.makeCylinder(${num(n(p, 'blockHole') / 2)}, ${num(n(p, 'holeDepth') + 1)}, App.Vector(${num(x)} + sx * ${num(n(p, 'blockPitchX') / 2)}, sy * ${num(n(p, 'blockPitchY') / 2)}, ${num(h - n(p, 'holeDepth'))})))\n${cutaway}\nballs = [${balls}]\nshape = ${state === 'rail' ? 'rail.removeSplitter()' : state === 'carriage' ? 'Part.makeCompound([block.removeSplitter()] + balls)' : 'Part.makeCompound([rail.removeSplitter(), block.removeSplitter()] + balls)'}\ncomponent_labels = ${JSON.stringify(state === 'rail' ? ['Guide rail'] : [...(state === 'carriage' ? [] : ['Guide rail']), 'Carriage', ...circuit.points.map((_, i) => `Recirculating ball ${i + 1}`)])}`;
  },
  dimensions(p, state) {
    const d = dimensions(p);
    return state === 'rail'
      ? [d.l, d.rw, d.rh]
      : state === 'carriage'
        ? [d.bl, d.bw, d.h - d.bottom]
        : [
            d.l,
            state === 'cutaway'
              ? d.bw / 2 + profileCircuit(p).returned + profileCircuit(p).radius
              : d.bw,
            d.h,
          ];
  },
  notes:
    'MGN presets use published mounting envelopes. Two closed ball circuits include loaded rows, return rows and semicircular end turns. Internal clearance chambers are representative open sections, not manufacturer return-channel tooling. Cutaway removes half the carriage. Ball diameters/counts, end retainers and threaded mounting bores are not production specifications.',
  sources: [
    {
      label: 'HIWIN · MGN/MGW mounting dimensions',
      url: hiwinGuideReference,
    },
  ],
};
export default { ...part, presets: modulePresets };

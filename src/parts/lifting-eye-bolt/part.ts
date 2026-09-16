import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import type { Parameters, PartDefinition } from '../../core/types';

import { booleans, primitives, solidUnionMesh, transforms } from '../../core/solid-union';
import { num } from '../../core/geometry';
const defaults: Parameters = {
  diameter: 10,
  length: 17,
  pitch: 1.5,
  collarDiameter: 25,
  collarHeight: 8,
  eyeDiameter: 45,
  eyeBore: 25,
  headHeight: 45,
};
function values(p: Parameters) {
  const outer = Number(p.eyeDiameter),
    inner = Number(p.eyeBore),
    length = Number(p.length);
  return {
    radius: (outer + inner) / 4,
    tube: (outer - inner) / 4,
    length,
    z: length + Number(p.headHeight) - outer / 2,
  };
}
const part: PartDefinition = {
  id: 'lifting-eye-bolt',
  name: 'Lifting eye bolt',
  category: 'FASTENERS & THREADS',
  subgroup: 'LIFTING EYES',
  icon: 'bolt',
  complexity: 'Round eye & collar',
  standard: 'DIN 580',
  description:
    'A round-section eye on a circular collar with a threaded stem, for layout and clearance prototyping.',
  keywords: ['lifting eye', 'ring bolt', 'DIN 580', 'collar', 'eyebolt'],
  defaults,
  parameters: [
    {
      key: 'diameter',
      label: 'Thread diameter',
      symbol: 'd',
      type: 'number',
      unit: 'mm',
      min: 2,
      max: 150,
      step: 1,
      group: 'Stem',
    },
    {
      key: 'length',
      label: 'Stem length',
      symbol: 'L',
      type: 'number',
      unit: 'mm',
      min: 2,
      max: 300,
      step: 1,
      group: 'Stem',
    },
    {
      key: 'pitch',
      label: 'Nominal pitch',
      symbol: 'P',
      type: 'number',
      unit: 'mm',
      min: 0.1,
      max: 8,
      step: 0.05,
      group: 'Stem',
      description: 'Thread identification; preview and CAD use a smooth nominal envelope.',
    },
    {
      key: 'collarDiameter',
      label: 'Collar diameter',
      symbol: 'd₂',
      type: 'number',
      unit: 'mm',
      min: 5,
      max: 300,
      step: 1,
      group: 'Collar',
    },
    {
      key: 'collarHeight',
      label: 'Collar height',
      symbol: 'e',
      type: 'number',
      unit: 'mm',
      min: 1,
      max: 150,
      step: 0.5,
      group: 'Collar',
    },
    {
      key: 'eyeDiameter',
      label: 'Eye outside diameter',
      symbol: 'd₃',
      type: 'number',
      unit: 'mm',
      min: 6,
      max: 500,
      step: 1,
      group: 'Eye',
    },
    {
      key: 'eyeBore',
      label: 'Eye inside diameter',
      symbol: 'd₄',
      type: 'number',
      unit: 'mm',
      min: 2,
      max: 400,
      step: 1,
      group: 'Eye',
    },
    {
      key: 'headHeight',
      label: 'Head overall height',
      symbol: 'h',
      type: 'number',
      unit: 'mm',
      min: 6,
      max: 500,
      step: 1,
      group: 'Eye',
    },
  ],
  presets: modulePresets,
  presetMatchKeys: ['diameter'],
  validate: (p) => {
    const errors: string[] = [];
    const v = values(p);
    if (v.tube <= 0.25)
      errors.push('The eye outside diameter must exceed the bore by at least 1 mm.');
    if (Number(p.collarDiameter) < Number(p.diameter))
      errors.push('The collar must be at least as wide as the stem.');
    if (Number(p.headHeight) - Number(p.eyeDiameter) < -Number(p.length) * 0.5)
      errors.push('Raise the eye to leave the lower half of the stem clear.');
    if (Number(p.headHeight) - Number(p.eyeDiameter) >= Number(p.collarHeight) - 0.1)
      errors.push('Lower the eye or increase collar height so the eye joins the collar.');
    if (
      Number(p.headHeight) - Number(p.eyeDiameter) / 2 - Number(p.eyeBore) / 2 <
      Number(p.collarHeight)
    )
      errors.push('The collar must stay below the eye opening.');
    return errors;
  },
  buildGeometry: (p) => {
    const v = values(p);
    const stem = primitives.cylinder({
      radius: Number(p.diameter) / 2,
      height: v.length,
      center: [0, 0, v.length / 2],
      segments: 48,
    });
    const collar = primitives.cylinder({
      radius: Number(p.collarDiameter) / 2,
      height: Number(p.collarHeight),
      center: [0, 0, v.length + Number(p.collarHeight) / 2],
      segments: 64,
    });
    const ring = transforms.translate(
      [0, 0, v.z],
      transforms.rotateX(
        Math.PI / 2,
        primitives.torus({
          innerRadius: v.tube,
          outerRadius: v.radius,
          innerSegments: 20,
          outerSegments: 80,
        }),
      ),
    );
    return solidUnionMesh(booleans.union(stem, collar, ring));
  },
  dimensions: (p) => [
    Math.max(Number(p.collarDiameter), Number(p.eyeDiameter)),
    Math.max(Number(p.collarDiameter), (Number(p.eyeDiameter) - Number(p.eyeBore)) / 2),
    Number(p.length) + Number(p.headHeight),
  ],
  python: (p) => {
    const v = values(p);
    return `# Smooth thread envelope and joined ring/collar geometry for clearance prototyping.\nshape = Part.makeCylinder(${num(Number(p.diameter) / 2)}, ${num(v.length)})\ncollar = Part.makeCylinder(${num(Number(p.collarDiameter) / 2)}, ${num(Number(p.collarHeight))}, App.Vector(0,0,${num(v.length)}))\neye = Part.makeTorus(${num(v.radius)}, ${num(v.tube)}, App.Vector(0,0,${num(v.z)}), App.Vector(0,1,0))\nshape = shape.fuse(collar).fuse(eye).removeSplitter()\nif len(shape.Solids) != 1: raise ValueError("The eye, collar and stem must form one solid.")\nshape.translate(App.Vector(0,0,-${num((v.length + Number(p.headHeight)) / 2)}))`;
  },
  notes:
    'Dimensional layout model with a circular ring cross-section, cylindrical collar and smooth thread envelope. Local forged transitions and certification details are omitted; this model does not establish a lifting capacity.',
  sources: [
    {
      label: 'Gvyntok DIN 580 dimensions',
      url: 'https://gvyntok.com/wp-content/uploads/2024/06/030-370-001.pdf',
    },
  ],
};
export default { ...part, presets: modulePresets };

import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import type { Parameters, PartDefinition } from '../../core/types';
import { numberParameter, num } from '../../core/geometry';
import {
  conformThreadMesh,
  internalThreadDefaults,
  internalThreadParameters,
  internalThreadErrors,
  internalThreadCutter,
  internalThreadPython,
  internalMinorDiameter,
  nutCoarsePitch,
} from './lib/core/internal-thread';
import { booleans, primitives, transforms, solidUnionMesh } from '../../core/solid-union';
import { handNutDrawings } from './lib/catalog/hand-nuts';

const defaults: Parameters = {
  ...internalThreadDefaults(10),
  diameter: 10,
  pitch: 1.5,
  collarDiameter: 25,
  collarHeight: 10,
  eyeDiameter: 45,
  eyeBore: 25,
  eyeThickness: 10,
  height: 45,
};
function values(p: Parameters) {
  const outer = Number(p.eyeDiameter),
    inner = Number(p.eyeBore),
    height = Number(p.height);
  return {
    outer,
    inner,
    height,
    radius: (outer + inner) / 4,
    tube: (outer - inner) / 4,
    center: height - outer / 2,
    boreDepth: Math.max(Number(p.collarHeight), height - (outer + inner) / 2) + 1,
  };
}
const part: PartDefinition = {
  id: 'lifting-eye-nut',
  name: 'Lifting eye nut',
  category: 'FASTENERS & THREADS',
  subgroup: 'LIFTING EYES',
  icon: 'bolt',
  complexity: 'Ring & threaded base',
  standard: 'DIN 582',
  description:
    'A forged ring on a bored circular nut base, with independent eye and mounting dimensions.',
  keywords: ['lifting', 'eye', 'ring', 'nut', 'DIN 582', 'female thread'],
  defaults,
  parameters: [
    numberParameter('diameter', 'Nominal thread bore', 'd₁', 'Thread', 2, 100, 1),
    ...internalThreadParameters,
    numberParameter('collarDiameter', 'Nut base diameter', 'd₂', 'Nut base', 5, 250, 1),
    numberParameter('collarHeight', 'Nut base height', 'e', 'Nut base', 2, 100, 0.5),
    numberParameter('eyeDiameter', 'Eye outside diameter', 'd₃', 'Eye', 8, 400, 1),
    numberParameter('eyeBore', 'Eye opening diameter', 'd₄', 'Eye', 3, 300, 1),
    numberParameter('eyeThickness', 'Eye transverse thickness', 'k', 'Eye', 2, 100, 1),
    numberParameter('height', 'Overall height', 'h', 'Eye', 8, 400, 1),
  ],
  presets: modulePresets,
  presetMatchKeys: [
    'diameter',
    'collarDiameter',
    'collarHeight',
    'eyeDiameter',
    'eyeBore',
    'eyeThickness',
    'height',
  ],
  updateParameters: (p, changedKey) =>
    changedKey === 'diameter' ? { ...p, pitch: nutCoarsePitch(Number(p.diameter)) } : p,
  validate: (p) => {
    const v = values(p),
      errors: string[] = internalThreadErrors(p, Number(p.diameter), v.boreDepth);
    if (v.tube <= 0.5)
      errors.push('The eye outside diameter must exceed its opening by more than 2 mm.');
    if (Number(p.collarDiameter) * 0.9 <= Number(p.diameter) + 1)
      errors.push('The threaded bore needs at least 0.5 mm wall inside the tapered base.');
    if (v.height <= v.outer / 2 || v.height - v.outer >= Number(p.collarHeight) - 0.2)
      errors.push('The eye must join the nut base and stay above its mounting face.');
    if (Number(p.collarHeight) >= v.center)
      errors.push('The nut base must remain below the eye center.');
    if (Number(p.diameter) >= v.inner)
      errors.push('The mounting bore must be narrower than the eye opening.');
    return errors;
  },
  buildGeometry: (p) => {
    const v = values(p),
      r = Number(p.collarDiameter) / 2,
      e = Number(p.collarHeight);
    const body = primitives.cylinderElliptic({
      startRadius: [r, r],
      endRadius: [r * 0.9, r * 0.9],
      height: e,
      center: [0, 0, e / 2],
      segments: 64,
    });
    const eye = transforms.translate(
      [0, 0, v.center],
      transforms.scale(
        [1, Number(p.eyeThickness) / (2 * v.tube), 1],
        transforms.rotateX(
          Math.PI / 2,
          primitives.torus({
            innerRadius: v.tube,
            outerRadius: v.radius,
            innerSegments: 20,
            outerSegments: 80,
          }),
        ),
      ),
    );
    const trim = primitives.cuboid({
      size: [Math.max(v.outer, 2 * r) + 2, Math.max(2 * r, Number(p.eyeThickness)) + 2, v.height],
      center: [0, 0, v.height / 2],
    });
    const bore = internalThreadCutter(p, Number(p.diameter), v.boreDepth);
    return conformThreadMesh(
      solidUnionMesh(booleans.subtract(booleans.intersect(booleans.union(body, eye), trim), bore)),
    );
  },
  dimensions: (p) => [
    Math.max(Number(p.eyeDiameter), Number(p.collarDiameter)),
    Math.max(Number(p.collarDiameter), Number(p.eyeThickness)),
    Number(p.height),
  ],
  python: (p) => {
    const v = values(p),
      r = Number(p.collarDiameter) / 2;
    return `# Joined ring and bored female-thread base; local forging transitions are representative.\nshape=Part.makeCone(${num(r)},${num(r * 0.9)},${num(Number(p.collarHeight))})\nsection=Part.Ellipse(App.Vector(0,0,0),${num(Math.max(v.tube, Number(p.eyeThickness) / 2))},${num(Math.min(v.tube, Number(p.eyeThickness) / 2))}).toShape()\n${Number(p.eyeThickness) / 2 > v.tube ? 'section.rotate(App.Vector(0,0,0),App.Vector(0,0,1),90)\n' : ''}section.translate(App.Vector(${num(v.radius)},0,0))\neye = Part.Face(Part.Wire([section])).revolve(App.Vector(0,0,0),App.Vector(0,1,0),360)\neye.translate(App.Vector(0,0,${num(v.center)}))\nshape=shape.fuse(eye)\nshape=shape.common(Part.makeBox(${num(Math.max(v.outer, 2 * r) + 2)},${num(Math.max(2 * r, Number(p.eyeThickness)) + 2)},${num(v.height)},App.Vector(-${num(Math.max(v.outer, 2 * r) / 2 + 1)},-${num(Math.max(2 * r, Number(p.eyeThickness)) / 2 + 1)},0)))\nshape=shape.cut(Part.makeCylinder(${num(internalMinorDiameter(p, Number(p.diameter)) / 2)},${num(v.boreDepth + 1)},App.Vector(0,0,-1)))\n${internalThreadPython(p, Number(p.diameter), v.boreDepth)}\nif len(shape.Solids) != 1: raise ValueError("The eye and bored nut base must form one solid.")\nshape.translate(App.Vector(0,0,-${num(v.height / 2)}))`;
  },
  notes:
    'Supplier nominal d2/d3/d4/e/h/k dimensions define the envelope. M6 is explicitly marked non-standard in the source drawing. The ring section, tapered nut base and forged transitions are simplified. A modeled basic metric internal thread opens through the nut base into the eye. Fit tolerances and forging details are not specified by this model. This geometry does not establish a lifting capacity.',
  sources: [{ label: 'Gvyntok DIN 582 drawing and nominal dimensions', url: handNutDrawings.eye }],
};
export default { ...part, presets: modulePresets };

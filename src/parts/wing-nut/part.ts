import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import modeling from '@jscad/modeling';
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
  ...internalThreadDefaults(6),
  diameter: 6,
  pitch: 1,
  baseDiameter: 14.2,
  wingSpan: 28.7,
  height: 15,
  baseHeight: 5.6,
  wingThickness: 2.4,
};
function outline(p: Parameters): [number, number][] {
  const r = Number(p.baseDiameter) / 2,
    s = Number(p.wingSpan) / 2,
    h = Number(p.height),
    m = Number(p.baseHeight);
  return [
    [r * 0.65, 0],
    [r, 0],
    [s * 0.76, h * 0.36],
    [s, h * 0.8],
    [s * 0.91, h * 0.94],
    [s * 0.76, h],
    [s * 0.58, h * 0.96],
    [r * 0.68, m],
  ];
}
const part: PartDefinition = {
  id: 'wing-nut',
  name: 'Wing nut',
  category: 'FASTENERS',
  subgroup: 'NUTS',
  icon: 'bolt',
  complexity: 'Hand tightened',
  standard: 'DIN 315',
  description: 'Two raised wings on a tapered circular nut body, with a through thread bore.',
  keywords: ['wing', 'butterfly', 'hand', 'nut', 'DIN 315', 'American form'],
  defaults,
  parameters: [
    numberParameter('diameter', 'Nominal thread bore', 'd', 'Thread', 1, 100, 0.5),
    ...internalThreadParameters,
    numberParameter('baseDiameter', 'Body base diameter', 'd₂', 'Body', 3, 200, 0.1),
    numberParameter('baseHeight', 'Body height', 'm', 'Body', 1, 100, 0.1),
    numberParameter('wingSpan', 'Overall wing span', 'e', 'Wings', 5, 400, 0.1),
    numberParameter('height', 'Overall height', 'h', 'Wings', 3, 200, 0.1),
    {
      ...numberParameter('wingThickness', 'Wing thickness', 't', 'Wings', 0.5, 50, 0.1),
      description: 'Representative wing section; not dimensioned in the supplier table.',
    },
  ],
  presets: modulePresets,
  presetMatchKeys: ['diameter', 'baseDiameter', 'baseHeight', 'wingSpan', 'height'],
  updateParameters: (p, changedKey) =>
    changedKey === 'diameter' ? { ...p, pitch: nutCoarsePitch(Number(p.diameter)) } : p,
  validate: (p) => {
    const errors: string[] = internalThreadErrors(p, Number(p.diameter), Number(p.height));
    if (Number(p.diameter) + 0.4 >= Number(p.baseDiameter) * 0.8)
      errors.push('The threaded bore needs a wall inside the tapered body.');
    if (Number(p.wingSpan) <= Number(p.baseDiameter) * 1.5)
      errors.push('The wings need a span exceeding 1.5 times the body diameter.');
    if (Number(p.height) <= Number(p.baseHeight) * 1.5)
      errors.push('The wings must extend clearly above the nut body.');
    if (Number(p.wingThickness) >= Number(p.baseDiameter) * 0.6)
      errors.push('Wing thickness must be below 60% of the body diameter.');
    return errors;
  },
  buildGeometry: (p) => {
    const r = Number(p.baseDiameter) / 2,
      m = Number(p.baseHeight),
      t = Number(p.wingThickness);
    const body = primitives.cylinderElliptic({
      startRadius: [r, r],
      endRadius: [r * 0.8, r * 0.8],
      height: m,
      center: [0, 0, m / 2],
      segments: 64,
    });
    const wing = transforms.translate(
      [0, t / 2, 0],
      transforms.rotateX(
        Math.PI / 2,
        modeling.extrusions.extrudeLinear(
          { height: t },
          primitives.polygon({ points: outline(p) }),
        ),
      ),
    );
    const bore = internalThreadCutter(p, Number(p.diameter), Number(p.height));
    return conformThreadMesh(
      solidUnionMesh(booleans.subtract(booleans.union(body, wing, transforms.mirrorX(wing)), bore)),
    );
  },
  dimensions: (p) => [Number(p.wingSpan), Number(p.baseDiameter), Number(p.height)],
  python: (p) => {
    const r = Number(p.baseDiameter) / 2,
      t = Number(p.wingThickness),
      h = Number(p.height);
    const points = outline(p).map(([x, z]) => `App.Vector(${num(x)},${num(-t / 2)},${num(z)})`);
    return `# Forged wing outline with a basic metric internal helical thread.\nshape = Part.makeCone(${num(r)},${num(r * 0.8)},${num(Number(p.baseHeight))})\npoints = [${points.join(',')}]\nwing = Part.Face(Part.makePolygon(points+[points[0]])).extrude(App.Vector(0,${num(t)},0))\nother_wing = wing.copy()\nother_wing.rotate(App.Vector(0,0,0),App.Vector(0,0,1),180)\nshape = shape.fuse(wing).fuse(other_wing)\nshape = shape.cut(Part.makeCylinder(${num(internalMinorDiameter(p, Number(p.diameter)) / 2)},${num(h + 2)},App.Vector(0,0,-1)))\n${internalThreadPython(p, Number(p.diameter), h)}\nif len(shape.Solids) != 1: raise ValueError("The wings and bored body must form one solid.")\nshape.translate(App.Vector(0,0,-${num(h / 2)}))`;
  },
  notes:
    'DIN 315 American-form outline. Supplier presets use the published maximum d2/e/h/m envelope; material variants share that dimensional preset. Wing thickness, faceted curvature and body taper are representative. Internal threads use a truncated 60° basic metric profile without fit tolerances. Smooth envelope mode is available for fast layout.',
  sources: [{ label: 'Gvyntok DIN 315 drawing and dimensional ranges', url: handNutDrawings.wing }],
};
export default { ...part, presets: modulePresets };

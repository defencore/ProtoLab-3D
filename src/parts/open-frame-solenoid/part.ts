import { withParameterStates } from '../../core/parameter-states';
import { Group } from 'three';
import type { Parameters, PartDefinition, Preset } from '../../core/types';
import { n, num } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presetData from './presets.json';
import {
  annulus,
  bounds,
  box,
  component,
  cylinder,
  pythonShape,
  subtract,
  union,
} from './lib/shapes';
import type { Shape, Vec } from './lib/shapes';

export function values(p: Parameters) {
  const W = n(p, 'frameWidth'),
    D = n(p, 'frameDepth'),
    L = n(p, 'frameLength'),
    t = n(p, 'frameWall');
  const c = n(p, 'clearance'),
    plungerR = n(p, 'plungerDiameter') / 2;
  const sleeveInner = plungerR + c,
    sleeveOuter = sleeveInner + n(p, 'sleeveWall');
  const bobbinInner = sleeveOuter + c,
    bobbinOuter = bobbinInner + n(p, 'bobbinWall');
  const coilR = n(p, 'coilDiameter') / 2,
    flange = n(p, 'flangeThickness');
  return {
    W,
    D,
    L,
    t,
    c,
    plungerR,
    sleeveInner,
    sleeveOuter,
    bobbinInner,
    bobbinOuter,
    coilR,
    flange,
    flangeR: coilR + flange,
    bobbinZ: t + c,
    bobbinLength: L - 2 * (t + c),
    plungerZ: n(p, 'poleLength') + n(p, 'residualGap'),
    poleShoulderR: sleeveOuter + c + t,
  };
}
export function mountingPoints(p: Parameters): Vec[] {
  const v = values(p);
  const xs =
    p.mountPattern === 'four-hole' ? [-n(p, 'mountPitchX') / 2, n(p, 'mountPitchX') / 2] : [0];
  return xs.flatMap((x) =>
    [-1, 1].map((sign): Vec => [x, -v.D / 2 - 1, v.L / 2 + (sign * n(p, 'mountPitchZ')) / 2]),
  );
}
function frameShape(p: Parameters): Shape {
  const v = values(p);
  return subtract(
    box([v.W, v.D, v.L], [-v.W / 2, -v.D / 2, 0]),
    box([v.W + 2, v.D + 1 - v.t, v.L - 2 * v.t], [-v.W / 2 - 1, -v.D / 2 + v.t, v.t]),
    cylinder(v.sleeveOuter + v.c, v.L + 2, [0, 0, -1]),
    ...mountingPoints(p).map((origin) =>
      cylinder(n(p, 'mountHoleDiameter') / 2, v.t + 2, origin, 'y'),
    ),
  );
}
export type Component = { shape: Shape; label: string; color: number; shift: Vec };
export function assembly(p: Parameters, state: string): Component[] {
  const v = values(p),
    exploded = state === 'exploded',
    spread = v.W * 1.4;
  const components: Component[] = [
    { shape: frameShape(p), label: 'Steel C-frame', color: 0x8e979f, shift: [0, 0, 0] },
  ];
  if (state === 'body') return components;
  components.push(
    {
      shape: union(
        annulus(v.bobbinOuter, v.bobbinInner, v.bobbinLength, v.bobbinZ),
        annulus(v.flangeR, v.bobbinInner, v.flange, v.bobbinZ),
        annulus(v.flangeR, v.bobbinInner, v.flange, v.bobbinZ + v.bobbinLength - v.flange),
      ),
      label: 'Coil bobbin',
      color: 0x303740,
      shift: [exploded ? spread : 0, 0, 0],
    },
    {
      shape: annulus(v.coilR, v.bobbinOuter, v.bobbinLength - 2 * v.flange, v.bobbinZ + v.flange),
      label: 'Copper winding envelope',
      color: 0xba673c,
      shift: [exploded ? 2 * spread : 0, 0, 0],
    },
    {
      shape: annulus(v.sleeveOuter, v.sleeveInner, v.L, 0),
      label: 'Guide sleeve',
      color: 0xabb5bc,
      shift: [exploded ? -spread : 0, 0, 0],
    },
    {
      shape: union(
        cylinder(v.poleShoulderR, v.t, [0, 0, -v.t]),
        cylinder(v.plungerR, n(p, 'poleLength') + 0.1, [0, 0, -0.1]),
      ),
      label: 'Fixed pole',
      color: 0x737d87,
      shift: [exploded ? -2 * spread : 0, 0, 0],
    },
  );
  let plunger: Shape = cylinder(v.plungerR, n(p, 'plungerLength'), [0, 0, v.plungerZ]);
  if (p.includePushRod === true)
    plunger = union(
      plunger,
      cylinder(n(p, 'pushRodDiameter') / 2, n(p, 'pushRodLength') + 0.1, [
        0,
        0,
        v.plungerZ + n(p, 'plungerLength') - 0.1,
      ]),
    );
  components.push({
    shape: plunger,
    label: p.includePushRod === true ? 'Sliding plunger with push rod' : 'Sliding plunger',
    color: 0xc0c7ce,
    shift: [0, 0, exploded ? v.L + v.W : state === 'retracted' ? 0 : n(p, 'stroke')],
  });
  return components;
}
const part: PartDefinition = {
  id: 'open-frame-solenoid',
  name: 'Open-frame solenoid',
  category: 'MOTORS & ACTUATORS',
  subgroup: 'SOLENOIDS',
  icon: 'magnet',
  description:
    'An open steel C-frame, visible coil and guided sliding plunger with editable mounting holes and travel.',
  keywords: [
    'solenoid',
    'open frame',
    'electromagnet',
    'linear actuator',
    'pull',
    'push rod',
    'coil',
    'соленоїд',
    'соленоид',
    'електромагніт',
  ],
  complexity: 'Six independent components',
  parameters,
  defaults,
  presets: presetData as Preset[],
  presetMatchKeys: ['frameWidth', 'frameDepth', 'frameLength', 'plungerDiameter', 'stroke'],
  states: [
    {
      id: 'extended',
      label: 'Extended',
      description: 'Plunger moved outward by the chosen stroke; frame and coil remain fixed.',
    },
    {
      id: 'retracted',
      label: 'Retracted',
      description: 'Plunger approaches the fixed pole with the selected residual gap.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Frame, bobbin, winding, sleeve, pole and plunger separated for inspection.',
    },
    {
      id: 'body',
      label: 'Frame only',
      description: 'Single steel C-frame with real guide and rear mounting holes.',
    },
  ],
  validate(p) {
    const v = values(p),
      errors: string[] = [];
    if (v.L <= 2 * v.t + 2 * v.c + 2 * v.flange + 1)
      errors.push('Frame length must leave at least 1 mm of winding between the bobbin flanges.');
    if (v.flangeR + v.c >= v.W / 2 || v.flangeR + v.c >= v.D / 2 - v.t)
      errors.push('Bobbin flanges must fit within the frame width and clear its rear wall.');
    if (v.coilR <= v.bobbinOuter + 0.5)
      errors.push(
        'Winding diameter must leave more than 0.5 mm of copper outside the bobbin tube.',
      );
    if (v.poleShoulderR + 0.5 >= Math.min(v.W, v.D) / 2)
      errors.push('Fixed-pole shoulder must fit inside the frame footprint.');
    if (n(p, 'poleLength') <= v.t || v.plungerZ >= v.L - v.t)
      errors.push(
        'Fixed pole must extend past the lower yoke and leave room for the moving plunger.',
      );
    if (v.plungerZ + n(p, 'plungerLength') < v.L + 1)
      errors.push('Retracted plunger must protrude at least 1 mm above the guide sleeve.');
    if (v.L - v.plungerZ - n(p, 'stroke') < Math.max(2, n(p, 'plungerDiameter')))
      errors.push(
        'Full stroke must retain at least one plunger diameter (and 2 mm) of guide engagement.',
      );
    const hole = n(p, 'mountHoleDiameter'),
      pitchZ = n(p, 'mountPitchZ');
    if (pitchZ <= hole + 0.5 || pitchZ + hole >= v.L - 2 * v.t - 1)
      errors.push('Rear mounting holes need separate webs and must fit between the end yokes.');
    if (hole >= v.W - 1)
      errors.push('Rear mounting holes must retain material at both frame edges.');
    if (
      p.mountPattern === 'four-hole' &&
      (n(p, 'mountPitchX') <= hole + 0.5 || n(p, 'mountPitchX') + hole >= v.W - 1)
    )
      errors.push(
        'Four-hole mounting pitch must leave material between holes and at the frame edges.',
      );
    if (p.includePushRod === true && n(p, 'pushRodDiameter') > n(p, 'plungerDiameter'))
      errors.push('Push rod diameter must not exceed the plunger diameter.');
    return errors;
  },
  buildGeometry(p, state) {
    const group = new Group();
    for (const item of assembly(p, state))
      group.add(component(item.shape, item.label, item.color, item.shift));
    return group;
  },
  python(p, state) {
    const lines = [
      '# Open-frame solenoid: millimetres, fixed frame datum z=0, movement along +Z.',
      'components = []',
      'component_labels = []',
      'component_colors = []',
    ];
    for (const item of assembly(p, state)) {
      lines.push(`item = ${pythonShape(item.shape)}.removeSplitter()`);
      if (item.shift.some((v) => v !== 0))
        lines.push(`item.translate(App.Vector(${item.shift.map(num).join(',')}))`);
      lines.push(
        'if item.isNull() or not item.isValid() or len(item.Solids) != 1: raise ValueError("Solenoid component failed solid validation.")',
        'components.append(item)',
        `component_labels.append(${JSON.stringify(item.label)})`,
        `component_colors.append((${[(item.color >> 16) & 255, (item.color >> 8) & 255, item.color & 255].map((v) => num(v / 255)).join(',')}))`,
      );
    }
    lines.push('shape = Part.makeCompound(components)');
    return lines.join('\n');
  },
  dimensions(p, state) {
    const componentBounds = assembly(p, state).map((item) =>
      bounds(item.shape).map((point) => point.map((v, i) => v + item.shift[i])),
    );
    return [0, 1, 2].map(
      (axis) =>
        Math.max(...componentBounds.map((bb) => bb[1][axis])) -
        Math.min(...componentBounds.map((bb) => bb[0][axis])),
    ) as Vec;
  },
  notes:
    'Prototype mechanical envelopes. The winding is a solid annulus, not individual insulated turns. Presets are design examples without manufacturer, voltage, force or thermal ratings. The fixed pole retains a positive gap from the retracted plunger; the extended plunger remains engaged in the guide. Mounting holes are plain through holes. The optional rod is fused to the moving plunger. The model does not predict electrical performance.',
};
export default withParameterStates(part, {
  retracted: ['stroke'],
  body: [
    'coilDiameter',
    'bobbinWall',
    'flangeThickness',
    'plungerLength',
    'poleLength',
    'residualGap',
    'stroke',
    'includePushRod',
  ],
});

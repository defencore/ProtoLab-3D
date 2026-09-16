import { withParameterStates } from '../../core/parameter-states';
import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { shaftBoreDefaults, shaftBoreParameters } from './lib/core/shaft-bore';
import { Box3, Group, Mesh, MeshStandardMaterial, Vector2, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../../core/types';
import { n, num, numberParameter } from '../../core/geometry';
import { disposeModel, loftMesh } from '../../core/mechanical';
import {
  gearGeometry,
  gearPython,
  gearValues,
  validateGear,
  type GearLayer,
} from './lib/core/gears';

const defaults = {
  ...shaftBoreDefaults(),
  module: 1.5,
  starts: 1,
  teeth: 40,
  wormDiameter: 15,
  wormLength: 32,
  wheelWidth: 10,
  bore: 8,
  pressureAngle: 20,
  backlash: 0.15,
  hand: 'right',
  rotation: 0,
  centerClearance: 1,
};
export function wormValues(p: Parameters) {
  const m = n(p, 'module'),
    starts = n(p, 'starts'),
    teeth = n(p, 'teeth'),
    pitch = Math.PI * m,
    lead = pitch * starts,
    wormR = n(p, 'wormDiameter') / 2;
  const gamma = Math.atan(lead / (Math.PI * 2 * wormR)),
    alpha = Math.atan(Math.tan((n(p, 'pressureAngle') * Math.PI) / 180) / Math.cos(gamma));
  const wheelP = {
    ...p,
    module: m * Math.cos(gamma),
    teeth,
    pressureAngle: n(p, 'pressureAngle'),
    backlash: n(p, 'backlash'),
    faceWidth: n(p, 'wheelWidth'),
    bore: n(p, 'bore'),
    boreAngle:
      n(p, 'boreAngle') - ((p.hand === 'left' ? -1 : 1) * n(p, 'rotation') * starts) / teeth,
    hub: false,
    hubDiameter: 1,
    hubLength: n(p, 'wheelWidth'),
    helixAngle: (gamma * 180) / Math.PI,
  };
  return {
    m,
    starts,
    teeth,
    pitch,
    lead,
    wormR,
    root: wormR - 1.25 * m,
    tip: wormR + m,
    length: n(p, 'wormLength'),
    gamma,
    alpha,
    wheelP,
    wheel: gearValues(wheelP, true),
    hand: p.hand === 'left' ? -1 : 1,
    phase: -Math.PI / 2 + (n(p, 'rotation') * Math.PI) / 180,
    distance: wormR + (m * teeth) / 2 + n(p, 'centerClearance'),
    halfRoot: pitch / 4 + 1.25 * m * Math.tan(alpha) - n(p, 'backlash') / 4,
    halfTip: pitch / 4 - m * Math.tan(alpha) - n(p, 'backlash') / 4,
  };
}
function wormSections(p: Parameters) {
  const v = wormValues(p),
    outline: Vector2[] = [];
  const point = (r: number, a: number) => new Vector2(r * Math.cos(a), r * Math.sin(a));
  const rootAngle = (Math.PI * 2 * v.halfRoot) / v.lead,
    tipAngle = (Math.PI * 2 * v.halfTip) / v.lead;
  for (let start = 0; start < v.starts; start++) {
    const center = (Math.PI * 2 * start) / v.starts;
    for (let i = 0; i <= 8; i++)
      outline.push(
        point(
          v.root + ((v.tip - v.root) * i) / 8,
          center - rootAngle + ((rootAngle - tipAngle) * i) / 8,
        ),
      );
    for (let i = 1; i <= 8; i++)
      outline.push(point(v.tip, center - tipAngle + (2 * tipAngle * i) / 8));
    for (let i = 1; i <= 8; i++)
      outline.push(
        point(
          v.tip - ((v.tip - v.root) * i) / 8,
          center + tipAngle + ((rootAngle - tipAngle) * i) / 8,
        ),
      );
    const next = (Math.PI * 2 * (start + 1)) / v.starts - rootAngle;
    for (let i = 1; i < 24; i++)
      outline.push(point(v.root, center + rootAngle + ((next - center - rootAngle) * i) / 24));
  }
  const layers = Math.max(24, Math.ceil((v.length / v.lead) * 64));
  return Array.from({ length: layers + 1 }, (_, i) => {
    const z = v.length * (i / layers - 0.5),
      angle = v.phase + (v.hand * 2 * Math.PI * z) / v.lead;
    return { z, points: outline.map((point) => point.clone().rotateAround(new Vector2(), angle)) };
  });
}
function wheelLayers(p: Parameters): GearLayer[] {
  const v = wormValues(p),
    phase =
      Math.PI / 2 +
      Math.PI / v.teeth -
      (((v.hand * n(p, 'rotation') * Math.PI) / 180) * v.starts) / v.teeth;
  return Array.from({ length: 9 }, (_, i) => {
    const z = n(p, 'wheelWidth') * (i / 8 - 0.5);
    const throatRise = v.wormR - Math.sqrt(v.wormR * v.wormR - z * z);
    return {
      z,
      scale: 1 + throatRise / v.wheel.pitchRadius,
      angle: phase + (v.hand * z * Math.tan(v.gamma)) / v.wheel.pitchRadius,
    };
  });
}
function build(p: Parameters, state: string): Group {
  const v = wormValues(p),
    group = new Group();
  if (state !== 'worm') {
    const wheel = gearGeometry(v.wheel, wheelLayers(p)).children[0] as Mesh;
    wheel.name = 'Throated worm wheel';
    wheel.material = (wheel.material as MeshStandardMaterial).clone();
    (wheel.material as MeshStandardMaterial).color.setHex(0xb99650);
    group.add(wheel);
  }
  if (state !== 'wheel') {
    const worm = loftMesh(wormSections(p));
    worm.name = 'Helical worm';
    worm.rotation.y = Math.PI / 2;
    worm.position.y = state === 'worm' ? 0 : v.distance + (state === 'exploded' ? v.tip * 2 : 0);
    group.add(worm);
  }
  return group;
}
const part: PartDefinition = {
  id: 'worm-drive',
  name: 'Worm drive',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'GEARS & GEAR DRIVES',
  icon: 'gear',
  complexity: 'Worm + wheel',
  description:
    'A modeled helical worm and a throated wheel on perpendicular, offset axes, with linked rotation and independent exports.',
  keywords: [
    'worm',
    'worm wheel',
    'worm gear',
    'reducer',
    'right angle',
    'transmission',
    'screw gear',
  ],
  parameters: [
    numberParameter('module', 'Axial module', 'mx', 'Transmission', 0.3, 5, 0.1),
    { ...numberParameter('starts', 'Worm starts', 'z1', 'Transmission', 1, 4, 1), unit: '' },
    {
      ...numberParameter('teeth', 'Wheel tooth count', 'z2', 'Transmission', 18, 100, 1),
      unit: '',
    },
    numberParameter('wormDiameter', 'Worm pitch diameter', 'd1', 'Worm', 4, 80),
    numberParameter('wormLength', 'Worm length', 'L1', 'Worm', 8, 160),
    numberParameter('wheelWidth', 'Wheel face width', 'b2', 'Wheel', 2, 50),
    {
      ...numberParameter('bore', 'Wheel shaft bore', 'd', 'Wheel', 0, 80),
      description:
        'Diameter for round / D / keyed holes; across flats for hex / square; inscribed diameter for custom polygons. Enter 0 for a solid blank.',
    },
    ...shaftBoreParameters('Wheel shaft connection', '', 'Wheel'),
    {
      ...numberParameter(
        'pressureAngle',
        'Normal pressure angle',
        'αn',
        'Transmission',
        14.5,
        25,
        0.5,
      ),
      unit: '°',
    },
    numberParameter('backlash', 'Tooth thinning allowance', 'j', 'Transmission', 0, 1, 0.01),
    numberParameter(
      'centerClearance',
      'Additional center clearance',
      'c',
      'Transmission',
      0,
      3,
      0.05,
    ),
    {
      key: 'hand',
      label: 'Worm hand',
      type: 'select',
      group: 'Worm',
      options: [
        { value: 'right', label: 'Right hand' },
        { value: 'left', label: 'Left hand' },
      ],
    },
    {
      ...numberParameter('rotation', 'Worm rotation', 'θ', 'Position', 0, 360, 5),
      unit: '°',
      description:
        'Wheel rotation follows the starts-to-teeth ratio. Contact surfaces remain a prototype approximation.',
    },
  ],
  defaults,
  presets: modulePresets,
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Worm and wheel at the calculated shaft center distance.',
    },
    {
      id: 'exploded',
      label: 'Separated',
      description: 'Moves the worm away from the wheel for inspection.',
    },
    {
      id: 'worm',
      label: 'Worm only',
      description: 'Independent worm export, centered on its shaft.',
    },
    { id: 'wheel', label: 'Wheel only', description: 'Independent throated wheel export.' },
  ],
  validate(p) {
    const v = wormValues(p),
      errors = validateGear(v.wheelP, true);
    if (!Number.isInteger(v.starts) || !Number.isInteger(v.teeth))
      errors.push('Starts and tooth count must be integers.');
    if (v.root <= 0.5 || v.wormR < v.m * 3)
      errors.push('Increase the worm pitch diameter to leave a sound thread core.');
    if (v.halfTip <= v.m * 0.05 || v.halfRoot >= v.pitch / 2)
      errors.push('Pressure angle and backlash must leave flat, separated thread crests.');
    if (n(p, 'wheelWidth') >= v.wormR * 1.5)
      errors.push(
        'Wheel face width must be less than 75% of the worm pitch diameter for the throat.',
      );
    if (v.length < v.lead || v.length / v.lead > 12)
      errors.push('Use between one and twelve worm turns within the chosen length.');
    if (v.length < n(p, 'wheelWidth') + 2 * v.m)
      errors.push('Worm length must extend beyond the wheel face.');
    return errors;
  },
  buildGeometry: build,
  python(p, state) {
    const v = wormValues(p),
      startZ = -v.length / 2 - v.lead,
      radialExtra = v.m * 0.1;
    const grooveRoot = v.pitch / 2 - v.halfRoot,
      grooveTip = v.pitch / 2 - v.halfTip + radialExtra * Math.tan(v.alpha);
    const worm = `worm = Part.makeCylinder(${num(v.tip)},${num(v.length)},App.Vector(0,0,${num(-v.length / 2)}))\nfor start in range(${v.starts}):\n    path = Part.Wire(Part.makeLongHelix(${num(v.lead)},${num(v.length + 2 * v.lead)},${num(v.root)},0,${v.hand < 0 ? 'True' : 'False'}).Edges)\n    points = [App.Vector(${num(v.root)},0,${num(-grooveRoot)}),App.Vector(${num(v.tip + radialExtra)},0,${num(-grooveTip)}),App.Vector(${num(v.tip + radialExtra)},0,${num(grooveTip)}),App.Vector(${num(v.root)},0,${num(grooveRoot)})]\n    groove = path.makePipeShell([Part.makePolygon(points + [points[0]])],True,True)\n    groove.rotate(App.Vector(0,0,0),App.Vector(0,0,1),${num(((v.phase + Math.PI / v.starts + (v.hand * 2 * Math.PI * startZ) / v.lead) * 180) / Math.PI)} + start * ${num(360 / v.starts)})\n    groove.translate(App.Vector(0,0,${num(startZ)}))\n    worm = worm.cut(groove)\nworm = worm.removeSplitter()\nworm.rotate(App.Vector(0,0,0),App.Vector(0,1,0),90)\nworm.translate(App.Vector(0,${num(state === 'worm' ? 0 : v.distance + (state === 'exploded' ? v.tip * 2 : 0))},0))`;
    if (state === 'worm') return worm + '\nshape = worm';
    const wheel = gearPython(v.wheel, wheelLayers(p)) + '\nwheel = shape';
    return state === 'wheel'
      ? wheel
      : wheel +
          '\n' +
          worm +
          '\nshape = Part.makeCompound([wheel,worm])\ncomponent_labels = ["Worm wheel", "Worm"]';
  },
  dimensions(p, state) {
    const model = build(p, state);
    try {
      return new Box3().setFromObject(model).getSize(new Vector3()).toArray() as [
        number,
        number,
        number,
      ];
    } finally {
      disposeModel(model);
    }
  },
  notes:
    'Axial module sets pitch and lead; ratio = wheel teeth / worm starts; nominal center distance = (worm pitch diameter + module × wheel teeth) / 2. The worm has modeled trapezoidal helical flanks. The wheel uses a sampled concave throat with inclined involute teeth; it is not a conjugate hob-generated tooth surface. Use this pair for layout and motion studies, not for a rated or interference-free transmission. No shafts, bearings, lubricant film or self-locking prediction.',
  sources: [
    {
      label: 'KHK · Worm gear dimensions and lead angle',
      url: 'https://khkgears.net/gear-knowledge/gear-technical-reference/calculation-gear-dimensions/',
    },
    {
      label: 'KHK · Worm gear pairs',
      url: 'https://khkgears.net/product-category/worm-gear-pair/',
    },
  ],
};
export default withParameterStates(
  { ...part, presets: modulePresets },
  {
    worm: ['teeth', 'wheelWidth', 'bore', 'boreShape', 'centerClearance'],
    wheel: ['wormLength', 'centerClearance'],
  },
);

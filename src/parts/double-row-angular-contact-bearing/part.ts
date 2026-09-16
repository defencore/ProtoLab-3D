import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Box3, Group, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../../core/types';
import {
  annulusPython,
  compoundPython,
  n,
  num,
  numberParameter,
  ring,
  sphere,
} from '../../core/geometry';
import { disposeModel } from '../../core/mechanical';
import { cageMesh, cagePython, type CageLayout } from './lib/parts/bearing-cage';
import {
  envelopeParameters,
  turnedMesh,
  turnedPython,
  validateEnvelope,
  type TurnedProfile,
} from './lib/parts/motion-bearing-utils';

function values(p: Parameters) {
  const r = n(p, 'bore') / 2,
    R = n(p, 'outer') / 2,
    width = n(p, 'width'),
    gap = R - r,
    radius = Math.min(gap * 0.26, width * 0.18),
    angle = (n(p, 'contactAngle') * Math.PI) / 180;
  return {
    r,
    R,
    width,
    gap,
    radius,
    angle,
    pitch: (r + R) / 2,
    rowZ: width * 0.23,
    grooveRadius: radius * 1.1,
    grooveShift: radius * 0.075,
    sealThickness: Math.min(width * 0.032, gap * 0.055),
    sealInner: r + gap * (0.38 + 0.07 * Math.sin(angle)),
    sealOuter: r + gap * (0.62 + 0.07 * Math.sin(angle)),
  };
}

/** Opposite groove-centre offsets and shoulders form a back-to-back contact layout. */
export function doubleAngularRaceProfiles(p: Parameters): TurnedProfile[] {
  const v = values(p),
    inner: TurnedProfile = [],
    outer: TurnedProfile = [];
  for (let i = 0; i <= 128; i++) {
    const z = v.width * (i / 128 - 0.5),
      shoulder = Math.max(-1, Math.min(1, (Math.abs(z) - v.rowZ) / v.radius)),
      rise = v.gap * 0.07 * Math.sin(v.angle) * shoulder;
    let innerR = v.r + v.gap * 0.37 + rise,
      outerR = v.r + v.gap * 0.63 + rise;
    for (const side of [-1, 1]) {
      // The groove circles contain the balls with a small positive prototype clearance.
      const radialOffset = v.grooveShift * Math.cos(v.angle),
        axialOffset = side * v.grooveShift * Math.sin(v.angle),
        innerDistance = z - (side * v.rowZ - axialOffset),
        outerDistance = z - (side * v.rowZ + axialOffset);
      if (Math.abs(innerDistance) < v.grooveRadius)
        innerR = Math.min(
          innerR,
          v.pitch + radialOffset - Math.sqrt(v.grooveRadius ** 2 - innerDistance ** 2),
        );
      if (Math.abs(outerDistance) < v.grooveRadius)
        outerR = Math.max(
          outerR,
          v.pitch - radialOffset + Math.sqrt(v.grooveRadius ** 2 - outerDistance ** 2),
        );
    }
    const chamfer = Math.min(v.gap, v.width) * 0.025,
      edge = Math.max(0, Math.abs(z) - (v.width / 2 - chamfer));
    inner.push([innerR - edge, z]);
    outer.push([outerR + edge, z]);
  }
  return [
    [[v.r, -v.width / 2], ...inner, [v.r, v.width / 2], [v.r, -v.width / 2]],
    [[v.R, -v.width / 2], [v.R, v.width / 2], ...outer.reverse(), [v.R, -v.width / 2]],
  ];
}

function cage(p: Parameters, side: number): CageLayout {
  const v = values(p);
  return {
    pitch: v.pitch,
    radius: v.radius,
    count: n(p, 'elements'),
    center: side * v.rowZ,
    halfWindow: v.radius * 1.045,
    band: v.radius * 0.09,
    rowPhase: side > 0 ? Math.PI / n(p, 'elements') : 0,
  };
}

function closureSides(p: Parameters): number[] {
  const closure = String(p.closure);
  return closure === 'open' ? [] : closure.endsWith('-one') ? [1] : [-1, 1];
}

const defaults = {
  bore: 20,
  outer: 47,
  width: 20.6,
  elements: 10,
  contactAngle: 30,
  closure: 'open',
};

const part: PartDefinition = {
  id: 'double-row-angular-contact-bearing',
  name: 'Double-row angular contact ball bearing',
  category: 'BEARINGS & SEALS',
  subgroup: 'BALL BEARINGS',
  icon: 'bearing',
  complexity: 'Opposed angular contact rows',
  standard: 'Supplier envelope',
  description:
    'Two opposing ball rows share continuous races, with asymmetric shoulders, individual cages and optional seals or shields.',
  keywords: ['3000', '3200', '3300', '5200', '5300', 'angular', 'double row', 'back to back'],
  defaults,
  presets: modulePresets,
  presetMatchKeys: ['bore', 'outer', 'width'],
  parameters: [
    ...envelopeParameters,
    {
      ...numberParameter(
        'elements',
        'Illustrative balls per row',
        'n',
        'Internal layout',
        4,
        64,
        1,
      ),
      unit: '',
      description:
        'Each of the two rows has this many balls; supplier envelopes do not verify their count.',
    },
    {
      ...numberParameter(
        'contactAngle',
        'Illustrative contact angle',
        'α',
        'Internal layout',
        10,
        45,
        1,
      ),
      unit: '°',
      description:
        'Controls opposing groove offsets and shoulders. Actual angles vary by manufacturer and design.',
    },
    {
      key: 'closure',
      label: 'Closure',
      type: 'select',
      group: 'Closure',
      options: [
        { value: 'open', label: 'Open' },
        { value: 'rubber', label: 'Rubber seals · both sides' },
        { value: 'metal', label: 'Metal shields · both sides' },
        { value: 'rubber-one', label: 'Rubber seal · one side' },
        { value: 'metal-one', label: 'Metal shield · one side' },
      ],
    },
  ],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'The configured supplier envelope with both angular contact rows.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Continuous races and closures separated axially to expose both ball cages.',
    },
    {
      id: 'internals',
      label: 'Internal mechanism',
      description:
        'The outer race and closures are hidden to reveal the opposed rows and inner race.',
    },
  ],
  validate(p) {
    const errors = validateEnvelope(p),
      v = values(p),
      count = n(p, 'elements');
    if (!Number.isInteger(count)) errors.push('The ball count must be an integer.');
    if (2 * v.pitch * Math.sin(Math.PI / count) <= 2.3 * v.radius)
      errors.push('Reduce the balls per row to leave room for cage windows.');
    if (v.width > v.gap * 7 || v.width < v.gap * 0.5)
      errors.push(
        'This double-row layout requires an axial width between 0.5 and 7 times the radial envelope.',
      );
    const profiles = doubleAngularRaceProfiles(p);
    if (Math.min(...profiles[0].slice(1, -2).map(([r]) => r)) <= v.r + v.gap * 0.08)
      errors.push('The inner race must retain a continuous wall around the bore.');
    if (Math.max(...profiles[1].slice(2, -1).map(([r]) => r)) >= v.R - v.gap * 0.08)
      errors.push('The outer race must retain a continuous wall around both tracks.');
    return errors;
  },
  buildGeometry(p, state) {
    const group = new Group(),
      v = values(p),
      profiles = doubleAngularRaceProfiles(p),
      offset = state === 'exploded' ? v.width * 1.1 : 0;
    const inner = turnedMesh(profiles[0]);
    inner.name = 'Continuous inner angular race';
    inner.position.z = -offset;
    group.add(inner);
    if (state !== 'internals') {
      const outer = turnedMesh(profiles[1]);
      outer.name = 'Continuous outer angular race';
      outer.position.z = offset;
      group.add(outer);
    }
    for (const side of [-1, 1]) {
      const layout = cage(p, side),
        shell = cageMesh(layout);
      shell.name = 'Angular ball cage';
      group.add(shell);
      for (let i = 0; i < layout.count; i++) {
        const angle = (i * Math.PI * 2) / layout.count + layout.rowPhase,
          ball = sphere(v.radius);
        ball.name = side < 0 ? 'Lower angular ball' : 'Upper angular ball';
        ball.position.set(v.pitch * Math.cos(angle), v.pitch * Math.sin(angle), layout.center);
        group.add(ball);
      }
    }
    if (state !== 'internals')
      for (const side of closureSides(p)) {
        const rubber = String(p.closure).startsWith('rubber'),
          seal = ring(v.sealOuter, v.sealInner, v.sealThickness, rubber ? 0x292f38 : 0xb0b5bc);
        seal.name = rubber ? 'Rubber seal' : 'Metal shield';
        seal.position.z =
          side * (state === 'exploded' ? v.width * 2 : (v.width - v.sealThickness) / 2);
        group.add(seal);
      }
    return group;
  },
  python(p, state) {
    const v = values(p),
      profiles = doubleAngularRaceProfiles(p),
      offset = state === 'exploded' ? v.width * 1.1 : 0,
      setup: string[] = [],
      shapes = [turnedPython(profiles[0].map(([r, z]) => [r, z - offset]))];
    if (state !== 'internals')
      shapes.push(turnedPython(profiles[1].map(([r, z]) => [r, z + offset])));
    for (const side of [-1, 1]) {
      const layout = cage(p, side),
        name = side < 0 ? 'lower_cage' : 'upper_cage';
      setup.push(cagePython(layout, name));
      shapes.push(name);
      for (let i = 0; i < layout.count; i++) {
        const angle = (i * Math.PI * 2) / layout.count + layout.rowPhase;
        shapes.push(
          `Part.makeSphere(${num(v.radius)},App.Vector(${num(v.pitch * Math.cos(angle))},${num(v.pitch * Math.sin(angle))},${num(layout.center)}))`,
        );
      }
    }
    if (state !== 'internals')
      for (const side of closureSides(p)) {
        const center =
          side * (state === 'exploded' ? v.width * 2 : (v.width - v.sealThickness) / 2);
        shapes.push(
          annulusPython(v.sealOuter, v.sealInner, v.sealThickness, center - v.sealThickness / 2),
        );
      }
    return [...setup, compoundPython(shapes)].join('\n');
  },
  dimensions(p, state) {
    const model = part.buildGeometry(p, state),
      size = new Box3().setFromObject(model, true).getSize(new Vector3());
    disposeModel(model);
    return [size.x, size.y, size.z];
  },
  notes:
    'The common back-to-back double-row angular contact layout follows SKF and NSK sections. Only marked supplier dimensions and closure designations are verified. Ball count and size, contact angle, groove curvature, cage windows, sealing lips, filling slots, race chamfers and clearances are illustrative prototype geometry. Production filling-slot and split-ring variants differ internally; explicit split-ring, snap-ring and automotive assemblies require separate models. This model does not reproduce preload, manufacturing tolerances or load capacity.',
  sources: [
    {
      label: 'Promtehimport · angular contact ball bearings',
      url: 'https://promtehimport.com.ua/radialno-uporni-kulkovi-pidshipniki-c36/',
    },
    {
      label: 'NSK · double-row angular contact construction',
      url: 'https://www.nsk.com/tools-resources/abc-bearings/angular-contact-ball-bearings/',
    },
    {
      label: 'SKF · double-row angular contact sections, page 27',
      url: 'https://cdn.skfmediahub.skf.com/api/public/0901d19680054a8a/pdf_preview_medium/0901d19680054a8a_pdf_preview_medium.pdf',
    },
  ],
};

export default { ...part, presets: modulePresets };

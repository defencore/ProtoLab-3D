import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { defaults, parameters } from './configurator';
import { layout, tr8 } from './lib/layout';
import { housingLayout } from './lib/housing';
import { geometry, python, dimensions, pieces } from './lib/model';
import { fabricationFiles } from './lib/fabrication';
import product from './product.json';
import presets from './presets.json';
const states = [
  {
    id: 'assembled',
    label: 'Assembly',
    description: 'Compact split housing, two output bearings and a four-start screw.',
  },
  {
    id: 'internals',
    label: 'Bearing and sleeve stack',
    description:
      'Hide the carrier to inspect both output bearings, the square seat and retaining rings.',
  },
  {
    id: 'negative-limit',
    label: 'Negative travel limit',
    description: 'Minus half the configured travel; both drive and output move.',
  },
  {
    id: 'positive-limit',
    label: 'Positive travel limit',
    description: 'Plus half the configured travel; both drive and output move.',
  },
  {
    id: 'exploded',
    label: 'Exploded assembly',
    description: 'Inspect separate physical components along their assembly axes.',
  },
  {
    id: 'sector',
    label: 'Finished sector',
    description: 'Tooth-finished 3 mm laser blank with a square central opening.',
  },
  {
    id: 'sleeve',
    label: 'Turned sleeve',
    description:
      'Large and small bearing journals, square seat and two actual retaining-ring grooves.',
  },
  {
    id: 'housing-open',
    label: 'Open housing',
    description: 'Lift the upper housing half to inspect the gear pocket and split worm seats.',
  },
  {
    id: 'housing-base',
    label: 'Housing base',
    description: 'Lower half with rear bearing seat and open captive nut pockets.',
  },
  {
    id: 'housing-lid',
    label: 'Housing lid',
    description: 'Upper half with the large output bearing seat and flush screw head pockets.',
  },
];
const part: PartDefinition = {
  id: 'worm-fin-actuator',
  name: 'TR8×8(P2) worm-sector actuator',
  product: product as ProductProfile,
  category: 'MOTORS & ACTUATORS',
  subgroup: 'MOTOR ASSEMBLIES',
  icon: 'gear',
  preview: 'worker',
  complexity: 'TR8x8 · two-bearing stepped sleeve',
  description:
    'Low-profile four-start Tr8x8 drive, two unequal flanged output bearings, a turned square-drive sleeve and a laser blank with finished tooth flanks. Two machinable or printable housing halves; fin platform and blade excluded.',
  keywords: [
    'fin mount',
    'fin rotation',
    'TR8x8',
    'Tr8x8(P2)',
    'four start',
    'laser sector',
    'square drive',
    'F6802ZZ',
    'F6804ZZ',
    'F688ZZ',
    'F685ZZ',
    'rotary actuator',
    '\u043f\u043b\u0430\u0432\u043d\u0438\u043a',
    '\u043a\u0440\u0456\u043f\u043b\u0435\u043d\u043d\u044f \u043f\u043b\u0430\u0432\u043d\u0438\u043a\u0430',
    '\u043f\u043e\u0432\u043e\u0440\u043e\u0442 \u043f\u043b\u0430\u0432\u043d\u0438\u043a\u0430',
    '\u0447\u0435\u0440\u0432’\u044f\u0447\u043d\u0438\u0439',
    '\u0447\u0435\u0440\u0432\u044f\u0447\u043d\u0438\u0439',
    '\u0432\u0442\u0443\u043b\u043a\u0430',
    '\u0444\u043b\u0430\u043d\u0446\u0435\u0432\u0456 \u043f\u0456\u0434\u0448\u0438\u043f\u043d\u0438\u043a\u0438',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states,
  presetMatchKeys: ['frontBearing', 'travel'],
  identityParameters: (p) => ({ ...p, outputAngle: 0 }),
  updateParameters(p, key) {
    const updated = { ...p };
    if (key === 'travel')
      updated.outputAngle = Math.max(
        -Number(p.travel) / 2,
        Math.min(Number(p.travel) / 2, Number(p.outputAngle)),
      );
    if (key !== 'driveStubLength') {
      const minimumStub = Math.ceil(housingLayout(updated).xHalf + 3 - layout(updated).wormEnd);
      if (Number.isFinite(minimumStub))
        updated.driveStubLength = Math.max(
          Number(updated.driveStubLength),
          Math.min(25, minimumStub),
        );
    }
    return updated;
  },
  validate(p, state) {
    const errors: string[] = [];
    if (!states.some((s) => s.id === state)) errors.push('Choose a supported model state.');
    for (const field of parameters) {
      const value = p[field.key];
      if (
        field.type === 'number' &&
        (typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < field.min! ||
          value > field.max!)
      )
        errors.push(`${field.label} must be a finite number within its range.`);
      if (field.type === 'select' && !field.options!.some((o) => o.value === value))
        errors.push(`Choose ${field.label.toLowerCase()}.`);
    }
    if (errors.length) return errors;
    const v = layout(p, state);
    if (
      v.front.outer <= v.front.bore + 3 ||
      v.front.flangeOuter <= v.front.outer + 0.4 ||
      v.front.flangeWidth >= v.front.width - 0.5
    )
      errors.push('Choose a flanged bearing with a positive body wall and flange shoulder.');
    if (v.front.bore <= v.squareAF * Math.SQRT2 + 0.2)
      errors.push('The square drive must pass through the large bearing during assembly.');
    if (v.teeth > 120)
      errors.push(
        'Reduce target turns or increase travel to stay within the 120-tooth compact layout.',
      );
    if (Math.abs(Number(p.outputAngle)) > v.travel / 2)
      errors.push('Output position must stay within half of the total travel.');
    if (v.rootDiameter <= 5.1)
      errors.push(
        'Measured thread roots must leave material for fully cleaned Ø5 bearing journals.',
      );
    if (v.driveEnd < housingLayout(p).xHalf + 3)
      errors.push('Increase the drive stub length to leave at least 3 mm outside the housing.');
    return errors;
  },
  composition(p) {
    return {
      components: pieces({ ...p, outputAngle: 0 }, 'assembled').map((i) => i.component),
      issues: [
        'The 3 mm sector is laser-cut as a blank, then its helical/enveloping flanks are finished. The DXF is not a ready-to-run flat worm wheel.',
        'Measure the purchased Tr8x8 root diameter and indicate the thread axis before turning clean Ø5 journals and DIN471 grooves.',
        'Select fits, materials, lubrication, fin loads and required life; numerical geometry and finite travel checks do not rate the transmission.',
      ],
    };
  },
  buildGeometry: geometry,
  python,
  dimensions,
  fabricationFiles,
  assessment(p) {
    const v = layout(p),
      f = (n: number) => Number(n.toFixed(3));
    return [
      `Travel ±${f(v.travel / 2)}°; ${v.teeth} equivalent teeth; ratio ${v.ratio}:1; ${f(v.actualTurns)} worm turns over full travel.`,
      `Tr8x8(P2): ${tr8.starts} starts, ${tr8.pitch} mm pitch, ${tr8.lead} mm lead. Fixed axial module ${f(v.module)} mm; sector pitch diameter ${f(v.pitchRadius * 2)} mm.`,
      `Output bearings: ${v.front.id} (${v.front.bore}×${v.front.outer}×${v.front.width}) and ${v.inner.id} (8×16×5). Worm: 2 × ${v.wormBearing.id}, turned journals Ø5.`,
      `Housing ${f(housingLayout(p).width)} × ${f(housingLayout(p).height)} × ${f(housingLayout(p).depth)} mm. Two split halves with four flush M3 case screws. Square drive 10 mm AF and two output circlips.`,
      `${v.plateThickness} mm laser blank requires tooth-flank finishing. Download the blank DXF, screw/sleeve turning drawings and component list.`,
    ];
  },
  notes:
    'Two output bearings support the stepped sleeve on opposite sides of the sector. Their opposed outward flanges bear against housing shoulders; the sleeve shoulder, selected thrust shims and two shaft circlips close the assembled axial stack. The two worm bearings use the same opposed-flange arrangement, four shaft rings and thrust washers. No separate bearing clamp covers or cover screws are required. Set actual axial play with measured shims; groove clearance and bearing internal play are not preload. The removable fin platform, its pins and its screws are excluded. Two blind M3 holes remain in the sleeve shoulder. Four countersunk M3 screws and captive nuts join the two housing halves; two integral locating bosses align them. Tr8 pitch and lead never scale with bearing choice. The swept numerical tooth surface is a finishing reference for the laser blank, not a qualified hob/tool specification or load rating. Internal M3 features and the fixed captive-nut mating screw phases are declared; Full native CAD models their helices. The 0.04 mm radial assembly allowance is not a tap-drill size. Four starts do not establish self-locking; verify holding torque for the fin load.',
  sources: [
    {
      label: 'User · requested stepped sleeve and two output bearings',
      url: 'references/worm-fin-actuator/reference-08-stepped-sleeve-section.png',
    },
    {
      label: 'User · low-profile worm fin arrangement',
      url: 'references/worm-fin-actuator/reference-07-fin-bearing-arrangement.png',
    },
    {
      label: 'User · original sector and bearing detail',
      url: 'references/worm-fin-actuator/reference-03-sector-detail.png',
    },
    {
      label: 'MakerStore · 8 mm, four-start, 8 mm lead, 2 mm pitch',
      url: 'https://makerstore.co.uk/products/8mm-metric-lead-screw-acme',
    },
    {
      label: 'SMB · F6802ZZ drawing',
      url: 'https://www.smbbearings.com/firebrick/ckeditor/plugins/upload/Uploads/Documents/bearingpdfs/F6802ZZ-flanged-thin-section-bearing-15x24x5mm.pdf',
    },
    {
      label: 'SMB · F6804ZZ drawing',
      url: 'https://www.smbbearings.com/firebrick/ckeditor/plugins/upload/Uploads/Documents/bearingpdfs/F6804ZZ-flanged-thin-section-bearing-20x32x7mm.pdf',
    },
    {
      label: 'SMB · F688ZZ drawing',
      url: 'https://www.smbbearings.com/firebrick/ckeditor/plugins/upload/Uploads/Documents/bearingpdfs/F688ZZ-flanged-miniature-bearing-8x16x5mm.pdf',
    },
    { label: 'Fitrun · F685ZZ', url: 'https://www.fitrunbearing.com/product/f685zz/' },
    { label: 'RotorClip · DIN471-10 groove', url: 'https://www.rotorclip.com/product/dsh-10/' },
    { label: 'RotorClip · DIN471-8 groove', url: 'https://www.rotorclip.com/product/dsh-8/' },
    { label: 'RotorClip · DIN471-5 groove', url: 'https://www.rotorclip.com/product/dsh-5/' },
    {
      label: 'KHK · worm wheel hobbing and contact',
      url: 'https://khkgears.net/product-category/worm-gear-pair/',
    },
  ],
};
export default part;

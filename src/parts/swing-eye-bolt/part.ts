import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import type { Parameters, PartDefinition } from '../../core/types';
import {
  eyeOutline,
  profileHeadDimensions,
  profileHeadGeometry,
  profileHeadPython,
  type ProfileHead,
} from './lib/core/special-fasteners';

const defaults: Parameters = {
  diameter: 8,
  length: 50,
  pitch: 1.25,
  eyeBore: 8,
  eyeDiameter: 18,
  headThickness: 9,
  threadSpan: 'partial',
  threadLength: 22,
};
function head(p: Parameters): ProfileHead {
  const profile = eyeOutline(Number(p.eyeDiameter), Number(p.eyeBore), Number(p.diameter) * 0.55);
  return {
    outline: profile.outline,
    holes: [profile.hole],
    thickness: () => Number(p.headThickness),
    shaftLength: Number(p.length) - profile.centerHeight,
    diameter: Number(p.diameter),
  };
}
const part: PartDefinition = {
  id: 'swing-eye-bolt',
  name: 'Swing eye bolt',
  category: 'FASTENERS',
  subgroup: 'BOLTS & SCREWS',
  icon: 'bolt',
  complexity: 'Flat eye head',
  standard: 'DIN 444',
  description:
    'A pivot bolt with a flat circular eye and transverse bore. Nominal length is measured to the eye centre.',
  keywords: ['eye bolt', 'swing bolt', 'pivot', 'DIN 444', 'hinge', 'partial thread'],
  defaults,
  parameters: [
    {
      key: 'diameter',
      label: 'Thread diameter',
      symbol: 'd',
      type: 'number',
      unit: 'mm',
      min: 1,
      max: 100,
      step: 0.5,
      group: 'Shank',
    },
    {
      key: 'length',
      label: 'Tip to eye centre',
      symbol: 'L',
      type: 'number',
      unit: 'mm',
      min: 5,
      max: 1000,
      step: 1,
      group: 'Shank',
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
      group: 'Shank',
      description: 'Thread identification; this model uses a smooth nominal envelope.',
    },
    {
      key: 'threadSpan',
      label: 'Thread coverage',
      type: 'select',
      options: [
        { value: 'full', label: 'Full shank' },
        { value: 'partial', label: 'Partial shank' },
      ],
      group: 'Shank',
    },
    {
      key: 'threadLength',
      label: 'Nominal thread length',
      symbol: 'b',
      type: 'number',
      unit: 'mm',
      min: 1,
      max: 1000,
      step: 1,
      group: 'Shank',
      visibleWhen: (p) => p.threadSpan === 'partial',
      description: 'Stored for reference; the thread is represented by its outer envelope.',
    },
    {
      key: 'eyeBore',
      label: 'Eye bore',
      symbol: 'd₂',
      type: 'number',
      unit: 'mm',
      min: 1,
      max: 150,
      step: 0.1,
      group: 'Eye',
    },
    {
      key: 'eyeDiameter',
      label: 'Eye outside diameter',
      symbol: 'd₃',
      type: 'number',
      unit: 'mm',
      min: 3,
      max: 250,
      step: 0.1,
      group: 'Eye',
    },
    {
      key: 'headThickness',
      label: 'Eye thickness',
      symbol: 'S',
      type: 'number',
      unit: 'mm',
      min: 1,
      max: 150,
      step: 0.1,
      group: 'Eye',
    },
  ],
  presets: modulePresets,
  presetMatchKeys: ['diameter', 'length', 'eyeBore', 'threadSpan'],
  validate: (p) => {
    const errors: string[] = [];
    if (Number(p.eyeDiameter) <= Math.max(Number(p.eyeBore) + 0.5, Number(p.diameter) * 1.2))
      errors.push(
        'The eye outside diameter must leave a wall around the bore and clear the shank.',
      );
    if (Number(p.headThickness) < Number(p.diameter) * 0.6)
      errors.push('Eye thickness must be at least 60% of the shank diameter.');
    if (!errors.length) {
      const h = head(p);
      if (h.shaftLength < Number(p.diameter) * 0.5)
        errors.push('Increase the tip-to-centre length to leave a shank below the eye.');
      if (p.threadSpan === 'partial' && Number(p.threadLength) > h.shaftLength)
        errors.push('Thread length must fit below the eye.');
      const profile = eyeOutline(
        Number(p.eyeDiameter),
        Number(p.eyeBore),
        Number(p.diameter) * 0.55,
      );
      if (profile.centerHeight <= Number(p.eyeBore) / 2)
        errors.push('The eye bore must leave material at the shank joint.');
    }
    return errors;
  },
  buildGeometry: (p) => profileHeadGeometry(head(p)),
  dimensions: (p) => profileHeadDimensions(head(p)),
  python: (p) => profileHeadPython(head(p)),
  notes:
    'The source nominal length runs from the tip to the eye centre. The flat eye, bore and transition are tessellated consistently in the preview and CAD; the thread is a smooth nominal envelope. Transition fillets and manufacturing tolerances are not modelled.',
  sources: [
    {
      label: 'Gvyntok DIN 444 drawing',
      url: 'https://gvyntok.com/wp-content/uploads/2024/06/030-390-001.pdf',
    },
  ],
};
export default { ...part, presets: modulePresets };

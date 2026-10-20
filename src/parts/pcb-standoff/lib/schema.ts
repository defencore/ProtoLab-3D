import type { ParameterDefinition, Parameters, Preset } from '../../../core/types';

export const prototypeDefaults: Parameters = {
  catalogItem: 'prototype',
  profile: 'hex',
  endA: 'female',
  endB: 'male',
  bodyLength: 10,
  bodyWidth: 5.5,
  cornerDiameter: 0,
  threadDiameterA: 3,
  threadDiameterB: 3,
  threadPitchA: 0.5,
  threadPitchB: 0.5,
  threadDesignationA: 'M3',
  threadDesignationB: 'M3',
  threadRootDiameterA: 0,
  threadRootDiameterB: 0,
  maleLengthA: 0,
  maleLengthB: 6,
  maleEnvelopeLengthA: 0,
  maleEnvelopeLengthB: 0,
  femaleDepthA: 5,
  femaleDepthB: 0,
  femaleEnvelopeDepthA: 0,
  femaleEnvelopeDepthB: 0,
  boreDiameter: 0,
  throughBore: false,
  threadedThrough: false,
  meetingFemaleBores: false,
  appearance: 'brass',
};
export const insertPrototypeDefaults: Parameters = {
  ...prototypeDefaults,
  endB: 'female',
  maleLengthB: 0,
  femaleDepthB: 0,
  femaleDepthA: 0,
  femaleEnvelopeDepthA: 2,
  femaleEnvelopeDepthB: 2,
  throughBore: false,
  boreDiameter: 0,
  appearance: 'nylon-black',
  insertOuterDiameter: 0,
  insertLengthA: 0,
  insertLengthB: 0,
  insertThrough: false,
};

const hidden = () => false;
const select = (key: string, label: string, values: string[]): ParameterDefinition => ({
  key,
  label,
  type: 'select',
  group: 'Supplier definition',
  visibleWhen: hidden,
  options: values.map((value) => ({ value, label: value })),
});
const dimension = (key: string, label: string): ParameterDefinition => ({
  key,
  label,
  type: 'number',
  group: 'Supplier definition',
  unit: 'mm',
  min: 0,
  max: 1000,
  step: 0.001,
  visibleWhen: hidden,
});
export function parameterSchema(presets: Preset[], composite = false): ParameterDefinition[] {
  return [
    {
      key: 'catalogItem',
      label: 'Catalog item',
      type: 'select',
      group: 'Catalogue',
      visibleWhen: hidden,
      options: presets.length
        ? presets.map((preset) => ({
            value: String(preset.parameters.catalogItem),
            label: preset.name,
          }))
        : [{ value: 'prototype', label: 'Development geometry, no supplier SKU' }],
    },
    select('profile', 'Body form', ['round', 'hex']),
    select('endA', 'Lower end', ['plain', 'female', 'male', 'self-tapping']),
    select('endB', 'Upper end', ['plain', 'female', 'male', 'self-tapping']),
    dimension('bodyLength', 'Body length'),
    dimension('bodyWidth', 'Body diameter / across flats'),
    dimension('cornerDiameter', 'Published across-corner envelope'),
    ...(['A', 'B'] as const).flatMap((side) => [
      dimension(`threadDiameter${side}`, `End ${side} nominal / source major diameter`),
      dimension(`threadPitch${side}`, `End ${side} declared thread pitch`),
      dimension(`threadRootDiameter${side}`, `End ${side} source root diameter`),
      {
        key: `threadDesignation${side}`,
        label: `End ${side} source thread designation`,
        type: 'text' as const,
        group: 'Supplier definition',
        visibleWhen: hidden,
      },
    ]),
    dimension('maleLengthA', 'Lower male length'),
    dimension('maleLengthB', 'Upper male length'),
    dimension('maleEnvelopeLengthA', 'Unverified lower stud envelope'),
    dimension('maleEnvelopeLengthB', 'Unverified upper stud envelope'),
    dimension('femaleDepthA', 'Lower female / pilot depth'),
    dimension('femaleDepthB', 'Upper female / pilot depth'),
    dimension('femaleEnvelopeDepthA', 'Unverified lower blind-opening envelope'),
    dimension('femaleEnvelopeDepthB', 'Unverified upper blind-opening envelope'),
    dimension('boreDiameter', 'Plain bore / self-tapping pilot diameter'),
    ...['throughBore', 'threadedThrough', 'meetingFemaleBores'].map((key) => ({
      key,
      label:
        key === 'throughBore'
          ? 'Plain through bore'
          : key === 'threadedThrough'
            ? 'Continuous through thread'
            : 'Source-confirmed meeting female spans',
      type: 'boolean' as const,
      group: 'Supplier definition',
      visibleWhen: hidden,
    })),
    select('appearance', 'Illustrative finish', [
      'neutral',
      'brass',
      'nickel',
      'aluminium',
      'steel',
      'nylon-black',
      'nylon-white',
    ]),
    ...(composite
      ? [
          dimension('insertOuterDiameter', 'Confirmed cylindrical insert outside diameter'),
          dimension('insertLengthA', 'Confirmed lower insert length'),
          dimension('insertLengthB', 'Confirmed upper insert length'),
          {
            key: 'insertThrough',
            label: 'Confirmed continuous insert',
            type: 'boolean' as const,
            group: 'Supplier definition',
            visibleWhen: hidden,
          },
        ]
      : []),
  ];
}

export function catalogFields(presets: Preset[]): ParameterDefinition[] {
  return [
    ...[
      ['supplier', 'Supplier'],
      ['manufacturer', 'Manufacturer'],
      ['series', 'Series'],
      ['endForm', 'End combination'],
      ['bodyForm', 'Body form'],
      ['material', 'Material'],
      ['coating', 'Coating / finish'],
      ['threadLabel', 'Thread designation'],
      ['catalogThreadA', 'Source thread at end A'],
      ['catalogThreadB', 'Source thread at end B'],
      ['modelFidelity', 'Model fidelity'],
    ].map(([key, label]) => ({
      key,
      label,
      type: 'select' as const,
      group: 'Product characteristics',
      options: [
        ...new Set(
          presets
            .map((preset) => preset.catalog?.attributes?.[key])
            .filter((value) => typeof value === 'string'),
        ),
      ]
        .sort()
        .map((value) => ({ value: String(value), label: String(value) })),
      catalogSummary: ['endForm', 'material', 'threadLabel'].includes(key),
      catalogCondition: key === 'modelFidelity',
    })),
    ...[
      ['catalogBodyLength', 'Body length'],
      ['catalogBodyWidth', 'Diameter / across flats'],
      ['catalogOverallLength', 'Published overall length'],
      ['catalogCornerDiameter', 'Across-corner envelope'],
    ].map(([key, label]) => ({
      key,
      label,
      type: 'number' as const,
      group: 'Dimensions',
      unit: 'mm',
      catalogSummary: ['catalogBodyLength', 'catalogBodyWidth'].includes(key),
    })),
  ];
}

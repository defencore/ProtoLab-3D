import type { ParameterDefinition, Parameters } from '../../core/types';

export const defaults: Parameters = {
  antennaModel: 'jcg108-3m',
  antennaDepth: 8.6,
  antennaBondline: 0.3,
  airflowDirection: 'positive-x',
  antennaHole: 12,
  antennaX: 0,
  antennaY: -17.5,
  showTube: true,
  showAntenna: true,
};

export const parameters: ParameterDefinition[] = [
  {
    key: 'antennaModel',
    label: 'JCG108 lead execution',
    type: 'select',
    group: 'Antenna reference',
    options: [
      { value: 'jcg108-3m', label: 'Jinchang JCG108 · 3 m lead' },
      { value: 'jcg108-5m', label: 'Jinchang JCG108 · 5 m lead' },
    ],
    description:
      'Reuses the exact library antenna execution. Lead and connector geometry remain unresolved.',
  },
  {
    key: 'antennaDepth',
    label: 'Measured mounting depth',
    type: 'number',
    unit: 'mm',
    min: 7.6,
    max: 9.6,
    step: 0.05,
    group: 'Mounting fit',
    description:
      'Changes the fairing contact plane only. The source antenna stays at its nominal 8.6 mm depth; measure the delivered housing before choosing this fit.',
  },
  {
    key: 'antennaBondline',
    label: 'Installed adhesive thickness',
    type: 'number',
    unit: 'mm',
    min: 0,
    max: 1,
    step: 0.05,
    group: 'Mounting fit',
    description:
      'Installation assumption between the flat antenna back and the pipe crown; no adhesive strength is established.',
  },
  {
    key: 'airflowDirection',
    label: 'Axial flow direction',
    type: 'select',
    group: 'Fairing orientation',
    options: [
      { value: 'positive-x', label: 'From −X toward +X' },
      { value: 'negative-x', label: 'From +X toward −X' },
    ],
    description:
      'Mirrors the short nose and long tail along X. This geometric choice does not establish aerodynamic performance.',
  },
  {
    key: 'antennaHole',
    label: 'Pipe cable-entry diameter',
    type: 'number',
    unit: 'mm',
    min: 9,
    max: 16,
    step: 0.5,
    group: 'Cable entry',
    description:
      'Fitting allowance in the pipe, not a sourced SMA plug dimension. Prethread the connector before installing the cap.',
  },
  {
    key: 'antennaX',
    label: 'Cable-entry X',
    type: 'number',
    unit: 'mm',
    min: -12,
    max: 12,
    step: 0.5,
    group: 'Cable entry',
  },
  {
    key: 'antennaY',
    label: 'Cable-entry Y',
    type: 'number',
    unit: 'mm',
    min: -24,
    max: -14,
    step: 0.5,
    group: 'Cable entry',
    description: 'Keep the complete pipe opening beside the maximum antenna housing footprint.',
  },
  {
    key: 'showTube',
    label: 'Show host pipe',
    type: 'boolean',
    group: 'Inspection',
    filterable: false,
  },
  {
    key: 'showAntenna',
    label: 'Show source antenna',
    type: 'boolean',
    group: 'Inspection',
    filterable: false,
  },
];

export const catalogSelection = [];

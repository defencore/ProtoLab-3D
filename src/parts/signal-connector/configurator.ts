import type { Parameters, ParameterDefinition, PartDefinition } from '../../core/types';
import catalog from './lib/catalog.json';
import { nikomA448027 } from './lib/nikom-a448027';
export const connectorChoices = [...catalog, nikomA448027];
export const defaults: Parameters = { model: 'usb-c-amphenol-12401610' };
export const parameters: ParameterDefinition[] = [
  {
    key: 'model',
    label: 'Connector model',
    type: 'select',
    group: 'Connector selection',
    options: connectorChoices.map((m) => ({ value: m.id, label: m.name })),
    description:
      'Fixed connector references. Mounting and local datums follow the evidence for the selected model.',
  },
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [{ key: 'model' }];
export const catalogFilterFields: ParameterDefinition[] = [
  ...(['family', 'contactType', 'mounting'] as const).map((key) => ({
    key,
    label: { family: 'Connector family', contactType: 'Contact type', mounting: 'Mounting' }[key],
    type: 'select' as const,
    group: 'Connector selection',
    catalogSummary: true,
    options: [...new Set(connectorChoices.map((m) => m[key]))].map((value) => ({
      value,
      label: value,
    })),
  })),
  ...(['contacts', 'pitch', 'width', 'depth', 'height'] as const).map((key) => ({
    key,
    label: {
      contacts: 'Signal contacts',
      pitch: 'Contact column pitch',
      width: 'Source X size',
      depth: 'Source Y size',
      height: 'Source Z size',
    }[key],
    type: 'number' as const,
    group: 'Dimensions',
    unit: key === 'contacts' ? '' : 'mm',
    min: 0,
    catalogSummary: ['contacts', 'pitch'].includes(key),
    description:
      key === 'contacts'
        ? 'Signal poles; switched audio jacks can have additional solder terminals.'
        : key === 'pitch'
          ? 'Published source column pitch where applicable; DE-9 uses a different 2.84 mm row pitch.'
          : 'Measured native source envelope; not a manufacturer tolerance specification.',
  })),
];

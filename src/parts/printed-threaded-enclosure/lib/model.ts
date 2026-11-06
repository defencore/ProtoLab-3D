import type { Parameters } from '../../../core/types';
import type { AssemblyComponent } from '../../../core/product-types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import shell from '../../printed-threaded-shell/part';

export function components(p: Parameters): AssemblyComponent[] {
  return ['body', 'cap'].map((model) => ({
    id: model,
    libraryId: 'printed-threaded-shell',
    name: model === 'body' ? 'Printed coarse-thread can' : 'Printed coarse-thread cap',
    parameters: { ...p, model },
    state: 'default',
    quantity: 1,
    supply: 'manufactured',
    presetId: shell.presets.find((preset) =>
      Object.entries(preset.parameters).every(([key, value]) => ({ ...p, model })[key] === value),
    )?.id,
    placement: {
      translation: [0, 0, model === 'body' ? 0 : Number(p.height) - Number(p.threadLength)],
      rotation: [0, 0, 0],
    },
    manufacturing: {
      material: 'Specify the actual printed polymer grade and settings',
      blank: 'Individually printed hollow shell',
      processes: ['printing'],
      requirements: [
        'Calibrate matching helical flanks and qualify torque, wear, creep and required working loads.',
      ],
    },
  }));
}

export function configured(p: Parameters, state: string): ConfiguredPiece[] {
  const diameter = Number(p.diameter),
    wall = Number(p.wall),
    clearance = Number(p.clearance),
    capHeight = Number(p.threadLength) + Number(p.roofGap) + Number(p.roof);
  return components(p).map((source, index) => {
    const component: AssemblyComponent = {
      ...source,
      placement: {
        translation: [...source.placement.translation],
        rotation: [...source.placement.rotation],
      },
    };
    if (index === 1 && state === 'exploded')
      component.placement.translation = [0, 0, Number(p.height) + 8];
    if (index === 1 && state === 'print')
      component.placement = {
        translation: [diameter + 2 * wall + clearance + 8, 0, capHeight],
        rotation: [180, 0, 0],
      };
    return {
      component,
      label: component.name,
      color: index === 0 ? 0xe6a34a : 0x478c99,
      requireSingleSolid: true,
    };
  });
}

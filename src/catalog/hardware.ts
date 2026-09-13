import data from './generated/gvyntok-hardware-presets.json';
import type { PartDefinition, Preset } from '../core/types';
import { nutCoarsePitch } from './lib/fastener-sizing';

export function withHardwarePresets(part: PartDefinition): PartDefinition {
  const imported = (data as Record<string, Preset[]>)[part.id] ?? [];
  if (!imported.length) return part;
  const complete = (preset: Preset): Preset => ({
    ...preset,
    parameters: {
      ...part.defaults,
      ...(part.subgroup === 'NUTS'
        ? { pitch: nutCoarsePitch(Number(preset.parameters.bore ?? preset.parameters.diameter)) }
        : {}),
      ...preset.parameters,
    },
  });
  const fingerprint = (preset: Preset) => JSON.stringify(Object.entries(preset.parameters).sort());
  const stock = imported.map(complete);
  const fingerprints = new Set(stock.map(fingerprint));
  return {
    ...part,
    presets: [
      ...stock,
      ...part.presets.map(complete).filter((preset) => !fingerprints.has(fingerprint(preset))),
    ],
  };
}

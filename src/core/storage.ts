import type { Parameters, PartDefinition } from './types';
import { configurationFromDocument } from './configuration';

export interface SavedPreset {
  id: string;
  name: string;
  partId: string;
  parameters: Parameters;
  state: string;
  presetId?: string;
}

const key = 'protolab.presets.v1';

export function createPresetId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function readPresets(parts: PartDefinition[]): SavedPreset[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): SavedPreset[] => {
      if (
        !entry ||
        typeof entry !== 'object' ||
        typeof entry.id !== 'string' ||
        typeof entry.name !== 'string' ||
        !entry.parameters ||
        typeof entry.state !== 'string'
      )
        return [];
      try {
        const { parameters, state, presetId } = configurationFromDocument(
          { ...entry, version: 1, units: 'mm', part: entry.partId },
          parts,
        );
        return [{ ...entry, parameters, state, ...(presetId === undefined ? {} : { presetId }) }];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export function storePresets(presets: SavedPreset[]): void {
  localStorage.setItem(key, JSON.stringify(presets));
}

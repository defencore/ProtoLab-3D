import { presetMatchesConfiguration } from './catalog-models';
import type { Parameters, PartDefinition, Preset } from './types';

/** An explicit selection may establish supply; a missing or stale choice may not. */
export function selectedMatchingPreset(
  part: PartDefinition,
  parameters: Parameters,
  presetId: string | undefined,
): Preset | undefined {
  return part.presets.find(
    (preset) => preset.id === presetId && presetMatchesConfiguration(part, preset, parameters),
  );
}

/** Resolve the configured identity while retaining an explicitly chosen matching source. */
export function matchingPreset(
  part: PartDefinition,
  parameters: Parameters,
  preferredId?: string,
): Preset | undefined {
  return (
    selectedMatchingPreset(part, parameters, preferredId) ??
    part.presets.find((preset) => presetMatchesConfiguration(part, preset, parameters))
  );
}

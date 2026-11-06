import type { Parameters, PartDefinition } from './types';
import { validateParameters } from './validation';
import {
  upgradeImplicitTubeProfile,
  upgradeImportedCameraParameters,
  upgradeImportedPresetId,
} from './configuration-upgrades';
import { selectedMatchingPreset } from './preset-resolution';

export interface ImportedConfiguration {
  part: PartDefinition;
  parameters: Parameters;
  state: string;
  presetId?: string;
}

export function parseConfiguration(
  text: string,
  parts: readonly PartDefinition[],
): ImportedConfiguration {
  return configurationFromDocument(JSON.parse(text), parts);
}

/** Files, links and local saves share parameter and explicit source-identity validation. */
export function configurationFromDocument(
  document: unknown,
  parts: readonly PartDefinition[],
): ImportedConfiguration {
  const config = document as Record<string, unknown> | null;
  const part = parts.find((item) => item.id === config?.part);
  if (
    config?.version !== 1 ||
    config?.units !== 'mm' ||
    !part ||
    !config.parameters ||
    typeof config.parameters !== 'object' ||
    Array.isArray(config.parameters) ||
    typeof config.state !== 'string'
  ) {
    throw new Error('Choose a ProtoLab parameters JSON file.');
  }
  const presetId =
    typeof config.presetId === 'string'
      ? upgradeImportedPresetId(part.id, config.presetId)
      : config.presetId;
  const imported = upgradeImportedCameraParameters(
    part.id,
    upgradeImplicitTubeProfile(part.id, config.parameters as Parameters),
    typeof presetId === 'string' ? presetId : undefined,
  );
  const issues = validateParameters(part, imported, config.state);
  if (issues.length) throw new Error(issues[0]);
  const parameters = Object.fromEntries(
    part.parameters
      .filter((field) => Object.hasOwn(imported, field.key))
      .map((field) => [field.key, imported[field.key]]),
  );
  if (
    presetId !== undefined &&
    presetId !== 'custom' &&
    (typeof presetId !== 'string' || !selectedMatchingPreset(part, parameters, presetId))
  )
    throw new Error('The library preset is missing or does not match its parameters.');
  return {
    part,
    parameters,
    state: config.state,
    ...(presetId === undefined ? {} : { presetId: presetId as string }),
  };
}

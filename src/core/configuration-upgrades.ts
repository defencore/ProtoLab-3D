import type { Parameters } from './types';

/** Import-only model renames retained while pre-rename version-one saves are supported.
 * Catalog lookup and newly created selections use only the canonical IDs.
 */
const renamedPresetIds: Readonly<Record<string, string>> = {
  'modular-tube-avionics:d90-86': 'd90-86-ov9281',
  'modular-tube-avionics:d90-86-camera-19': 'd90-86-imx577-19x19',
  'board-camera-19:19-rear-mipi-m25': 'imx577-19x19-rear-mipi-m25',
};

export function upgradeImportedPresetId(
  libraryId: string,
  presetId: string | undefined,
): string | undefined {
  if (presetId === undefined) return undefined;
  const key = `${libraryId}:${presetId}`;
  return Object.hasOwn(renamedPresetIds, key) ? renamedPresetIds[key] : presetId;
}

/** Preserve version-one saves made before the two tube families exposed a profile.
 * Keep this import-only upgrade while those saved links/projects remain supported.
 * Explicit unknown selections and all unrelated missing fields still fail validation.
 */
export function upgradeImplicitTubeProfile(libraryId: string, parameters: Parameters): Parameters {
  if (
    ['modular-tube-avionics', 'modular-tube-marking-kit'].includes(libraryId) &&
    !Object.hasOwn(parameters, 'tubeProfile')
  )
    return { ...parameters, tubeProfile: 'd90-86' };
  return parameters;
}

const originalImx577Envelope: Readonly<Parameters> = {
  bodyWidth: 19,
  bodyHeight: 19,
  bodyDepth: 12,
  lensDiameter: 12,
  lensLength: 15,
  rearInterface: 'rear-mipi',
  rearConnectorWidth: 17,
  rearConnectorHeight: 2,
  rearConnectorProjection: 0.5,
  rearConnectorTopInset: 3,
  rearConnectorRightInset: 0,
  sideMount: 'm2.5',
  sideMountOffset: 7.5,
  sideHoleDepth: 2.5,
};

/** Version-one imports predate the objective-profile fields. Keep this upgrade
 * at import boundaries while those saves remain supported; runtime validation
 * requires the current schema. Only the exact old, explicitly identified IMX577
 * execution receives the user's measured objective correction. Generic/custom
 * envelopes preserve their dimensions and gain a cylindrical profile instead.
 * Partial or explicit profile values are never repaired or overwritten.
 */
export function upgradeImportedCameraParameters(
  libraryId: string,
  parameters: Parameters,
  canonicalPresetId: string | undefined,
): Parameters {
  if (
    libraryId !== 'board-camera-19' ||
    ['lensProfile', 'lensCollarDiameter', 'lensCollarHeight'].some((key) =>
      Object.hasOwn(parameters, key),
    )
  )
    return parameters;

  const originalKeys = Object.keys(originalImx577Envelope);
  if (
    canonicalPresetId === 'imx577-19x19-rear-mipi-m25' &&
    Object.keys(parameters).length === originalKeys.length &&
    originalKeys.every((key) => parameters[key] === originalImx577Envelope[key])
  )
    return {
      ...parameters,
      lensDiameter: 14.8,
      lensProfile: 'stepped',
      lensCollarDiameter: 16,
      lensCollarHeight: 5,
    };

  return {
    ...parameters,
    lensProfile: 'cylindrical',
    lensCollarDiameter: parameters.lensDiameter,
    lensCollarHeight: 0,
  };
}

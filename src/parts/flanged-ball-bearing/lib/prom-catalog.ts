import type { Preset } from '../../../core/types';
import presets from '../presets.json';

const actuatorBearingIds = new Set(['smb-mf105-2z', 'smb-mf106-2z', 'smb-mf63-2z']);

/** Assembly order lists use supplier designations; the catalog titles also include dimensions. */
export const promActuatorBearings: Preset[] = (presets as Preset[])
  .filter((preset) => actuatorBearingIds.has(preset.id))
  .map((preset) => ({ ...preset, name: preset.catalog!.designation }));

export const promBearing = (id: string) => {
  const preset = promActuatorBearings.find((preset) => preset.id === id);
  if (!preset) throw new Error('Unknown Prom bearing ' + id);
  return preset;
};

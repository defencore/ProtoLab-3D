import type { Parameters } from '../../../core/types';
import data from './catalog-models.json';
import * as waveshare from './waveshare/model';
import * as kst from './kst/model';
import * as standard from './standard/model';
import * as st3025 from './st3025/model';
import * as towerpro from './towerpro/model';

export type ServoFamily = 'waveshare' | 'kst' | 'standard' | 'st3025' | 'towerpro';
export interface ServoModelDefinition {
  model: string;
  name: string;
  family: ServoFamily;
  angleLimit: number;
  geometry: Readonly<Parameters>;
  geometryEvidence: {
    dimensions?: Readonly<Parameters>;
    verifiedDimensions: string[];
    notes: string;
    sources: { label: string; url: string }[];
  };
}

function fixedGeometry(values: Record<string, unknown>): Readonly<Parameters> {
  const geometry: Parameters = {};
  for (const [key, value] of Object.entries(values)) {
    if (
      (typeof value !== 'number' && typeof value !== 'string' && typeof value !== 'boolean') ||
      (typeof value === 'number' && !Number.isFinite(value))
    )
      throw new Error(`Invalid fixed servo geometry value: ${key}.`);
    geometry[key] = value;
  }
  return Object.freeze(geometry);
}

// Supplier model geometry is fixed catalog data; only assembly placement is configurable.
export const modelDefinitions: readonly ServoModelDefinition[] = data.map((entry) =>
  Object.freeze({
    ...entry,
    family: entry.family as ServoFamily,
    geometry: fixedGeometry(entry.geometry),
  }),
);

export function getModelDefinition(model: unknown): ServoModelDefinition {
  const found = modelDefinitions.find((entry) => entry.model === model);
  if (!found) throw new Error('Choose a supported servo model.');
  return found;
}

export function getModelGeometryParameters(parameters: Parameters): Parameters {
  const model = getModelDefinition(parameters.model);
  return {
    ...model.geometry,
    outputAngle: parameters.outputAngle,
    showHorn: parameters.showHorn,
    hornStyle: model.family === 'waveshare' ? parameters.hornStyle : 'single',
  };
}

export function getModelGeometry(model: unknown) {
  const family = getModelDefinition(model).family;
  switch (family) {
    case 'waveshare':
      return waveshare;
    case 'kst':
      return kst;
    case 'standard':
      return standard;
    case 'st3025':
      return st3025;
    case 'towerpro':
      return towerpro;
  }
}

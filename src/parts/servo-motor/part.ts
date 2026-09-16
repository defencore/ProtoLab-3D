import type { Parameters, PartDefinition, Preset } from '../../core/types';
import { defaults, parameters, catalogFilterFields } from './configurator';
import presetData from './presets.json';
import {
  getModelDefinition,
  getModelGeometry,
  getModelGeometryParameters,
  modelDefinitions,
} from './lib/models';

export { getModelDefinition, getModelGeometryParameters, modelDefinitions } from './lib/models';

function validate(p: Parameters, state: string): string[] {
  const errors: string[] = [];
  const keys = new Set(parameters.map((field) => field.key));
  for (const key of Object.keys(p)) {
    if (!keys.has(key))
      errors.push(`Servo dimensions and specifications are fixed; unsupported parameter: ${key}.`);
  }
  for (const field of parameters) {
    const value = p[field.key];
    if (field.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value)))
      errors.push(`${field.label} must be a finite number.`);
    else if (field.type === 'boolean' && typeof value !== 'boolean')
      errors.push(`${field.label} must be enabled or disabled.`);
    else if (field.type === 'select' && !field.options?.some((option) => option.value === value))
      errors.push(`Choose a supported ${field.label.toLowerCase()}.`);
  }
  if (!['assembled', 'exploded', 'body'].includes(state))
    errors.push('Choose a supported servo state.');
  if (errors.length) return errors;
  const model = getModelDefinition(p.model);
  if (Math.abs(p.outputAngle as number) > model.angleLimit)
    errors.push(
      `${model.name} output angle must be between −${model.angleLimit}° and ${model.angleLimit}°.`,
    );
  if (model.family !== 'waveshare' && p.hornStyle !== 'single')
    errors.push('The supplied disc pair is available only for Waveshare ST3215-HS.');
  return errors;
}

const part: PartDefinition = {
  id: 'servo-motor',
  name: 'Servo motor',
  category: 'MOTORS & ACTUATORS',
  subgroup: 'SERVOS',
  icon: 'gear',
  complexity: 'Supplier models selected by fixed dimensions and electrical specifications',
  description:
    'Choose a Waveshare, KST or Power-HD servo by case size, torque, current, voltage and other published characteristics. Geometry follows the selected model.',
  keywords: [
    'servo',
    'servomotor',
    'servo motor',
    'Waveshare',
    'ST3215-HS',
    'ST3215',
    'KST',
    'X10 Mini Pro',
    'X10 V8.0',
    'X10 Pro',
    'Power-HD',
    'Power HD',
    'T60-BHV',
    'TDS-2',
    'TTL',
    'PWM',
    '25T',
    'robot',
    'glider',
    'сервопривід',
    'сервопривод',
    'сервомотор',
    'серво',
    'крутний момент',
    'струм',
  ],
  defaults,
  parameters,
  presets: presetData.map((preset): Preset => ({
    ...preset,
    catalog: {
      ...preset.catalog,
      attributes: Object.fromEntries<string | number | boolean>(
        Object.entries(preset.catalog.attributes),
      ),
      attributeConditions: Object.fromEntries<string>(
        Object.entries(preset.catalog.attributeConditions),
      ),
    } as NonNullable<Preset['catalog']>,
  })),
  presetMatchKeys: ['model'],
  catalogSelectionOnly: true,
  catalogFilterFields,
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description: 'Fixed servo case with its output at the selected angle and an optional horn.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description:
        'Separate components for inspection; ST3215 includes its original covers, motor and circuit board.',
    },
    {
      id: 'body',
      label: 'Case only',
      description: 'Fixed case and mounting details without output hardware.',
    },
  ],
  validate,
  buildGeometry(p, state) {
    return getModelGeometry(p.model).geometry(getModelGeometryParameters(p), state);
  },
  dimensions(p, state) {
    return getModelGeometry(p.model).dimensions(getModelGeometryParameters(p), state);
  },
  python(p, state) {
    return getModelGeometry(p.model).python(getModelGeometryParameters(p), state);
  },
  updateParameters(p, key) {
    if (key !== 'model') return p;
    const model = getModelDefinition(p.model);
    return {
      ...p,
      outputAngle: Math.max(-model.angleLimit, Math.min(model.angleLimit, Number(p.outputAngle))),
      hornStyle: model.family === 'waveshare' ? p.hornStyle : 'single',
    };
  },
  notes:
    'Servo models have fixed manufacturer dimensions and read-only published specifications. Filters select matching models; they never resize a servo or change its torque/current rating. Case heights follow the dimension drawings; undimensioned casing details, mounting cutouts, threads and most optional horns are fixed visual approximations. KST A/B mounting patterns and ST3215 supplied discs remain distinct. See each model source and specifications for dimension discrepancies and measurement conditions. Current ratings are omitted where absent or ambiguously specified; missing values are not zero. Output angle changes geometric placement only, with no motor or electrical simulation.',
  sources: [
    ...new Map(
      modelDefinitions
        .flatMap((model) => model.geometryEvidence.sources)
        .map((source) => [source.url, source]),
    ).values(),
  ],
};
export default part;

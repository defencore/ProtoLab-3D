import type { PartDefinition } from './types';

/** Increment only when the portable part contract changes incompatibly. */
export const PART_MODULE_API_VERSION = 1;

export interface PartModule {
  apiVersion: typeof PART_MODULE_API_VERSION;
  order: number;
  part: PartDefinition;
}

export const PART_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** Fail at the module boundary, before malformed definitions reach the interface. */
export function registerPartModules(modules: readonly PartModule[]): PartDefinition[] {
  const ids = new Set<string>();
  let defaultSelection: string | undefined;
  for (const module of modules) {
    if (!module || module.apiVersion !== PART_MODULE_API_VERSION)
      throw new Error(`Unsupported part module API. Expected version ${PART_MODULE_API_VERSION}.`);
    const part = module.part;
    if (!part || typeof part.id !== 'string' || !PART_ID_PATTERN.test(part.id))
      throw new Error('Every part module needs a lowercase, hyphen-separated ID.');
    if (ids.has(part.id)) throw new Error(`Duplicate part module ID: ${part.id}.`);
    ids.add(part.id);
    if (part.defaultSelection) {
      if (defaultSelection)
        throw new Error(
          `Only one part may be the initial selection: ${defaultSelection}, ${part.id}.`,
        );
      defaultSelection = part.id;
    }
    const fail = (message: string): never => {
      throw new Error(`${part.id}: ${message}`);
    };
    if (!Number.isFinite(module.order) || module.order < 0)
      fail('Module order must be finite and nonnegative.');
    for (const key of [
      'name',
      'category',
      'subgroup',
      'description',
      'icon',
      'complexity',
    ] as const)
      if (typeof part[key] !== 'string' || !part[key].trim()) fail(`Missing ${key}.`);
    for (const key of ['buildGeometry', 'python', 'dimensions', 'validate'] as const)
      if (typeof part[key] !== 'function') fail(`Missing ${key} function.`);
    if (!Array.isArray(part.parameters) || !part.defaults || !Array.isArray(part.presets))
      fail('A configurator, defaults and presets are required.');
    const keys = new Set<string>();
    for (const field of part.parameters) {
      if (!field.key || keys.has(field.key))
        fail(`Duplicate or missing parameter key: ${field.key}.`);
      keys.add(field.key);
      if (!['number', 'select', 'boolean'].includes(field.type))
        fail(`Unknown parameter type for ${field.key}.`);
      if (!(field.key in part.defaults)) fail(`Missing default for ${field.key}.`);
      const value = part.defaults[field.key];
      if (field.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value)))
        fail(`Default ${field.key} must be a finite number.`);
      if (field.type === 'boolean' && typeof value !== 'boolean')
        fail(`Default ${field.key} must be boolean.`);
      if (field.type === 'select' && !field.options?.some((option) => option.value === value))
        fail(`Default ${field.key} must be one of its options.`);
    }
    const presetIds = new Set<string>();
    const attributeKeys = new Set<string>();
    for (const field of part.catalogFilterFields ?? []) {
      if (!field.key || keys.has(field.key) || attributeKeys.has(field.key))
        fail(`Duplicate catalog characteristic key: ${field.key}.`);
      attributeKeys.add(field.key);
      if (!['number', 'select', 'boolean'].includes(field.type))
        fail(`Unknown catalog characteristic type: ${field.key}.`);
    }
    if (part.catalogSelectionOnly && (!attributeKeys.size || !part.presets.length))
      fail('Fixed catalog models require characteristics and presets.');
    for (const preset of part.presets) {
      if (!preset.id || presetIds.has(preset.id))
        fail(`Duplicate or missing preset ID: ${preset.id}.`);
      presetIds.add(preset.id);
      if (part.catalogSelectionOnly) {
        const identity = preset.catalog?.verifiedParameters;
        if (!Array.isArray(identity) || !identity.length)
          fail(`Fixed model ${preset.id} requires source-verified identity parameters.`);
        for (const key of identity!) {
          const field = part.parameters.find((field) => field.key === key);
          if (!field || !Object.hasOwn(preset.parameters, key))
            fail(`Fixed model ${preset.id} has an unknown or missing identity parameter: ${key}.`);
          const value = preset.parameters[key];
          if (
            (field!.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) ||
            (field!.type === 'boolean' && typeof value !== 'boolean') ||
            (field!.type === 'select' && !field!.options?.some((option) => option.value === value))
          )
            fail(`Fixed model ${preset.id} has an invalid identity value for ${key}.`);
        }
      }
      for (const [key, value] of Object.entries(preset.catalog?.attributes ?? {})) {
        const field = part.catalogFilterFields?.find((field) => field.key === key);
        if (!field) fail(`Unknown catalog characteristic ${key} in ${preset.id}.`);
        if (field!.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value)))
          fail(`Catalog characteristic ${key} must be finite in ${preset.id}.`);
        if (field!.type === 'boolean' && typeof value !== 'boolean')
          fail(`Catalog characteristic ${key} must be boolean in ${preset.id}.`);
        if (field!.type === 'select' && !field!.options?.some((option) => option.value === value))
          fail(`Catalog characteristic ${key} must match an option in ${preset.id}.`);
      }
    }
    for (const selection of part.catalogSelection ?? [])
      if (!keys.has(selection.key))
        fail(`Catalog selection refers to unknown parameter ${selection.key}.`);
  }
  return [...modules]
    .sort((a, b) => a.order - b.order || a.part.id.localeCompare(b.part.id))
    .map((module) => module.part);
}

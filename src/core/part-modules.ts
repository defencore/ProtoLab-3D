import type { PartDefinition } from './types';
import { validateProductProfile } from './product-library';
import { libraryCatalogFamily } from './library';
import { isValidPresetId } from './library-identity';

/** Increment only when the portable part contract changes incompatibly. */
export const PART_MODULE_API_VERSION = 2;

export interface PartModule {
  apiVersion: typeof PART_MODULE_API_VERSION;
  order: number;
  /** Explicit library packages reused by this assembly; included in portable exports. */
  dependencies?: string[];
  part: PartDefinition;
}

export const PART_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** Fail at the module boundary, before malformed definitions reach the interface. */
export function registerPartModules(definitions: readonly PartModule[]): PartDefinition[] {
  const modules = definitions.map((module) => {
    const family = module?.part && libraryCatalogFamily(module.part.id);
    if (!family) return module;
    if (module.part.browseFamily && module.part.browseFamily.id !== family.id)
      throw new Error(`Conflicting catalog membership for ${module.part.id}.`);
    return { ...module, part: { ...module.part, browseFamily: family } };
  });
  const ids = new Set<string>();
  const browseFamilies = new Map<
    string,
    { label: string; category: string; subgroup: string; primary?: string }
  >();
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
    const validWhen = (when: unknown): boolean => {
      if (when === undefined) return true;
      if (
        !when ||
        typeof when !== 'object' ||
        Array.isArray(when) ||
        !Array.isArray(part.parameters)
      )
        return false;
      const values = Object.entries(when);
      return (
        values.length > 0 &&
        values.every(([key, value]) => {
          const field = part.parameters.find((item) => item.key === key);
          if (!field) return false;
          if (field.type === 'number') return typeof value === 'number' && Number.isFinite(value);
          if (field.type === 'boolean') return typeof value === 'boolean';
          if (field.type === 'text') return typeof value === 'string';
          return field.options?.some((option) => option.value === value) ?? false;
        })
      );
    };
    if (
      part.discovery !== undefined &&
      (!Array.isArray(part.discovery) ||
        part.discovery.some(
          (fact) =>
            !fact ||
            !['power', 'bearing', 'width'].includes(fact.kind) ||
            typeof fact.key !== 'string' ||
            !fact.key.trim() ||
            typeof fact.label !== 'string' ||
            !fact.label.trim() ||
            !(typeof fact.value === 'number'
              ? Number.isFinite(fact.value)
              : typeof fact.value === 'string' && !!fact.value.trim()) ||
            (fact.unit !== undefined && typeof fact.unit !== 'string') ||
            (fact.range !== undefined &&
              (!fact.range ||
                !Number.isFinite(fact.range.min) ||
                !Number.isFinite(fact.range.max) ||
                fact.range.min > fact.range.max)) ||
            !validWhen(fact.when),
        ))
    )
      fail(
        'Discovery characteristics require documented values and valid configuration conditions.',
      );
    if (
      part.browseLabel !== undefined &&
      (typeof part.browseLabel !== 'string' ||
        !part.browseLabel.trim() ||
        part.browseLabel !== part.browseLabel.trim())
    )
      fail('Browse label must be a nonempty, trimmed navigation title.');
    if (part.browseFamily !== undefined) {
      const family = part.browseFamily;
      if (
        !family ||
        typeof family !== 'object' ||
        Array.isArray(family) ||
        typeof family.id !== 'string' ||
        !PART_ID_PATTERN.test(family.id) ||
        typeof family.label !== 'string' ||
        !family.label.trim() ||
        (family.primary !== undefined && typeof family.primary !== 'boolean')
      )
        fail(
          'Browse family requires a valid lowercase ID, nonempty label and optional boolean primary.',
        );
      const previous = browseFamilies.get(family.id);
      if (previous) {
        if (previous.label !== family.label)
          fail(`Browse family ${family.id} has inconsistent labels.`);
        if (previous.category !== part.category || previous.subgroup !== part.subgroup)
          fail(`Browse family ${family.id} must share its engineering category and subgroup.`);
        if (family.primary && previous.primary)
          fail(
            `Browse family ${family.id} has more than one primary: ${previous.primary}, ${part.id}.`,
          );
        if (family.primary) previous.primary = part.id;
      } else
        browseFamilies.set(family.id, {
          label: family.label,
          category: part.category,
          subgroup: part.subgroup,
          ...(family.primary ? { primary: part.id } : {}),
        });
    }
    const productErrors = validateProductProfile(part.product);
    if (productErrors.length) fail(`Invalid product profile: ${productErrors.join(' ')}`);
    if (part.mechanismExecution !== undefined) {
      const execution = part.mechanismExecution;
      if (
        !part.browseFamily ||
        !execution ||
        typeof execution !== 'object' ||
        Array.isArray(execution) ||
        !Number.isSafeInteger(execution.outputs) ||
        execution.outputs < 1 ||
        !['construction', 'description'].every(
          (key) =>
            typeof execution[key as keyof typeof execution] === 'string' &&
            String(execution[key as keyof typeof execution]).trim(),
        ) ||
        !Number.isFinite(execution.travelDegrees) ||
        execution.travelDegrees <= 0 ||
        !Array.isArray(execution.screws) ||
        !execution.screws.length ||
        !Array.isArray(execution.motors) ||
        !execution.motors.length ||
        !['materials', 'processes'].every((key) => {
          const values = execution[key as 'materials' | 'processes'];
          return (
            Array.isArray(values) &&
            values.length > 0 &&
            values.every((value) => typeof value === 'string' && value.trim()) &&
            new Set(values).size === values.length
          );
        })
      )
        fail(
          'Mechanism execution requires a browse family, screw and motor models, materials, processes, travel, construction, description and positive integer output count.',
        );
      if (
        execution.screws.some(
          (screw) =>
            !screw ||
            typeof screw.designation !== 'string' ||
            !screw.designation.trim() ||
            !['ball-screw', 'lead-screw'].includes(screw.kind) ||
            !Number.isFinite(screw.lead) ||
            screw.lead <= 0 ||
            (screw.pitch !== undefined && (!Number.isFinite(screw.pitch) || screw.pitch <= 0)) ||
            (screw.starts !== undefined &&
              (!Number.isSafeInteger(screw.starts) || screw.starts < 1)) ||
            (screw.pitch !== undefined &&
              screw.starts !== undefined &&
              Math.abs(screw.pitch * screw.starts - screw.lead) > 1e-6) ||
            !validWhen(screw.when),
        ) ||
        execution.motors.some(
          (motor) =>
            !motor ||
            typeof motor.model !== 'string' ||
            !motor.model.trim() ||
            !validWhen(motor.when),
        )
      )
        fail('Mechanism execution contains invalid screw or motor characteristics.');
      if (
        execution.bearings !== undefined &&
        (!Array.isArray(execution.bearings) ||
          execution.bearings.some(
            (bearing) =>
              !bearing ||
              typeof bearing.model !== 'string' ||
              !bearing.model.trim() ||
              !validWhen(bearing.when),
          ))
      )
        fail('Mechanism execution contains invalid bearing characteristics.');
      if (part.product.kind !== 'assembly')
        fail('Mechanism executions must retain their physical assembly product type.');
    }
    if (part.composition !== undefined && typeof part.composition !== 'function')
      fail('Composition must be a function when provided.');
    if (part.initializeGeometry !== undefined && typeof part.initializeGeometry !== 'function')
      fail('Geometry initialization must be a function when provided.');
    if (
      part.catalogIdentityParameters !== undefined &&
      typeof part.catalogIdentityParameters !== 'function'
    )
      fail('Catalog identity parameters must be a function when provided.');
    if (
      part.product.supply === 'manufactured' &&
      ['assembly', 'complex', 'kit'].includes(part.product.kind) &&
      typeof part.composition !== 'function'
    )
      fail(
        'Manufactured assemblies, complexes and kits require a physical library composition function.',
      );
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
      if (!['number', 'select', 'boolean', 'text'].includes(field.type))
        fail(`Unknown parameter type for ${field.key}.`);
      if (field.optionalWhenHidden !== undefined && typeof field.optionalWhenHidden !== 'boolean')
        fail(`optionalWhenHidden must be boolean for ${field.key}.`);
      if (field.optionalWhenHidden && typeof field.visibleWhen !== 'function')
        fail(`Optional hidden field ${field.key} requires a visibility condition.`);
      if (!(field.key in part.defaults)) {
        if (
          field.optionalWhenHidden &&
          !field.visibleWhen!(part.defaults, part.states?.[0]?.id ?? 'default')
        )
          continue;
        fail(`Missing default for ${field.key}.`);
      }
      const value = part.defaults[field.key];
      if (field.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value)))
        fail(`Default ${field.key} must be a finite number.`);
      if (field.type === 'boolean' && typeof value !== 'boolean')
        fail(`Default ${field.key} must be boolean.`);
      if (field.type === 'text' && typeof value !== 'string')
        fail(`Default ${field.key} must be a string.`);
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
      if (!isValidPresetId(preset.id))
        fail(
          `Invalid preset ID: ${String(preset.id)}. Use a nonempty, trimmed ID without colons or control characters; custom is reserved.`,
        );
      if (presetIds.has(preset.id)) fail(`Duplicate preset ID: ${preset.id}.`);
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
        if (
          field!.type === 'select' &&
          (typeof value !== 'string' ||
            (!preset.catalog?.attributeOptions?.[key] &&
              !field!.options?.some((option) => option.value === value)))
        )
          fail(`Catalog characteristic ${key} must match an option in ${preset.id}.`);
      }
      for (const [key, alternatives] of Object.entries(preset.catalog?.attributeOptions ?? {})) {
        const field = part.catalogFilterFields?.find((field) => field.key === key);
        if (
          field?.type !== 'select' ||
          !Array.isArray(alternatives) ||
          !alternatives.length ||
          new Set(alternatives).size !== alternatives.length ||
          alternatives.some(
            (value) =>
              typeof value !== 'string' || !field.options?.some((option) => option.value === value),
          )
        )
          fail(`Catalog alternatives ${key} must match distinct options in ${preset.id}.`);
      }
      for (const [key, choices] of Object.entries(preset.catalog?.parameterChoices ?? {})) {
        const field =
          part.catalogFilterFields?.find((field) => field.key === key) ??
          part.parameters.find((field) => field.key === key);
        if (
          field?.type !== 'number' ||
          !Array.isArray(choices) ||
          !choices.length ||
          new Set(choices).size !== choices.length ||
          choices.some((value) => typeof value !== 'number' || !Number.isFinite(value))
        )
          fail(`Catalog size choices ${key} must be distinct finite numbers in ${preset.id}.`);
      }
    }
    for (const selection of part.catalogSelection ?? [])
      if (!keys.has(selection.key))
        fail(`Catalog selection refers to unknown parameter ${selection.key}.`);
  }
  for (const module of modules)
    if (browseFamilies.has(module.part.id) && module.part.browseFamily?.id !== module.part.id)
      throw new Error(
        `Browse family ID ${module.part.id} conflicts with an unrelated physical part.`,
      );
  const byId = new Map(modules.map((module) => [module.part.id, module]));
  const complete = new Set<string>();
  const visit = (id: string, ancestors: string[] = []) => {
    if (ancestors.includes(id))
      throw new Error(`Cyclic part dependency: ${[...ancestors, id].join(' -> ')}`);
    if (complete.has(id)) return;
    const module = byId.get(id);
    if (!module) throw new Error(`Missing library dependency: ${id}.`);
    const dependencies = module.dependencies ?? [];
    if (!Array.isArray(dependencies) || new Set(dependencies).size !== dependencies.length)
      throw new Error(`Invalid dependencies in ${id}.`);
    for (const dependency of dependencies) {
      if (!PART_ID_PATTERN.test(dependency)) throw new Error(`Invalid dependency in ${id}.`);
      visit(dependency, [...ancestors, id]);
    }
    complete.add(id);
  };
  for (const id of byId.keys()) visit(id);
  return [...modules]
    .sort((a, b) => a.order - b.order || a.part.id.localeCompare(b.part.id))
    .map((module) => module.part);
}

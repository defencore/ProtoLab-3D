import type { Parameters, PartDefinition, Preset } from './types';
import type { ProductConfiguration, ProductKind, SupplyKind } from './product-types';
import { selectedMatchingPreset } from './preset-resolution';
import { libraryEntryId } from './library-identity';
import { availableModelState } from './part-selection';

export interface EskdIdentity {
  libraryId: string;
  presetId?: string;
  libraryEntryId: string;
  designation: string;
  name: string;
  revision: string;
  baseDesignation: string;
  execution: string;
  configurationKey: string;
  supply: SupplyKind;
  productType: ProductKind;
  label: string;
}

export function eskdFileStem(identity: EskdIdentity): string {
  const name = identity.designation || identity.name;
  return `${name}_rev-${identity.revision}`.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

/** A size alone is not an ordering identity when several standards share that size. */
export function supplierDesignation(catalog: NonNullable<Preset['catalog']>): string {
  const code = catalog.productCodes?.[0];
  if (code && !catalog.designation.toUpperCase().includes(code.toUpperCase())) return code;
  return catalog.standard && !catalog.designation.includes(catalog.standard)
    ? `${catalog.designation} ${catalog.standard}`
    : catalog.designation;
}

// These controls change representation, never the physical design or execution.
const presentationKeys = new Set([
  'detail',
  'meshBackend',
  'meshConform',
  'nativeRefine',
  'meshEdgeTolerance',
  'meshMinimumTriangleArea',
]);

export function stableDesignText(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b, 'en')))
      : item,
  );
}

/** Stable 64-bit draft identifier; exact definitions are also checked for collisions in projects. */
function fingerprint(text: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    first = Math.imul(first ^ text.charCodeAt(i), 0x01000193);
    second = Math.imul(second ^ text.charCodeAt(i), 0x85ebca6b);
  }
  return [first, second]
    .map((word) => (word >>> 0).toString(16).padStart(8, '0'))
    .join('')
    .toUpperCase();
}

/** Canonical physical parameters, independent of preview tessellation and property ordering. */
export function physicalParameters(parameters: Parameters): Parameters {
  return Object.fromEntries(
    Object.entries(parameters)
      .filter(([key]) => !presentationKeys.has(key))
      .map(([key, value]) => {
        if (key !== 'recipe' || typeof value !== 'string') return [key, value];
        try {
          return [key, stableDesignText(JSON.parse(value))];
        } catch {
          return [key, value];
        } // Parameter validation reports malformed authored geometry.
      }),
  );
}

export function productIdentityParameters(
  part: PartDefinition,
  parameters: Parameters,
): Parameters {
  return physicalParameters(
    part.identityParameters ? part.identityParameters(parameters) : parameters,
  );
}

export function physicalProductState(
  part: PartDefinition,
  selected: string,
  parameters: Parameters = part.defaults,
): string {
  return part.physicalStates?.includes(selected) &&
    availableModelState(part, parameters, selected) === selected
    ? selected
    : availableModelState(
        part,
        parameters,
        part.states?.find((item) => item.id === 'assembled')?.id ??
          part.states?.[0]?.id ??
          'default',
      );
}

/** ProtoLab's editable enterprise convention, not a normative ESKD classification code. */
export function eskdIdentity(
  part: PartDefinition,
  parameters: Parameters,
  state: string,
  presetId?: string,
  configuration?: ProductConfiguration,
): EskdIdentity {
  const preset = selectedMatchingPreset(part, parameters, presetId);
  const catalog = preset?.catalog;
  const supply =
    configuration?.supply ?? (catalog ? preset?.product?.supply : undefined) ?? part.product.supply;
  const bought = supply === 'purchased' || supply === 'standard';
  const sameSupplier =
    !configuration?.procurement?.source || configuration.procurement.source === catalog?.sourceUrl;
  const keys = bought && part.catalogSelectionOnly ? catalog?.verifiedParameters : undefined;
  const physical = keys?.length
    ? Object.fromEntries(keys.map((key) => [key, parameters[key]]))
    : productIdentityParameters(part, parameters);
  const configurationKey = fingerprint(
    stableDesignText({
      libraryId: part.id,
      parameters: physical,
      state: physicalProductState(part, state, parameters),
      supply,
      ...(supply === 'manufactured'
        ? {
            manufacturing: configuration?.manufacturing ?? {
              material: '',
              blank: '',
              processes: part.product.processes,
              requirements: [],
            },
          }
        : {}),
    }),
  );
  const generatedBase = `PL3D.${part.id
    .replace(/[^a-zA-Z0-9]+/g, '.')
    .toUpperCase()
    .slice(0, 64)}`;
  const baseDesignation =
    supply === 'manufactured' ? configuration?.baseDesignation || generatedBase : '';
  const execution = supply === 'manufactured' ? (configuration?.execution ?? configurationKey) : '';
  const requestedDesignation =
    configuration?.designation.trim() ||
    (bought
      ? configuration?.procurement?.designation || (catalog ? supplierDesignation(catalog) : '')
      : supply === 'manufactured'
        ? `${baseDesignation}${execution ? `-${execution}` : ''}`
        : '');
  const designation =
    bought && catalog && sameSupplier && requestedDesignation === catalog.designation
      ? supplierDesignation(catalog)
      : requestedDesignation;
  const name = bought
    ? configuration?.procurement?.name ||
      (sameSupplier ? catalog?.name : undefined) ||
      (catalog && sameSupplier ? preset!.name : configuration?.name) ||
      part.name
    : configuration?.name || part.name;
  const revision = configuration?.revision || 'A';
  return {
    libraryId: part.id,
    ...(preset ? { presetId: preset.id } : {}),
    libraryEntryId: libraryEntryId(part.id, preset?.id),
    designation,
    name,
    revision,
    baseDesignation,
    execution,
    configurationKey,
    supply,
    productType: part.product.kind,
    label: bought ? name : `${designation ? `${designation} ` : ''}${name} · rev ${revision}`,
  };
}

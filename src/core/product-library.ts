import type { PartDefinition } from './types';
import type {
  ManufacturingProcess,
  ProductKind,
  ProductProfile,
  SpecificationSection,
  SupplyKind,
} from './product-types';
import { libraryCategories, libraryCategoryIcon, sortLibraryParts } from './library';

export const productKindLabels: Record<ProductKind, string> = {
  detail: 'Details',
  assembly: 'Assembly units',
  complex: 'Complexes',
  kit: 'Kits',
  material: 'Materials and stock',
  reference: 'Engineering references',
};

export const supplyKindLabels: Record<SupplyKind, string> = {
  manufactured: 'Manufactured',
  standard: 'Standard products',
  purchased: 'Purchased',
  reference: 'Engineering references',
};

export const manufacturingProcessLabels: Record<ManufacturingProcess, string> = {
  turning: 'Turning',
  milling: 'Milling',
  cutting: 'Cutting',
  drilling: 'Drilling',
  bending: 'Bending',
  printing: '3D printing',
  moulding: 'Moulding',
  winding: 'Spring and wire forming',
  assembly: 'Assembly',
};

export type ProductLibraryView = 'engineering' | 'product-kind' | 'supply' | 'process';

export const productLibraryViewLabels: Record<ProductLibraryView, string> = {
  engineering: 'Function',
  'product-kind': 'Product type',
  supply: 'Make or buy',
  process: 'Manufacturing process',
};

export interface ProductLibraryFilter {
  kind?: ProductKind;
  supply?: SupplyKind;
  process?: ManufacturingProcess;
}

export interface ProductLibraryGroup {
  id: string;
  label: string;
  icon: PartDefinition['icon'];
  parts: PartDefinition[];
}

/** Validate portable metadata without inferring engineering claims from geometry or names. */
export function validateProductProfile(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return ['A product profile object is required.'];
  const profile = value as Record<string, unknown>;
  const errors: string[] = [];
  if (typeof profile.kind !== 'string' || !Object.hasOwn(productKindLabels, profile.kind))
    errors.push('Choose a known product type.');
  if (typeof profile.supply !== 'string' || !Object.hasOwn(supplyKindLabels, profile.supply))
    errors.push('Choose a known supply policy.');
  if (typeof profile.description !== 'string' || !profile.description.trim())
    errors.push('A product classification description is required.');
  if (
    !Array.isArray(profile.processes) ||
    profile.processes.some(
      (process) =>
        typeof process !== 'string' || !Object.hasOwn(manufacturingProcessLabels, process),
    ) ||
    new Set(profile.processes).size !== profile.processes.length
  )
    errors.push('Manufacturing processes must be unique known process IDs.');
  if (
    profile.supply === 'manufactured' &&
    Array.isArray(profile.processes) &&
    profile.processes.length === 0
  )
    errors.push('A manufactured product needs an explicit process route.');
  if (
    !Array.isArray(profile.releaseRequirements) ||
    !profile.releaseRequirements.length ||
    profile.releaseRequirements.some(
      (requirement) => typeof requirement !== 'string' || !requirement.trim(),
    ) ||
    new Set(profile.releaseRequirements).size !== profile.releaseRequirements.length
  )
    errors.push('Unique nonempty production release requirements are required.');
  if ((profile.kind === 'reference') !== (profile.supply === 'reference'))
    errors.push('An engineering reference must retain reference product type and supply policy.');
  return errors;
}

/** The configured supply policy controls purchased/standard specification sections. */
export function specificationSection(
  product: ProductProfile | Pick<PartDefinition, 'product'>,
  supply?: SupplyKind,
): SpecificationSection {
  const profile = 'product' in product ? product.product : product;
  const configuredSupply = supply ?? profile.supply;
  if (profile.kind === 'reference' || configuredSupply === 'reference')
    throw new Error('Resolve engineering references before assigning specification sections.');
  if (profile.kind === 'material') return 'materials';
  if (configuredSupply === 'standard') return 'standard-products';
  if (configuredSupply === 'purchased') return 'other-products';
  const sections: Record<Exclude<ProductKind, 'reference' | 'material'>, SpecificationSection> = {
    detail: 'details',
    assembly: 'assemblies',
    complex: 'complexes',
    kit: 'kits',
  };
  return sections[profile.kind];
}

export function filterProductLibrary(
  parts: readonly PartDefinition[],
  filter: ProductLibraryFilter = {},
): PartDefinition[] {
  return sortLibraryParts(parts).filter(
    ({ product }) =>
      (!filter.kind || product.kind === filter.kind) &&
      (!filter.supply || product.supply === filter.supply) &&
      (!filter.process || product.processes.includes(filter.process)),
  );
}

/** Process views intentionally list a family in each of its declared processes. */
export function groupProductLibrary(
  parts: readonly PartDefinition[],
  view: ProductLibraryView = 'engineering',
): ProductLibraryGroup[] {
  const ordered = sortLibraryParts(parts);
  if (view === 'engineering')
    return libraryCategories(ordered).map((category) => ({
      id: category,
      label: category,
      icon: libraryCategoryIcon(category),
      parts: ordered.filter((part) => part.category === category),
    }));

  const groups: ProductLibraryGroup[] = [];
  const add = (
    id: string,
    label: string,
    predicate: (part: PartDefinition) => boolean,
    icon: PartDefinition['icon'] = 'box',
  ) => {
    const groupParts = ordered.filter(predicate);
    if (groupParts.length) groups.push({ id, label, icon, parts: groupParts });
  };
  if (view === 'product-kind')
    for (const [kind, label] of Object.entries(productKindLabels))
      add(kind, label, (part) => part.product.kind === kind, kind === 'assembly' ? 'gear' : 'box');
  else if (view === 'supply')
    for (const [supply, label] of Object.entries(supplyKindLabels))
      add(supply, label, (part) => part.product.supply === supply);
  else if (view === 'process') {
    for (const [process, label] of Object.entries(manufacturingProcessLabels))
      add(
        process,
        label,
        (part) => part.product.processes.includes(process as ManufacturingProcess),
        process === 'assembly' ? 'gear' : 'box',
      );
    add(
      'no-process',
      'Select a supplier or resolve the reference',
      (part) => !part.product.processes.length,
    );
  } else throw new Error(`Unknown product library view: ${view}.`);
  return groups;
}

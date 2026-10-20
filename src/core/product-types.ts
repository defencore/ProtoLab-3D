import type { Parameters } from './types';

export type ProductKind = 'detail' | 'assembly' | 'complex' | 'kit' | 'material' | 'reference';
export type SupplyKind = 'manufactured' | 'standard' | 'purchased' | 'reference';
export type ManufacturingProcess =
  | 'turning'
  | 'milling'
  | 'cutting'
  | 'drilling'
  | 'bending'
  | 'printing'
  | 'moulding'
  | 'winding'
  | 'assembly';

/** A library family is a design definition, never an approval to manufacture. */
export interface ProductProfile {
  kind: ProductKind;
  supply: SupplyKind;
  description: string;
  processes: ManufacturingProcess[];
  /** Requirements that a configured product must resolve before design release. */
  releaseRequirements: string[];
}

export interface ManufacturingDefinition {
  material: string;
  blank: string;
  processes: ManufacturingProcess[];
  requirements: string[];
}

export interface ProcurementDefinition {
  designation: string;
  manufacturer: string;
  source: string;
  /** An actual normative product standard, not a geometry-envelope label. */
  standard?: string;
}

export interface ProductConfiguration {
  id: string;
  libraryId: string;
  parameters: Parameters;
  state: string;
  presetId?: string;
  designation: string;
  name: string;
  revision: string;
  supply: SupplyKind;
  manufacturing?: ManufacturingDefinition;
  procurement?: ProcurementDefinition;
}

/** Local placement, independent of exploded/cutaway display geometry. */
export interface ProductPlacement {
  translation: [number, number, number];
  rotation: [number, number, number];
}

export interface ProductOccurrence {
  id: string;
  parentId: string | null;
  configurationId: string;
  position: string;
  quantity: number;
  placement: ProductPlacement;
  notes: string;
}

export type SpecificationSection =
  | 'documents'
  | 'complexes'
  | 'assemblies'
  | 'details'
  | 'standard-products'
  | 'other-products'
  | 'materials'
  | 'kits';

export interface DesignDocument {
  id: string;
  configurationId: string;
  designation: string;
  name: string;
  kind: 'drawing' | 'assembly-drawing' | 'specification' | 'model' | 'instructions' | 'other';
  revision: string;
  format: string;
  file: string;
}

export interface DesignProject {
  schemaVersion: 1;
  id: string;
  name: string;
  designation: string;
  revision: string;
  documentationPolicy: 'enterprise-eskd' | 'dstu-eskd' | 'gost-eskd';
  documentationRules: DocumentationRules;
  configurations: ProductConfiguration[];
  occurrences: ProductOccurrence[];
  documents: DesignDocument[];
}

export interface DocumentationRules {
  sectionOrder: SpecificationSection[];
  sectionLabels: Record<SpecificationSection, string>;
  /** Empty means no enterprise designation-format constraint. */
  designationPattern: string;
  requiredDocuments: DesignDocument['kind'][];
}

export interface AssemblyComponent {
  notes?: string;
  id: string;
  libraryId: string;
  parameters: Parameters;
  state: string;
  presetId?: string;
  quantity: number;
  placement: ProductPlacement;
  name: string;
  supply: SupplyKind;
  manufacturing?: ManufacturingDefinition;
  procurement?: ProcurementDefinition;
  children?: AssemblyComponent[];
}

export interface AssemblyDefinition {
  components: AssemblyComponent[];
  /** Explicit unresolved engineering items; these prevent release, not preview. */
  issues: string[];
}

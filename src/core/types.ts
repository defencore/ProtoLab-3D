import type { Group } from 'three';
import type {
  AssemblyComponent,
  AssemblyDefinition,
  ProductProfile,
  SupplyKind,
} from './product-types';

export type Parameters = Record<string, number | string | boolean>;

export interface AssemblyReference {
  /** Boolean inspection control that shows this occurrence in the preview. */
  visibilityParameter: string;
  /** Return the same occurrence as the preview, even when hidden by its control. */
  component: (
    parameters: Parameters,
    state: string,
  ) => (AssemblyComponent & { supply: 'reference' }) | undefined;
}

export interface ParameterDefinition {
  key: string;
  label: string;
  symbol?: string;
  type: 'number' | 'select' | 'boolean' | 'text';
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  group: string;
  description?: string;
  options?: {
    label: string;
    value: string;
    /** Dependent choices stay available only for a compatible configuration. */
    availableWhen?: (parameters: Parameters) => boolean;
  }[];
  visibleWhen?: (parameters: Parameters, state?: string) => boolean;
  /** A mode-specific field may be absent while hidden; present values are still validated. */
  optionalWhenHidden?: boolean;
  filterable?: boolean;
  catalogSummary?: boolean;
  catalogCondition?: boolean;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  parameters: Parameters;
  /** An explicitly selected supplier product can be bought as a complete opaque unit. */
  product?: { supply: SupplyKind };
  catalog?: {
    /** Original supplier listing title. Keep curated selector names separate. */
    name?: string;
    designation: string;
    manufacturer?: string;
    standard?: string;
    sourceName: string;
    sourceUrl: string;
    sourceKind?: 'attachment';
    verifiedParameters: string[];
    /** Evidence for physical geometry, independent of SKU identity and valid CAD topology. */
    geometryEvidence?: {
      kind: 'manufacturer-cad' | 'community-cad' | 'source-dimensions' | 'envelope';
      summary: string;
      limitations: string;
      sourceUrl: string;
      sourceSha256?: string;
    };
    parameterRanges?: Record<string, { min: number; max: number }>;
    /** Explicit available dimensions; intermediate values in a displayed range are not implied. */
    parameterChoices?: Record<string, number[]>;
    productCodes?: string[];
    alternateSourceUrls?: string[];
    specifications?: { label: string; value: string }[];
    /** Published model characteristics, independent of editable geometry or pose. Missing means unknown. */
    attributes?: Record<string, number | string | boolean>;
    /** Published alternatives within one supplier family, not a selected order execution. */
    attributeOptions?: Record<string, string[]>;
    attributeConditions?: Record<string, string>;
  };
}

export interface FabricationFile {
  id: string;
  label: string;
  description: string;
  name: string;
  type: string;
  content: string;
}

export interface CatalogSortOption {
  key: string;
  label: string;
  direction: 'asc' | 'desc';
  /** Multiply published dimensions, for example to compare outside enclosure volumes. */
  productOf?: string[];
}

export interface PartDefinition {
  /** Declarative component facts for discovery; geometry and preview builders are never searched. */
  discovery?: {
    kind: 'power' | 'bearing' | 'width';
    key: string;
    label: string;
    value: string | number;
    unit?: string;
    range?: { min: number; max: number };
    when?: Parameters;
  }[];
  fabricationFiles?: (parameters: Parameters) => FabricationFile[];
  id: string;
  /** Generic navigation title; component-specific names belong to configurations. */
  browseLabel?: string;
  /** Shared navigation entry; physical package/product identity remains independent. */
  browseFamily?: { id: string; label: string; primary?: boolean };
  /** A finished mechanism construction offered inside its shared family catalog. */
  mechanismExecution?: {
    outputs: number;
    construction: string;
    description: string;
    /** Alternatives are real screw configurations; lead is travel per revolution in mm. */
    screws: {
      designation: string;
      kind: 'ball-screw' | 'lead-screw';
      lead: number;
      pitch?: number;
      starts?: number;
      /** Parameter values selecting this screw in a configurable construction. */
      when?: Parameters;
    }[];
    motors: { model: string; when?: Parameters }[];
    /** Exact bearing models used by the selected construction or bearing kit. */
    bearings?: { model: string; when?: Parameters }[];
    /** Structural/transmission materials and processes for the custom mechanism details. */
    materials: string[];
    processes: string[];
    /** Symmetric output travel, expressed as ± this angle in degrees. */
    travelDegrees: number;
  };
  product: ProductProfile;
  /** Only parameters that change the physical design, excluding hidden template values. */
  identityParameters?: (parameters: Parameters) => Parameters;
  /** Normalize documented inspection controls only for source-model matching, never geometry identity. */
  catalogIdentityParameters?: (parameters: Parameters, preset: Preset) => Parameters;
  /** Physical library occurrences. Display states must not change the bill of materials. */
  composition?: (parameters: Parameters) => AssemblyDefinition;
  /** Optional inspection rows for the Components tab, separate from physical composition. */
  assemblyReferences?: readonly AssemblyReference[];
  preview?: 'worker';
  /** These states select separate physical supplier units, rather than inspection views. */
  physicalStates?: string[];
  /** Prepare asynchronous geometry resources before calling synchronous builders or dimensions. */
  initializeGeometry?: (parameters: Parameters, state: string) => Promise<void>;
  /** Physical export contours can omit inspection references and visual thread relief. */
  buildExportGeometry?: (parameters: Parameters, state: string) => Group;
  /** Physical CAD envelope when an inspection preview includes non-exported references. */
  exportDimensions?: (parameters: Parameters, state: string) => [number, number, number];
  /** Standalone FreeCAD recipe and bounds when copying a model requires additional context. */
  standaloneCad?: (
    parameters: Parameters,
    state: string,
  ) => { python: string; dimensions: [number, number, number] };
  defaultSelection?: boolean;
  name: string;
  validationNotice?: string;
  category: string;
  subgroup: string;
  description: string;
  keywords: string[];
  icon:
    | 'bearing'
    | 'bolt'
    | 'spring'
    | 'box'
    | 'bracket'
    | 'wheel'
    | 'gear'
    | 'rail'
    | 'magnet'
    | 'wing'
    | 'camera'
    | 'circuit';
  standard?: string;
  complexity: string;
  parameters: ParameterDefinition[];
  defaults: Parameters;
  presets: Preset[];
  states?: {
    id: string;
    label: string;
    description: string;
    availableWhen?: (parameters: Parameters) => boolean;
  }[];
  validate: (parameters: Parameters, state: string) => string[];
  buildGeometry: (parameters: Parameters, state: string) => Group;
  python: (parameters: Parameters, state: string) => string;
  /** Rendered-state envelope, including any inspection references. */
  dimensions: (parameters: Parameters, state: string) => [number, number, number];
  notes?: string;
  assessment?: (parameters: Parameters) => string[];
  sources?: { label: string; url: string }[];
  updateParameters?: (parameters: Parameters, changedKey: string) => Parameters;
  presetMatchKeys?: string[];
  /** Fixed manufactured models are selected from the catalog; only pose/accessory controls remain editable. */
  catalogSelectionOnly?: boolean;
  catalogFilterFields?: ParameterDefinition[];
  catalogSortOptions?: CatalogSortOption[];
  catalogSelection?: {
    key: string;
    label?: string;
    format?: 'metric-thread';
  }[];
}

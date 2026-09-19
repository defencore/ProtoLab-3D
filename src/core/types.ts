import type { Group } from 'three';

export type Parameters = Record<string, number | string | boolean>;

export interface ParameterDefinition {
  key: string;
  label: string;
  symbol?: string;
  type: 'number' | 'select' | 'boolean';
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  group: string;
  description?: string;
  options?: { label: string; value: string }[];
  visibleWhen?: (parameters: Parameters, state?: string) => boolean;
  filterable?: boolean;
  catalogSummary?: boolean;
  catalogCondition?: boolean;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  parameters: Parameters;
  catalog?: {
    designation: string;
    manufacturer?: string;
    standard?: string;
    sourceName: string;
    sourceUrl: string;
    sourceKind?: 'attachment';
    verifiedParameters: string[];
    /** Evidence for physical geometry, independent of SKU identity and valid CAD topology. */
    geometryEvidence?: {
      kind: 'manufacturer-cad' | 'source-dimensions' | 'envelope';
      summary: string;
      limitations: string;
      sourceUrl: string;
      sourceSha256?: string;
    };
    parameterRanges?: Record<string, { min: number; max: number }>;
    productCodes?: string[];
    alternateSourceUrls?: string[];
    specifications?: { label: string; value: string }[];
    /** Published model characteristics, independent of editable geometry or pose. Missing means unknown. */
    attributes?: Record<string, number | string | boolean>;
    attributeConditions?: Record<string, string>;
  };
}

export interface PartDefinition {
  id: string;
  defaultSelection?: boolean;
  name: string;
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
  states?: { id: string; label: string; description: string }[];
  validate: (parameters: Parameters, state: string) => string[];
  buildGeometry: (parameters: Parameters, state: string) => Group;
  python: (parameters: Parameters, state: string) => string;
  dimensions: (parameters: Parameters, state: string) => [number, number, number];
  notes?: string;
  assessment?: (parameters: Parameters) => string[];
  sources?: { label: string; url: string }[];
  updateParameters?: (parameters: Parameters, changedKey: string) => Parameters;
  presetMatchKeys?: string[];
  /** Fixed manufactured models are selected from the catalog; only pose/accessory controls remain editable. */
  catalogSelectionOnly?: boolean;
  catalogFilterFields?: ParameterDefinition[];
  catalogSelection?: {
    key: string;
    label?: string;
    format?: 'metric-thread';
  }[];
}

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
  visibleWhen?: (parameters: Parameters) => boolean;
  filterable?: boolean;
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
    parameterRanges?: Record<string, { min: number; max: number }>;
    productCodes?: string[];
    alternateSourceUrls?: string[];
    specifications?: { label: string; value: string }[];
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
  icon: 'bearing' | 'bolt' | 'spring' | 'box' | 'bracket' | 'wheel' | 'gear' | 'rail';
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
  sources?: { label: string; url: string }[];
  updateParameters?: (parameters: Parameters, changedKey: string) => Parameters;
  presetMatchKeys?: string[];
  catalogSelection?: {
    key: string;
    label?: string;
    format?: 'metric-thread';
  }[];
}

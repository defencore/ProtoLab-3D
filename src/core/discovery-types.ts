import type { BrowseFamily } from './browse-families';
import type { PartDefinition, Preset } from './types';
import type { PresetEntry } from './preset-search';

export type DiscoveryFacet = 'power' | 'bearing' | 'width';

/** One documented or explicitly configured characteristic, never a computed mesh dimension. */
export interface DiscoveryTrait {
  kind: DiscoveryFacet;
  key: string;
  label: string;
  value: string | number;
  unit?: string;
  range?: { min: number; max: number };
  choices?: number[];
}

export interface DiscoveryFilters {
  power: string;
  bearing: string;
  widthKind: string;
  width: { min: string; max: string };
}

export interface DiscoveryCandidate {
  id: string;
  family: BrowseFamily;
  part: PartDefinition;
  preset: Preset;
  entry: PresetEntry;
  traits: DiscoveryTrait[];
}

export interface DiscoveryOption {
  value: string;
  label: string;
  count: number;
}

export interface DiscoverySuggestion {
  id: string;
  kind: DiscoveryFacet;
  label: string;
  detail: string;
  count: number;
  filters: Partial<DiscoveryFilters>;
  query: string;
}

export interface DiscoveryChoices {
  power: DiscoveryOption[];
  bearing: DiscoveryOption[];
  widthKind: DiscoveryOption[];
}

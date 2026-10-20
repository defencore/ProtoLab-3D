import type { PartDefinition } from './types';
import type { BrowseFamily } from './browse-families';
import { groupProductLibrary, type ProductLibraryView } from './product-library';

export const libraryAreas = [
  {
    id: 'hardware',
    label: 'Hardware',
    icon: 'bolt',
    description: 'Profiles, mounts, fasteners and springs',
  },
  {
    id: 'motion',
    label: 'Motion',
    icon: 'rail',
    description: 'Bearings, guides, drives and motors',
  },
  {
    id: 'electronics',
    label: 'Electronics',
    icon: 'circuit',
    description: 'Boards, power, controls and connectors',
  },
  {
    id: 'workshop',
    label: 'Workshop',
    icon: 'bracket',
    description: 'Jigs, cutting tools and workshop accessories',
  },
  {
    id: 'machines',
    label: 'Machines',
    icon: 'gear',
    description: 'Complete cutting and milling machines',
  },
  {
    id: 'vehicles',
    label: 'Vehicles',
    icon: 'wing',
    description: 'Frames, airframes and vehicle assemblies',
  },
] as const;
export type LibraryArea = (typeof libraryAreas)[number]['id'];

const categoryAreas: Readonly<Record<string, LibraryArea>> = {
  'STRUCTURAL PARTS': 'hardware',
  'FASTENERS & THREADS': 'hardware',
  SPRINGS: 'hardware',
  'BEARINGS & SEALS': 'motion',
  'LINEAR MOTION': 'motion',
  'TRANSMISSION & LINKAGES': 'motion',
  'MOTORS & ACTUATORS': 'motion',
  'PNEUMATICS & GAS': 'motion',
  'SWITCHES & BUTTONS': 'electronics',
  'POWER & MOTOR CONTROL': 'electronics',
  'ELECTRONICS & VISION': 'electronics',
  'CONNECTORS & INTERFACES': 'electronics',
  'WORKSHOP TOOLS': 'workshop',
  'MACHINE TOOLS': 'machines',
  'VEHICLE STRUCTURES': 'vehicles',
};

/** Function-based browsing is independent of product type and supply policy. */
export function libraryArea(category: string): LibraryArea {
  // Imported categories must remain reachable before their own navigation is registered.
  return Object.hasOwn(categoryAreas, category) ? categoryAreas[category] : 'hardware';
}

export function libraryLabel(value: string): string {
  if (value !== value.toUpperCase()) return value;
  return value
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase())
    .replace(/\b(cnc|dc|bec|srs|pcb)\b/gi, (word) => word.toUpperCase());
}

export interface LibraryNavigationGroup {
  id: string;
  label: string;
  icon: PartDefinition['icon'];
  entries: BrowseFamily[];
}

/** Navigation grouping never merges physical definitions or changes their product metadata. */
export function libraryNavigationGroups(
  entries: BrowseFamily[],
  view: ProductLibraryView,
): LibraryNavigationGroup[] {
  const groups = groupProductLibrary(
    entries.flatMap((entry) => entry.members),
    view,
  );
  const mixed: BrowseFamily[] = [];
  const destinations = new Map(groups.map((group) => [group.id, [] as BrowseFamily[]]));
  for (const entry of entries) {
    const memberIds = new Set(entry.members.map((part) => part.id));
    const matching = groups.filter((group) => group.parts.some((part) => memberIds.has(part.id)));
    if (entry.grouped && matching.length > 1) mixed.push(entry);
    else for (const group of matching) destinations.get(group.id)!.push(entry);
  }
  const result = groups.flatMap((group) => {
    const grouped = destinations.get(group.id)!;
    return grouped.length
      ? [{ id: group.id, label: libraryLabel(group.label), icon: group.icon, entries: grouped }]
      : [];
  });
  if (mixed.length)
    result.push({
      id: 'mixed-families',
      label:
        view === 'product-kind'
          ? 'Multiple product types'
          : view === 'supply'
            ? 'Multiple supply policies'
            : 'Multiple manufacturing processes',
      icon: 'box',
      entries: mixed,
    });
  return result;
}

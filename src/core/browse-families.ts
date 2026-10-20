import type { PartDefinition } from './types';
import { sortLibraryParts } from './library';

export interface BrowseFamily {
  id: string;
  label: string;
  grouped: boolean;
  members: PartDefinition[];
  primary: PartDefinition;
  category: string;
  subgroup: string;
  icon: PartDefinition['icon'];
}

export function familyId(part: PartDefinition): string {
  return part.browseFamily?.id ?? part.id;
}

export function familyLabel(part: PartDefinition): string {
  return part.browseFamily?.label ?? part.name;
}

/** The result contains real definitions, never a combined synthetic product. */
export function familyMembers(
  parts: readonly PartDefinition[],
  part: PartDefinition,
): PartDefinition[] {
  const id = familyId(part);
  return sortLibraryParts(parts.filter((candidate) => familyId(candidate) === id));
}

export function groupBrowseFamilies(parts: readonly PartDefinition[]): BrowseFamily[] {
  const grouped = new Map<string, PartDefinition[]>();
  for (const part of sortLibraryParts(parts)) {
    const id = familyId(part);
    const members = grouped.get(id);
    if (members) members.push(part);
    else grouped.set(id, [part]);
  }
  return [...grouped.values()].map((members) => {
    const primary = members.find((part) => part.browseFamily?.primary) ?? members[0];
    return {
      id: familyId(primary),
      label: familyLabel(primary),
      grouped: !!primary.browseFamily,
      members,
      primary,
      category: primary.category,
      subgroup: primary.subgroup,
      icon: primary.icon,
    };
  });
}

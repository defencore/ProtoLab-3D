import type { PartDefinition, Preset } from './types';

/** Taxonomy IDs remain unchanged; only their visible section labels use sentence case. */
export function libraryLabel(value: string): string {
  if (value !== value.toUpperCase()) return value;
  return value
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase())
    .replace(/\b(cnc|dc|bec|srs|pcb|led)\b/gi, (word) => word.toUpperCase());
}

/** Navigation names the mechanism type; configurations retain their component-specific names. */
export function familyLabel(
  part: Pick<PartDefinition, 'name' | 'browseLabel' | 'browseFamily'>,
): string {
  return part.browseFamily?.label ?? part.browseLabel ?? part.name;
}

/** Curated names identify variants; original source designations remain separate evidence. */
export function presetLabels(preset: Pick<Preset, 'name' | 'catalog'>): {
  name: string;
  designation: string | undefined;
} {
  const designation = preset.catalog?.designation;
  return {
    name: preset.name,
    designation: designation && designation !== preset.name ? designation : undefined,
  };
}

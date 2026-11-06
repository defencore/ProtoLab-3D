import type { Parameters, PartDefinition, Preset } from './types';
import { defaultPartSelection, type PartSelection } from './part-selection';
import { matchesNumericRange, parseNumericRange } from './numeric-range';
import { translateSearchQuery } from './search-query';
import { isQualifiedLibraryEntryId, libraryEntryId } from './library-identity';

export interface MechanismExecutionFilters {
  drive: string;
  outputs: string;
  query: string;
  screwKind?: string;
  motor?: string;
  material?: string;
  process?: string;
  lead?: { min: string; max: string };
}

export const mechanismFacetLabels = {
  screwKind: 'Screw type',
  drive: 'Screw model',
  motor: 'Motor model',
  outputs: 'Outputs',
  material: 'Component material',
  process: 'Manufacturing process',
} as const;
export type MechanismFacet = keyof typeof mechanismFacetLabels;
export const screwKindLabels: Record<string, string> = {
  'ball-screw': 'Ball screw',
  'lead-screw': 'Trapezoidal lead screw',
};

export function emptyMechanismFilters(): MechanismExecutionFilters {
  return {
    query: '',
    drive: '',
    outputs: '',
    screwKind: '',
    motor: '',
    material: '',
    process: '',
    lead: { min: '', max: '' },
  };
}

/** Session settings belong to one finished execution, never to another construction. */
export function mechanismExecutionSelection(
  part: PartDefinition,
  saved?: PartSelection,
): PartSelection {
  return saved?.partId === part.id
    ? { ...saved, parameters: { ...saved.parameters } }
    : defaultPartSelection(part);
}

function searchText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u00d7\u0445]/g, 'x')
    .replace(/\u00d8/gi, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

type Execution = NonNullable<PartDefinition['mechanismExecution']>;
type Screw = Execution['screws'][number];

function configuredScrews(execution: Execution, parameters: Parameters): Screw[] {
  return execution.screws.filter(
    (screw) =>
      !screw.when || Object.entries(screw.when).every(([key, value]) => parameters[key] === value),
  );
}

function configuredMotors(execution: Execution, parameters: Parameters) {
  return execution.motors.filter(
    (motor) =>
      !motor.when || Object.entries(motor.when).every(([key, value]) => parameters[key] === value),
  );
}

/** Shared descriptions cannot make two alternative screws satisfy one query. */
function constructionText(part: PartDefinition): string {
  const execution = part.mechanismExecution!;
  return searchText(
    [
      'rotary actuator mechanism motor',
      execution.construction,
      ...(execution.screws.length === 1 && execution.motors.length === 1
        ? [execution.description]
        : []),
      ...execution.materials,
      ...execution.processes,
      `${execution.outputs} ${execution.outputs === 1 ? 'output' : 'outputs'}`,
      `${execution.travelDegrees} degrees`,
    ].join(' '),
  );
}

function matchesConfiguration(
  part: PartDefinition,
  parameters: Parameters,
  preset: Preset | undefined,
  filters: MechanismExecutionFilters,
): boolean {
  const execution = part.mechanismExecution;
  if (!execution) return false;
  if (filters.outputs && String(execution.outputs) !== filters.outputs) return false;
  const motors = configuredMotors(execution, parameters);
  if (filters.motor && !motors.some((motor) => motor.model === filters.motor)) return false;
  if (filters.material && !execution.materials.includes(filters.material)) return false;
  if (filters.process && !execution.processes.includes(filters.process)) return false;
  const lead = parseNumericRange(filters.lead ?? {});
  if (lead.errors.length) return false;
  const reference = filters.query.trim();
  const exact =
    reference === part.id || (preset && reference === libraryEntryId(part.id, preset.id));
  if (!exact && isQualifiedLibraryEntryId(reference)) return false;
  const terms = exact
    ? []
    : searchText(translateSearchQuery(filters.query)).split(/\s+/).filter(Boolean);
  const fields = part.parameters.filter(
    (field) => part.presetMatchKeys?.includes(field.key) || field.key === 'motorModel',
  );
  const configurationText = [
    preset?.name ?? '',
    ...fields.map(
      (field) =>
        field.options?.find((option) => option.value === String(parameters[field.key]))?.label ??
        '',
    ),
  ].join(' ');
  const common = terms.length ? constructionText(part) : '';
  return configuredScrews(execution, parameters).some((screw) => {
    if (filters.drive && screw.designation !== filters.drive) return false;
    if (filters.screwKind && screw.kind !== filters.screwKind) return false;
    if (!matchesNumericRange(screw.lead, undefined, lead.range)) return false;
    if (!terms.length) return true;
    const searchable = searchText(
      [
        common,
        configurationText,
        ...motors.map((motor) => motor.model),
        screw.designation,
        screwKindLabels[screw.kind],
        `lead ${screw.lead} mm`,
        screw.pitch === undefined ? '' : `pitch ${screw.pitch} mm`,
        screw.starts === undefined ? '' : `${screw.starts} starts`,
        screw.starts === undefined
          ? ''
          : `${({ 1: 'single', 2: 'two', 4: 'four' } as Record<number, string>)[screw.starts] ?? screw.starts} start`,
      ].join(' '),
    );
    return terms.every((term) => searchable.includes(term));
  });
}

export function mechanismParametersMatch(
  part: PartDefinition,
  parameters: Parameters,
  filters: MechanismExecutionFilters,
): boolean {
  const preset = part.presets.find((item) =>
    (part.presetMatchKeys ?? Object.keys(item.parameters)).every(
      (key) => item.parameters[key] === parameters[key],
    ),
  );
  return matchesConfiguration(part, parameters, preset, filters);
}

export function matchingMechanismPreset(
  part: PartDefinition,
  filters: MechanismExecutionFilters,
): Preset | undefined {
  return part.presets.find((preset) =>
    matchesConfiguration(part, { ...part.defaults, ...preset.parameters }, preset, filters),
  );
}

/** Facets describe actual assemblies and alternatives; they do not invent products. */
export function filterMechanismExecutions(
  parts: readonly PartDefinition[],
  filters: MechanismExecutionFilters,
): PartDefinition[] {
  return parts.filter(
    (part) =>
      part.mechanismExecution &&
      (part.presets.length
        ? !!matchingMechanismPreset(part, filters)
        : matchesConfiguration(part, part.defaults, undefined, filters)),
  );
}

function facetValues(part: PartDefinition, key: MechanismFacet): string[] {
  const execution = part.mechanismExecution;
  if (!execution) return [];
  if (key === 'drive') return execution.screws.map((screw) => screw.designation);
  if (key === 'screwKind') return execution.screws.map((screw) => screw.kind);
  if (key === 'outputs') return [String(execution.outputs)];
  if (key === 'motor') return execution.motors.map((motor) => motor.model);
  return execution[key === 'material' ? 'materials' : 'processes'];
}

export function mechanismExecutionChoices(
  parts: readonly PartDefinition[],
  filters: MechanismExecutionFilters = emptyMechanismFilters(),
) {
  const facets = Object.fromEntries(
    (Object.keys(mechanismFacetLabels) as MechanismFacet[]).map((key) => {
      const values = new Set(parts.flatMap((part) => facetValues(part, key)));
      if (filters[key]) values.add(filters[key]!);
      return [
        key,
        [...values]
          .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }))
          .map((value) => ({
            value,
            label:
              key === 'screwKind'
                ? (screwKindLabels[value] ?? value)
                : key === 'outputs'
                  ? `${value} ${value === '1' ? 'output' : 'outputs'}`
                  : value,
            count: filterMechanismExecutions(parts, { ...filters, [key]: value }).length,
          })),
      ];
    }),
  ) as Record<MechanismFacet, { value: string; label: string; count: number }[]>;
  return {
    drives: facets.drive.map((item) => item.value),
    outputs: facets.outputs.map((item) => Number(item.value)),
    screwKinds: facets.screwKind.map((item) => item.value),
    motors: facets.motor.map((item) => item.value),
    materials: facets.material.map((item) => item.value),
    processes: facets.process.map((item) => item.value),
    facets,
  };
}

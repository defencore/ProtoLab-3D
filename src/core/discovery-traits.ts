import type { ParameterDefinition, Parameters, PartDefinition, Preset } from './types';
import type { DiscoveryTrait } from './discovery-types';
import { isPublishedValue, presetValue, searchableFields } from './catalog-models';
import { readNumericInterval } from './numeric-range';

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const present = (value: unknown): value is string | number =>
  finite(value) || (typeof value === 'string' && !!value.trim());

function available(field: ParameterDefinition, preset: Preset): boolean {
  return (
    !preset.catalog ||
    isPublishedValue(preset, field.key) ||
    !!readNumericInterval(preset.catalog.parameterRanges?.[field.key]) ||
    !!preset.catalog.parameterChoices?.[field.key]?.length
  );
}

function configured(value: { when?: Parameters }, parameters: Parameters): boolean {
  return (
    !value.when ||
    Object.entries(value.when).every(([key, expected]) => parameters[key] === expected)
  );
}

function widthCharacteristic(part: PartDefinition, field: ParameterDefinition): boolean {
  // Supplier B is the enclosure's documented outside Y dimension, not an inferred envelope.
  const supplierOutsideWidth =
    part.id === 'catalog-enclosure' &&
    field.key === 'width' &&
    /^Outside B\s*\(Y\)$/i.test(field.label);
  // Saw stock/profile controls describe the material being cut, not the machine's size.
  const workpieceCapacity =
    /\bworkpiece\b/i.test(field.group) ||
    (part.id === 'automatic-band-saw' && field.key === 'width') ||
    (part.id === 'automatic-tube-saw' && field.key === 'tubeDiameter');
  return (
    field.type === 'number' &&
    (field.unit ?? 'mm') === 'mm' &&
    !workpieceCapacity &&
    (supplierOutsideWidth ||
      /\bwidth\b/i.test(field.label) ||
      ['boardWidth', 'caseWidth', 'bodyWidth'].includes(field.key)) &&
    !/length|depth|height|capacity|cutout|opening|clearance|slot|keyway|image|pixel|pitch/i.test(
      field.label,
    )
  );
}

/** Search only source characteristics and explicit configurations, never preview geometry. */
export function discoveryTraits(part: PartDefinition, preset: Preset): DiscoveryTrait[] {
  const parameters = { ...part.defaults, ...preset.parameters };
  const fields = searchableFields(part).filter(
    (field) => (!field.visibleWhen || field.visibleWhen(parameters)) && available(field, preset),
  );
  const result: DiscoveryTrait[] = [];
  const fieldValue = (key: string) =>
    fields.some((field) => field.key === key) ? presetValue(preset, key) : undefined;
  const add = (trait: DiscoveryTrait) => {
    if (!present(trait.value)) return;
    if (trait.range && !readNumericInterval(trait.range)) return;
    result.push(trait);
  };

  for (const entry of part.discovery ?? []) {
    if (!configured(entry, parameters)) continue;
    const { when: _when, ...trait } = entry;
    add(trait);
  }
  for (const bearing of part.mechanismExecution?.bearings ?? [])
    if (configured(bearing, parameters))
      add({ kind: 'bearing', key: 'bearing', label: 'Installed bearing', value: bearing.model });

  for (const [minimum, maximum, key, label, unit] of [
    ['voltageMin', 'voltageMax', 'supplyVoltage', 'Supply voltage', 'V'],
    ['inputMin', 'inputMax', 'supplyVoltage', 'Input voltage', 'V'],
    ['cellsMin', 'cellsMax', 'batteryCells', 'Supported series cells', 'S'],
  ]) {
    const min = fieldValue(minimum),
      max = fieldValue(maximum);
    if (finite(min) && finite(max) && min <= max)
      add({
        kind: 'power',
        key,
        label,
        value: min === max ? min : `${min}–${max}`,
        unit,
        range: { min, max },
      });
  }

  for (const field of fields) {
    const raw = presetValue(preset, field.key);
    const selected = field.options?.find((option) => option.value === String(raw));
    const label = selected?.label ?? (present(raw) ? String(raw) : '');
    if (widthCharacteristic(part, field)) {
      const rawRange = preset.catalog?.parameterRanges?.[field.key];
      const range = readNumericInterval(rawRange);
      if (rawRange !== undefined && !range) continue;
      const choices = preset.catalog?.parameterChoices?.[field.key];
      if (
        choices !== undefined &&
        (!Array.isArray(choices) || !choices.length || !choices.every(finite))
      )
        continue;
      const value = finite(raw) ? raw : (choices?.[0] ?? range?.min);
      if (!finite(value)) continue;
      add({
        kind: 'width',
        key: field.key === 'width' ? `width:${slug(field.label)}` : field.key,
        label: field.label,
        value,
        unit: 'mm',
        ...(range ? { range } : {}),
        ...(choices ? { choices: [...choices] } : {}),
      });
    }
    if (
      (field.type === 'select' || field.type === 'text') &&
      /bearing/i.test(field.key) &&
      label &&
      !/^(none|custom|shells)$/i.test(String(raw))
    )
      add({
        kind: 'bearing',
        key: field.key === 'bearingKit' ? 'bearingKit' : 'bearing',
        label: field.label,
        value:
          field.key !== 'bearingKit' &&
          typeof raw === 'string' &&
          /[a-z]/i.test(raw) &&
          /\d/.test(raw)
            ? raw
            : label,
      });

    if (
      [
        'voltage',
        'inputVoltage',
        'supplyVoltage',
        'nominalVoltage',
        'ratedVoltage',
        'packVoltage',
      ].includes(field.key) &&
      !/reference|test|phase|output|insulation|contact|switching|maximum.*rating/i.test(
        field.label,
      ) &&
      /supply|input|nominal|rated|pack.*voltage/i.test(field.label)
    ) {
      const voltage = finite(raw)
        ? raw
        : typeof raw === 'string' && /^\d+(?:[.,]\d+)?$/.test(raw)
          ? Number(raw.replace(',', '.'))
          : undefined;
      if (finite(voltage))
        add({ kind: 'power', key: 'supplyVoltage', label: field.label, value: voltage, unit: 'V' });
    }
    if (
      [
        'chemistry',
        'format',
        'pack',
        'batteryPack',
        'wingBattery',
        'powerSource',
        'powerType',
        'batteryType',
      ].includes(field.key) &&
      (field.type === 'select' || field.type === 'text') &&
      label &&
      !/^(none|custom|external|unconfigured)$/i.test(String(raw)) &&
      (field.key !== 'format' || /batter|cell/i.test(part.subgroup + ' ' + field.label))
    )
      add({
        kind: 'power',
        key: field.key === 'format' ? 'batteryFormat' : field.key,
        label: field.label,
        value: label,
      });
    if (field.key === 'cells' && finite(raw) && /series/i.test(field.label))
      add({ kind: 'power', key: 'batteryCells', label: 'Series cells', value: raw, unit: 'S' });
    // This selected option is an explicit supported motor execution, not a motor-SKU voltage guess.
    if (part.mechanismExecution && field.key === 'motorModel' && selected) {
      const matches = [...selected.label.matchAll(/\b(\d+(?:[.,]\d+)?)\s*V\b/g)];
      if (matches.length === 1)
        add({
          kind: 'power',
          key: 'supplyVoltage',
          label: 'Motor supply voltage',
          value: Number(matches[0][1].replace(',', '.')),
          unit: 'V',
        });
    }
  }
  if (/(?:bearing|bushing)$/.test(part.id) && preset.catalog?.designation)
    add({
      kind: 'bearing',
      key: 'bearing',
      label: 'Bearing model',
      value: preset.catalog.designation,
    });
  const seen = new Set<string>();
  return result.filter((trait) => {
    const identity = JSON.stringify(trait);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export function discoveryTraitLabel(trait: DiscoveryTrait): string {
  const value = trait.choices?.length
    ? trait.choices.join(' / ')
    : trait.range && trait.range.min !== trait.range.max
      ? `${trait.range.min}–${trait.range.max}`
      : String(trait.value);
  return `${trait.label}: ${value}${trait.unit ? ` ${trait.unit}` : ''}`;
}

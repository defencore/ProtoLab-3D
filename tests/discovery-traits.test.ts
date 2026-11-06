import assert from 'node:assert/strict';
import test from 'node:test';
import { discoveryTraits, discoveryTraitLabel } from '../src/core/discovery-traits';
import type { ParameterDefinition, PartDefinition, Preset } from '../src/core/types';
import { parts } from '../src/parts';

const part = (id: string) => parts.find((item) => item.id === id)!;
const fields: ParameterDefinition[] = [
  { key: 'width', label: 'Overall width', type: 'number', group: 'Dimensions', unit: 'mm' },
  { key: 'boardWidth', label: 'PCB width', type: 'number', group: 'Dimensions', unit: 'mm' },
  {
    key: 'voltageMin',
    label: 'Minimum supply voltage',
    type: 'number',
    group: 'Electrical',
    unit: 'V',
  },
  {
    key: 'voltageMax',
    label: 'Maximum supply voltage',
    type: 'number',
    group: 'Electrical',
    unit: 'V',
  },
];
function fixture(parameters = fields): PartDefinition {
  return {
    ...part('waveshare-ups-3s'),
    id: 'trait-fixture',
    defaults: {},
    parameters,
    catalogFilterFields: [],
    catalogSelectionOnly: false,
    discovery: undefined,
    mechanismExecution: undefined,
    buildGeometry() {
      assert.fail('Discovery must not build geometry.');
    },
    composition() {
      assert.fail('Discovery must not compose shapes.');
    },
    dimensions() {
      assert.fail('Discovery must not measure preview shapes.');
    },
  };
}
function preset(
  parameters: Preset['parameters'] = {},
  attributes: NonNullable<Preset['catalog']>['attributes'] = {},
): Preset {
  return {
    id: 'fixture',
    name: 'Trait fixture',
    description: '',
    parameters,
    catalog: {
      designation: 'SOURCE',
      sourceName: 'Fixture source',
      sourceUrl: 'https://example.com/source',
      verifiedParameters: [],
      attributes,
    },
  };
}

test('discovery reads documented characteristics without invoking geometry or composing components', () => {
  const source = preset({}, { width: 60, voltageMin: 6, voltageMax: 12.6 });
  const snapshot = structuredClone(source);
  const traits = discoveryTraits(fixture(), source);
  assert.ok(traits.some((item) => item.kind === 'width' && item.value === 60));
  assert.deepEqual(traits.find((item) => item.kind === 'power')?.range, { min: 6, max: 12.6 });
  assert.deepEqual(source, snapshot);
});

test('unpublished and hidden dimensions cannot become discovery widths', () => {
  const hidden = {
    key: 'frontWidth',
    label: 'Bearing width',
    type: 'number' as const,
    group: 'Dimensions',
    visibleWhen: (p: Preset['parameters']) => p.frontBearing === 'custom',
  };
  const traits = discoveryTraits(
    fixture([...fields, hidden]),
    preset({ width: 900, frontBearing: 'F6804ZZ' }, { boardWidth: 60, frontWidth: 5 }),
  );
  assert.deepEqual(
    traits.filter((item) => item.kind === 'width').map((item) => item.key),
    ['boardWidth'],
  );
  const worm = part('worm-fin-actuator');
  const actual = discoveryTraits(
    worm,
    worm.presets.find((item) => item.parameters.frontBearing === 'F6804ZZ')!,
  );
  assert.ok(
    actual.some((item) => item.kind === 'bearing' && String(item.value).includes('F6804ZZ')),
  );
  assert.ok(!actual.some((item) => item.key === 'frontWidth'));
});

test('widths preserve their actual meaning and source intervals or discrete alternatives', () => {
  const wrong = fixture([{ ...fields[0], label: 'Overall length' }]);
  assert.deepEqual(discoveryTraits(wrong, preset({}, { width: 10 })), []);
  const discrete = preset();
  discrete.catalog!.parameterChoices = { width: [10, 20] };
  const trait = discoveryTraits(fixture(), discrete).find((item) => item.kind === 'width')!;
  assert.deepEqual(trait.choices, [10, 20]);
  assert.equal(discoveryTraitLabel(trait), 'Overall width: 10 / 20 mm');
  discrete.catalog!.parameterChoices = undefined;
  discrete.catalog!.parameterRanges = { width: { min: 10, max: 20 } };
  assert.deepEqual(discoveryTraits(fixture(), discrete)[0].range, { min: 10, max: 20 });
  discrete.catalog!.parameterRanges = { width: { min: 20, max: 10 } };
  assert.deepEqual(discoveryTraits(fixture(), discrete), []);
});

test('output, phase and torque-test voltages do not become a supply-voltage facet', () => {
  const definitions = ['outputVoltage', 'phaseVoltage', 'referenceVoltage'].map((key) => ({
    key,
    label: key === 'referenceVoltage' ? 'Torque / speed test voltage' : key,
    type: 'number' as const,
    group: 'Electrical',
    unit: 'V',
  }));
  const traits = discoveryTraits(
    fixture(definitions),
    preset(
      {},
      {
        outputVoltage: 5,
        phaseVoltage: 12,
        referenceVoltage: 24,
      },
    ),
  );
  assert.deepEqual(traits, []);
});

test('real UPS support and PCB width stay separate from its output voltages', () => {
  const ups = part('waveshare-ups-3s');
  const traits = discoveryTraits(ups, ups.presets[0]);
  assert.ok(traits.some((item) => item.key === 'boardWidth' && item.value === 60));
  assert.ok(traits.some((item) => item.kind === 'power' && item.value === '3S'));
  assert.ok(traits.some((item) => item.kind === 'power' && item.value === '18650'));
  assert.ok(!traits.some((item) => item.kind === 'power' && item.unit === 'V'));
});

test('configured motor voltage and actual bearing alternatives refer to the same execution', () => {
  const compact = part('tr8-compact-actuator');
  const first = discoveryTraits(compact, compact.presets[0]);
  assert.ok(first.some((item) => item.kind === 'bearing' && item.value === 'F686-2RS'));
  assert.ok(first.some((item) => item.kind === 'power' && item.value === 12 && item.unit === 'V'));
  const twin = part('tr8-quad-twin-pin-actuator');
  for (const kit of ['prom-smb', 'reference']) {
    const traits = discoveryTraits(
      twin,
      twin.presets.find((item) => item.parameters.bearingKit === kit)!,
    );
    const models = traits.filter((item) => item.kind === 'bearing').map((item) => item.value);
    assert.equal(models.includes('SMB MF105 2Z'), kit === 'prom-smb');
    assert.equal(models.includes('F695-2RS'), kit === 'reference');
  }
  const faulhaber = part('tr8-quad-faulhaber-actuator');
  assert.ok(
    discoveryTraits(faulhaber, faulhaber.presets[0]).some(
      (item) => item.kind === 'power' && item.value === 24 && item.unit === 'V',
    ),
  );
});

test('servo source supply range and case width remain distinct from a test condition', () => {
  const servo = part('servo-motor');
  const traits = discoveryTraits(
    servo,
    servo.presets.find((item) => item.id === 'kst-x10-mini-pro-a')!,
  );
  assert.ok(
    traits.some((item) => item.kind === 'width' && item.key === 'caseWidth' && item.value === 10),
  );
  const power = traits.filter((item) => item.kind === 'power');
  assert.equal(power.length, 1);
  assert.deepEqual(power[0].range, { min: 4.8, max: 8.4 });
  assert.ok(!power.some((item) => item.value === 7.4));
});

test('supplier outside B remains searchable as the actual published enclosure width', () => {
  const enclosure = part('catalog-enclosure');
  const source = enclosure.presets.find((item) => item.id === 'altinkaya-5773')!;
  assert.equal(source.catalog?.attributes?.width, 333);
  const width = discoveryTraits(enclosure, source).find((item) => item.label === 'Outside B (Y)');
  assert.equal(width?.kind, 'width');
  assert.equal(width?.value, 333);
  assert.equal(width?.unit, 'mm');
  assert.equal(discoveryTraitLabel(width!), 'Outside B (Y): 333 mm');
});

test('saw workpiece width capacities cannot masquerade as machine widths', () => {
  for (const id of ['automatic-band-saw', 'automatic-tube-saw']) {
    const saw = part(id);
    assert.ok(saw.presets.length, id);
    for (const item of saw.presets)
      assert.ok(
        !discoveryTraits(saw, item).some(
          (trait) =>
            trait.kind === 'width' &&
            /tube diameter|profile width|section width/i.test(trait.label),
        ),
        `${id}/${item.id}`,
      );
  }
  const structural = fixture([{ ...fields[0], label: 'Section width', group: 'Dimensions' }]);
  const traits = discoveryTraits(structural, preset({}, { width: 40 }));
  assert.ok(
    traits.some(
      (trait) => trait.kind === 'width' && trait.label === 'Section width' && trait.value === 40,
    ),
  );
});

test('configured bearing models keep a canonical value instead of a dimensions-decorated label', () => {
  const worm = part('worm-fin-actuator');
  const traits = discoveryTraits(worm, worm.presets[0]);
  assert.equal(
    traits.find((item) => item.label === 'Large outer output bearing')?.value,
    'F6802ZZ',
  );
  assert.equal(
    traits.find((item) => item.label === 'Worm bearings · Ø5 turned journals')?.value,
    'F685ZZ',
  );
  assert.ok(
    !traits
      .filter((item) => item.kind === 'bearing')
      .some((item) => /×|mm/.test(String(item.value))),
  );
  const flanged = part('flanged-ball-bearing');
  const stored = flanged.presets.find((item) => item.catalog?.designation === 'F685ZZ');
  if (stored)
    assert.equal(
      discoveryTraits(flanged, stored).find((item) => item.kind === 'bearing')?.value,
      'F685ZZ',
    );
});

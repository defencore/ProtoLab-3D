import assert from 'node:assert/strict';
import test from 'node:test';
import { parts } from '../src/parts';
import { groupBrowseFamilies } from '../src/core/browse-families';
import { librarySections, librarySubgroups, sortLibraryParts } from '../src/core/library';
import { groupProductLibrary } from '../src/core/product-library';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';

const part = (id: string) => {
  const found = parts.find((definition) => definition.id === id);
  assert.ok(found, `Missing registered product ${id}.`);
  return found;
};

test('enclosure models share one catalog while handheld devices retain their own family', () => {
  assert.deepEqual(librarySubgroups(parts, 'ENCLOSURES & DEVICES'), [
    'GENERAL-PURPOSE ENCLOSURES',
    'HANDHELD CONTROLLERS',
  ]);
  const definitions = parts.filter((definition) => definition.category === 'ENCLOSURES & DEVICES');
  assert.deepEqual(definitions.map((definition) => definition.id).sort(), [
    'catalog-enclosure',
    'enclosure',
    'field-daq-enclosure',
    'grandado-tube-mount',
    'handheld-lora-controller',
    'jcg108-tube-fairing',
    'printed-bayonet-enclosure',
    'printed-rim-enclosure',
    'printed-screw-enclosure',
    'printed-self-centering-enclosure',
    'printed-threaded-enclosure',
    'printed-threaded-shell',
    'underwater-pressure-enclosure',
  ]);
  const generic = part('enclosure');
  const handheld = part('handheld-lora-controller');
  assert.equal(generic.name, 'Rectangular open-top enclosure');
  assert.equal(generic.subgroup, 'GENERAL-PURPOSE ENCLOSURES');
  assert.equal(generic.product.kind, 'detail');
  assert.equal(handheld.name, 'Heltec V4 handheld controller');
  assert.equal(handheld.subgroup, 'HANDHELD CONTROLLERS');
  assert.equal(handheld.product.kind, 'assembly');
  assert.equal(typeof handheld.composition, 'function');
  const families = groupBrowseFamilies(definitions);
  assert.equal(families.length, 2);
  assert.deepEqual(families.map((family) => family.id).sort(), [
    'enclosures',
    'handheld-lora-controller',
  ]);
  assert.equal(families.find((family) => family.id === 'enclosures')?.members.length, 12);
  assert.ok(!librarySubgroups(parts, 'STRUCTURAL PARTS').includes('BOXES & CASES'));
  assert.equal(part('lora-module').category, 'ELECTRONICS & VISION');
  const index = buildLibrarySearchIndex(groupBrowseFamilies(parts));
  for (const [query, id] of [
    ['Rectangular open-top enclosure', 'enclosures'],
    ['Field DAQ', 'enclosures'],
    ['Heltec V4', 'handheld-lora-controller'],
    ['Palm Lock', 'handheld-lora-controller'],
  ])
    assert.ok(
      searchLibrary(index, query).some((match) => match.family.id === id),
      query,
    );
});

test('machine tools contains complete composed machines rather than their reusable components', () => {
  const machines = parts.filter((definition) => definition.category === 'MACHINE TOOLS');
  assert.deepEqual(machines.map((definition) => definition.id).sort(), [
    'automatic-band-saw',
    'automatic-tube-saw',
    'cnc-milling-machine',
  ]);
  for (const machine of machines) {
    assert.equal(machine.product.kind, 'assembly', machine.id);
    assert.ok(machine.product.processes.includes('assembly'), machine.id);
    assert.equal(typeof machine.composition, 'function', machine.id);
  }
  assert.deepEqual(librarySubgroups(parts, 'MACHINE TOOLS'), [
    'CUTTING MACHINES',
    'MILLING MACHINES',
  ]);
});

test('reusable machine components belong to their engineering disciplines and declared subgroups', () => {
  const expected: Record<string, [string, string]> = {
    'circular-saw-blade': ['WORKSHOP TOOLS', 'SAW BLADES'],
    'conveyor-roller': ['STRUCTURAL PARTS', 'WHEELS & ROLLERS'],
    'machine-control': ['POWER & MOTOR CONTROL', 'INDUSTRIAL CONTROL EQUIPMENT'],
    'machine-drive-motor': ['MOTORS & ACTUATORS', 'MOTOR ASSEMBLIES'],
    'machine-measurement': ['ELECTRONICS & VISION', 'SENSORS & SWITCHES'],
    'panel-switch': ['SWITCHES & BUTTONS', 'PANEL CONTROLS'],
    'panel-indicator': ['SWITCHES & BUTTONS', 'PANEL CONTROLS'],
    'panel-control': ['SWITCHES & BUTTONS', 'PANEL CONTROLS'],
    'laboratory-terminal': ['CONNECTORS & INTERFACES', 'LABORATORY TERMINALS'],
    'signal-connector': ['CONNECTORS & INTERFACES', 'PCB CONNECTORS'],
    'electrical-connector': ['CONNECTORS & INTERFACES', 'POWER & INDUSTRIAL'],
    'waterproof-connector': ['CONNECTORS & INTERFACES', 'POWER & INDUSTRIAL'],
    'prototyping-board': ['ELECTRONICS & VISION', 'PROTOTYPING BOARDS'],
    'addressable-led': ['ELECTRONICS & VISION', 'LED MODULES'],
    'cnc-process-accessory': ['WORKSHOP TOOLS', 'COOLING & COOLANT'],
    'cnc-limit-sensor': ['ELECTRONICS & VISION', 'SENSORS & SWITCHES'],
    'cnc-linear-encoder': ['ELECTRONICS & VISION', 'SENSORS & SWITCHES'],
    'cnc-toolsetter-part': ['WORKSHOP TOOLS', 'TOOL SETTING & PROBES'],
    'cnc-worktable': ['STRUCTURAL PARTS', 'WORK SURFACES & TRAYS'],
    'cnc-guide-rail': ['LINEAR MOTION', 'PROFILE RAILS'],
    'cnc-guide-carriage': ['LINEAR MOTION', 'PROFILE RAILS'],
    'cnc-drive-screw': ['LINEAR MOTION', 'BALL SCREWS'],
    'cnc-precision-axis': ['LINEAR MOTION', 'BALL SCREWS'],
    'cnc-precision-screw': ['LINEAR MOTION', 'BALL SCREWS'],
    'cnc-precision-nut': ['LINEAR MOTION', 'BALL SCREWS'],
    'cnc-screw-support': ['LINEAR MOTION', 'SHAFT & SCREW SUPPORTS'],
    'cnc-precision-support': ['LINEAR MOTION', 'SHAFT & SCREW SUPPORTS'],
    'stepper-motor': ['MOTORS & ACTUATORS', 'STEPPER MOTORS'],
    'cnc-feed-servo': ['MOTORS & ACTUATORS', 'SERVOS'],
    'cnc-servo-drive': ['POWER & MOTOR CONTROL', 'SERVO CONTROLLERS'],
    'cnc-spindle': ['MOTORS & ACTUATORS', 'SPINDLE MOTORS'],
    'cnc-spindle-mount': ['STRUCTURAL PARTS', 'BRACKETS & MOUNTS'],
    'bolt-screw': ['FASTENERS & THREADS', 'BOLTS & SCREWS'],
    'lipo-battery': ['POWER & MOTOR CONTROL', 'BATTERIES & HOLDERS'],
    'li-ion-cell': ['POWER & MOTOR CONTROL', 'BATTERIES & HOLDERS'],
    'li-ion-pack': ['POWER & MOTOR CONTROL', 'BATTERIES & HOLDERS'],
    'adc-module': ['ELECTRONICS & VISION', 'SENSORS & SWITCHES'],
    'power-filter': ['POWER & MOTOR CONTROL', 'POWER FILTERS'],
    'standard-battery': ['POWER & MOTOR CONTROL', 'BATTERIES & HOLDERS'],
    'battery-holder': ['POWER & MOTOR CONTROL', 'BATTERIES & HOLDERS'],
    'li-ion-battery-holder': ['POWER & MOTOR CONTROL', 'BATTERIES & HOLDERS'],
    'din-rail': ['STRUCTURAL PARTS', 'BRACKETS & MOUNTS'],
    'parallel-gripper': ['MOTORS & ACTUATORS', 'GRIPPERS'],
    brake: ['TRANSMISSION & LINKAGES', 'BRAKES'],
    'slewing-bearing': ['BEARINGS & SEALS', 'SLEWING BEARINGS'],
  };
  const groups = groupProductLibrary(parts, 'engineering');
  for (const [id, [category, subgroup]] of Object.entries(expected)) {
    const definition = part(id);
    assert.equal(definition.category, category, id);
    assert.equal(definition.subgroup, subgroup, id);
    assert.ok(groups.find((group) => group.id === category)?.parts.includes(definition), id);
    assert.ok(
      librarySections.find((section) => section.name === category)?.groups.includes(subgroup),
      id,
    );
  }
});

test('batteries and holders share their fitting context while rails, grippers and bearings retain their own function', () => {
  assert.deepEqual(
    parts
      .filter((definition) => definition.subgroup === 'BATTERIES & HOLDERS')
      .map((definition) => definition.id)
      .sort(),
    [
      'battery-holder',
      'li-ion-battery-holder',
      'li-ion-cell',
      'li-ion-pack',
      'lipo-battery',
      'panel-battery-module',
      'standard-battery',
      'waveshare-ups-3s',
    ],
  );
  assert.deepEqual(
    parts
      .filter((definition) => definition.subgroup === 'COOLING & MOUNTING')
      .map((definition) => definition.id)
      .sort(),
    ['cooling-fan', 'heat-sink'],
  );
  assert.ok(!librarySubgroups(parts, 'BEARINGS & SEALS').includes('ROTARY TABLES'));
  assert.ok(!librarySubgroups(parts, 'TRANSMISSION & LINKAGES').includes('BRAKES & GRIPPERS'));
  assert.ok(
    !parts.some((definition) =>
      ['BATTERY PACKS', 'RECHARGEABLE CELLS', 'PRIMARY BATTERIES'].includes(definition.subgroup),
    ),
  );
  for (const definition of parts) {
    const section = librarySections.find((section) => section.name === definition.category);
    assert.ok(section, `${definition.id}: category is registered`);
    assert.ok(
      section.groups.includes(definition.subgroup),
      `${definition.id}: subgroup is registered`,
    );
  }
});

test('electrical catalogs are discoverable by workshop terminology and supplier designation', () => {
  const index = buildLibrarySearchIndex(groupBrowseFamilies(parts));
  const examples = [
    ['toggle', 'panel-switch'],
    ['Lehao AD16-16C', 'panel-indicator'],
    ['SP20-2', 'waterproof-connector'],
    ['SP20-4', 'waterproof-connector'],
    ['SP20-6', 'waterproof-connector'],
    ['\u0456\u043d\u0434\u0438\u043a\u0430\u0442\u043e\u0440\u0438', 'panel-indicator'],
    [
      '\u0433\u0435\u0440\u043c\u0435\u0442\u0438\u0447\u043d\u0456 \u0440\u043e\u0437\u0454\u043c\u0438',
      'waterproof-connector',
    ],
    ['SP20 \u0433\u043d\u0456\u0437\u0434\u0430', 'waterproof-connector'],
    ['guard', 'panel-switch'],
    ['banana', 'laboratory-terminal'],
    ['WAGO 221-413', 'laboratory-terminal'],
    ['USB', 'signal-connector'],
    ['JST', 'signal-connector'],
    ['XT60E-F', 'electrical-connector'],
    ['XT60E-M', 'electrical-connector'],
    ['XT90E-M', 'electrical-connector'],
    ['XT30UPB-M', 'electrical-connector'],
    ['XT30UPB-F', 'electrical-connector'],
    ['XT60PW-M30', 'electrical-connector'],
    ['XT60PW-F30', 'electrical-connector'],
    ['PY-10', 'prototyping-board'],
    ['PY-7', 'prototyping-board'],
    ['PY-3*7CM', 'prototyping-board'],
    ['PY-6*8CM', 'prototyping-board'],
    ['NeoPixel', 'addressable-led'],
    ['WS2812B-4', 'addressable-led'],
    ['WS2812B 24', 'addressable-led'],
    ['LCD03022', 'addressable-led'],
  ];
  for (const [query, id] of examples)
    assert.ok(
      searchLibrary(index, query).some((match) =>
        match.family.members.some((member) => member.id === id),
      ),
      query,
    );
  assert.deepEqual(
    sortLibraryParts(parts.filter((definition) => definition.subgroup === 'PANEL CONTROLS')).map(
      (definition) => definition.id,
    ),
    ['panel-switch', 'panel-indicator', 'panel-control', 'servo-toggle-actuator'],
  );
});

test('neutral component names do not make screws, guides, motors or fixtures CNC-only products', () => {
  for (const id of [
    'cnc-guide-rail',
    'cnc-guide-carriage',
    'cnc-drive-screw',
    'cnc-screw-support',
    'cnc-spindle',
    'cnc-spindle-mount',
    'cnc-toolsetter-part',
    'cnc-worktable',
    'cnc-process-accessory',
    'cnc-limit-sensor',
  ]) {
    assert.ok(!/\bCNC\b/i.test(part(id).name), id);
    assert.equal(part(id).id, id, 'the existing portable product identity is preserved');
  }
  assert.match(part('cnc-milling-machine').name, /\bCNC\b/);
});

test('discipline navigation preserves distinct supplier definitions inside catalogs and stable primary-to-accessory order', () => {
  const ids = [
    'linear-guide',
    'cnc-guide-rail',
    'cnc-guide-carriage',
    'ball-screw',
    'cnc-drive-screw',
    'cnc-precision-axis',
    'cnc-precision-screw',
    'cnc-precision-nut',
    'servo-motor',
    'cnc-feed-servo',
  ];
  const definitions = ids.map(part);
  const families = groupBrowseFamilies(definitions);
  assert.deepEqual(
    families.flatMap((family) => family.members.map((member) => member.id)).sort(),
    [...ids].sort(),
    'shared catalogs retain every physical definition without duplicates',
  );
  for (const definition of definitions) {
    const family = families.find((entry) => entry.members.includes(definition))!;
    assert.ok(family);
    assert.ok(family.members.includes(definition));
    assert.equal(family.category, definition.category);
    assert.equal(family.subgroup, definition.subgroup);
  }
  const servos = families.find((family) => family.id === 'servo-motors')!;
  assert.equal(servos.primary, part('servo-motor'));
  assert.deepEqual(servos.members.map((member) => member.id).sort(), [
    'cnc-feed-servo',
    'servo-motor',
  ]);
  assert.deepEqual(
    sortLibraryParts(
      definitions.filter((definition) => definition.subgroup === 'PROFILE RAILS'),
    ).map((definition) => definition.id),
    ['linear-guide', 'cnc-guide-rail', 'cnc-guide-carriage'],
  );
  assert.deepEqual(sortLibraryParts([...parts].reverse()), sortLibraryParts(parts));
});

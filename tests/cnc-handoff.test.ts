import assert from 'node:assert/strict';
import test from 'node:test';
import type { Parameters, PartDefinition } from '../src/core/types';
import {
  addProduct,
  createProject,
  projectReadiness,
  supplyRows,
} from '../src/core/design-project';
import machine, {
  millingComponents,
  millingLibraries,
} from '../src/parts/cnc-milling-machine/part';
import { millingHandoff } from '../src/parts/cnc-milling-machine/lib/handoff';
import control from '../src/parts/machine-control/part';
import motor from '../src/parts/stepper-motor/part';
import carriage from '../src/parts/cnc-guide-carriage/part';
import support from '../src/parts/cnc-screw-support/part';
import rail, { railParameters } from '../src/parts/cnc-guide-rail/part';
import frame, { frameManufacturing } from '../src/parts/cnc-frame-part/part';
import mount, {
  spindleMountLayout,
  spindleMountDefaults,
} from '../src/parts/cnc-spindle-mount/part';
import drive, { driveScrewLayout, driveScrewParameters } from '../src/parts/cnc-drive-screw/part';
import table, { worktableParameters } from '../src/parts/cnc-worktable/part';
import nut from '../src/parts/hex-nut/part';

test('CNC M4/M5 nut inspection allowances retain qualified nominal ordering identity without changing actual geometry parameters', () => {
  for (const bore of [4, 5]) {
    const preset = nut.presets.find((row) => row.parameters.bore === bore)!,
      parameters: Parameters = { ...nut.defaults, ...preset.parameters, threadAllowance: 0.05 },
      before = structuredClone(parameters),
      result = millingHandoff(nut, parameters, preset.id);
    assert.equal(result.presetId, preset.id);
    assert.equal(result.procurement?.source, preset.catalog!.sourceUrl);
    assert.equal(result.procurement?.standard, preset.catalog!.standard);
    assert.ok(result.procurement?.designation.startsWith(preset.catalog!.designation + ' /'));
    assert.match(result.procurement!.designation, /0.05 mm authored, delivered fit unqualified/);
    assert.deepEqual(parameters, before);
    assert.equal(parameters.threadAllowance, 0.05);
    for (const patch of [
      { acrossFlats: Number(parameters.acrossFlats) + 0.1 },
      { height: Number(parameters.height) + 0.1 },
      { bore: bore + 0.1 },
      { pitch: Number(parameters.pitch) + 0.1 },
      { handedness: 'left' },
    ] as Parameters[])
      assert.deepEqual(millingHandoff(nut, { ...parameters, ...patch }, preset.id), {});
    const otherFamily = { ...nut, id: 'unrelated-component' };
    assert.deepEqual(millingHandoff(otherFamily, parameters, preset.id), {});
    const verifiedAllowance = {
      ...nut,
      presets: [
        {
          ...preset,
          catalog: {
            ...preset.catalog!,
            verifiedParameters: [...preset.catalog!.verifiedParameters, 'threadAllowance'],
          },
        },
      ],
    };
    assert.deepEqual(millingHandoff(verifiedAllowance, parameters, preset.id), {});
    const publishedAllowance = {
      ...nut,
      presets: [{ ...preset, catalog: { ...preset.catalog!, attributes: { threadAllowance: 0 } } }],
    };
    assert.deepEqual(millingHandoff(publishedAllowance, parameters, preset.id), {});
    for (const threadAllowance of [-0.01, 0.21, Number.NaN])
      assert.deepEqual(millingHandoff(nut, { ...parameters, threadAllowance }, preset.id), {});
  }
});

test('the real CNC project retains both nominal and inspection nut executions without conflicting designations or duplicate kit orders', () => {
  const parts = [machine, ...millingLibraries],
    { project } = addProduct(createProject('Qualified nominal nut ordering'), parts, {
      part: machine,
      parameters: machine.defaults,
      state: 'assembled',
    }),
    nuts = project.configurations.filter((c) => c.libraryId === nut.id);
  assert.equal(nuts.length, 5);
  for (const configuration of nuts.filter((c) => c.parameters.threadAllowance === 0.05)) {
    assert.ok(configuration.presetId);
    assert.ok(configuration.procurement?.source.startsWith('https://'));
    if (configuration.parameters.bore === 10) {
      assert.match(configuration.designation, /DIN934 M10 class8 nut/);
      assert.match(
        configuration.designation,
        /nominal catalog identity.*inspection allowance0.05 mm/,
      );
      assert.equal(
        configuration.procurement?.source,
        'https://gvyntok.com/shop/gajki/gajka-sh-g-kl-pr-8-0-din-934/gajka-sh-g-kl-pr-8-0-din-934-m10/',
      );
    } else {
      assert.match(
        configuration.designation,
        /nominal catalog identity; Full CAD radial allowance 0.05 mm authored/,
      );
    }
    assert.equal(configuration.parameters.threadAllowance, 0.05);
  }
  assert.equal(new Set(nuts.map((c) => c.designation)).size, nuts.length);
  const cutTies = project.configurations.filter((c) => c.libraryId === 'threaded-rod');
  assert.equal(cutTies.length, 1);
  assert.equal(cutTies[0].supply, 'manufactured');
  assert.equal(
    cutTies[0].procurement,
    undefined,
    'Finished cuts must not pretend to be supplier SKUs.',
  );
  assert.equal(cutTies[0].parameters.length, 287.2);
  assert.match(cutTies[0].manufacturing!.blank, /Three published M10 x 1000/);
  assert.ok(
    cutTies[0].manufacturing!.requirements.some((line) =>
      line.includes('https://gvyntok.com/shop/shpilki/'),
    ),
  );
  const orders = supplyRows(project, parts, 'purchased'),
    kitParents = project.occurrences.filter(
      (occurrence) =>
        project.configurations.some(
          (c) => c.id === occurrence.configurationId && c.supply === 'purchased',
        ) && project.occurrences.some((child) => child.parentId === occurrence.id),
    );
  assert.equal(kitParents.length, 6);
  for (const parent of kitParents) {
    const order = orders.filter((row) => row.configurationId === parent.configurationId);
    assert.equal(order.length, 1);
    assert.equal(order[0].quantity, 1);
    for (const child of project.occurrences.filter((row) => row.parentId === parent.id))
      assert.equal(
        orders.some((row) => row.configurationId === child.configurationId),
        false,
      );
  }
});

test('exact supplier identities retain their actual per-model ordering sources and inspection parameters', () => {
  for (const part of [control, motor, support, carriage]) {
    for (const preset of part.presets) {
      const parameters = { ...part.defaults, ...preset.parameters },
        before = structuredClone(parameters),
        result = millingHandoff(part, parameters);
      assert.equal(result.presetId, preset.id, `${part.id}/${preset.id}`);
      assert.deepEqual(result.procurement, {
        designation: preset.catalog!.designation,
        manufacturer: preset.catalog!.manufacturer ?? '',
        source: preset.catalog!.sourceUrl,
        ...(preset.catalog!.standard ? { standard: preset.catalog!.standard } : {}),
      });
      assert.deepEqual(parameters, before);
      assert.equal(result.manufacturing, undefined);
    }
  }
  const inspection = { ...carriage.defaults, threadFitAllowance: 0.05 },
    result = millingHandoff(carriage, inspection);
  assert.equal(result.presetId, 'hgh20ca');
  assert.equal(result.procurement?.designation, 'HGH20CA');
  assert.equal(inspection.threadFitAllowance, 0.05);
});

test('missing, conflicting and ambiguous catalog matches never select an unrelated supplier product', () => {
  assert.deepEqual(millingHandoff(control, { model: 'unknown' }), {});
  assert.deepEqual(millingHandoff(control, { model: 'cl57t-v3' }, 'atv12hu22m2'), {});
  assert.deepEqual(millingHandoff(control, { model: 'cl57t-v3' }, 'missing'), {});
  assert.deepEqual(millingHandoff(rail, railParameters(1200)), {});
  assert.deepEqual(millingHandoff(rail, railParameters(500), 'hgr20-1900'), {});
  assert.equal(millingHandoff(rail, railParameters(1900)).presetId, 'hgr20-1900');
  const preset = control.presets.find((row) => row.id === 'cl57t-v3')!,
    ambiguous: PartDefinition = {
      ...control,
      presets: [
        preset,
        {
          ...preset,
          id: 'another-supplier',
          catalog: { ...preset.catalog!, manufacturer: 'Another supplier' },
        },
      ],
    };
  assert.deepEqual(millingHandoff(ambiguous, preset.parameters), {});
  assert.equal(millingHandoff(ambiguous, preset.parameters, preset.id).presetId, preset.id);
});

test('catalog references with missing ordering data retain the missing fields instead of invented standards or producers', () => {
  const preset = control.presets.find((row) => row.id === 'cl57t-v3')!,
    part: PartDefinition = {
      ...control,
      presets: [
        {
          ...preset,
          catalog: {
            ...preset.catalog!,
            manufacturer: undefined,
            sourceUrl: '',
            standard: undefined,
          },
        },
      ],
    },
    result = millingHandoff(part, preset.parameters);
  assert.deepEqual(result.procurement, {
    designation: preset.catalog!.designation,
    manufacturer: '',
    source: '',
  });
  const uncatalogued: PartDefinition = { ...control, presets: [{ ...preset, catalog: undefined }] };
  assert.deepEqual(millingHandoff(uncatalogued, preset.parameters), {});
});

test('fabrication records use actual mount halves and retained shaft dimensions while leaving grade and fit release open', () => {
  for (const bodyDiameter of [65, 80, 100]) {
    for (const component of ['back', 'cap']) {
      const p = { ...spindleMountDefaults, bodyDiameter, component, threadFitAllowance: 0.05 },
        before = structuredClone(p),
        layout = spindleMountLayout(p),
        manufacturing = millingHandoff(mount, p).manufacturing!;
      assert.deepEqual(p, before);
      assert.match(manufacturing.material, /alloy and temper to be specified/);
      const dimensions = manufacturing.blank.match(/\d+(?:\.\d+)?/g)!.map(Number);
      assert.deepEqual(dimensions, [
        layout.outerWidth,
        component === 'back'
          ? layout.backSplitY - layout.rearFaceY
          : layout.capFrontY - layout.capSplitY,
        layout.clampHeight,
      ]);
      assert.deepEqual(manufacturing.processes, mount.product.processes);
      assert.ok(manufacturing.requirements.some((r) => r.includes('common bore')));
      assert.ok(manufacturing.requirements.some((r) => r.includes('not released fits')));
    }
  }
  for (const racewayLength of [460, 1100, 1800]) {
    const p = driveScrewParameters(racewayLength),
      layout = driveScrewLayout(p),
      record = millingHandoff(drive, p).manufacturing!;
    assert.ok(record.blank.includes(`${layout.overallLength} mm`));
    assert.ok(record.blank.includes(`${racewayLength} mm active raceway`));
    assert.match(record.material, /grade and heat treatment to be confirmed/);
    assert.deepEqual(record.processes, drive.product.processes);
    assert.ok(record.requirements.some((r) => r.includes('not an identified supplier SKU')));
    assert.equal(millingHandoff(drive, p).procurement, undefined);
  }
  const p = { ...frame.defaults, role: 'rail-pad', shoulderHeight: 6 };
  assert.deepEqual(millingHandoff(frame, p).manufacturing, frameManufacturing(p));
});

test('table fabrication handoff distinguishes formed sheet from the actual monolithic tank library recipe', () => {
  const bent = millingHandoff(table, worktableParameters('pan-side')).manufacturing!;
  assert.match(bent.blank, /calculate the developed blank/);
  assert.deepEqual(bent.processes, ['cutting', 'drilling', 'bending']);
  assert.ok(bent.requirements.some((r) => r.includes('bend allowance')));
  const tank = millingHandoff(table, worktableParameters('tank-body')).manufacturing!;
  assert.match(tank.blank, /250 x 350 x 150 mm billet/);
  assert.deepEqual(tank.processes, ['milling']);
  assert.equal(
    tank.requirements.some((r) => r.includes('welded')),
    false,
  );
});

test('adding the actual CNC to a project preserves source identities, fabrication choices and unresolved release requirements', () => {
  const parts = [machine, ...millingLibraries],
    components = millingComponents(machine.defaults).map((piece) => piece.component),
    { project } = addProduct(createProject('CNC fabrication handoff'), parts, {
      part: machine,
      parameters: machine.defaults,
      state: 'assembled',
    });
  assert.equal(project.occurrences.length, components.length + 7); // Root and six purchased kit parents.
  for (const c of components.filter((c) =>
    [
      'machine-control',
      'cnc-feed-servo',
      'cnc-servo-drive',
      'cnc-precision-support',
      'cnc-guide-carriage',
    ].includes(c.libraryId),
  )) {
    const configuration = project.configurations.find(
      (p) =>
        p.libraryId === c.libraryId &&
        JSON.stringify(p.parameters) === JSON.stringify(c.parameters) &&
        p.procurement?.designation === c.procurement?.designation,
    )!;
    assert.ok(configuration, c.id);
    assert.equal(configuration.presetId, c.presetId);
    assert.deepEqual(configuration.procurement, c.procurement);
    assert.ok(configuration.procurement?.manufacturer);
    assert.ok(configuration.procurement?.source.startsWith('https://'));
    assert.equal(configuration.designation, c.procurement!.designation);
  }
  const mounts = project.configurations.filter((c) => c.libraryId === mount.id),
    shafts = project.configurations.filter((c) => c.libraryId === 'cnc-precision-screw'),
    slat = project.configurations.find(
      (c) => c.libraryId === table.id && c.parameters.component === 'slat',
    )!;
  assert.equal(mounts.length, 2);
  assert.equal(shafts.length, 3);
  for (const c of mounts) {
    assert.ok(c.manufacturing?.material);
    assert.ok(c.manufacturing?.blank);
    assert.ok(c.manufacturing?.requirements.length);
    assert.equal(c.procurement, undefined);
  }
  assert.ok(
    shafts.every((c) => !c.manufacturing && c.procurement?.designation.includes('included')),
  );
  assert.match(slat.manufacturing?.material ?? '', /Aluminium/);
  const spindle = project.configurations.find((c) => c.libraryId === 'cnc-spindle')!;
  assert.match(spindle.procurement!.designation, /220 V winding; nameplate current pending/);
  const unmappedRails = project.configurations.filter(
    (c) => c.libraryId === rail.id && c.parameters.length !== 1900,
  );
  assert.equal(unmappedRails.length, 3);
  assert.ok(
    unmappedRails.every(
      (c) => !c.presetId && c.procurement?.designation.includes('certificate pending'),
    ),
  );
  assert.equal(projectReadiness(project, parts).complete, false);
  assert.ok(
    project.documents.length === 0,
    'Handoff metadata must not fabricate released drawings.',
  );
});

test('CNC control alternatives carry the selected VFD and controller source instead of default-model procurement', () => {
  for (const spindle of ['jst-2200-water-80', 'jst-3000-water-100']) {
    for (const controller of ['ddcs-v3-1', 'ddcs-v4-1']) {
      const p: Parameters = { ...machine.defaults, spindle, controller },
        pieces = millingComponents(p),
        vfd = pieces.find(
          (piece) => piece.component.id === 'spindle-variable-frequency-drive',
        )!.component,
        selectedController = pieces.find(
          (piece) => piece.component.id === 'motion-controller',
        )!.component,
        vfdPreset = control.presets.find((row) => row.parameters.model === vfd.parameters.model)!;
      assert.deepEqual(vfd.procurement, millingHandoff(control, vfd.parameters).procurement);
      assert.equal(vfd.procurement?.source, vfdPreset.catalog!.sourceUrl);
      assert.equal(
        vfd.presetId,
        spindle.includes('3000') ? 'gpenny-huanyang-4kw-220v' : 'atv12hu22m2',
      );
      assert.equal(selectedController.presetId, controller);
      assert.equal(
        selectedController.procurement?.source,
        control.presets.find((row) => row.id === controller)!.catalog!.sourceUrl,
      );
    }
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import part, { states } from '../src/parts/modular-tube-avionics/part';
import {
  libraries,
  composition,
  configured,
  allPrinted,
  powerCellReferences,
} from '../src/parts/modular-tube-avionics/lib/model';
import { validateParameters } from '../src/core/validation';
import {
  addProduct,
  createProject,
  parseProject,
  validateProject,
  supplyRows,
} from '../src/core/design-project';
import {
  availableModelState,
  matchingPresetId,
  reconcilePartSelection,
} from '../src/core/part-selection';
import { powerEnvelopeChecks } from '../src/parts/modular-tube-avionics/lib/power';
import { Euler, Vector3 } from 'three';
import { payload } from '../src/parts/modular-tube-avionics/lib/model';
import { lowerCoverPartIds } from '../src/parts/modular-tube-avionics/lib/radio';
import { auxiliaryContactSpecs, piContactSpecs } from '../src/parts/modular-tube-avionics/lib/nose';
import { physicalProductState, productIdentityParameters } from '../src/core/eskd';
import { initializeManifoldGeometry } from '../src/core/assembly/manifold-boundary';
import { parseConfiguration } from '../src/core/configuration';
import { parseConfigurationLink } from '../src/core/configuration-link';
import {
  defaultTubeProfile,
  resolveTubeProfile,
  tubeProfiles,
} from '../src/parts/modular-tube-avionics/lib/tube-interface';

test('one explicit tube profile defines the qualified interface without arbitrary numeric controls', () => {
  assert.equal(defaultTubeProfile, 'd90-86');
  assert.deepEqual(
    tubeProfiles.map((profile) => profile.id),
    ['d90-86'],
  );
  const t = resolveTubeProfile(part.defaults);
  assert.deepEqual(
    [
      t.outerDiameter,
      t.innerDiameter,
      t.wallThickness,
      t.insertDiameter,
      t.insertDiametralClearance,
    ],
    [90, 86, 2, 85.6, 0.4],
  );
  assert.equal(productIdentityParameters(part, part.defaults).tubeProfile, 'd90-86');
  assert.ok(part.presetMatchKeys!.includes('tubeProfile'));
  for (const key of ['tubeOD', 'tubeID', 'insertDiametralClearance']) {
    assert.ok(!part.parameters.some((field) => field.key === key));
    assert.ok(part.validate({ ...part.defaults, [key]: 100 }, 'assembled').length);
  }
  for (const tubeProfile of ['d100-96', '', undefined]) {
    const p = { ...part.defaults };
    if (tubeProfile === undefined) delete p.tubeProfile;
    else p.tubeProfile = tubeProfile;
    assert.ok(validateParameters(part, p, 'assembled').length);
    assert.throws(() => resolveTubeProfile(p));
    assert.throws(() => composition(p));
    assert.throws(() => configured(p, 'assembled', true));
    assert.throws(() => part.python(p, 'assembled'));
  }
});

test('old preset and edited library selections gain the explicit profile without losing camera or view', () => {
  const omitProfile = (p: typeof part.defaults) => {
    const { tubeProfile: _profile, ...rest } = p;
    return rest;
  };
  const previous = {
    ...part,
    defaults: omitProfile(part.defaults),
    parameters: part.parameters.filter((field) => field.key !== 'tubeProfile'),
    presets: part.presets.map((preset) => ({
      ...preset,
      parameters: omitProfile(preset.parameters),
    })),
  };
  for (const preset of previous.presets) {
    const next = reconcilePartSelection(part, previous, {
      partId: part.id,
      parameters: preset.parameters,
      modelState: 'service',
      presetId: preset.id,
    });
    assert.equal(next.parameters.tubeProfile, 'd90-86');
    assert.equal(next.parameters.cameraSetup, preset.parameters.cameraSetup);
    assert.equal(next.presetId, preset.id);
    assert.equal(matchingPresetId(part, next.parameters, preset.id), preset.id);
  }
  const edited = {
    ...previous.defaults,
    cameraSetup: 'camera-19',
    keyClearance: 0.4,
    module: 'nose',
    showTube: false,
  };
  const next = reconcilePartSelection(part, previous, {
    partId: part.id,
    parameters: edited,
    modelState: 'service',
    presetId: 'custom',
  });
  assert.deepEqual(next.parameters, { ...edited, tubeProfile: 'd90-86' });
  assert.equal(next.modelState, 'service');
});

test('old avionics configuration links and project records migrate only the missing known profile', () => {
  for (const preset of part.presets) {
    const { tubeProfile: _profile, ...oldParameters } = preset.parameters;
    const document = {
      version: 1,
      units: 'mm',
      part: part.id,
      state: 'service',
      presetId: preset.id,
      parameters: oldParameters,
    };
    const restored = parseConfiguration(JSON.stringify(document), [part]);
    assert.deepEqual(restored.parameters, preset.parameters);
    const link = '#configuration=' + encodeURIComponent(JSON.stringify(document));
    const linked = parseConfigurationLink(link, [part])!;
    assert.equal(linked.presetId, preset.id);
    assert.deepEqual(linked.parameters, preset.parameters);
    const project = addProduct(createProject('Saved tube profile'), [part, ...libraries], {
      part,
      parameters: preset.parameters,
      state: 'service',
      presetId: preset.id,
    }).project;
    const expected = JSON.parse(JSON.stringify(project)) as typeof project;
    const old = JSON.parse(JSON.stringify(expected)) as typeof project;
    delete old.configurations.find((item) => item.libraryId === part.id)!.parameters.tubeProfile;
    assert.deepEqual(parseProject(JSON.stringify(old), [part, ...libraries]), expected);
    const invalid = JSON.parse(JSON.stringify(old)) as typeof old;
    invalid.configurations.find((item) => item.libraryId === part.id)!.parameters.tubeProfile =
      'd100-96';
    assert.throws(() => parseProject(JSON.stringify(invalid), [part, ...libraries]));
    assert.throws(() =>
      parseConfiguration(
        JSON.stringify({ ...document, parameters: { ...oldParameters, tubeProfile: 'd100-96' } }),
        [part],
      ),
    );
    assert.throws(() =>
      parseConfigurationLink(
        '#configuration=' +
          encodeURIComponent(
            JSON.stringify({
              ...document,
              parameters: { ...oldParameters, tubeProfile: 'd100-96' },
            }),
          ),
        [part],
      ),
    );
    const missingOther = { ...oldParameters };
    delete missingOther.cameraSetup;
    assert.throws(() =>
      parseConfiguration(JSON.stringify({ ...document, parameters: missingOther }), [part]),
    );
  }
});

test('both clean camera kits separate the coupling fit coupon from the installed assembly', async () => {
  await initializeManifoldGeometry();
  const couponState = states.find((state) => state.id === 'templates')!;
  assert.match(couponState.label, /fit coupon/i);
  assert.doesNotMatch(couponState.label + couponState.description, /repair|retrofit/i);
  assert.match(couponState.description, /coupling seat/i);
  assert.match(couponState.description, /modular-tube-marking-kit:d90-86/);
  assert.equal(physicalProductState(part, 'templates'), 'assembled');
  assert.deepEqual(
    states.map((state) => state.id),
    ['assembled', 'cutaway', 'service', 'lower-cover', 'cable-routes', 'print', 'templates'],
  );
  const camera = part.parameters.find((field) => field.key === 'cameraSetup')!;
  const aidIds = ['square-key-fit-coupon'];
  let firstAids: unknown;
  for (const preset of part.presets) {
    const p = { ...preset.parameters, module: 'all', showElectronics: true, showTube: true };
    const prints = allPrinted(p);
    assert.equal(prints.length, 29);
    assert.equal(prints.filter((piece) => piece.material === 'PETG').length, 20);
    assert.equal(prints.filter((piece) => piece.material === 'TPU').length, 9);
    assert.ok(!prints.some((piece) => piece.id === 'tube-pilot-collar'));
    assert.ok(!prints.some((piece) => piece.id.endsWith('-retrofit-drill-mask')));
    assert.deepEqual(
      prints
        .filter((piece) => piece.module === 'template')
        .map((piece) => piece.id)
        .sort(),
      aidIds,
    );
    const kit = composition(p).components;
    assert.equal(kit.length, 164);
    assert.equal(kit.filter((piece) => piece.id === 'square-key-fit-coupon').length, 1);
    assert.ok(!kit.some((piece) => piece.id === 'tube-pilot-collar'));
    const installed = configured(p, 'assembled', true);
    assert.equal(installed.length, 163);
    assert.ok(!installed.some((piece) => aidIds.includes(piece.component.id)));
    assert.equal(camera.visibleWhen!(p, 'templates'), false);
    assert.equal(camera.visibleWhen!(p, 'assembled'), true);
    for (const excludeReferences of [false, true]) {
      const aids = configured(p, 'templates', excludeReferences)
        .map((piece) => piece.component)
        .sort((a, b) => a.id.localeCompare(b.id));
      assert.deepEqual(
        aids.map((piece) => piece.id),
        aidIds,
      );
      assert.ok(aids.every((piece) => piece.supply === 'manufactured'));
      firstAids ??= aids;
      assert.deepEqual(aids, firstAids);
    }
    assert.equal(configured(p, 'print', true).length, 29);
  }
});

test('both camera configurations retain valid inspection states and exact supplier identities', () => {
  for (const preset of part.presets) {
    for (const state of states) {
      assert.deepEqual(validateParameters(part, preset.parameters, state.id), []);
      assert.equal(availableModelState(part, preset.parameters, state.id), state.id);
    }
    const bom = composition(preset.parameters);
    assert.equal(new Set(bom.components.map((item) => item.id)).size, bom.components.length);
    for (const component of bom.components) {
      const library = libraries.find((item) => item.id === component.libraryId)!;
      assert.ok(library, component.libraryId);
      assert.deepEqual(library.validate(component.parameters, component.state), [], component.id);
    }
    const selectedCamera = bom.components.filter((item) =>
      ['board-camera-19', 'waveshare-ov9281-110'].includes(item.libraryId),
    );
    assert.equal(selectedCamera.length, 1);
    assert.equal(
      selectedCamera[0].presetId,
      preset.parameters.cameraSetup === 'ov9281' ? 'waveshare-21653' : 'imx577-19x19-rear-mipi-m25',
    );
    assert.equal(bom.components.filter((item) => item.libraryId === 'waveshare-ups-3s').length, 1);
    assert.equal(
      bom.components.filter((item) => item.libraryId === 'li-ion-battery-holder').length,
      1,
    );
    assert.equal(
      bom.components.filter(
        (item) => item.libraryId === 'electrical-connector' && item.presetId === 'xt60e-f',
      ).length,
      2,
    );
    assert.ok(
      !bom.components.some((item) => item.supply === 'purchased' && /elrs|antenna/i.test(item.id)),
      'Unidentified receiver must not acquire an invented supplier identity.',
    );
  }
  assert.deepEqual(powerEnvelopeChecks(), []);
});

test('inspection selection keeps canonical composition and project round trip source records', () => {
  const selection = {
    part,
    parameters: { ...part.defaults, module: 'flight', showTube: false, showElectronics: false },
    state: 'service',
    presetId: 'd90-86-ov9281',
  };
  const added = addProduct(
    createProject('Modular avionics reference'),
    [part, ...libraries],
    selection,
  );
  const roundTrip = JSON.parse(JSON.stringify(added.project));
  assert.deepEqual(validateProject(roundTrip, [part, ...libraries]), []);
  const rows = supplyRows(roundTrip, [part, ...libraries], 'purchased');
  for (const libraryId of [
    'flight-controller',
    'lch7-controller',
    'raspberry-pi',
    'waveshare-ups-3s',
  ])
    assert.ok(
      roundTrip.configurations.some(
        (config: { libraryId: string }) => config.libraryId === libraryId,
      ),
      libraryId,
    );
  assert.ok(rows.length > 10);
  const grandadoStock = roundTrip.configurations.filter(
    (config: { manufacturing?: { blank: string } }) =>
      config.manufacturing?.blank === 'catalog-enclosure:grandado-83-58-35-clear',
  );
  assert.equal(
    grandadoStock.length,
    1,
    'One drilled physical detail retains its exact purchased blank provenance.',
  );
  assert.ok(
    grandadoStock[0].manufacturing.requirements.some((item: string) =>
      item.includes('grandado.com'),
    ),
  );
  const inspection = configured(
    { ...selection.parameters, showElectronics: true },
    'service',
    true,
  );
  assert.ok(inspection.every((item) => item.component.supply !== 'reference'));
  assert.ok(inspection.some((item) => item.component.id === 'wing-mini'));
  assert.ok(inspection.some((item) => item.component.id === 'grandado-drilled-body'));
});

test('invalid camera, stale interface keys and invalid socket fits fail before geometry', () => {
  for (const p of [
    { ...part.defaults, cameraSetup: 'dual' },
    { ...part.defaults, keyClearance: NaN },
    { ...part.defaults, tubeID: 90 },
  ])
    assert.ok(part.validate(p, 'assembled').length);
  assert.ok(part.validate(part.defaults, 'compressed').length);
  const ids = allPrinted(part.defaults).map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('controller orientations remain selected while Pi ports face the camera', () => {
  const pieces = payload(part.defaults);
  const direction = (id: string, local: [number, number, number]) => {
    const occurrence = pieces.find((item) => item.component.id === id)!.component;
    return new Vector3(...local).applyEuler(
      new Euler(
        ...(occurrence.placement.rotation.map((angle) => (angle * Math.PI) / 180) as [
          number,
          number,
          number,
        ]),
        'ZYX',
      ),
    );
  };
  assert.ok(
    direction('wing-mini', [-1, 0, 0]).distanceTo(new Vector3(1, 0, 0)) < 1e-9,
    'WING contact group remains aft.',
  );
  for (const preset of part.presets) {
    const boards = payload(preset.parameters);
    for (const id of ['wing-mini', 'lch7']) {
      const placement = boards.find((item) => item.component.id === id)!.component.placement;
      assert.deepEqual(placement.translation.slice(0, 2), [0, 0], `${id} shares the tube axis`);
    }
  }
  assert.ok(
    direction('lch7', [1, 0, 0]).distanceTo(new Vector3(0, 1, 0)) < 1e-9,
    'LCH7 USB retains its selected Y+ direction.',
  );
  assert.ok(
    direction('usb-wireless', [-1, 0, 0]).distanceTo(new Vector3(0, 0, -1)) < 1e-9,
    'SpeedyBee USB opens downward through the fore side of the lower window.',
  );
  const panel = pieces.find((item) => item.component.id === 'flight-usb-c-panel')!.component;
  assert.equal(panel.libraryId, 'signal-connector');
  assert.equal(panel.presetId, 'nikom-a448027');
  assert.ok(panel.placement.translation[0] > 0);
  assert.ok(direction(panel.id, [0, 0, 1]).distanceTo(new Vector3(0, 0, -1)) < 1e-9);
  assert.ok(
    direction('pi-5', [1, 0, 0]).distanceTo(new Vector3(-1, 0, 0)) < 1e-9,
    'Pi USB/Ethernet face the camera.',
  );
  assert.ok(
    direction('power-ups-3s', [1, 0, 0]).distanceTo(new Vector3(-1, 0, 0)) < 1e-9,
    'UPS socket edge faces the forward XT60 panel after its in-plane correction.',
  );
  assert.ok(
    direction('power-ups-3s', [0, 0, -1]).distanceTo(new Vector3(0, 0, -1)) < 1e-9,
    'UPS battery face is retained by the proper Z-axis rotation.',
  );
  for (const preset of part.presets) {
    const source = payload(preset.parameters).find(
      (piece) => piece.component.id === 'nose-camera',
    )!.component;
    const rotation = new Euler(
      ...(source.placement!.rotation.map((value) => (value * Math.PI) / 180) as [
        number,
        number,
        number,
      ]),
      'ZYX',
    );
    assert.ok(new Vector3(0, 0, 1).applyEuler(rotation).distanceTo(new Vector3(-1, 0, 0)) < 1e-9);
    if (preset.parameters.cameraSetup === 'camera-19') {
      assert.ok(new Vector3(0, 1, 0).applyEuler(rotation).distanceTo(new Vector3(0, 0, 1)) < 1e-9);
      assert.ok(new Vector3(1, 0, 0).applyEuler(rotation).distanceTo(new Vector3(0, -1, 0)) < 1e-9);
      assert.equal(source.parameters.lensDiameter, 14.8);
      assert.equal(source.parameters.lensCollarDiameter, 16);
      assert.equal(source.parameters.lensCollarHeight, 5);
    }
  }
});

test('shared flight cassette and coupling seats retain exact reusable fasteners', () => {
  for (const preset of part.presets) {
    const components = composition(preset.parameters).components;
    const wing = components.filter((item) => item.id.startsWith('wing-mount-screw-'));
    const lch = components.filter((item) => item.id.startsWith('lch7-mount-screw-'));
    const nuts = components.filter((item) => item.id.startsWith('lch7-mount-nut-'));
    const washers = components.filter((item) => /^power-xt60-washer-[12]-[12]$/.test(item.id));
    assert.equal(wing.length, 4);
    assert.ok(
      wing.every(
        (item) => item.libraryId === 'bolt-screw' && item.presetId === 'gvyntok-040-200-004',
      ),
    );
    assert.equal(lch.length, 4);
    assert.ok(
      lch.every(
        (item) => item.libraryId === 'bolt-screw' && item.presetId === 'gvyntok-040-200-014',
      ),
    );
    assert.equal(nuts.length, 4);
    assert.ok(nuts.every((item) => item.libraryId === 'nyloc-nut'));
    assert.equal(components.filter((item) => item.id.startsWith('lch7-mount-washer-')).length, 4);
    for (const [id, material] of [
      ['flight-board-carrier', 'PETG'],
      ['flight-board-isolator', 'TPU'],
    ])
      assert.equal(components.find((item) => item.id === id)?.manufacturing?.material, material);
    assert.ok(!components.some((item) => /^(wing|lch7|usb)-tpu-platform$/.test(item.id)));
    const sleeves = components.filter((item) => item.id.startsWith('flight-cassette-sleeve-'));
    assert.equal(sleeves.length, 4);
    for (const sleeve of sleeves) {
      assert.equal(sleeve.libraryId, 'dremec-spacer-sleeve');
      assert.equal(sleeve.parameters.outerDiameter, 5);
      assert.equal(sleeve.parameters.bore, 3.4);
      assert.equal(sleeve.parameters.length, 6);
    }
    assert.equal(washers.length, 4);
    assert.ok(
      washers.every(
        (item) => item.libraryId === 'washer' && item.presetId === 'gvyntok-e3f364f222e0',
      ),
    );
    assert.ok(!components.some((item) => item.id.startsWith('temporary-coupler-screw-')));
    const couplers = components.filter((item) => item.id.startsWith('m3-10-coupler-'));
    assert.equal(couplers.length, 4);
    assert.ok(
      couplers.every(
        (item) => item.libraryId === 'pcb-standoff' && item.presetId === 'user-m3x10-af4-7-ac5-2',
      ),
    );
    for (const item of couplers) {
      assert.equal(item.parameters.bodyWidth, 4.7);
      assert.equal(item.parameters.cornerDiameter, 5.2);
      assert.equal(item.parameters.bodyLength, 10);
    }
    assert.ok(!components.some((item) => item.id.startsWith('flight-coupler-keeper-')));
    assert.ok(!components.some((item) => item.id.startsWith('flight-coupler-post-')));
    assert.ok(!components.some((item) => item.id.startsWith('flight-coupler-retainer-')));
    for (const [suffix, libraryId, presetId] of [
      ['screw', 'bolt-screw', 'gvyntok-040-190-007'],
      ['washer', 'washer', 'gvyntok-e3f364f222e0'],
      ['nut', 'hex-nut', 'gvyntok-474adfbe1cd7'],
    ]) {
      const earParts = components.filter((item) => item.id.startsWith(`grandado-ear-${suffix}-`));
      assert.equal(earParts.length, 2);
      assert.ok(
        earParts.every((item) => item.libraryId === libraryId && item.presetId === presetId),
      );
    }
  }
});

test('lower radio cover is reviewable for every module filter without changing the BOM', () => {
  for (const module of ['all', 'flight', 'nose', 'power', 'spool', 'tail']) {
    const p = { ...part.defaults, module };
    const pieces = configured(p, 'lower-cover');
    const ids = new Set(pieces.map((item) => item.component.id));
    for (const id of lowerCoverPartIds) assert.ok(ids.has(id), `${module}: missing ${id}`);
    assert.ok(!ids.has('flight-board-carrier'));
    assert.ok(!ids.has('nose-shell'));
    assert.deepEqual(composition(p).components, composition(part.defaults).components);
    for (const item of pieces.filter((item) => item.component.id.endsWith('-reference')))
      assert.equal(item.component.supply, 'reference');
  }
});

test('servicing the lower cover carries its radio assembly and leaves LCH7 supports installed', () => {
  const p = { ...part.defaults, module: 'flight', showTube: false };
  const closed = configured(p, 'assembled');
  const open = configured(p, 'service');
  for (const id of lowerCoverPartIds) {
    const before = closed.find((item) => item.component.id === id)!;
    const after = open.find((item) => item.component.id === id)!;
    assert.ok(before && after, id);
    assert.deepEqual(
      after.component,
      before.component,
      `${id}: source identity or installed placement changed`,
    );
    assert.deepEqual(after.position, [0, 0, -50], `${id}: must move with the lid`);
  }
  assert.deepEqual(
    open.find((item) => item.component.id === 'flight-board-carrier')!.position,
    [0, 0, 0],
  );
  const noseService = configured({ ...part.defaults, module: 'nose', showTube: false }, 'service');
  assert.deepEqual(
    noseService.find((item) => item.component.id === 'nose-shell')!.position,
    [-180, 0, 0],
  );
  for (const item of noseService.filter((piece) =>
    piece.component.id.startsWith('nose-shell-nut-'),
  ))
    assert.deepEqual(
      item.position,
      [0, 0, 0],
      'Captured nuts stay with the frame during fairing removal.',
    );
  for (const item of noseService.filter((piece) =>
    piece.component.id.startsWith('nose-shell-screw-'),
  ))
    assert.equal(item.position?.[1], 12 * Math.sign(item.component.placement.translation[1]));
});

test('obsolete selected lid screw lengths are absent from every configuration and view', () => {
  assert.ok(
    !composition(part.defaults).components.some((item) =>
      /^(upper|lower)-through-screw-/.test(item.id),
    ),
  );
  assert.ok(
    !composition(part.defaults).components.some((item) =>
      /^flight-radio-(tpu-carrier|retainer|closure-)/.test(item.id),
    ),
  );
  assert.equal(
    composition(part.defaults).components.filter((item) => item.id.startsWith('m3-10-coupler-'))
      .length,
    4,
  );
  for (const state of ['assembled', 'service', 'lower-cover'])
    assert.ok(
      !configured(part.defaults, state).some((item) =>
        /^(upper|lower)-through-screw-|^flight-radio-(tpu-carrier|retainer|closure-)/.test(
          item.component.id,
        ),
      ),
    );
});

test('cable inspection keeps reserved gauges separate from physical configuration and exports', () => {
  for (const preset of part.presets) {
    const p = { ...preset.parameters, module: 'tail', showElectronics: false, showTube: true };
    const view = configured(p, 'cable-routes');
    const gauges = view.filter((item) => item.component.id.startsWith('flight-cable-route-'));
    assert.deepEqual(
      gauges.map((item) => item.component.id),
      ['flight-cable-route-left', 'flight-cable-route-right'],
    );
    assert.ok(gauges.every((item) => item.component.supply === 'reference'));
    assert.ok(view.some((item) => item.component.id === 'pi-5'));
    assert.ok(
      !view.some((item) =>
        ['tube-reference', 'nose-shell', 'grandado-through-cover', 'flight-lower-cover'].includes(
          item.component.id,
        ),
      ),
    );
    const exported = configured(p, 'cable-routes', true);
    assert.ok(exported.every((item) => item.component.supply !== 'reference'));
    assert.ok(exported.some((item) => item.component.id === 'pi-5'));
    const bom = composition(p);
    assert.ok(!bom.components.some((item) => item.id.startsWith('flight-cable-route-')));
    const sleeves = bom.components.filter((item) =>
      item.id.startsWith('nose-pi-compression-sleeve-'),
    );
    assert.equal(sleeves.length, 4);
    assert.ok(
      sleeves.every(
        (item) =>
          item.libraryId === 'dremec-spacer-sleeve' &&
          item.supply === 'purchased' &&
          item.presetId === undefined,
      ),
    );
    assert.ok(!allPrinted(p).some((item) => item.id.startsWith('nose-pi-compression-sleeve-')));
    const added = addProduct(createProject('Cable inspection reference'), [part, ...libraries], {
      part,
      parameters: p,
      state: 'cable-routes',
      presetId: preset.id,
    });
    assert.deepEqual(
      validateProject(JSON.parse(JSON.stringify(added.project)), [part, ...libraries]),
      [],
    );
  }
});

test('six generic 18650 fitting cans are visible references and never selected purchases', () => {
  const references = powerCellReferences();
  assert.equal(references.length, 6);
  assert.equal(new Set(references.map((piece) => piece.component.id)).size, 6);
  assert.ok(
    references.every(
      ({ component }) =>
        component.supply === 'reference' &&
        component.presetId === undefined &&
        !component.procurement,
    ),
  );
  for (const preset of part.presets) {
    const p = { ...preset.parameters, module: 'power', showElectronics: true };
    const ids = new Set(references.map((piece) => piece.component.id));
    for (const state of ['assembled', 'cutaway', 'service', 'cable-routes']) {
      assert.equal(configured(p, state).filter((piece) => ids.has(piece.component.id)).length, 6);
      assert.ok(!configured(p, state, true).some((piece) => ids.has(piece.component.id)));
    }
    assert.ok(!composition(p).components.some((component) => ids.has(component.id)));
    assert.ok(
      !configured({ ...p, showElectronics: false }, 'assembled').some((piece) =>
        ids.has(piece.component.id),
      ),
    );
    assert.ok(
      !configured({ ...p, module: 'flight' }, 'assembled').some((piece) =>
        ids.has(piece.component.id),
      ),
    );
  }
});

test('power cassette retains six structural pieces after the delivered UPS rejects its liner', () => {
  const printed = allPrinted(part.defaults).filter((piece) => piece.module === 'power');
  assert.deepEqual(
    new Set(printed.map((piece) => piece.id)),
    new Set([
      'power-forward-disc',
      'power-aft-disc',
      'power-main-frame',
      'power-upper-cage',
      'power-lower-pan',
      'power-holder-cell-liner',
    ]),
  );
  assert.equal(printed.length, 6);
  assert.equal(printed.filter((piece) => piece.material === 'PETG').length, 5);
  assert.equal(printed.filter((piece) => piece.material === 'TPU').length, 1);
  const components = composition(part.defaults).components;
  assert.ok(!components.some((component) => component.id === 'power-ups-cell-liner'));
  assert.ok(
    !components.some((component) =>
      /^power-(?:lower-holder-cradle|upper-ups-cradle|ups-(?:left|right)-keeper|lower-holder-pad-|ups-pad-)/.test(
        component.id,
      ),
    ),
  );
  for (const id of ['power-ups-3s', 'power-extra-3s-holder', 'power-xt60e-f-1', 'power-xt60e-f-2'])
    assert.equal(components.filter((component) => component.id === id).length, 1);
  for (const piece of printed.filter((piece) => piece.material === 'PETG')) {
    const manufactured = components.find((component) => component.id === piece.id)!.manufacturing!;
    assert.ok(
      manufactured.requirements.some((requirement) => requirement.includes('100% rectilinear')),
    );
    if (piece.id.endsWith('-disc')) continue;
    const direction = new Vector3(1, 0, 0).applyEuler(
      new Euler(
        ...((piece.printRotation ?? [0, 0, 0]).map((angle) => (angle * Math.PI) / 180) as [
          number,
          number,
          number,
        ]),
        'ZYX',
      ),
    );
    assert.ok(
      Math.abs(direction.z) < 1e-9,
      `${piece.id}: longitudinal load direction must remain in the layer plane`,
    );
  }
  for (const id of [
    'flight-frame',
    'nose-base-frame',
    'nose-camera-keeper',
    'grandado-through-cover',
    'flight-lower-cover',
  ]) {
    const piece = allPrinted(part.defaults).find((item) => item.id === id)!;
    const manufacturing = components.find((component) => component.id === id)!.manufacturing!;
    assert.ok(
      manufacturing.requirements.some((requirement) => requirement.includes('100% rectilinear')),
    );
    const direction = new Vector3(1, 0, 0).applyEuler(
      new Euler(
        ...((piece.printRotation ?? [0, 0, 0]).map((angle) => (angle * Math.PI) / 180) as [
          number,
          number,
          number,
        ]),
        'ZYX',
      ),
    );
    assert.ok(
      Math.abs(direction.z) < 1e-9,
      `${id}: longitudinal frame stress must remain in the layer plane`,
    );
  }
});

test('keyed Pi isolation uses one free-form TPU detail and the original hard-clamped board stack', () => {
  assert.deepEqual(
    auxiliaryContactSpecs(),
    [],
    'The two auxiliary sleeves are bolted with clearance.',
  );
  const retired = [
    'nose-auxiliary-tray',
    'nose-pi-keeper-left',
    'nose-pi-keeper-right',
    'nose-pi-upper-liner-left',
    'nose-pi-upper-liner-right',
  ];
  for (const preset of part.presets) {
    const prints = allPrinted(preset.parameters).filter((piece) => piece.module === 'nose');
    assert.equal(prints.length, 11);
    const components = composition(preset.parameters).components;
    assert.ok(!components.some((piece) => retired.includes(piece.id)));
    assert.ok(!components.some((piece) => /^nose-pi-keeper-(?:screw|nut)-/.test(piece.id)));
    const cushion = prints.find((piece) => piece.id === 'nose-pi-cushion')!;
    assert.ok(
      cushion.printShape,
      'The folded eyelets have a separately implemented upright manufacturing form.',
    );
    const installed = components.find((piece) => piece.id === cushion.id)!;
    const manufactured = configured(preset.parameters, 'print', true).find(
      (piece) => piece.component.id === cushion.id,
    )!.component;
    assert.equal(installed.state, 'default');
    assert.equal(manufactured.state, 'manufacturing');
    assert.deepEqual(
      installed.parameters,
      manufactured.parameters,
      'Free and installed forms must share one complete physical definition.',
    );
    assert.equal(typeof installed.parameters.manufacturingRecipe, 'string');
    assert.notEqual(installed.parameters.recipe, installed.parameters.manufacturingRecipe);
    const detail = libraries.find((library) => library.id === 'manufactured-detail')!;
    assert.equal(physicalProductState(detail, manufactured.state), 'default');
    assert.deepEqual(
      productIdentityParameters(detail, installed.parameters),
      productIdentityParameters(detail, manufactured.parameters),
    );
    assert.deepEqual(
      piContactSpecs().map((spec) => [spec.ids, spec.expectedVolume]),
      [
        [['nose-base-frame', 'nose-pi-cushion'], 23.2195959472],
        [['nose-pi-cushion', 'nose-pi-carrier'], 17.34],
        [['nose-pi-cushion', 'pi-5'], 3.79812116154],
      ],
      'Short backed lands take up three interfaces; the Pi tabs avoid serial soft bolt clamping.',
    );
    assert.ok(piContactSpecs().every((spec) => spec.interference === 0.1));
    for (const id of ['nose-tracker-tray', 'nose-finder-tray']) {
      const matches = components.filter((piece) => piece.id === id);
      assert.equal(matches.length, 1);
      assert.equal(matches[0].manufacturing!.material, 'TPU');
      const screwPreset = id === 'nose-finder-tray' ? 'gvyntok-040-070-005' : 'gvyntok-040-190-006';
      for (const [suffix, libraryId, presetId] of [
        ['screw', 'bolt-screw', screwPreset],
        ['washer', 'washer', 'gvyntok-e3f364f222e0'],
        ['nut', 'hex-nut', 'gvyntok-474adfbe1cd7'],
      ]) {
        const fastener = components.find((piece) => piece.id === `${id}-${suffix}`)!;
        assert.equal(fastener.libraryId, libraryId);
        assert.equal(fastener.presetId, presetId);
      }
    }
    for (const [prefix, libraryId, presetId] of [
      ['pi-stack-screw-', 'bolt-screw', 'gvyntok-040-220-039'],
      ['pi-stack-nut-', 'nyloc-nut', 'tr-tr00000407-000'],
    ]) {
      const fasteners = components.filter((piece) => piece.id.startsWith(prefix));
      assert.equal(fasteners.length, 4);
      assert.ok(
        fasteners.every((piece) => piece.libraryId === libraryId && piece.presetId === presetId),
      );
    }
    for (const libraryId of ['gps-tracker', 'jhe42b-finder'])
      assert.equal(components.filter((piece) => piece.libraryId === libraryId).length, 1);
    const service = configured(
      { ...preset.parameters, module: 'nose', showElectronics: true },
      'service',
      true,
    );
    for (const id of [
      'nose-tracker-tray',
      'nose-finder-tray',
      'nose-pi-carrier',
      'nose-pi-cushion',
    ])
      assert.equal(service.filter((piece) => piece.component.id === id).length, 1);
    assert.ok(!service.some((piece) => piece.component.id.endsWith('-retrofit-drill-mask')));
  }
});

test('integrated tail closure is one physical part and stays visible from power and tail views', () => {
  for (const preset of part.presets) {
    const canonical = composition(preset.parameters);
    assert.equal(canonical.components.filter((item) => item.id === 'power-aft-disc').length, 1);
    assert.equal(canonical.components.filter((item) => item.id === 'tail-tpu-buffer').length, 1);
    assert.ok(!canonical.components.some((item) => item.id === 'tail-baffle'));
    for (const id of ['tail-tie-washer-1', 'tail-tie-washer-2']) {
      const washer = canonical.components.find((item) => item.id === id)!;
      assert.equal(washer.libraryId, 'washer');
      assert.equal(washer.presetId, 'gvyntok-e5f58c827639');
    }
    for (const module of ['all', 'power', 'tail']) {
      const p = { ...preset.parameters, module, showElectronics: true };
      assert.deepEqual(composition(p), canonical);
      for (const state of ['assembled', 'service']) {
        const pieces = configured(p, state);
        const ids = pieces.map((item) => item.component.id);
        assert.equal(new Set(ids).size, ids.length);
        assert.equal(ids.filter((id) => id === 'power-aft-disc').length, 1);
        assert.equal(ids.filter((id) => id === 'tail-tpu-buffer').length, 1);
        assert.ok(!ids.includes('tail-baffle'));
        for (const id of [
          'tail-tie-screw-1',
          'tail-tie-screw-2',
          'tube-anchor-7-1',
          'tube-anchor-7--1',
        ])
          assert.ok(ids.includes(id), `${module}/${state}: ${id}`);
      }
    }
  }
});

test('NVMe end retention hardware follows the nose assembly in both camera variants', () => {
  const retentionIds = ['nvme-end-screw', 'nvme-end-washer'];
  for (const preset of part.presets) {
    const canonical = composition(preset.parameters);
    const p = { ...preset.parameters, module: 'nose', showElectronics: true };
    assert.deepEqual(composition(p), canonical);
    for (const state of ['assembled', 'service', 'cutaway']) {
      const pieces = configured(p, state, true);
      for (const id of retentionIds) {
        const matches = pieces.filter((piece) => piece.component.id === id);
        assert.equal(matches.length, 1, `${preset.id}/${state}: ${id}`);
        assert.deepEqual(
          matches[0].component,
          canonical.components.find((component) => component.id === id),
        );
      }
    }
    for (const module of ['flight', 'power', 'spool', 'tail']) {
      assert.ok(
        !configured({ ...p, module }, 'assembled', true).some((piece) =>
          retentionIds.includes(piece.component.id),
        ),
      );
    }
    assert.ok(
      !configured({ ...p, showElectronics: false }, 'assembled', true).some((piece) =>
        retentionIds.includes(piece.component.id),
      ),
    );
  }
});

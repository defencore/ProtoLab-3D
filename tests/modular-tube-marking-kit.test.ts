import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Euler, Matrix4, Raycaster, Vector3 } from 'three';
import part, { states } from '../src/parts/modular-tube-marking-kit/part';
import descriptor from '../src/parts/modular-tube-marking-kit/index';
import {
  configured,
  jigPrinted,
  jigPayload,
  jigLayout,
  libraries,
} from '../src/parts/modular-tube-marking-kit/lib/model';
import { jigDatums, jigPattern } from '../src/parts/modular-tube-marking-kit/lib/shapes';
import { componentGeometry } from '../src/core/assembly/detail-instances';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import { availableModelState } from '../src/core/part-selection';
import { physicalProductState, productIdentityParameters } from '../src/core/eskd';
import {
  addProduct,
  createProject,
  parseProject,
  validateProject,
} from '../src/core/design-project';
import { parseConfiguration } from '../src/core/configuration';
import { parseConfigurationLink } from '../src/core/configuration-link';
import { resolveTubeProfile } from '../src/parts/modular-tube-avionics/lib/tube-interface';
import avionics from '../src/parts/modular-tube-avionics/part';
import avionicsDescriptor from '../src/parts/modular-tube-avionics/index';
import {
  composition as avionicsComposition,
  configured as avionicsConfigured,
} from '../src/parts/modular-tube-avionics/lib/model';
import {
  tubeReferenceDatums,
  accessWindowDatums,
} from '../src/parts/modular-tube-avionics/lib/shared';
import { holeStations, tubeMounting } from '../src/parts/modular-tube-avionics/lib/service';
import { grandadoSpec } from '../src/parts/catalog-enclosure/lib/grandado';
import { parts } from '../src/parts';
import { groupBrowseFamilies } from '../src/core/browse-families';
import { filterLibraryLocation, libraryArea } from '../src/core/library-navigation';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';

const printedIds = [
  'modular-tube-jig-collar-a',
  'modular-tube-jig-clamp-shoe',
  'modular-tube-jig-window-stencil',
  'modular-tube-jig-rail-front',
  'modular-tube-jig-rail-rear',
];
const movingIds = new Set(printedIds.slice(2));
const hardwareIds = [
  'modular-tube-jig-pressure-screw',
  'modular-tube-jig-pressure-nut',
  'modular-tube-jig-shoe-retainer-screw',
  'modular-tube-jig-shoe-retainer-nut',
];
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-7, `${a} differs from ${b}`);

test('marking tools share one explicit profile and reject unqualified profiles before geometry', () => {
  assert.equal(part.defaults.tubeProfile, 'd90-86');
  assert.equal(part.presets[0].parameters.tubeProfile, 'd90-86');
  assert.equal(resolveTubeProfile(part.defaults).outerDiameter, 90);
  assert.equal(productIdentityParameters(part, part.defaults).tubeProfile, 'd90-86');
  assert.ok(part.presetMatchKeys!.includes('tubeProfile'));
  for (const key of ['tubeOD', 'tubeID', 'insertDiametralClearance'])
    assert.ok(!part.parameters.some((field) => field.key === key));
  for (const tubeProfile of ['d100-96', '', undefined]) {
    const p = { ...part.defaults };
    if (tubeProfile === undefined) delete p.tubeProfile;
    else p.tubeProfile = tubeProfile;
    assert.ok(validateParameters(part, p, 'assembled').length);
    assert.throws(() => configured(p, 'assembled', false));
    assert.throws(() => part.composition!(p));
    assert.throws(() => part.python(p, 'assembled'));
  }
});

test('old marking links and projects acquire only the supported missing profile', () => {
  const { tubeProfile: _profile, ...oldParameters } = part.presets[0].parameters;
  const document = {
    version: 1,
    units: 'mm',
    part: part.id,
    state: 'exploded',
    presetId: 'd90-86',
    parameters: oldParameters,
  };
  assert.deepEqual(
    parseConfiguration(JSON.stringify(document), [part]).parameters,
    part.presets[0].parameters,
  );
  const linked = parseConfigurationLink(
    '#configuration=' + encodeURIComponent(JSON.stringify(document)),
    [part],
  )!;
  assert.equal(linked.presetId, 'd90-86');
  assert.deepEqual(linked.parameters, part.presets[0].parameters);
  const project = addProduct(createProject('Saved marking kit'), [part, ...libraries], {
    part,
    parameters: part.presets[0].parameters,
    state: 'exploded',
    presetId: 'd90-86',
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
          JSON.stringify({ ...document, parameters: { ...oldParameters, tubeProfile: 'd100-96' } }),
        ),
      [part],
    ),
  );
  const missingOther = { ...oldParameters };
  delete missingOther.fitAllowance;
  assert.throws(() =>
    parseConfiguration(JSON.stringify({ ...document, parameters: missingOther }), [part]),
  );
});

test('registered family resolves its exact execution in the existing workshop hierarchy', () => {
  assert.equal(parts.filter((candidate) => candidate.id === part.id).length, 1);
  assert.equal(libraryArea(part.category), 'workshop');
  const entries = filterLibraryLocation(groupBrowseFamilies(parts), {
    level: 'subgroup',
    category: 'WORKSHOP TOOLS',
    subgroup: 'DRILLING JIGS',
  });
  const own = entries.filter((entry) => entry.id === part.id);
  assert.equal(own.length, 1);
  assert.equal(own[0].members.length, 1);
  const matches = searchLibrary(buildLibrarySearchIndex(own), `${part.id}:d90-86`);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].family.primary.id, part.id);
  assert.equal(matches[0].articleQuery, `${part.id}:d90-86`);
});

test('standalone marking kit has five authored tools and four exact standard units', () => {
  assert.equal(part.id, 'modular-tube-marking-kit');
  assert.equal(part.category, 'WORKSHOP TOOLS');
  assert.equal(part.subgroup, 'DRILLING JIGS');
  assert.equal(part.product.kind, 'kit');
  assert.ok(descriptor.dependencies.includes('modular-tube-avionics'));
  assert.ok(!avionicsDescriptor.dependencies.includes('modular-tube-marking-kit'));
  assert.deepEqual(
    jigPrinted(part.defaults).map((item) => item.id),
    printedIds,
  );
  const kit = part.composition!(part.defaults);
  assert.equal(kit.components.length, 9);
  assert.equal(new Set(kit.components.map((item) => item.id)).size, 9);
  assert.equal(kit.components.filter((item) => item.supply === 'manufactured').length, 5);
  assert.equal(kit.components.filter((item) => item.supply === 'standard').length, 4);
  assert.deepEqual(
    kit.components.filter((item) => item.supply === 'standard').map((item) => item.id),
    hardwareIds,
  );
  assert.ok(!kit.components.some((item) => /collar-b|clamp-screw-|clamp-nut-/.test(item.id)));
  assert.equal(part.defaults.fitAllowance, 0.8);
  assert.equal(part.presets[0].parameters.fitAllowance, 0.8);
  for (const item of kit.components) {
    const library = libraries.find((candidate) => candidate.id === item.libraryId)!;
    assert.ok(library, item.id);
    assert.deepEqual(library.validate(item.parameters, item.state), [], item.id);
  }
  const screws = jigPayload(part.defaults).filter(
    (item) => item.component.libraryId === 'bolt-screw',
  );
  const nuts = jigPayload(part.defaults).filter((item) => item.component.libraryId === 'hex-nut');
  assert.equal(screws.length, 2);
  assert.equal(nuts.length, 2);
  assert.deepEqual(
    screws.map((item) => [item.component.id, item.component.presetId]),
    [
      ['modular-tube-jig-pressure-screw', 'gvyntok-040-190-008'],
      ['modular-tube-jig-shoe-retainer-screw', 'gvyntok-040-190-009'],
    ],
  );
  assert.ok(nuts.every((item) => item.component.presetId === 'gvyntok-474adfbe1cd7'));
});

test('all implemented views validate and normalize to the canonical tool kit', () => {
  assert.deepEqual(
    states.map((state) => state.id),
    ['assembled', 'exploded', 'print'],
  );
  for (const preset of part.presets) {
    for (const state of states) {
      assert.deepEqual(validateParameters(part, preset.parameters, state.id), []);
      assert.equal(availableModelState(part, preset.parameters, state.id), state.id);
      assert.equal(physicalProductState(part, state.id), 'assembled');
    }
  }
  assert.ok(validateParameters(part, { ...part.defaults, markDiameter: 3 }, 'assembled').length);
  assert.ok(
    validateParameters(part, { ...part.defaults, fitAllowance: Infinity }, 'assembled').length,
  );
  assert.ok(validateParameters(part, { ...part.defaults, unrelatedSize: 10 }, 'assembled').length);
});

test('setup and reference controls keep product identity and all nine canonical placements', () => {
  const original = part.composition!(part.defaults);
  const identity = productIdentityParameters(part, part.defaults);
  for (const side of ['first', 'opposite']) {
    for (const showTube of [false, true]) {
      const p = { ...part.defaults, side, showTube };
      assert.deepEqual(productIdentityParameters(part, p), identity);
      assert.deepEqual(part.composition!(p), original);
      const physical = configured(p, 'assembled', false);
      const view = configured(p, 'assembled', true);
      assert.equal(physical.length, 9);
      assert.ok(physical.every((item) => item.component.supply !== 'reference'));
      assert.equal(view.length, showTube ? 11 : 9);
    }
  }
  for (const [key, value] of [
    ['fitAllowance', 0.5],
    ['jointAllowance', 0.3],
    ['markDiameter', 3.3],
  ] as const) {
    const edited = { ...part.defaults, [key]: value };
    assert.notDeepEqual(productIdentityParameters(part, edited), identity);
    assert.notDeepEqual(
      part.composition!(edited).components.map((item) => item.parameters),
      original.components.map((item) => item.parameters),
    );
  }
});

test('opposite pass transfers only three tools and preserves the complete fixed base', () => {
  const frame = (placement: { translation: number[]; rotation: number[] }) =>
    new Matrix4()
      .makeRotationFromEuler(
        new Euler(
          ...(placement.rotation.map((v) => (v * Math.PI) / 180) as [number, number, number]),
          'ZYX',
        ),
      )
      .setPosition(...(placement.translation as [number, number, number]));
  for (const state of ['assembled', 'exploded']) {
    const first = configured({ ...part.defaults, side: 'first' }, state, false);
    const opposite = configured({ ...part.defaults, side: 'opposite' }, state, false);
    assert.equal(first.length, 9);
    assert.equal(first.filter((item) => movingIds.has(item.component.id)).length, 3);
    for (let i = 0; i < first.length; i++) {
      const before = first[i].component;
      const after = opposite[i].component;
      assert.equal(after.id, before.id);
      if (!movingIds.has(before.id)) {
        assert.deepEqual(after, before, `${state}: fixed ${before.id} changed between passes`);
        continue;
      }
      assert.deepEqual(after.parameters, before.parameters, before.id);
      const expected = new Matrix4().makeRotationX(Math.PI).multiply(frame(before.placement));
      const actual = frame(after.placement);
      actual.elements.forEach((value, j) => near(value, expected.elements[j]));
    }
  }
  const layout = jigLayout({ ...part.defaults, side: 'opposite' });
  near(layout.toolAngleDegrees, 180);
  near(layout.baseAngleDegrees, 0);
  assert.deepEqual(layout.registerAnglesDegrees, [0, 90, 180, 270]);
});

test('source pattern has exactly two windows and sixteen radial centers without cover-bolt holes', () => {
  assert.deepEqual(
    jigPattern.holeStations.map((station) => station.sourceX),
    holeStations,
  );
  assert.equal(jigPattern.holeStations.length * 2, 16);
  assert.equal(jigPattern.finishedHoleDiameter, tubeMounting.pilotDiameter);
  assert.deepEqual(jigPattern.window, accessWindowDatums);
  assert.equal(jigPattern.window.cornerRadius, 2.5);
  for (const station of jigPattern.holeStations)
    near(station.x, station.sourceX - tubeReferenceDatums.frontX);
  near(
    jigPattern.windowCenterX,
    accessWindowDatums.x + accessWindowDatums.length / 2 - tubeReferenceDatums.frontX,
  );
  for (const [coverX] of grandadoSpec.screwCenters)
    assert.ok(
      !jigPattern.holeStations.some((station) => Math.abs(station.sourceX - coverX) < 1e-7),
    );
  for (const fitAllowance of [0.1, 1]) {
    const layout = jigLayout({ ...part.defaults, fitAllowance });
    assert.deepEqual(layout.pattern, jigPattern);
    assert.equal(layout.pattern.window.length, 83.6);
    assert.equal(layout.pattern.window.width, 58.6);
  }
});

test('project round trip retains the canonical nine units and no workpiece reference', () => {
  const p = { ...part.defaults, side: 'opposite', showTube: true };
  for (const state of ['assembled', 'exploded', 'print']) {
    const added = addProduct(createProject('Tube stencil kit'), [part, ...libraries], {
      part,
      parameters: p,
      state,
      presetId: 'd90-86',
    });
    const project = JSON.parse(JSON.stringify(added.project));
    assert.deepEqual(validateProject(project, [part, ...libraries]), []);
    assert.equal(
      project.occurrences.filter((item: { parentId: string | null }) => item.parentId).length,
      9,
    );
    assert.ok(
      project.configurations.every((item: { supply: string }) => item.supply !== 'reference'),
    );
  }
});

test('the separate process kit leaves installed avionics composition unchanged', () => {
  assert.equal(avionics.id, 'modular-tube-avionics');
  assert.deepEqual(
    avionics.presets.map((preset) => preset.id),
    ['d90-86-ov9281', 'd90-86-imx577-19x19'],
  );
  for (const preset of avionics.presets) {
    const all = avionicsComposition(preset.parameters).components;
    const installed = avionicsConfigured(
      { ...preset.parameters, showTube: false, showElectronics: true },
      'assembled',
      true,
    );
    assert.equal(all.length, 164);
    assert.equal(installed.length, 163);
    assert.ok(!all.some((item) => item.id.startsWith('modular-tube-jig-')));
    assert.ok(!installed.some((item) => item.component.libraryId === 'modular-tube-marking-kit'));
  }
});

test('printed tools fit individual beds and assembled centerlines pass through the whole kit', async () => {
  await part.initializeGeometry!(part.defaults, 'print');
  const first = configured({ ...part.defaults, side: 'first', showTube: true }, 'print', false);
  const opposite = configured(
    { ...part.defaults, side: 'opposite', showTube: false },
    'print',
    false,
  );
  assert.equal(first.length, 5);
  assert.deepEqual(
    first.map((item) => item.component),
    opposite.map((item) => item.component),
  );
  for (const item of first) {
    const model = componentGeometry(libraries, [item]);
    try {
      const bounds = new Box3().setFromObject(model, true);
      assert.ok(Math.max(...bounds.getSize(new Vector3()).toArray()) <= 256.001, item.component.id);
      assert.ok(Math.abs(bounds.min.z) < 1e-5, item.component.id);
    } finally {
      disposeModel(model);
    }
  }
  const framePiece = configured(part.defaults, 'assembled', false).find(
    (item) => item.component.id === 'modular-tube-jig-collar-a',
  )!;
  const frame = componentGeometry(libraries, [framePiece]);
  try {
    frame.updateMatrixWorld(true);
    for (const degrees of [0, 90, 180, 270]) {
      const angle = (degrees * Math.PI) / 180;
      const normal = new Vector3(0, Math.cos(angle), Math.sin(angle));
      const tangent = new Vector3(0, -Math.sin(angle), Math.cos(angle));
      for (const x of [21, 24, 26]) {
        for (const side of [-8, 8]) {
          const origin = normal.clone().multiplyScalar(100).addScaledVector(tangent, side);
          origin.x = x;
          const hits = new Raycaster(origin, normal.clone().negate(), 0, 60).intersectObject(
            frame,
            true,
          );
          assert.ok(hits.length, `register ${degrees}° has no bearing land at X${x}/${side}`);
          near(hits[0].distance, 100 - jigDatums.docking.face);
        }
      }
    }
  } finally {
    disposeModel(frame);
  }
  for (const [side, sign] of [
    ['first', 1],
    ['opposite', -1],
  ] as const) {
    const model = componentGeometry(
      libraries,
      configured({ ...part.defaults, side, showTube: false }, 'assembled', false),
    );
    try {
      model.updateMatrixWorld(true);
      for (const station of jigPattern.holeStations) {
        const ray = new Raycaster(
          new Vector3(station.x, sign * 100, 0),
          new Vector3(0, -sign, 0),
          0,
          55 - 1e-5,
        );
        const hits = ray.intersectObject(model, true);
        assert.equal(
          hits.length,
          0,
          `${side} centerline X${station.x} blocked by ${hits[0]?.object.name}`,
        );
      }
    } finally {
      disposeModel(model);
    }
  }
});

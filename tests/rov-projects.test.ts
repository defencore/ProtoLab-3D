import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import { inflateSync } from 'node:zlib';
import assemblyPart, {
  assembly,
  composition,
  pieces,
  purchasedLibraries,
} from '../src/parts/rov-project/part';
import madePart, { models as made } from '../src/parts/rov-component/part';
import nativeMade from '../src/parts/rov-component/lib/native/components.json';
import { disposeModel } from '../src/core/mechanical';
import { generateScript } from '../src/core/freecad';
import { groupBrowseFamilies } from '../src/core/browse-families';
import { buildLibrarySearchIndex, searchLibrary } from '../src/core/library-search';
import { libraryCatalogFamily } from '../src/core/library';
import { registerPartModules } from '../src/core/part-modules';
import servoModule from '../src/parts/qfs2025-servo';
import thrusterModule from '../src/parts/underwater-thruster';
import { addProduct, createProject } from '../src/core/design-project';
import { packModel, unpackModel, modelComponentMetadata } from '../src/core/mesh-transfer';
import type { Parameters } from '../src/core/types';

const parameters: Parameters = { model: 'finsrov' };
const expectedDefinitions = [
  'finsrov-pressure-sensor-mount',
  'finsrov-cable-passing-screw',
  'finsrov-front-cabin-mount',
  'finsrov-horizontal-thruster-bracket',
  'finsrov-rear-cabin-hatch',
  'finsrov-thruster-mount',
].sort();

test('the build is a physical make/buy assembly, not a source-solid or printable-COTS inventory', () => {
  assert.equal(assemblyPart.product.kind, 'assembly');
  assert.equal(libraryCatalogFamily('qfs2025-servo')?.id, 'servo-motors');
  const registered = registerPartModules([servoModule, thrusterModule]);
  const searchIndex = buildLibrarySearchIndex(groupBrowseFamilies(registered));
  assert.ok(
    searchLibrary(searchIndex, 'FinsROV').some((match) => match.family.id === 'servo-motors'),
  );
  assert.ok(
    searchLibrary(searchIndex, 'QFS2025').some((match) => match.family.id === 'servo-motors'),
  );
  assert.equal(
    registerPartModules([servoModule, thrusterModule]).find((part) => part.id === 'qfs2025-servo')
      ?.browseFamily?.id,
    'servo-motors',
  );
  assert.equal(assemblyPart.product.supply, 'manufactured');
  assert.equal(assemblyPart.presets.length, 1);
  assert.equal(assembly.occurrences.length, 50);
  assert.equal(assembly.occurrences.filter((o) => o.supply === 'manufactured').length, 26);
  assert.equal(assembly.occurrences.filter((o) => o.supply === 'purchased').length, 24);
  assert.equal(assembly.occurrences.filter((o) => o.role === 'printed').length, 4);
  assert.equal(assembly.occurrences.filter((o) => o.role === 'machined').length, 22);
  assert.deepEqual(made.map((m) => m.id).sort(), expectedDefinitions);
  assert.equal(made.filter((m) => m.route === 'printing').length, 1);
  for (const library of purchasedLibraries) {
    assert.equal(library.product.supply, 'purchased');
    assert.deepEqual(library.product.processes, []);
    assert.notEqual(library.id, 'rov-equipment');
    assert.notEqual(library.category, 'VEHICLE STRUCTURES');
  }
  const bom = composition(parameters);
  assert.equal(bom.components.length, 50);
  assert.ok(bom.issues.some((s) => /horn/i.test(s)));
  assert.ok(bom.issues.some((s) => /fastener/i.test(s)));
  for (const o of bom.components) {
    if (o.supply === 'purchased') {
      assert.ok(
        purchasedLibraries.some((library) => library.id === o.libraryId),
        o.libraryId,
      );
      assert.equal(o.manufacturing, undefined);
      assert.ok(o.procurement?.designation && o.procurement.source);
    } else {
      assert.equal(o.libraryId, 'rov-component');
      assert.ok(o.manufacturing?.material && o.manufacturing.blank);
      assert.equal(o.procurement, undefined);
    }
  }
});

test('all 26 installed making files match their source assembly geometry', () => {
  assert.equal(assembly.verification.length, 26);
  for (const fit of assembly.verification) {
    assert.equal(fit.sourceSolidCount, 1, fit.id);
    assert.ok(fit.symmetricDifferenceMm3 < 0.001, fit.id);
    assert.equal(fit.sourceBounds.length, 6);
  }
  for (const o of assembly.occurrences.filter((o) => o.supply === 'manufactured')) {
    const model = made.find((m) => m.id === o.parameters.component)!;
    assert.ok(model, o.id);
    assert.equal(model.solidCount, 1);
    assert.equal(o.manufacturing!.processes.includes('printing'), o.role === 'printed');
  }
  assert.equal(made.find((m) => m.id === 'finsrov-rear-cabin-hatch')!.route, 'milling');
});

test('the assembled preview retains source poses and records the corrected mirrored commercial servo', () => {
  const model = assemblyPart.buildGeometry(parameters, 'assembled');
  try {
    assert.equal(model.children.length, 50);
    model.updateMatrixWorld(true);
    for (let i = 0; i < model.children.length; i++) {
      const box = new Box3().setFromObject(model.children[i], true);
      const measured = [...box.min.toArray(), ...box.max.toArray()];
      const expected = assembly.occurrences[i].sourceBounds;
      if (assembly.occurrences[i].sourceFit?.exactRigidFit === false) {
        assert.equal(assembly.occurrences[i].id, 'finsrov-nauo12');
        assert.match(assembly.occurrences[i].notes ?? '', /mirror/i);
        continue;
      }
      assert.ok(
        measured.every((v, a) => Math.abs(v - expected[a]) < 0.151),
        assembly.occurrences[i].id,
      );
    }
  } finally {
    disposeModel(model);
  }
});

for (const state of ['assembled', 'manufactured', 'printed', 'exploded']) {
  test(`${state}: the printing export contains only four source sensor brackets`, () => {
    const originalBom = JSON.stringify(composition(parameters));
    const printPieces = pieces(parameters, state, true);
    assert.equal(printPieces.length, 4);
    assert.ok(
      printPieces.every(
        (p) =>
          p.component.supply === 'manufactured' &&
          p.component.parameters.component === 'finsrov-pressure-sensor-mount',
      ),
    );
    const mesh = assemblyPart.buildExportGeometry!(parameters, state);
    try {
      let count = 0;
      mesh.traverse((o) => {
        if (o instanceof Mesh) count++;
      });
      assert.equal(count, 4);
      const dims = new Box3().setFromObject(mesh, true).getSize(new Vector3()).toArray();
      assert.ok(dims.every((v, i) => Math.abs(v - [42, 58, 22][i]) < 0.001));
      assert.deepEqual(
        assemblyPart.exportDimensions!(parameters, state),
        assemblyPart.dimensions(parameters, state),
      );
    } finally {
      disposeModel(mesh);
    }
    assert.equal(JSON.stringify(composition(parameters)), originalBom);
  });
}

test('equipment and machined parts cannot be exported as printing STL', () => {
  for (const state of ['purchased', 'machined'])
    assert.throws(
      () => assemblyPart.buildExportGeometry!(parameters, state),
      /purchased|machined/i,
    );
  for (const library of purchasedLibraries)
    for (const preset of library.presets)
      assert.throws(
        () => library.buildExportGeometry!(preset.parameters, 'default'),
        /purchased|buy/i,
      );
  for (const model of made.filter((m) => m.route !== 'printing'))
    assert.throws(
      () => madePart.buildExportGeometry!({ component: model.id }, 'default'),
      /FreeCAD|STEP|machin/i,
    );
});

test('servos and thrusters are reused canonical library products with distinct installed poses', () => {
  const units = composition(parameters).components.filter((item) => item.supply === 'purchased');
  assert.equal(units.length, 24);
  const servo = units.filter((item) => item.libraryId === 'qfs2025-servo');
  assert.equal(servo.length, 4);
  assert.equal(new Set(servo.map((item) => JSON.stringify(item.parameters))).size, 1);
  assert.equal(new Set(servo.map((item) => JSON.stringify(item.placement))).size, 4);
  const thrusters = units.filter((item) => item.libraryId === 'underwater-thruster');
  assert.equal(thrusters.length, 8);
  assert.deepEqual(thrusters.map((item) => item.parameters.model).sort(), [
    'ccw',
    'ccw',
    'ccw',
    'ccw',
    'cw',
    'cw',
    'cw',
    'cw',
  ]);
  assert.equal(new Set(thrusters.map((item) => JSON.stringify(item.placement))).size, 8);
  assert.equal(
    purchasedLibraries.reduce((sum, library) => sum + library.presets.length, 0),
    8,
  );
  for (const library of purchasedLibraries) {
    for (const preset of library.presets) {
      assert.deepEqual(library.validate(preset.parameters, 'default'), [], library.id);
      const model = library.buildGeometry(preset.parameters, 'default');
      try {
        const bounds = new Box3().setFromObject(model, true);
        const actual = bounds.getSize(new Vector3()).toArray();
        assert.ok(
          actual.every(
            (value, axis) =>
              Math.abs(value - library.dimensions(preset.parameters, 'default')[axis]) < 0.151,
          ),
        );
        assert.ok(
          bounds.getCenter(new Vector3()).length() < Math.max(...actual),
          library.id + ': reusable local coordinates',
        );
      } finally {
        disposeModel(model);
      }
    }
  }
  for (const item of nativeMade.components) {
    const vertices = inflateSync(Buffer.from(item.vertices, 'base64'));
    const indices = inflateSync(Buffer.from(item.triangles, 'base64'));
    assert.ok(vertices.length && vertices.length % 12 === 0, item.id);
    assert.ok(indices.length && indices.length % 12 === 0, item.id);
  }
});

test('separate assembly instances remain selectable after worker transport', () => {
  const original = assemblyPart.buildGeometry(parameters, 'assembled');
  const transferred = unpackModel(packModel(original).model);
  try {
    const seen = new Map<string, string>();
    transferred.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const metadata = modelComponentMetadata(object);
      assert.ok(metadata.occurrenceId);
      seen.set(metadata.occurrenceId, metadata.libraryId!);
    });
    assert.equal(seen.size, 50);
    assert.equal([...seen.values()].filter((id) => id === 'qfs2025-servo').length, 4);
    assert.equal([...seen.values()].filter((id) => id === 'underwater-thruster').length, 8);
  } finally {
    disposeModel(original);
    disposeModel(transferred);
  }
});

test('project insertion shares the canonical servo configuration and also adds the servo on its own', () => {
  const library = [assemblyPart, madePart, ...purchasedLibraries];
  const { project } = addProduct(createProject('ROV reuse'), library, {
    part: assemblyPart,
    parameters,
    state: 'assembled',
  });
  assert.equal(project.occurrences.length, 51);
  const servoConfigs = project.configurations.filter((item) => item.libraryId === 'qfs2025-servo');
  assert.equal(servoConfigs.length, 1);
  assert.equal(
    project.occurrences.filter((item) => item.configurationId === servoConfigs[0].id).length,
    4,
  );
  const servo = purchasedLibraries.find((item) => item.id === 'qfs2025-servo')!;
  const added = addProduct(createProject('Servo alone'), library, {
    part: servo,
    parameters: servo.defaults,
    state: 'default',
  }).project;
  assert.equal(added.occurrences.length, 1);
  assert.equal(added.configurations[0].supply, 'purchased');
  assert.equal(added.configurations[0].libraryId, servo.id);
});

test('purchase BOM uses purchasing units and exposes missing items', () => {
  const kit = assembly.bom.procurement.find((r) => r.id === 'waterproof-compartment-kit')!;
  const thrusters = assembly.bom.procurement.find((r) => r.id === 'thruster-pairs')!;
  assert.equal(kit.quantity, 1);
  assert.equal(kit.cadUnitCount, 2);
  assert.equal(thrusters.quantity, 4);
  assert.equal(thrusters.cadUnitCount, 8);
  assert.match(thrusters.unit, /pair/i);
  assert.ok(assembly.bom.procurement.some((r) => r.quantity === null));
  assert.ok(assembly.issues.some((s) => /Missing2 horn|Missing 2 horn/.test(s)));
  const downloads = assemblyPart.fabricationFiles!(parameters);
  const make = downloads.find((f) => f.id === 'fabrication-routing')!.content;
  assert.doesNotMatch(make, /QFS2025|Complete underwater thruster|waterproof servo/i);
  assert.equal(make.split('\n').length, 27);
});

test('invalid scales and source identities fail and FreeCAD recipes retain procurement identities', () => {
  assert.ok(assemblyPart.validate({ model: 'mur' }, 'assembled').length);
  assert.ok(assemblyPart.validate({ model: 'finsrov', scale: 2 }, 'assembled').length);
  const script = generateScript(assemblyPart, parameters, 'assembled');
  assert.ok(/"Supply"\s*:\s*"purchased"/.test(script), 'Native purchased identity');
  assert.ok(/"Supply"\s*:\s*"manufactured"/.test(script), 'Native made identity');
  assert.match(script, /ProcurementDefinition/);
  assert.match(script, /ManufacturingDefinition/);
});

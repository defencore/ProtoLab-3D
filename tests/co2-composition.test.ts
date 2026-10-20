import { withGeometryMode } from '../src/core/geometry-mode';
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import type { AssemblyComponent } from '../src/core/product-types';
import { addProduct, createProject, supplyRows, validateProject } from '../src/core/design-project';
import { validateParameters } from '../src/core/validation';
import { parseRecoveryRecipe } from '../src/core/recovery-component-recipes';
import recovery from '../src/parts/rocket-co2-recovery/part';
import detail from '../src/parts/recovery-detail/part';
import purchased from '../src/parts/purchased-recovery-component/part';
import cartridge from '../src/parts/co2-cartridge/part';
import cell from '../src/parts/li-ion-cell/part';
import lch7 from '../src/parts/lch7-controller/part';
import tracker from '../src/parts/gps-tracker/part';
import buzzer from '../src/parts/recovery-buzzer/part';
import pwm from '../src/parts/pwm-switch/part';
import { pieces } from '../src/parts/rocket-co2-recovery/lib/model';
import {
  compositionComponents,
  pieceComponent,
} from '../src/parts/rocket-co2-recovery/lib/composition';
import { threadFeatures } from '../src/core/assembly/recovery/thread-features';

const libraries = [recovery, detail, purchased, cartridge, cell, lch7, tracker, buzzer, pwm];

test('CO2 physical BOM resolves all configured library components and excludes routing references', () => {
  for (const preset of recovery.presets) {
    const authored = pieces(preset.parameters, 'assembled');
    const physical = recovery.composition!(preset.parameters);
    assert.ok(authored.some((piece) => piece.process === 'REFERENCE'));
    assert.equal(
      physical.components.length,
      authored.filter((piece) => piece.process !== 'REFERENCE' && !piece.metadata?.SupplierUnitId)
        .length + Number(authored.some((piece) => piece.metadata?.SupplierUnitId)),
    );
    assert.equal(
      new Set(physical.components.map((component) => component.id)).size,
      physical.components.length,
    );
    for (const component of physical.components) {
      const library = libraries.find((part) => part.id === component.libraryId);
      assert.ok(library, component.libraryId);
      assert.deepEqual(
        validateParameters(library, component.parameters, component.state),
        [],
        preset.id + '/' + component.name,
      );
      assert.ok(component.notes?.includes('Organization:'), component.name);
    }
    const added = addProduct(createProject(preset.name), libraries, {
      part: recovery,
      parameters: preset.parameters,
      state: 'cutaway',
      presetId: preset.id,
    });
    assert.deepEqual(validateProject(added.project, libraries), []);
    assert.equal(
      added.project.configurations.find((configuration) => configuration.libraryId === recovery.id)!
        .state,
      'assembled',
    );
    assert.equal(added.project.occurrences.length, physical.components.length + 1);
    assert.ok(
      added.project.occurrences
        .slice(1)
        .every((occurrence) => occurrence.notes.includes('Organization:')),
    );
  }
});

test('CO2 supplier electronics purchase one F405 kit and retain separate custom mounting routes', () => {
  const preset = recovery.presets.find((preset) => preset.id === 'pem-90-86-16g-wing-4s')!;
  const physical = recovery.composition!(preset.parameters);
  const kits = physical.components.filter(
    (component) => component.procurement?.manufacturer === 'SpeedyBee',
  );
  assert.equal(kits.length, 1);
  assert.equal(kits[0].supply, 'purchased');
  assert.equal(kits[0].libraryId, purchased.id);
  assert.ok(kits[0].procurement!.source.startsWith('https://www.speedybee.com/'));
  assert.ok(kits[0].notes!.includes('individual board components'));
  const project = addProduct(createProject(), libraries, {
    part: recovery,
    parameters: preset.parameters,
    state: 'assembled',
  }).project;
  assert.equal(
    supplyRows(project, libraries, 'purchased').filter((row) => row.name === kits[0].name).length,
    1,
  );
  assert.equal(
    physical.components.filter((component) =>
      component.manufacturing?.processes.includes('moulding'),
    ).length,
    4,
  );
  assert.equal(
    physical.components.filter((component) => component.libraryId === cell.id).length,
    4,
  );
});

test('CO2 process provenance controls manufacture and preserves printed thread recipes', () => {
  const authored = pieces(recovery.defaults, 'assembled');
  const printed = authored.find(
    (piece) =>
      piece.process === '3D PRINT' &&
      withGeometryMode('full', () =>
        threadFeatures(piece.shape!).some((feature) => feature.representation === 'printed-helix'),
      ),
  )!;
  const component = pieceComponent(
    { ...printed, label: 'BUY text does not change the authored process' },
    0,
  )!;
  assert.equal(component.supply, 'manufactured');
  assert.deepEqual(component.manufacturing!.processes, ['printing']);
  assert.equal(component.manufacturing!.material, printed.material);
  const recipe = parseRecoveryRecipe(String(component.parameters.recipe));
  assert.ok(
    withGeometryMode('full', () =>
      threadFeatures(recipe).some((feature) => feature.representation === 'printed-helix'),
    ),
  );
  const bought = pieceComponent(
    { ...printed, label: 'MAKE text does not change the authored process', process: 'BUY' },
    1,
  )!;
  assert.equal(bought.supply, 'purchased');
  assert.equal(pieceComponent({ ...printed, process: 'REFERENCE' }, 2), undefined);
  assert.throws(() => pieceComponent({ ...printed, process: 'GUESS' }, 3), /Unsupported authored/);
  assert.deepEqual(
    compositionComponents(authored),
    recovery.composition!(recovery.defaults).components as AssemblyComponent[],
  );
});

test(
  'CO2 local printed adapter remains a valid solid before any assembly placement',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const adapter = pieces(recovery.defaults, 'assembled').find(
      (piece) =>
        piece.process === '3D PRINT' &&
        piece.shape &&
        threadFeatures(piece.shape).some(
          (feature) => feature.internal && feature.designation === '3/8-24 UNF RH',
        ),
    )!;
    const configured = pieceComponent(adapter, 0)!;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: `import FreeCAD as App, Part, math
${withGeometryMode('full', () => detail.python(configured.parameters, configured.state))}
assert shape.isValid() and shape.isClosed() and len(shape.Solids)==1
assert abs(shape.Volume-1309.85253594)<0.001
print('LOCAL_ADAPTER_OK')
`,
      encoding: 'utf8',
      timeout: 60_000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /LOCAL_ADAPTER_OK/);
  },
);

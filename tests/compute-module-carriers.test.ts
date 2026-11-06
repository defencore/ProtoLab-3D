import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { Box3, DoubleSide, Mesh, Raycaster, Vector3 } from 'three';
import carrier from '../src/parts/compute-module-carrier/part';
import { models, pieces } from '../src/parts/compute-module-carrier/lib/model';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import { buildPresetIndex, emptyPresetFilters, filterPresets } from '../src/core/preset-search';
import { libraryEntryId, resolveLibraryEntry } from '../src/core/library-identity';
import {
  addProduct,
  createProject,
  parseProject,
  serializeProject,
} from '../src/core/design-project';
import { generateScript } from '../src/core/freecad';

const nanoIds = ['waveshare-cm5-nano-a', 'waveshare-cm5-nano-b'];

interface NativeCarrier {
  sourceSha256: string;
  sourceSolids: number;
  selectedSolids: number;
  excludedSourceSolids: number[];
  components: {
    sourceSolid: number;
    label: string;
    bounds: number[];
    layer: number;
    template: number;
    volume: number;
  }[];
  templates: { brep: string; positions: string; indices: string }[];
}

test('CM5 carriers are fixed bare purchased boards with separate sourced article identities', () => {
  assert.deepEqual(
    models.map((model) => model.id),
    ['raspberry-pi-cm5-io-rev2', 'waveshare-cm5-io-base-a', ...nanoIds],
  );
  assert.equal(carrier.product.supply, 'purchased');
  assert.equal(carrier.catalogSelectionOnly, true);
  assert.equal(carrier.presets.length, 4);
  for (const preset of carrier.presets) {
    assert.deepEqual(validateParameters(carrier, preset.parameters, 'assembled'), []);
    assert.equal(
      preset.catalog!.geometryEvidence!.kind,
      nanoIds.includes(preset.id) ? 'manufacturer-cad' : 'source-dimensions',
    );
    assert.match(preset.catalog!.geometryEvidence!.sourceSha256!, /^[a-f0-9]{64}$/);
    assert.match(preset.description, /compute module.*excluded/);
    assert.equal(preset.catalog!.attributes!.module, 'CM5');
    assert.ok(carrier.validate({ ...preset.parameters, width: 100 }, 'assembled').length);
    if (!nanoIds.includes(preset.id)) {
      const authored = pieces(preset.parameters, 'assembled');
      assert.equal(authored.filter((piece) => /100-pin CM5 B2B/.test(piece.label)).length, 2);
      assert.equal(authored.filter((piece) => /contact \d+$/.test(piece.label)).length, 40);
      assert.ok(!authored.some((piece) => /BCM2712|LPDDR|SD card inserted/.test(piece.label)));
    }
  }
  assert.ok(carrier.validate({ model: 'cm4-only-carrier' }, 'assembled').length);
  assert.ok(carrier.validate(carrier.defaults, 'missing').length);
  const filters = emptyPresetFilters(carrier);
  filters.query = 'CM5-IO-BASE-A';
  assert.deepEqual(
    filterPresets(buildPresetIndex([carrier]), filters).items.map((item) => item.preset.id),
    ['waveshare-cm5-io-base-a'],
  );
});

test('NANO article IDs and supplier identities survive inspection-state project and export round trips', () => {
  let project = createProject('CM5 NANO carrier identity');
  const index = buildPresetIndex([carrier]);
  for (const id of nanoIds) {
    const qualified = libraryEntryId(carrier.id, id);
    const preset = resolveLibraryEntry([carrier], qualified)?.preset;
    assert.ok(preset);
    assert.deepEqual(
      filterPresets(index, { ...emptyPresetFilters(carrier), query: qualified }).items.map(
        (entry) => entry.id,
      ),
      [qualified],
    );
    const selected = {
      part: carrier,
      parameters: preset.parameters,
      state: 'exploded',
      presetId: id,
    };
    project = addProduct(project, [carrier], selected).project;
    project = addProduct(project, [carrier], selected).project;
    const macro = generateScript(carrier, preset.parameters, 'assembled', id);
    assert.ok(macro.includes(preset.catalog!.designation!));
    assert.ok(macro.includes(preset.catalog!.geometryEvidence!.sourceSha256!));
  }
  const restored = parseProject(serializeProject(project, [carrier]), [carrier]);
  assert.equal(restored.configurations.length, 2);
  assert.equal(restored.occurrences.length, 4);
  for (const configuration of restored.configurations) {
    assert.equal(configuration.libraryId, carrier.id);
    assert.ok(nanoIds.includes(configuration.presetId!));
    assert.deepEqual(configuration.parameters, { model: configuration.presetId });
    assert.equal(configuration.state, 'assembled');
    assert.equal(configuration.supply, 'purchased');
    const preset = carrier.presets.find((entry) => entry.id === configuration.presetId)!;
    assert.equal(configuration.procurement!.designation, preset.catalog!.designation);
    assert.equal(configuration.procurement!.manufacturer, 'Waveshare');
    assert.equal(configuration.procurement!.source, preset.catalog!.sourceUrl);
    assert.equal(
      restored.occurrences.filter((occurrence) => occurrence.configurationId === configuration.id)
        .length,
      2,
    );
  }
});

test('NANO incomplete CAD status stays visible without hiding real published product interfaces', () => {
  assert.match(carrier.validationNotice!, /NANO.*incomplete CAD references/);
  for (const [index, id] of nanoIds.entries()) {
    const preset = carrier.presets.find((entry) => entry.id === id)!;
    const evidence = preset.catalog!.geometryEvidence!;
    assert.match(preset.description, /Incomplete manufacturer CAD engineering reference/);
    assert.match(evidence.summary!, /Incomplete manufacturer CAD engineering reference/);
    assert.match(evidence.limitations!, /MIPI/);
    assert.match(evidence.limitations!, /CM5 board-to-board/);
    assert.match(evidence.limitations!, /not the complete installed product envelope/);
    assert.ok(
      carrier.assessment!(preset.parameters).some((line) =>
        /Incomplete manufacturer CAD engineering reference/.test(line),
      ),
    );
    const attributes = preset.catalog!.attributes!;
    assert.equal(attributes.usb3, 1);
    assert.equal(attributes.mipi, 2);
    assert.equal(attributes.ethernet, index);
    assert.equal(attributes.hdmi, index);
    assert.match(preset.catalog!.attributeConditions!.mipi, /absent from the supplied CAD/);
    if (index) {
      assert.match(evidence.limitations!, /RJ45 Ethernet connector, mini HDMI socket/);
      assert.match(evidence.limitations!, /microSD/);
      assert.match(preset.catalog!.attributeConditions!.ethernet, /absent from the supplied CAD/);
      assert.match(preset.catalog!.attributeConditions!.hdmi, /absent from the supplied CAD/);
    }
  }
});

test('board mounting patterns and the rotated IO Board module datum match manufacturer designs', () => {
  const io = models[0],
    base = models[1];
  assert.deepEqual([io.width, io.length, io.board], [160, 90, 1.6]);
  assert.equal(io.holes.length, 8);
  assert.deepEqual(
    io.moduleHoles.map((hole) => hole.slice(0, 2)).sort(),
    [
      [3.5, -6.5],
      [3.5, 41.5],
      [36.5, -6.5],
      [36.5, 41.5],
    ].sort(),
  );
  assert.ok([...io.holes, ...io.moduleHoles].every((hole) => hole[2] === 2.7));
  assert.deepEqual([base.width, base.length, base.board], [85, 56, 1.6]);
  assert.deepEqual(base.holes, [
    [-39, -24.5, 3],
    [19, -24.5, 3],
    [-39, 24.5, 3],
    [19, 24.5, 3],
  ]);
  assert.deepEqual(base.moduleHoles, [
    [-30.95, -15.85, 3],
    [17.05, -15.85, 3],
    [-30.95, 17.15, 3],
    [17.05, 17.15, 3],
  ]);
  assert.match(io.limitations, /1\.51/);
  assert.match(base.limitations, /radius 3\.5 mm is inferred/);
});

for (const [index, id] of nanoIds.entries())
  test(
    id + ': manufacturer geometry retains native topology independently from preview triangles',
    () => {
      const native = JSON.parse(
        readFileSync(
          new URL(
            `../src/parts/compute-module-carrier/lib/nano-${index ? 'b' : 'a'}/native.json`,
            import.meta.url,
          ),
          'utf8',
        ),
      ) as NativeCarrier;
      const preset = carrier.presets.find((entry) => entry.id === id)!;
      assert.equal(native.sourceSha256, preset.catalog!.geometryEvidence!.sourceSha256);
      assert.equal(native.sourceSolids, index ? 537 : 337);
      assert.equal(native.components.length, native.selectedSolids);
      assert.equal(
        native.components.length + native.excludedSourceSolids.length,
        native.sourceSolids,
      );
      assert.equal(
        new Set(native.components.map((component) => component.sourceSolid)).size,
        native.components.length,
      );
      assert.deepEqual(
        [
          ...native.components.map((component) => component.sourceSolid),
          ...native.excludedSourceSolids,
        ].sort((a, b) => a - b),
        Array.from({ length: native.sourceSolids }, (_, i) => i),
      );
      assert.deepEqual(
        native.excludedSourceSolids,
        Array.from({ length: index ? 120 : 60 }, (_, i) => i + (index ? 270 : 252)),
      );
      assert.ok(native.templates.length > 0 && native.templates.length <= native.sourceSolids);
      for (const template of native.templates) {
        assert.match(
          inflateSync(Buffer.from(template.brep, 'base64')).toString(),
          /CASCADE Topology/,
        );
        assert.ok(Buffer.from(template.positions, 'base64').length > 0);
        assert.ok(Buffer.from(template.indices, 'base64').length > 0);
      }
      const pcb = native.components.find((component) => component.sourceSolid === 0)!;
      assert.match(pcb.label, /^PCB/);
      assert.ok(Math.abs(pcb.bounds[0] + pcb.bounds[3]) < 1e-5, 'PCB centred on X datum');
      assert.ok(Math.abs(pcb.bounds[1] + pcb.bounds[4]) < 1e-5, 'PCB centred on Y datum');
      assert.ok(Math.abs(pcb.bounds[2]) < 1e-5, 'PCB underside on Z=0');
      assert.equal(pcb.layer, 0);
      for (const component of native.components) {
        assert.ok(component.volume > 0);
        assert.ok(component.template >= 0 && component.template < native.templates.length);
      }
      const assembled = carrier.buildGeometry(preset.parameters, 'assembled');
      const exploded = carrier.buildGeometry(preset.parameters, 'exploded');
      try {
        assert.equal(assembled.children.length, native.components.length);
        assert.equal(exploded.children.length, native.components.length);
        for (let i = 0; i < assembled.children.length; i++) {
          const component = assembled.children[i];
          const inspection = exploded.children[i];
          assert.equal(component.name, inspection.name);
          assert.ok(component instanceof Mesh && component.geometry.userData.nativeTopology);
          assert.equal(component.position.x, inspection.position.x);
          assert.equal(component.position.y, inspection.position.y);
          assert.ok(
            Math.abs(
              inspection.position.z - component.position.z - native.components[i].layer * 10,
            ) < 1e-10,
          );
        }
        const macro = carrier.python(preset.parameters, 'assembled');
        assert.match(macro, /importBrepFromString/);
        assert.doesNotMatch(macro, /Part\.makePolygon|Part\.makeShell/);
      } finally {
        disposeModel(assembled);
        disposeModel(exploded);
      }
    },
  );

for (const model of models)
  test(model.id + ': open bores, distinct components and matching preview/export bounds', () => {
    const parameters = { model: model.id };
    for (const state of ['assembled', 'exploded']) {
      const group = carrier.buildGeometry(parameters, state);
      try {
        const bounds = new Box3().setFromObject(group, true).getSize(new Vector3()).toArray();
        carrier
          .dimensions(parameters, state)
          .forEach((value, axis) => assert.ok(Math.abs(bounds[axis] - value) < 0.002));
        assert.equal(
          new Set(group.children.map((child) => child.name)).size,
          group.children.length,
        );
        group.traverse((child) => {
          if (!(child instanceof Mesh)) return;
          const position = child.geometry.getAttribute('position');
          assert.ok(position.count > 0 && Array.from(position.array).every(Number.isFinite));
        });
        const pcb = group.children.find((child) => /^PCB/.test(child.name));
        assert.ok(pcb, model.id + ': distinct PCB source component');
        pcb.traverse((child) => {
          if (child instanceof Mesh) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((material) => {
              material.side = DoubleSide;
            });
          }
        });
        group.updateMatrixWorld(true);
        for (const [x, y] of [...model.holes, ...model.moduleHoles]) {
          assert.equal(
            new Raycaster(
              new Vector3(x, y, -1),
              new Vector3(0, 0, 1),
              0,
              model.board + 2,
            ).intersectObject(pcb, true).length,
            0,
          );
        }
        assert.ok(
          new Raycaster(
            new Vector3(0, 0, -1),
            new Vector3(0, 0, 1),
            0,
            model.board + 2,
          ).intersectObject(pcb, true).length > 0,
        );
        const macro = carrier.python(parameters, state);
        assert.ok(macro.includes('component_labels = '));
        assert.ok(macro.includes('Part.makeCompound(components)'));
        assert.equal(
          (macro.match(/components\.append\(component\)/g) ?? []).length,
          group.children.length,
        );
      } finally {
        disposeModel(group);
      }
    }
  });

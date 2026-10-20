import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import part from '../src/parts/rover-chassis/part';
import module from '../src/parts/rover-chassis';
import { models, selected, selectedComponents } from '../src/parts/rover-chassis/lib/model';
import { registerPartModules } from '../src/core/part-modules';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { generateScript } from '../src/core/freecad';
import { inspectPackage } from '../scripts/part-modules/library';
import type { Parameters } from '../src/core/types';

function inspectMesh(mesh: Mesh, label: string): number {
  const positions = mesh.geometry.getAttribute('position');
  const indices = mesh.geometry.index;
  assert.ok(indices, `${label}: source triangulation keeps indexed topology`);
  const edges = new Map<string, { count: number; winding: number }>();
  let volume = 0;
  for (let i = 0; i < indices.count; i += 3) {
    const ids = [0, 1, 2].map((j) => indices.getX(i + j));
    const vertices = ids.map((id) => new Vector3().fromBufferAttribute(positions, id));
    assert.ok(
      vertices.every((v) => v.toArray().every(Number.isFinite)),
      `${label}: finite vertices`,
    );
    assert.ok(
      vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).lengthSq() >
        1e-24,
      `${label}: nondegenerate triangle ${i / 3}`,
    );
    volume += vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
    const keys = mesh.geometry.userData.nativeTopology
      ? ids.map(String)
      : vertices.map((v) =>
          v
            .toArray()
            .map((value) => Math.round(value * 1e5))
            .join(','),
        );
    for (let j = 0; j < 3; j++) {
      const a = keys[j],
        b = keys[(j + 1) % 3],
        key = [a, b].sort().join('|');
      const edge = edges.get(key) ?? { count: 0, winding: 0 };
      edge.count++;
      edge.winding += a < b ? 1 : -1;
      edges.set(key, edge);
    }
  }
  assert.ok(volume > 0, `${label}: outward positive source volume`);
  for (const edge of edges.values())
    assert.deepEqual(edge, { count: 2, winding: 0 }, `${label}: closed oriented source boundary`);
  return volume;
}

test('rover offers three fixed purchased supplier CAD chassis with traceable source evidence', async () => {
  assert.ok(registerPartModules([module]).some((candidate) => candidate.id === part.id));
  const inspected = await inspectPackage(path.resolve('src/parts/rover-chassis'), process.cwd());
  assert.equal(inspected.id, 'rover-chassis');
  assert.equal(part.category, 'VEHICLE STRUCTURES');
  assert.equal(part.subgroup, 'GROUND VEHICLES');
  assert.equal(part.product.kind, 'assembly');
  assert.equal(part.product.supply, 'purchased');
  assert.equal(part.catalogSelectionOnly, true);
  assert.equal(part.composition, undefined, 'Supplier internals belong to the purchased chassis.');
  assert.deepEqual(models.map((model) => model.id).sort(), ['pirate-4wd', 'romi', 'ugv-rover']);
  assert.equal(part.presets.length, 3);
  assert.deepEqual(part.parameters.map((field) => field.key).sort(), ['explodedGap', 'model']);
  for (const preset of part.presets) {
    assert.ok(preset.catalog?.sourceUrl.startsWith('https://'), preset.id);
    assert.equal(preset.catalog?.geometryEvidence?.kind, 'manufacturer-cad');
    assert.match(preset.catalog!.geometryEvidence!.sourceSha256!, /^[a-f0-9]{64}$/);
    assert.ok(preset.catalog!.verifiedParameters.includes('model'));
    assert.deepEqual(Object.keys(preset.parameters).sort(), Object.keys(part.defaults).sort());
    assert.equal(selected(preset.parameters).id, preset.parameters.model);
    for (const state of part.states!)
      assert.deepEqual(
        validateParameters(part, preset.parameters, state.id),
        [],
        `${preset.id}/${state.id}`,
      );
  }
});

test('lossless native BRep storage retains the source bytes and topology headers', () => {
  const audit = [
    'import base64, hashlib, json, lzma, sys',
    'with open(sys.argv[1]) as source: data = json.load(source)',
    'assert data["brepCompression"] == "xz"',
    'for component in data["components"]:',
    '    native = lzma.decompress(base64.b64decode(component["brep"]))',
    '    assert b"CASCADE Topology" in native[:100], component["id"]',
    '    assert hashlib.sha256(native).hexdigest() == component["brepSha256"], component["id"]',
    'print(json.dumps({"id":data["id"],"components":len(data["components"]),"brepCompression":data["brepCompression"]}))',
  ].join('\n');
  for (const supplier of models) {
    const result = JSON.parse(
      execFileSync(
        'python3',
        ['-c', audit, path.resolve('src/parts/rover-chassis/lib/native', supplier.id + '.json')],
        { encoding: 'utf8', maxBuffer: 1024 * 1024 },
      ),
    );
    assert.equal(result.id, supplier.id);
    assert.equal(result.components, supplier.components.length);
    assert.equal(result.brepCompression, 'xz');
  }
});

for (const preset of part.presets) {
  test(`${preset.id}: source components retain real native solids and closed preview geometry`, () => {
    const source = selectedComponents(preset.parameters, 'assembled');
    assert.ok(
      source.length >= 5,
      'A supplier chassis contains physical structure and running gear.',
    );
    assert.equal(new Set(source.map((component) => component.id)).size, source.length);
    const model = part.buildGeometry(preset.parameters, 'assembled');
    try {
      model.updateMatrixWorld(true);
      assert.equal(model.children.length, source.length);
      for (const [index, child] of model.children.entries()) {
        const component = source[index];
        assert.equal(child.name, component.label);
        assert.ok(component.volume > 0, component.label);
        const bounds = new Box3().setFromObject(child, true);
        [...bounds.min.toArray(), ...bounds.max.toArray()].forEach((value, axis) => {
          assert.ok(
            Math.abs(value - component.bounds[axis]) < 0.05,
            `${component.label}: source envelope axis ${axis}`,
          );
        });
        let volume = 0,
          meshes = 0;
        child.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          meshes++;
          volume += inspectMesh(object, `${preset.id}/${component.label}`);
        });
        assert.ok(meshes > 0, component.label);
        assert.ok(
          Math.abs(volume - component.volume) / component.volume < 0.015,
          `${component.label}: source volume agrees with triangulation`,
        );
      }
    } finally {
      disposeModel(model);
    }
  });

  test(`${preset.id}: frame and drive inspection show the real source subsets`, () => {
    const complete = selectedComponents(preset.parameters, 'assembled');
    const frame = selectedComponents(preset.parameters, 'frame');
    const drive = selectedComponents(preset.parameters, 'drive');
    assert.ok(frame.length > 0 && frame.length < complete.length);
    assert.ok(drive.length > 0 && drive.length < complete.length);
    const mountingSupports = new Set(selected(preset.parameters).mountingSupportIds ?? []);
    const excluded = new Set(selected(preset.parameters).frameExcludedIds ?? []);
    assert.ok(
      frame.every(
        (component) => component.group === 'structure' || mountingSupports.has(component.id),
      ),
    );
    assert.ok(frame.every((component) => !excluded.has(component.id)));
    assert.ok(drive.every((component) => component.group === 'drive'));
    for (const state of ['assembled', 'frame', 'drive', 'exploded']) {
      const records = selectedComponents(preset.parameters, state);
      const model = part.buildGeometry(preset.parameters, state);
      try {
        model.updateMatrixWorld(true);
        assert.deepEqual(
          model.children.map((child) => child.name),
          records.map((record) => record.label),
        );
        const actual = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
        const dimensions = part.dimensions(preset.parameters, state);
        dimensions.forEach((value, axis) => {
          assert.ok(value > 0 && Number.isFinite(value));
          assert.ok(
            Math.abs(value - actual[axis]) < 0.05,
            `${preset.id}/${state}: dimension ${axis}`,
          );
        });
        const script = generateScript(part, preset.parameters, state);
        assert.match(script, /importBrepFromString/);
        assert.match(script, /component_labels/);
        assert.ok(!script.includes('Part.makeBox('), 'Export uses the supplier boundary surfaces.');
        for (const record of records) assert.ok(script.includes(record.label), record.label);
      } finally {
        disposeModel(model);
      }
    }
  });
}

test('Pirate retains its accessible upper equipment deck above the original running gear', () => {
  const p = { ...part.defaults, model: 'pirate-4wd' };
  const deck = selectedComponents(p, 'frame').find(
    (component) => component.label === 'Upper equipment deck',
  );
  assert.ok(deck, 'The source equipment deck remains an independent real CAD part.');
  const size = [0, 1, 2].map((axis) => deck.bounds[axis + 3] - deck.bounds[axis]);
  [180, 150, 1.5].forEach((dimension, axis) => {
    assert.ok(Math.abs(size[axis] - dimension) < 0.001, `Actual source deck dimension ${axis}`);
  });
  const solidStock = size[0] * size[1] * size[2];
  assert.ok(
    deck.volume > 0.85 * solidStock && deck.volume < 0.95 * solidStock,
    'Original mounting holes and slots remain in the deck; it is not a solid envelope.',
  );
  const driveTop = Math.max(
    ...selectedComponents(p, 'drive').map((component) => component.bounds[5]),
  );
  assert.ok(
    deck.bounds[2] - driveTop > 45,
    'The equipment surface clears the actual wheels and tyres.',
  );
  const inner = selectedComponents(p, 'frame').find(
    (component) => component.label === 'Inner upper chassis plate',
  );
  assert.ok(inner);
  assert.ok(
    Math.abs(deck.bounds[2] - inner.bounds[5] - 60) < 0.001,
    'The original raised deck retains 60 mm of vertical space over the inner plate.',
  );
});

test('Pirate frame inspection retains the four original supports seated between its plates', () => {
  const p = { ...part.defaults, model: 'pirate-4wd' };
  const expected = ['pirate-4wd-037', 'pirate-4wd-038', 'pirate-4wd-039', 'pirate-4wd-040'];
  const supplier = selected(p);
  assert.deepEqual(supplier.mountingSupportIds, expected);
  const complete = selectedComponents(p, 'assembled');
  const frame = selectedComponents(p, 'frame');
  const upper = frame.find((component) => component.id === 'pirate-4wd-020')!;
  const inner = frame.find((component) => component.id === 'pirate-4wd-025')!;
  assert.ok(upper && inner);
  const displayed = part.buildGeometry(p, 'frame');
  try {
    assert.equal(
      frame.length,
      11,
      'Seven source structural parts and four required deck supports.',
    );
    assert.deepEqual(
      frame.filter((component) => component.group === 'hardware').map((component) => component.id),
      expected,
      'Other hardware stays hidden in frame inspection.',
    );
    for (const id of expected) {
      const support = frame.find((component) => component.id === id)!;
      assert.equal(
        support,
        complete.find((component) => component.id === id),
      );
      assert.equal(support.group, 'hardware', 'The original supplier role remains intact.');
      assert.ok(displayed.children.some((child) => child.userData.sourceComponent === id));
      assert.ok(Math.abs(support.bounds[2] - inner.bounds[5]) < 0.00001);
      assert.ok(Math.abs(support.bounds[5] - upper.bounds[2]) < 0.00001);
      const x = (support.bounds[0] + support.bounds[3]) / 2;
      const y = (support.bounds[1] + support.bounds[4]) / 2;
      for (const plate of [upper, inner]) {
        const face = supplier.mountingSurfaces!.find(
          (surface) => surface.componentId === plate.id,
        )!;
        assert.ok(
          face.circles.some((circle) => Math.hypot(circle.x - x, circle.y - y) < 0.001),
          `${support.label}: aligns with the original ${plate.label} mounting hole`,
        );
      }
    }
  } finally {
    disposeModel(displayed);
  }
});

test('UGV frame inspection supports the upper plate and hides loose electronics accessories', () => {
  const p = { ...part.defaults, model: 'ugv-rover' };
  const supplier = selected(p);
  const shortIds = ['ugv-rover-116', 'ugv-rover-118', 'ugv-rover-120', 'ugv-rover-122'];
  const longIds = ['ugv-rover-190', 'ugv-rover-191', 'ugv-rover-192', 'ugv-rover-193'];
  const excluded = [
    'ugv-rover-130',
    'ugv-rover-131',
    'ugv-rover-132',
    'ugv-rover-133',
    'ugv-rover-135',
    'ugv-rover-136',
    'ugv-rover-145',
    'ugv-rover-146',
    'ugv-rover-147',
    'ugv-rover-148',
    'ugv-rover-149',
    'ugv-rover-150',
    'ugv-rover-151',
  ];
  assert.deepEqual(supplier.mountingSupportIds, [...shortIds, ...longIds]);
  assert.deepEqual(supplier.frameExcludedIds, excluded);
  const complete = selectedComponents(p, 'assembled');
  const frame = selectedComponents(p, 'frame');
  assert.equal(frame.length, 25);
  assert.deepEqual(
    frame.filter((component) => component.group === 'hardware').map((component) => component.id),
    [...shortIds, ...longIds],
    'Only the eight identified structural posts appear as frame hardware.',
  );
  for (const id of excluded) {
    assert.ok(
      complete.some((component) => component.id === id),
      'Supplier assembly retains its original parts.',
    );
    assert.ok(
      !frame.some((component) => component.id === id),
      `${id}: hidden without its electronics.`,
    );
  }
  const base = supplier.mountingSurfaces!.find(
    (surface) => surface.componentId === 'ugv-rover-001',
  )!;
  const upper = supplier.mountingSurfaces!.find(
    (surface) => surface.componentId === 'ugv-rover-090',
  )!;
  assert.ok(base && upper);
  const displayed = part.buildGeometry(p, 'frame');
  try {
    displayed.updateMatrixWorld(true);
    const plate = displayed.children.find(
      (child) => child.userData.sourceComponent === upper.componentId,
    )!;
    assert.ok(plate);
    for (const id of [...shortIds, ...longIds]) {
      const post = frame.find((component) => component.id === id)!;
      assert.equal(
        post,
        complete.find((component) => component.id === id),
      );
      assert.equal(post.group, 'hardware', 'Source role and geometry are unchanged.');
      assert.ok(displayed.children.some((child) => child.userData.sourceComponent === id));
      const x = (post.bounds[0] + post.bounds[3]) / 2;
      const y = (post.bounds[1] + post.bounds[4]) / 2;
      for (const surface of [base, upper]) {
        assert.ok(
          surface.circles.some((circle) => Math.hypot(circle.x - x, circle.y - y) < 0.001),
          `${post.label}: source mounting axis aligns with ${surface.label}`,
        );
      }
      if (shortIds.includes(id)) {
        assert.ok(
          Math.abs(post.bounds[2] - base.z) < 0.00001,
          'Lower posts seat on the base surface.',
        );
      } else {
        assert.ok(
          Math.abs(post.bounds[5] - (upper.z - 2)) < 0.00001,
          'Upper posts reach the original 2 mm plate underside.',
        );
        const seatingRay = new Raycaster(
          new Vector3(x + 2, y, post.bounds[5] - 1),
          new Vector3(0, 0, 1),
          0,
          1.05,
        );
        assert.ok(
          seatingRay
            .intersectObject(plate, true)
            .some((hit) => Math.abs(hit.point.z - post.bounds[5]) < 0.001),
          `${post.label}: the actual source plate underside meets its support top`,
        );
      }
    }
  } finally {
    disposeModel(displayed);
  }
});

test('source mounting coordinates correspond to open holes in the real mounting surfaces', () => {
  for (const preset of part.presets) {
    const supplier = selected(preset.parameters);
    assert.ok(
      supplier.mountingSurfaces?.length,
      `${preset.id}: source mounting faces are identified`,
    );
    const frame = part.buildGeometry(preset.parameters, 'frame');
    try {
      frame.updateMatrixWorld(true);
      let checkedHoles = 0;
      for (const surface of supplier.mountingSurfaces) {
        assert.ok(surface.area > 500 && surface.bounds[5] - surface.bounds[2] < 0.001);
        const body = frame.children.find(
          (child) => child.userData.sourceComponent === surface.componentId,
        );
        assert.ok(body, surface.label);
        for (const circle of surface.circles) {
          assert.ok(circle.radius >= 0.5 && circle.radius <= 12);
          const ray = new Raycaster(
            new Vector3(circle.x, circle.y, surface.z + 1),
            new Vector3(0, 0, -1),
            0,
            1.05,
          );
          assert.equal(
            ray.intersectObject(body, true).length,
            0,
            `${surface.label}: source hole opening at ${circle.x},${circle.y}`,
          );
          const ringOffset = Math.min(0.25, circle.radius * 0.1);
          const hasBoundaryMaterial = Array.from(
            { length: 8 },
            (_, index) => (index * Math.PI) / 4,
          ).some((angle) => {
            const radius = circle.radius + ringOffset;
            const ringRay = new Raycaster(
              new Vector3(
                circle.x + radius * Math.cos(angle),
                circle.y + radius * Math.sin(angle),
                surface.z + 1,
              ),
              new Vector3(0, 0, -1),
              0,
              1.05,
            );
            return ringRay
              .intersectObject(body, true)
              .some((hit) => Math.abs(hit.point.z - surface.z) < 0.03);
          });
          assert.ok(
            hasBoundaryMaterial,
            `${surface.label}: material surrounds its circular source opening`,
          );
          checkedHoles++;
        }
      }
      assert.ok(checkedHoles > 0, `${preset.id}: usable original mounting-hole coordinates`);
    } finally {
      disposeModel(frame);
    }
  }
});

test('UGV retains the actual supplier equipment and explicitly accounts for invalid source connector solids', () => {
  const supplier = selected({ ...part.defaults, model: 'ugv-rover' });
  assert.equal(supplier.sourceSolids, 1305);
  assert.equal(supplier.retainedSourceSolids, 1302);
  assert.equal(supplier.omissions?.length, 5);
  assert.equal(
    supplier.omissions?.filter((omission) =>
      omission.reason?.includes('Original nonstructural electronics solid is invalid'),
    ).length,
    3,
  );
  assert.equal(supplier.sourceSolids! - supplier.retainedSourceSolids!, 3);
  assert.equal(
    supplier.components.reduce((count, component) => count + (component.solids ?? 1), 0),
    supplier.retainedSourceSolids,
  );
  assert.ok(supplier.omissions?.every((omission) => (omission.reason?.length ?? 0) > 0));
  const equipment = supplier.components.filter((component) => component.group === 'electronics');
  assert.ok(equipment.length > 0);
  assert.ok(
    equipment.some((component) => (component.solids ?? 1) > 10),
    'The actual multi-solid supplier boards remain installed instead of generic equipment boxes.',
  );
});

test('inspection spacing cannot reshape the fixed supplier geometry', () => {
  for (const preset of part.presets) {
    const narrow = { ...preset.parameters, explodedGap: 15 };
    const wide = { ...preset.parameters, explodedGap: 60 };
    const assemblyA = part.buildGeometry(narrow, 'assembled');
    const assemblyB = part.buildGeometry(wide, 'assembled');
    const explodedA = part.buildGeometry(narrow, 'exploded');
    const explodedB = part.buildGeometry(wide, 'exploded');
    try {
      assert.deepEqual(
        new Box3().setFromObject(assemblyA, true),
        new Box3().setFromObject(assemblyB, true),
      );
      assert.equal(explodedA.children.length, assemblyA.children.length);
      assert.equal(explodedB.children.length, assemblyA.children.length);
      let moved = false;
      for (const [index, child] of explodedA.children.entries()) {
        const other = explodedB.children[index];
        assert.equal(child.name, other.name);
        const firstSize = new Box3().setFromObject(child, true).getSize(new Vector3());
        const secondSize = new Box3().setFromObject(other, true).getSize(new Vector3());
        assert.ok(
          firstSize.distanceTo(secondSize) < 0.001,
          `${child.name}: rigid inspection motion`,
        );
        if (child.position.distanceTo(other.position) > 0.001) moved = true;
      }
      assert.ok(moved, `${preset.id}: inspection separation responds to its control`);
    } finally {
      for (const model of [assemblyA, assemblyB, explodedA, explodedB]) disposeModel(model);
    }
  }
});

test('unsupported models, legacy geometry parameters and invalid inspection values block export', () => {
  const patches: Parameters[] = [
    { model: 'missing' },
    { length: 300 },
    { width: 180 },
    { motorStations: '6' },
    { plateThickness: 4 },
    { deckGap: 50 },
    { explodedGap: Number.NaN },
    { explodedGap: '20' },
  ];
  for (const patch of patches) {
    const p = { ...part.defaults, ...patch };
    assert.ok(validateParameters(part, p, 'exploded').length, JSON.stringify(patch));
    assert.throws(() => generateScript(part, p, 'exploded'));
  }
  for (const state of ['decks', 'cut', 'print', 'unknown']) {
    assert.ok(validateParameters(part, part.defaults, state).length, state);
    assert.throws(() => generateScript(part, part.defaults, state));
  }
});

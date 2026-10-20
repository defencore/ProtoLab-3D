import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { Box3, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import part from '../src/parts/pcb-standoff/part';
import insertPart from '../src/parts/pcb-standoff-insert/part';
import {
  prototypeDefaults,
  insertPrototypeDefaults,
  parameterSchema,
  catalogFields,
} from '../src/parts/pcb-standoff/lib/schema';
import {
  dimensions,
  geometry,
  pieces,
  validateStandoff,
} from '../src/parts/pcb-standoff/lib/model';
import { generateScript } from '../src/core/freecad';
import { withGeometryMode } from '../src/core/geometry-mode';
import { disposeModel } from '../src/core/mechanical';
import { presetMatchesConfiguration } from '../src/core/catalog-models';
import { modelEvidence } from '../src/core/model-evidence';
import type { Parameters, PartDefinition, Preset } from '../src/core/types';
import { registerPartModules } from '../src/core/part-modules';

const base = { ...prototypeDefaults };
const fixtures: { name: string; parameters: Parameters; composite?: boolean }[] = [
  { name: 'female-male', parameters: base },
  {
    name: 'mixed-UNC-metric',
    parameters: {
      ...base,
      bodyLength: 5,
      bodyWidth: 5,
      femaleDepthA: 3,
      threadDiameterA: 2.8448,
      threadPitchA: 25.4 / 40,
      threadDesignationA: 'UNC4-40',
    },
  },
  {
    name: 'mixed-metric-UNC',
    parameters: {
      ...base,
      bodyLength: 5,
      bodyWidth: 5,
      femaleDepthA: 3,
      threadDiameterB: 2.8448,
      threadPitchB: 25.4 / 40,
      threadDesignationB: 'UNC4-40',
    },
  },
  {
    name: 'external-ST',
    parameters: {
      ...base,
      bodyLength: 8,
      bodyWidth: 5,
      femaleDepthA: 5,
      threadDiameterA: 2.5,
      threadPitchA: 0.45,
      threadDesignationA: 'M2.5',
      threadDiameterB: 2.1,
      threadRootDiameterB: 1.6,
      threadPitchB: 0,
      threadDesignationB: 'ST2.2',
      maleLengthB: 5,
    },
  },
  {
    name: 'meeting-M3',
    parameters: {
      ...base,
      bodyLength: 18,
      endB: 'female',
      maleLengthB: 0,
      femaleDepthA: 9,
      femaleDepthB: 9,
      meetingFemaleBores: true,
    },
  },
  {
    name: 'meeting-M2.5',
    parameters: {
      ...base,
      bodyLength: 15,
      bodyWidth: 5,
      endB: 'female',
      maleLengthB: 0,
      femaleDepthA: 7.5,
      femaleDepthB: 7.5,
      threadDiameterA: 2.5,
      threadDiameterB: 2.5,
      threadPitchA: 0.45,
      threadPitchB: 0.45,
      threadDesignationA: 'M2.5',
      threadDesignationB: 'M2.5',
      meetingFemaleBores: true,
    },
  },
  { name: 'unknown-male', parameters: { ...base, maleLengthB: 0, maleEnvelopeLengthB: 6 } },
  { name: 'male-male', parameters: { ...base, endA: 'male', femaleDepthA: 0, maleLengthA: 4 } },
  {
    name: 'female-female-blind',
    parameters: {
      ...base,
      bodyLength: 12,
      bodyWidth: 5,
      cornerDiameter: 5.5,
      endB: 'female',
      maleLengthB: 0,
      femaleDepthA: 3,
      femaleDepthB: 3,
    },
  },
  {
    name: 'female-female-through',
    parameters: { ...base, endB: 'female', maleLengthB: 0, femaleDepthA: 0, threadedThrough: true },
  },
  {
    name: 'UNC',
    parameters: {
      ...base,
      bodyWidth: 6,
      threadDiameterA: 3.5052,
      threadDiameterB: 3.5052,
      threadPitchA: 25.4 / 32,
      threadPitchB: 25.4 / 32,
      threadDesignationA: '#6-32 UNC',
      threadDesignationB: '#6-32 UNC',
      femaleDepthA: 3,
    },
  },
  {
    name: 'unknown-blind',
    parameters: {
      ...base,
      bodyWidth: 5,
      cornerDiameter: 5.5,
      endB: 'female',
      maleLengthB: 0,
      femaleDepthA: 0,
      femaleEnvelopeDepthA: 2,
      femaleEnvelopeDepthB: 2,
      threadPitchA: 0,
      threadPitchB: 0,
    },
  },
  {
    name: 'plain-spacer',
    parameters: {
      ...base,
      profile: 'round',
      endA: 'plain',
      endB: 'plain',
      maleLengthB: 0,
      femaleDepthA: 0,
      threadDiameterA: 0,
      threadDiameterB: 0,
      threadPitchA: 0,
      threadPitchB: 0,
      threadDesignationA: '',
      threadDesignationB: '',
      throughBore: true,
      boreDiameter: 3.2,
    },
  },
  {
    name: 'self-tapping',
    parameters: {
      ...base,
      profile: 'round',
      endA: 'plain',
      endB: 'self-tapping',
      maleLengthB: 0,
      femaleDepthA: 0,
      femaleDepthB: 3,
      boreDiameter: 2.5,
      threadPitchA: 0,
      threadPitchB: 0,
    },
  },
  { name: 'insert-unpublished', parameters: { ...insertPrototypeDefaults }, composite: true },
  {
    name: 'insert-exposed',
    parameters: {
      ...insertPrototypeDefaults,
      ...base,
      bodyLength: 15,
      bodyWidth: 6,
      femaleDepthA: 6,
      maleLengthB: 8,
      appearance: 'nylon-white',
    },
    composite: true,
  },
  {
    name: 'insert-known',
    parameters: {
      ...insertPrototypeDefaults,
      bodyWidth: 6,
      bodyLength: 12,
      femaleDepthA: 2,
      femaleDepthB: 2,
      femaleEnvelopeDepthA: 0,
      femaleEnvelopeDepthB: 0,
      insertOuterDiameter: 4,
      insertLengthA: 3,
      insertLengthB: 3,
    },
    composite: true,
  },
  {
    name: 'insert-male',
    parameters: {
      ...insertPrototypeDefaults,
      ...base,
      appearance: 'nylon-black',
      bodyWidth: 6,
      femaleDepthA: 2,
      insertOuterDiameter: 4,
      insertLengthA: 3,
      insertLengthB: 3,
    },
    composite: true,
  },
  {
    name: 'insert-through',
    parameters: {
      ...insertPrototypeDefaults,
      bodyWidth: 6,
      femaleEnvelopeDepthA: 0,
      femaleEnvelopeDepthB: 0,
      threadedThrough: true,
      insertOuterDiameter: 4,
      insertThrough: true,
    },
    composite: true,
  },
];
function fixturePart(p: Parameters, composite = false): PartDefinition {
  return {
    ...(composite ? insertPart : part),
    defaults: p,
    presets: [],
    parameters: parameterSchema([], composite),
    validate: (value) => validateStandoff(value, [], composite),
  };
}
function assertClosedMesh(mesh: Mesh, label: string) {
  const pos = mesh.geometry.getAttribute('position'),
    index = mesh.geometry.getIndex(),
    edges = new Map<string, number>();
  let volume = 0;
  for (let i = 0; i < (index?.count ?? pos.count); i += 3) {
    const v = [0, 1, 2].map((j) =>
      new Vector3().fromBufferAttribute(pos, index ? index.getX(i + j) : i + j),
    );
    assert.ok(
      v.every((point) => point.toArray().every(Number.isFinite)),
      label,
    );
    assert.ok(
      v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).length() > 1e-9,
      label + ' nondegenerate triangle',
    );
    volume += v[0].dot(v[1].clone().cross(v[2])) / 6;
    const keys = v.map((point) =>
      point
        .toArray()
        .map((value) => Math.round(value * 10000))
        .join(','),
    );
    for (let side = 0; side < 3; side++) {
      const key = [keys[side], keys[(side + 1) % 3]].sort().join('|');
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  assert.ok(volume > 0, label + ' positive outward volume');
  for (const [edge, count] of edges) assert.equal(count, 2, label + ' shared edge ' + edge);
}

test('PCB end forms, UNC and sourced hex corner envelopes retain closed previews and correct overall dimensions in both modes', () => {
  for (const fixture of fixtures)
    for (const mode of ['simple', 'full'] as const)
      withGeometryMode(mode, () => {
        const p = fixture.parameters;
        assert.deepEqual(validateStandoff(p, [], !!fixture.composite), [], fixture.name);
        const model = geometry(p, !!fixture.composite);
        try {
          const actual = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
          dimensions(p).forEach((value, axis) =>
            assert.ok(Math.abs(value - actual[axis]) < 0.002, fixture.name + ' dimension ' + axis),
          );
          model.traverse((object) => {
            if (object instanceof Mesh) assertClosedMesh(object, fixture.name + '/' + mode);
          });
          if (fixture.name === 'female-female-blind')
            assert.ok(Math.abs(actual[0] - 5.5) < 1e-5 && Math.abs(actual[1] - 5) < 1e-5);
        } finally {
          disposeModel(model);
        }
      });
});

test('unpublished blind depths stay visibly open with a solid web and never acquire fabricated thread spans', () => {
  const p = fixtures.find((fixture) => fixture.name === 'unknown-blind')!.parameters;
  for (const mode of ['simple', 'full'] as const)
    withGeometryMode(mode, () => {
      const model = geometry(p);
      try {
        model.updateMatrixWorld(true);
        const hits = new Raycaster(new Vector3(0, 0, -1), new Vector3(0, 0, 1)).intersectObject(
          model,
          true,
        );
        assert.ok(hits.length > 0);
        assert.ok(
          Math.abs(hits[0].point.z - 2) < 1e-4,
          'visible bottom opening terminates at the nominal blind envelope, preserving the web',
        );
        const item = pieces(p)[0];
        assert.equal(item.metadata.SupplierThreadDesignationA, 'M3');
        assert.match(item.metadata.ThreadCallouts, /source female M3/);
        assert.ok(
          !item.metadata.ThreadFeaturesJSON,
          'unpublished thread extent must not become a manufacturing feature',
        );
        const envelopes = JSON.parse(item.metadata.NominalBoreEnvelopeJSON);
        assert.equal(envelopes.length, 2);
        assert.ok(envelopes.every((entry: { verified: boolean }) => entry.verified === false));
        model.traverse((object) => {
          if (object instanceof Mesh && object.material instanceof MeshStandardMaterial)
            assert.equal(object.material.userData.visualThreads, undefined);
        });
      } finally {
        disposeModel(model);
      }
    });
});

test('thread metadata preserves source designation, actual span and outward interface frames without metric relabeling', () => {
  const mixed = pieces({ ...base, femaleDepthA: 0, femaleEnvelopeDepthA: 2 })[0].metadata;
  assert.equal(
    JSON.parse(mixed.ThreadFeaturesJSON).length,
    1,
    'only the confirmed male thread has an actual span',
  );
  assert.match(mixed.ThreadCallouts, /A: source female M3, depth unpublished/);
  for (const mode of ['simple', 'full'] as const)
    withGeometryMode(mode, () => {
      const item = pieces(fixtures.find((fixture) => fixture.name === 'UNC')!.parameters)[0];
      const features = JSON.parse(item.metadata.ThreadFeaturesJSON);
      assert.equal(features.length, 2);
      assert.deepEqual(
        features.map((feature: { length: number }) => feature.length),
        [6, 3],
      );
      assert.ok(
        features.every(
          (feature: { designation: string; representation: string }) =>
            feature.designation === '#6-32 UNC' &&
            feature.representation === (mode === 'full' ? 'machined-helix' : 'nominal-cylinder'),
        ),
      );
      const internal = features.find((feature: { internal: boolean }) => feature.internal);
      const external = features.find((feature: { internal: boolean }) => !feature.internal);
      assert.deepEqual(internal.origin, [0, 0, 0]);
      assert.deepEqual(internal.axis, [0, 0, 1]);
      assert.deepEqual(external.origin, [0, 0, 10]);
      assert.deepEqual(external.axis, [0, 0, 1]);
      const self = pieces(
        fixtures.find((fixture) => fixture.name === 'self-tapping')!.parameters,
      )[0];
      assert.equal(self.metadata.ThreadFeaturesJSON, undefined);
      assert.match(self.metadata.InterfaceGeometryNotes, /explicit smooth envelopes/);
    });
});

test('fixed supplier identity distinguishes equal geometry and rejects altered or impossible configurations', () => {
  const catalog = (id: string): Preset => ({
    id,
    name: id,
    description: 'Fixture supplier identity',
    parameters: { ...base, catalogItem: id },
    catalog: {
      designation: id,
      sourceName: id,
      sourceUrl: 'https://example.com/' + id,
      verifiedParameters: ['catalogItem', 'bodyLength'],
    },
  });
  const presets = [catalog('supplier-a/item'), catalog('supplier-b/item')];
  for (const preset of presets)
    preset.catalog!.attributes = { supplier: preset.id, threadLabel: 'M3', catalogBodyLength: 10 };
  const registered = registerPartModules([
    {
      apiVersion: 2,
      order: 72.1,
      part: {
        ...part,
        parameters: parameterSchema(presets),
        defaults: presets[0].parameters,
        presets,
        catalogFilterFields: catalogFields(presets),
      },
    },
  ]);
  assert.equal(registered[0].presets.length, 2);
  const definition = { ...part, presets };
  assert.equal(presetMatchesConfiguration(definition, presets[0], presets[1].parameters), false);
  assert.equal(modelEvidence(definition, presets[1].parameters).presetId, 'supplier-b/item');
  assert.deepEqual(validateStandoff(presets[1].parameters, presets), []);
  assert.ok(validateStandoff({ ...presets[1].parameters, bodyLength: 11 }, presets).length > 0);
  for (const patch of [
    { bodyLength: 0 },
    { threadPitchA: 4, threadPitchB: 4 },
    { threadDiameterA: 5.5, threadDiameterB: 5.5 },
    { femaleDepthA: 10 },
    { maleLengthB: 0 },
    { cornerDiameter: 4 },
    { threadedThrough: true },
    { throughBore: true, boreDiameter: 0 },
  ] as Parameters[])
    assert.ok(validateStandoff({ ...base, ...patch }, []).length > 0, JSON.stringify(patch));
  const known = fixtures.find((fixture) => fixture.name === 'insert-known')!.parameters;
  for (const patch of [
    { insertOuterDiameter: 3 },
    { insertLengthA: 13 },
    { insertLengthB: 0 },
    { femaleDepthA: 4 },
  ] as Parameters[])
    assert.ok(validateStandoff({ ...known, ...patch }, [], true).length > 0, JSON.stringify(patch));
});

test('known inserts have their own thread metadata; unpublished inserts remain one explicitly limited purchased-unit envelope', () => {
  const unknown = pieces(
    fixtures.find((fixture) => fixture.name === 'insert-unpublished')!.parameters,
    true,
  );
  assert.equal(unknown.length, 1);
  assert.match(unknown[0].metadata.InterfaceGeometryNotes, /without inventing hidden metal/);
  const known = pieces(
    fixtures.find((fixture) => fixture.name === 'insert-known')!.parameters,
    true,
  );
  assert.equal(known.length, 3);
  assert.equal(known[0].metadata.ThreadFeaturesJSON, undefined);
  assert.equal(known[0].metadata.ThreadCallouts, undefined);
  assert.deepEqual(
    known.slice(1).map((item) => JSON.parse(item.metadata.ThreadFeaturesJSON).length),
    [1, 1],
  );
});

test('source meeting spans, unknown protrusions, ST studs and exposed brass retain honest per-end geometry and annotations', () => {
  for (const mode of ['simple', 'full'] as const)
    withGeometryMode(mode, () => {
      const mixed = pieces(
        fixtures.find((fixture) => fixture.name === 'mixed-UNC-metric')!.parameters,
      )[0];
      const features = JSON.parse(mixed.metadata.ThreadFeaturesJSON);
      assert.deepEqual(
        new Set(features.map((feature: { designation: string }) => feature.designation)),
        new Set(['M3', 'UNC4-40']),
      );
      const st = pieces(fixtures.find((fixture) => fixture.name === 'external-ST')!.parameters)[0];
      assert.equal(
        JSON.parse(st.metadata.ThreadFeaturesJSON).length,
        1,
        'only the metric female thread has a defined profile',
      );
      assert.deepEqual(JSON.parse(st.metadata.SourceThreadRootDiametersJSON), { B: 1.6 });
      assert.match(st.metadata.ThreadCallouts, /source male ST2.2/);
      const meeting = pieces(
        fixtures.find((fixture) => fixture.name === 'meeting-M3')!.parameters,
      )[0];
      assert.deepEqual(
        JSON.parse(meeting.metadata.ThreadFeaturesJSON).map(
          (feature: { length: number }) => feature.length,
        ),
        [9, 9],
      );
      assert.match(
        meeting.metadata.InterfaceGeometryNotes,
        /not a source declaration of one continuous/,
      );
      const unknown = pieces(
        fixtures.find((fixture) => fixture.name === 'unknown-male')!.parameters,
      )[0];
      assert.equal(
        JSON.parse(unknown.metadata.ThreadFeaturesJSON).length,
        1,
        'unknown male span must not become a real thread feature',
      );
      assert.equal(JSON.parse(unknown.metadata.NominalStudEnvelopeJSON)[0].verified, false);
      assert.match(unknown.metadata.ThreadCallouts, /protrusion\/thread span unpublished/);
      const exposed = pieces(
        fixtures.find((fixture) => fixture.name === 'insert-exposed')!.parameters,
        true,
      );
      assert.equal(
        exposed.length,
        2,
        'only the body envelope and actual exposed stud; no invented hidden insert',
      );
      assert.equal(exposed[0].appearance, 'nylon-white');
      assert.equal(exposed[1].appearance, 'brass');
      assert.notEqual(exposed[0].color, exposed[1].color);
      assert.equal(JSON.parse(exposed[1].metadata.ThreadFeaturesJSON)[0].length, 8);
    });
  const meeting = fixtures.find((fixture) => fixture.name === 'meeting-M3')!.parameters;
  assert.ok(validateStandoff({ ...meeting, meetingFemaleBores: false }, []).length);
  assert.ok(
    validateStandoff({ ...meeting, femaleDepthA: 0, femaleEnvelopeDepthA: 9 }, []).length,
    'unknown opening cannot eliminate the web',
  );
});

test(
  'native PCB interfaces remain closed, non-overlapping, correctly annotated and dimensionally consistent in Simple and Full',
  { skip: !process.env.FREECAD_PYTHON, timeout: 600_000 },
  () => {
    const cases = fixtures.flatMap((fixture) =>
      (['simple', 'full'] as const).map((mode) => ({
        ...fixture,
        mode,
        source: generateScript(
          fixturePart(fixture.parameters, !!fixture.composite),
          fixture.parameters,
          'default',
          undefined,
          undefined,
          mode,
        ),
        expectedComponents: pieces(fixture.parameters, !!fixture.composite).length,
      })),
    );
    const source = `import FreeCAD as App, Part, json, ast
cases=json.loads(${JSON.stringify(JSON.stringify(cases))})
volumes={}
for case in cases:
    doc=App.newDocument('PCBStandoffRegression')
    try:
        exec(compile(case['source'],case['name']+'/'+case['mode'],'exec'),{})
        assert len(doc.RootObjects)==1
        root=doc.RootObjects[0]
        assert root.GeometryMode==case['mode']
        components=root.Group if root.TypeId=='App::Part' else [root]
        assert len(components)==case['expectedComponents']
        for index,component in enumerate(components):
            shape=component.Shape
            assert shape.isValid() and shape.isClosed() and len(shape.Solids)==1 and shape.Volume>0
            assert component.SupplierCatalogItem==case['parameters']['catalogItem']
            assert component.SupplierThreadDesignationA==case['parameters']['threadDesignationA']
            assert component.SupplierThreadDesignationB==case['parameters']['threadDesignationB']
            if hasattr(component,'ThreadFeaturesJSON'):
                features=json.loads(component.ThreadFeaturesJSON)
                assert all(feature['designation'] in [case['parameters']['threadDesignationA'],case['parameters']['threadDesignationB']] for feature in features)
                assert all(feature['representation']==('machined-helix' if case['mode']=='full' else 'nominal-cylinder') for feature in features)
            if component.Label.startswith('Polymer supplier body'):
                assert not hasattr(component,'ThreadFeaturesJSON') and not hasattr(component,'ThreadCallouts'),'metal insert owns the threaded interface'
            for other in components[index+1:]:
                assert shape.common(other.Shape).Volume<1e-8,'physical components must not intersect'
        shape=Part.makeCompound([component.Shape for component in components])
        volumes[(case['name'],case['mode'])]=shape.Volume
        if case['name']=='unknown-blind':
            solid=shape.Solids[0]
            assert not solid.isInside(App.Vector(0,0,0.1),1e-7,True)
            assert not solid.isInside(App.Vector(0,0,9.9),1e-7,True)
            assert solid.isInside(App.Vector(0,0,5),1e-7,True),'blind holes must retain a web'
            assert not hasattr(components[0],'ThreadFeaturesJSON')
        if case['name']=='female-female-blind':
            bounds=shape.optimalBoundingBox(False,False)
            assert abs(bounds.XLength-5.5)<1e-6 and abs(bounds.YLength-5)<1e-6
        if case['name']=='insert-exposed':
            colors=ast.literal_eval(next(line.strip()[len('component_colors = '):] for line in case['source'].splitlines() if line.strip().startswith('component_colors = [')))
            assert len(colors)==2 and colors[0]!=colors[1]
            assert colors[1][0]>colors[1][2]+0.05,'actual exposed brass is gold in native GUI'
            assert components[1].Label.startswith('Exposed brass stud')
        if case['name']=='unknown-male':
            assert len(json.loads(components[0].ThreadFeaturesJSON))==1
            assert json.loads(components[0].NominalStudEnvelopeJSON)[0]['verified'] is False
        if case['name'].startswith('meeting-'):
            assert len(json.loads(components[0].ThreadFeaturesJSON))==2
            assert 'not a source declaration of one continuous' in components[0].InterfaceGeometryNotes
    finally:
        App.closeDocument(doc.Name)
for name in ['unknown-blind','plain-spacer','self-tapping','insert-unpublished']:
    assert abs(volumes[(name,'simple')]-volumes[(name,'full')])<1e-8,(name,'unknown features must remain nominal')
assert volumes[('male-male','full')]<volumes[('male-male','simple')]
assert volumes[('female-female-blind','full')]>volumes[('female-female-blind','simple')]
print('PASS native PCB standoffs in both modes')
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: source,
      encoding: 'utf8',
      timeout: 600_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PASS native PCB standoffs/);
  },
);

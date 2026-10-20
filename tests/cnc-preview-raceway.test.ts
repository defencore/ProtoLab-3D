import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { DoubleSide, Mesh, Raycaster, Vector3, type Group } from 'three';
import screw, {
  precisionScrewParameters,
  precisionScrewLayout,
} from '../src/parts/cnc-precision-screw/part';
import { withGeometryMode } from '../src/core/geometry-mode';
import { disposeModel } from '../src/core/mechanical';

function contains(model: Group, point: Vector3): boolean {
  let contained = false;
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const sides = materials.map((material) => material.side);
    materials.forEach((material) => (material.side = DoubleSide));
    try {
      const hits = new Raycaster(
        point,
        new Vector3(0.371, 0.491, 0.788).normalize(),
        1e-6,
        1000,
      ).intersectObject(object, false);
      const distances = hits
        .map((hit) => hit.distance)
        .filter((distance, index, values) => !index || distance - values[index - 1] > 1e-5);
      if (distances.length % 2) contained = true;
    } finally {
      materials.forEach((material, index) => (material.side = sides[index]));
    }
  });
  return contained;
}

const models = ['r25-10t3-fdi', 'r20-5t3-fdi'] as const;
function probes(model: (typeof models)[number]) {
  const values = precisionScrewLayout(precisionScrewParameters(model, 200));
  return [0, 1, 2].flatMap((quarter) =>
    [0, 1, 2, 3].map((angle) => {
      const radians = (angle * Math.PI) / 2,
        radius = values.rootDiameter / 2 + 0.2;
      return {
        point: new Vector3(
          (quarter * values.lead) / 4,
          radius * Math.cos(radians),
          radius * Math.sin(radians),
        ),
        inside: angle !== (quarter + 3) % 4,
      };
    }),
  );
}

test('Full ground-shaft preview uses the native X-axis helix phase for both source lead executions', () => {
  for (const id of models) {
    const parameters = precisionScrewParameters(id, 200);
    assert.deepEqual(screw.validate(parameters, 'default'), []);
    const object = withGeometryMode('full', () => screw.buildGeometry(parameters, 'default'));
    object.updateMatrixWorld(true);
    try {
      for (const probe of probes(id))
        assert.equal(
          contains(object, probe.point),
          probe.inside,
          `${id} / ${probe.point.toArray()}`,
        );
    } finally {
      disposeModel(object);
    }
  }
});

test('Simple ground-shaft preview retains its complete nominal installation envelope', () => {
  for (const id of models) {
    const object = withGeometryMode('simple', () =>
      screw.buildGeometry(precisionScrewParameters(id, 200), 'default'),
    );
    object.updateMatrixWorld(true);
    try {
      for (const probe of probes(id))
        assert.ok(contains(object, probe.point), `${id} nominal / ${probe.point.toArray()}`);
    } finally {
      disposeModel(object);
    }
  }
});

test(
  'native ground-shaft material witnesses agree with the actual Full preview away from the surfaces',
  { skip: !process.env.FREECAD_PYTHON, timeout: 180_000 },
  () => {
    const cases = models.map((id) => {
      const parameters = precisionScrewParameters(id, 200);
      const object = withGeometryMode('full', () => screw.buildGeometry(parameters, 'default'));
      object.updateMatrixWorld(true);
      try {
        return {
          id,
          source: withGeometryMode('full', () => screw.python(parameters, 'default')),
          points: probes(id).map(({ point }) => ({
            point: point.toArray(),
            meshInside: contains(object, point),
          })),
        };
      } finally {
        disposeModel(object);
      }
    });
    const output = '/tmp/protolab-cnc-preview-raceway-native.json';
    const script = '/tmp/protolab-cnc-preview-raceway-native.py';
    const source = `import FreeCAD as App, Part, math, json
cases=json.loads(${JSON.stringify(JSON.stringify(cases))})
rows=[]
for case in cases:
    scope={'App':App,'Part':Part,'math':math}
    exec(case['source'],scope)
    shape=scope['shape']
    assert shape.isValid() and shape.isClosed() and len(shape.Solids)==1 and math.isfinite(shape.Volume) and shape.Volume>0, case['id']
    for row in case['points']:
        point=App.Vector(*row['point'])
        distance=shape.distToShape(Part.Vertex(point))[0]
        assert distance>0.05, (case['id'],'ambiguous surface witness',row,distance)
        native=shape.isInside(point,1e-7,False)
        assert native==row['meshInside'], (case['id'],'preview/native material mismatch',row,native,distance)
        rows.append(dict(row,model=case['id'],nativeInside=native,surfaceDistanceMm=distance))
open(${JSON.stringify(output)},'w').write(json.dumps(rows,indent=2))
`;
    writeFileSync(script, source);
    const execution = spawnSync(process.env.FREECAD_PYTHON!, [script], {
      encoding: 'utf8',
      env: process.env,
      timeout: 170_000,
    });
    assert.equal(execution.status, 0, execution.stderr + execution.stdout);
    const proof = JSON.parse(readFileSync(output, 'utf8')) as {
      nativeInside: boolean;
      meshInside: boolean;
    }[];
    assert.equal(proof.length, 24);
    assert.ok(proof.every((row) => row.nativeInside === row.meshInside));
  },
);

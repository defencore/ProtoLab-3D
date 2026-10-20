import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { DoubleSide, Mesh, Raycaster, Vector3 } from 'three';
import machine, { millingPieces } from '../src/parts/cnc-milling-machine/part';
import frame from '../src/parts/cnc-frame-part/part';
import { withGeometryMode } from '../src/core/geometry-mode';
import { disposeModel } from '../src/core/mechanical';

const direction = new Vector3(0.371, 0.491, 0.788).normalize();
function contains(model: ReturnType<typeof frame.buildGeometry>, coordinates: number[]) {
  let inside = false;
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const sides = materials.map((material) => material.side);
    materials.forEach((material) => (material.side = DoubleSide));
    try {
      const hits = new Raycaster(
        new Vector3(...coordinates),
        direction,
        1e-6,
        1000,
      ).intersectObject(object, false);
      const distances = hits
        .map((hit) => hit.distance)
        .filter((distance, i, values) => !i || distance - values[i - 1] > 1e-5);
      inside ||= distances.length % 2 === 1;
    } finally {
      materials.forEach((material, i) => (material.side = sides[i]));
    }
  });
  return inside;
}

test('the actual moving saddle preview and STL have one closed consistently wound shell at the coincident nut-pocket floor', () => {
  const component = millingPieces(machine.defaults, 'assembled').find(
    (piece) => piece.component.id === 'moving-z-saddle',
  )!.component;
  for (const exporter of [false, true]) {
    const model = withGeometryMode('simple', () =>
      (exporter ? frame.buildExportGeometry! : frame.buildGeometry)(
        component.parameters,
        component.state,
      ),
    );
    model.updateMatrixWorld(true);
    try {
      let meshes = 0;
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        meshes++;
        const position = object.geometry.getAttribute('position');
        const index = object.geometry.index;
        const count = index?.count ?? position.count;
        const key = (i: number) =>
          [position.getX(i), position.getY(i), position.getZ(i)]
            .map((value) => {
              assert.ok(Number.isFinite(value));
              return Math.round(value / 1e-4);
            })
            .join(',');
        const edges = new Map<string, { count: number; winding: number }>();
        for (let i = 0; i < count; i += 3) {
          const triangle = [0, 1, 2].map((corner) => (index ? index.getX(i + corner) : i + corner));
          const vertices = triangle.map((vertex) =>
            new Vector3().fromBufferAttribute(position, vertex),
          );
          assert.ok(
            vertices[1]
              .clone()
              .sub(vertices[0])
              .cross(vertices[2].clone().sub(vertices[0]))
              .lengthSq() > 1e-18,
            'No collapsed triangle may hide the cap boundary.',
          );
          for (let side = 0; side < 3; side++) {
            const a = key(triangle[side]);
            const b = key(triangle[(side + 1) % 3]);
            const id = [a, b].sort().join(':');
            const edge = edges.get(id) ?? { count: 0, winding: 0 };
            edge.count++;
            edge.winding += a < b ? 1 : -1;
            edges.set(id, edge);
          }
        }
        assert.ok(edges.size > 0);
        for (const [edge, incidence] of edges)
          assert.deepEqual(incidence, { count: 2, winding: 0 }, `Open or duplicate edge: ${edge}`);
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => (material.side = DoubleSide));
        // This exterior point previously saw a duplicated boss-floor crossing and
        // was incorrectly classified as inside the web mesh, far from any stock.
        const hits = new Raycaster(
          new Vector3(-40.53936524456367, -36.536734923891345, -32.82175061125494),
          new Vector3(0.371, 0.491, 0.788).normalize(),
          1e-6,
          1000,
        ).intersectObject(object, false);
        const distances = hits
          .map((hit) => hit.distance)
          .filter((distance, i, values) => !i || distance - values[i - 1] > 1e-5);
        assert.equal(distances.length % 2, 0, 'Exterior witness must remain outside the mesh.');
      });
      assert.equal(meshes, 1, 'One fabricated blank must remain one mesh shell.');
    } finally {
      disposeModel(model);
    }
  }
});

test(
  'actual native saddle material agrees with the repaired web mesh at stock, pocket and duplicate-cap witnesses',
  { skip: !process.env.FREECAD_PYTHON, timeout: 90_000 },
  () => {
    const component = millingPieces(machine.defaults, 'assembled').find(
      (piece) => piece.component.id === 'moving-z-saddle',
    )!.component;
    const points = [
      [-40.53936524456367, -36.536734923891345, -32.82175061125494],
      [11.280586383771151, -40.75869025636666, 43.27805971667365],
      [-31.1261253147386, -40.63229476772722, 29.653247554853778],
      [-29.13483851728961, -22.18398869374414, 46.26618024204441],
      [-26.883285191375762, -16.8884857249991, 51.075460057941854],
      [-100, 0, 0],
      [100, 0, 0],
      [0, 0, -100],
      [0, 0, 100],
      [0, -30, 100],
      [0, -45, 45],
      [0, -25, 30],
      [-100, 10, -100],
      [100, 10, 100],
      [0, 10, -150],
      [0, 10, 150],
    ];
    const object = withGeometryMode('simple', () =>
      frame.buildGeometry(component.parameters, component.state),
    );
    object.updateMatrixWorld(true);
    const source = withGeometryMode('simple', () =>
      frame.python(component.parameters, component.state),
    );
    let rows;
    try {
      rows = points.map((point) => ({ point, meshInside: contains(object, point) }));
    } finally {
      disposeModel(object);
    }
    const sourceHash = createHash('sha256').update(source).digest('hex');
    const script = `import FreeCAD as App, Part, math, json
scope={'App':App,'Part':Part,'math':math}
exec(${JSON.stringify(source)},scope)
shape=scope['shape']
assert shape.isValid() and shape.isClosed() and len(shape.Solids)==1 and math.isfinite(shape.Volume) and shape.Volume>0
rows=json.loads(${JSON.stringify(JSON.stringify(rows))})
for row in rows:
    point=App.Vector(*row['point'])
    row['surfaceDistanceMm']=shape.distToShape(Part.Vertex(point))[0]
    assert row['surfaceDistanceMm']>0.1,('Ambiguous material witness',row)
    row['nativeInside']=shape.isInside(point,1e-7,False)
    assert row['nativeInside']==row['meshInside'],row
assert sum(r['nativeInside'] for r in rows)>=3
assert sum(not r['nativeInside'] for r in rows)>=5
report={'status':'passed','nativeSourceSha256':${JSON.stringify(sourceHash)},'points':rows}
open('/tmp/protolab-cnc-preview-frame-native.json','w').write(json.dumps(report,indent=2))
`;
    const path = '/tmp/protolab-cnc-preview-frame-native.py';
    writeFileSync(path, script);
    const result = spawnSync(process.env.FREECAD_PYTHON!, [path], {
      encoding: 'utf8',
      timeout: 80_000,
      maxBuffer: 2_000_000,
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  },
);

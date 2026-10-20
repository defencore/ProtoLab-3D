import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import wheel from '../src/parts/wheel/part';
import { wheelPieces } from '../src/parts/wheel/lib/composition';
import { pythonShape } from '../src/core/assembly/boundary/shapes';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import type { Parameters } from '../src/core/types';

const cases: { id: string; parameters: Parameters }[] = [
  { id: 'default', parameters: wheel.defaults },
  ...wheel.presets.map(({ id, parameters }) => ({ id, parameters })),
  {
    id: 'flush-hub',
    parameters: { ...wheel.defaults, hubLength: Number(wheel.defaults.width) * 0.6 },
  },
  {
    id: 'short-hub-step',
    parameters: { ...wheel.defaults, hubLength: Number(wheel.defaults.width) * 0.6 + 0.001 },
  },
  { id: 'minimum', parameters: { diameter: 15, width: 3, bore: 1, hubDiameter: 4, hubLength: 3 } },
  {
    id: 'maximum',
    parameters: { diameter: 300, width: 100, bore: 60, hubDiameter: 100, hubLength: 120 },
  },
];

test('wheel tire and rim/hub remain separate closed shells with the specified annular volume', () => {
  for (const { id, parameters } of cases) {
    assert.deepEqual(validateParameters(wheel, parameters, 'default'), [], id);
    const model = wheel.buildGeometry(parameters, 'default');
    try {
      assert.equal(model.children.length, 2, id);
      assert.ok(
        model.children.every((child) => child.userData.libraryId === 'manufactured-detail'),
      );
      const meshes: Mesh[] = [];
      model.traverse((child) => {
        if (child instanceof Mesh) meshes.push(child);
      });
      assert.deepEqual(
        meshes.map((mesh) => mesh.name),
        ['Tire', 'Rim and hub'],
        id,
      );
      const radius = Number(parameters.diameter) / 2,
        rim = radius * 0.78,
        bore = Number(parameters.bore) / 2,
        hub = Number(parameters.hubDiameter) / 2,
        width = Number(parameters.width),
        hubLength = Number(parameters.hubLength),
        polygonArea = (96 * Math.sin((2 * Math.PI) / 96)) / 2;
      const expected = [
        polygonArea * (radius * radius - rim * rim) * width,
        polygonArea *
          ((rim * rim - bore * bore) * width * 0.6 +
            (hub * hub - bore * bore) * (hubLength - width * 0.6)),
      ];
      for (const [meshIndex, mesh] of meshes.entries()) {
        const label = `${id}/${mesh.name}`,
          positions = mesh.geometry.getAttribute('position'),
          indices =
            mesh.geometry.index?.array ?? Array.from({ length: positions.count }, (_, i) => i),
          edges = new Map<string, number>();
        let volume = 0;
        for (let triangle = 0; triangle < indices.length; triangle += 3) {
          const vertices = [0, 1, 2].map((offset) =>
            new Vector3().fromBufferAttribute(positions, indices[triangle + offset]),
          );
          volume += vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
          const keys = vertices.map((vertex) =>
            vertex
              .toArray()
              .map((value) => Math.round(value * 10000))
              .join(','),
          );
          assert.equal(new Set(keys).size, 3, `${label}: degenerate triangle`);
          for (let side = 0; side < 3; side++) {
            const edge = [keys[side], keys[(side + 1) % 3]].sort().join('|');
            edges.set(edge, (edges.get(edge) ?? 0) + 1);
          }
        }
        assert.ok(volume > 0, `${label}: outward winding`);
        assert.ok(
          Math.abs(volume - expected[meshIndex]) / expected[meshIndex] <
            (meshIndex === 0 ? 1e-5 : 1e-6),
          `${label}: expected annular volume`,
        );
        for (const [edge, count] of edges) assert.equal(count, 2, `${label}: shared edge ${edge}`);
      }
      model.updateMatrixWorld(true);
      const actual = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
      assert.ok(
        actual.every(
          (value, axis) => Math.abs(value - wheel.dimensions(parameters, 'default')[axis]) < 0.001,
        ),
        id,
      );
    } finally {
      disposeModel(model);
    }
  }
});

test(
  'native wheel rim/hub is equivalent to the original annular union, including a flush hub',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const code =
      'import FreeCAD as App, Part\n' +
      cases
        .map(({ id, parameters }) => {
          const radius = Number(parameters.diameter) / 2,
            rim = radius * 0.78,
            bore = Number(parameters.bore) / 2,
            hub = Number(parameters.hubDiameter) / 2,
            rimLength = Number(parameters.width) * 0.6,
            hubLength = Number(parameters.hubLength);
          return `label = ${JSON.stringify(id)}
def annulus(radius, length):
    return Part.makeCylinder(radius,length,App.Vector(0,0,-length/2)).cut(Part.makeCylinder(${bore},length+2,App.Vector(0,0,-length/2-1)))
original = annulus(${rim},${rimLength}).fuse(annulus(${hub},${hubLength})).removeSplitter()
actual = ${pythonShape(wheelPieces(parameters)[1].shape)}
assert actual.isValid() and actual.isClosed() and len(actual.Solids) == 1, label
tolerance = max(1e-6,original.Volume*1e-10)
assert abs(actual.Volume-original.Volume) < tolerance, label
assert actual.cut(original).Volume < tolerance and original.cut(actual).Volume < tolerance, label
`;
        })
        .join('\n') +
      "print('PASS native wheel equivalence')\n";
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PASS native wheel equivalence/);
  },
);

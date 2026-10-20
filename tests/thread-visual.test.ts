import assert from 'node:assert/strict';
import test from 'node:test';
import { Mesh, MeshStandardMaterial } from 'three';
import { withGeometryMode } from '../src/core/geometry-mode';
import { disposeModel } from '../src/core/mechanical';
import { packModel, unpackModel } from '../src/core/mesh-transfer';
import { showThreads, type VisualThread } from '../src/core/thread-visual';
import threadTool from '../src/parts/thread-tool/part';
import type { Parameters as ProductParameters } from '../src/core/types';

function fragment(material: MeshStandardMaterial): string {
  const shader = {
    vertexShader: '#include <begin_vertex>',
    fragmentShader: '#include <normal_fragment_maps>',
    uniforms: {},
  };
  material.onBeforeCompile(
    shader as Parameters<MeshStandardMaterial['onBeforeCompile']>[0],
    {} as Parameters<MeshStandardMaterial['onBeforeCompile']>[1],
  );
  return shader.fragmentShader;
}

function threadMaterial(model: ReturnType<typeof threadTool.buildGeometry>): MeshStandardMaterial {
  let selected: MeshStandardMaterial | undefined;
  model.traverse((object) => {
    if (object instanceof Mesh && object.material instanceof MeshStandardMaterial)
      selected = object.material;
  });
  assert.ok(selected);
  return selected;
}

test('Full thread-tool preview preserves multi-start lead and both handednesses through worker transport', () => {
  for (const starts of [1, 2, 3, 4])
    for (const handedness of ['right', 'left'])
      for (const state of ['external', 'internal'])
        withGeometryMode('full', () => {
          const p: ProductParameters = {
            ...threadTool.defaults,
            starts,
            handedness,
            manufacturing: 'machined',
          };
          assert.deepEqual(threadTool.validate(p, state), []);
          const model = threadTool.buildGeometry(p, state);
          const transferred = unpackModel(packModel(model).model);
          try {
            for (const candidate of [model, transferred]) {
              const material = threadMaterial(candidate);
              const thread = (material.userData.visualThreads as VisualThread[])[0];
              assert.equal(thread.starts, starts);
              assert.equal(thread.internal, state === 'internal');
              assert.equal(thread.left, handedness === 'left');
              const shader = fragment(material);
              const phase = shader.match(
                /float phase = axial \/ ([\d.]+) - \(([-\d.]+)\) \* angle \/ ([\d.]+);/,
              );
              assert.ok(phase, 'shader must encode a signed, parenthesized angular coefficient');
              assert.doesNotMatch(
                phase[0],
                /--/,
                'left-hand subtraction must not become a GLSL decrement token',
              );
              const pitch = Number(phase[1]),
                count = Number(phase[2]),
                tau = Number(phase[3]);
              const hand = handedness === 'left' ? -1 : 1;
              assert.equal(count, hand * starts);
              assert.equal(pitch, Number(p.pitch));
              const angle = 0.73,
                lead = Number(p.pitch) * starts;
              assert.ok(
                Math.abs((hand * lead * angle) / (2 * Math.PI) / pitch - (count * angle) / tau) <
                  1e-10,
                'following one physical helix by its configured lead must preserve groove phase',
              );
              assert.ok(
                Math.abs((count * ((2 * Math.PI) / starts)) / tau - hand) < 1e-10,
                'successive thread starts must be separated by 2π/starts around the axis',
              );
            }
          } finally {
            disposeModel(model);
            disposeModel(transferred);
          }
        });
});

test('single-start descriptors are normalized at the preview boundary and Simple installs no thread shader', () => {
  const descriptor: VisualThread = {
    origin: [0, 0, 0],
    axis: [0, 0, 1],
    diameter: 6,
    pitch: 1,
    length: 10,
  };
  for (const mode of ['simple', 'full'] as const)
    withGeometryMode(mode, () => {
      const material = new MeshStandardMaterial();
      const mesh = new Mesh(undefined, material);
      try {
        showThreads(mesh, [descriptor]);
        if (mode === 'simple') {
          assert.equal(material.userData.visualThreads, undefined);
          assert.doesNotMatch(fragment(material), /float phase/);
        } else {
          assert.equal(material.userData.visualThreads[0].starts, 1);
          assert.match(fragment(material), /- \(1\.000000\) \* angle/);
        }
        assert.equal(
          descriptor.starts,
          undefined,
          'normalization must not mutate authored features',
        );
      } finally {
        mesh.geometry.dispose();
        material.dispose();
      }
    });
});

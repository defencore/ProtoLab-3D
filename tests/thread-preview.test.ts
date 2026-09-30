import assert from 'node:assert/strict';
import test from 'node:test';
import { Mesh, MeshStandardMaterial } from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import bolt from '../src/parts/bolt-screw/part';
import nut from '../src/parts/hex-nut/part';
import { packModel, unpackModel } from '../src/core/mesh-transfer';
import { disposeModel } from '../src/core/mechanical';
import { machinePieces } from '../src/parts/automatic-band-saw/lib/model';
import { geometry } from '../src/parts/automatic-band-saw/lib/assembly';
import saw from '../src/parts/automatic-band-saw/part';

test('thread pitch and handedness survive worker transfer without adding thread triangles to STL', () => {
  for (const part of [bolt, nut]) {
    const p = { ...part.defaults, handedness: 'left' };
    const root = part.buildGeometry(p, 'default');
    const before = new STLExporter().parse(root, { binary: true });
    const copy = unpackModel(packModel(root).model);
    let count = 0;
    copy.traverse((o) => {
      if (o instanceof Mesh) {
        const m = o.material as MeshStandardMaterial;
        if (m.userData.visualThreads) {
          count++;
          assert.ok(m.userData.visualThreads.every((t: { left: boolean }) => t.left));
          assert.notEqual(
            m.customProgramCacheKey(),
            new MeshStandardMaterial().customProgramCacheKey(),
          );
        }
      }
    });
    assert.ok(count > 0, part.id);
    const after = new STLExporter().parse(copy, { binary: true });
    assert.deepEqual(new Uint8Array(before.buffer), new Uint8Array(after.buffer));
    assert.doesNotMatch(part.python(p, 'default'), /makeLongHelix|makePipeShell/);
    disposeModel(root);
    disposeModel(copy);
  }
});

test('SFU ball race and individual bearing components exist in the machine', () => {
  const pieces = machinePieces(saw.defaults, 'feed-detail');
  assert.ok(pieces.some((p) => p.label.includes('outer race')));
  assert.ok(pieces.some((p) => p.label.includes('ball 1')));
  assert.ok(pieces.some((p) => p.label.includes('cage')));
  const screws = pieces.filter((p) => p.label.startsWith('SFU1605 library'));
  assert.equal(screws.length, 2, 'separate library shaft and flanged nut');
  const root = geometry(screws),
    nominal = geometry(screws, true);
  const triangles = (model: typeof root) => {
    let count = 0;
    model.traverse((o) => {
      if (o instanceof Mesh)
        count += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3;
    });
    return count;
  };
  assert.ok(triangles(root) > 3 * triangles(nominal), 'real helical raceways only in preview');
  assert.doesNotMatch(saw.python(saw.defaults, 'feed-detail'), /makeLongHelix|makePipeShell/);
  disposeModel(root);
  disposeModel(nominal);
});

test('saw assemblies compose library ball-circuit guides and detailed stepper parts', () => {
  const pieces = machinePieces(saw.defaults, 'mechanism');
  const guides = pieces.filter(
    (p) => p.shape.kind === 'transform' && p.shape.child.kind === 'library-guide',
  );
  assert.equal(guides.length, 6, 'two feed rails/four blocks; bow uses a pivot');
  assert.ok(pieces.some((p) => p.label.includes('Feed NEMA23 / Lamination stack section')));
  assert.ok(
    !pieces.some(
      (p) => p.group === 'Length gauge' || /Material encoder|Contact measuring wheel/.test(p.label),
    ),
  );
  assert.ok(pieces.some((p) => p.label.includes('1000 ppr rear encoder cover')));
  assert.match(saw.python(saw.defaults, 'feed-detail'), /Part.makeSphere/);
});

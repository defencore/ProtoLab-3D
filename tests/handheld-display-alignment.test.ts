import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { Box3, DoubleSide, Mesh, Raycaster, Vector3, type Object3D } from 'three';
import { componentGeometry } from '../src/core/assembly/detail-instances';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';
import part from '../src/parts/handheld-lora-controller/part';
import { layout } from '../src/parts/handheld-lora-controller/lib/layout';
import { configuredPieces, libraries } from '../src/parts/handheld-lora-controller/lib/model';

before(async () => {
  await part.initializeGeometry?.(part.defaults, 'assembled');
});

const close = (actual: number, expected: number, label: string) =>
  assert.ok(Math.abs(actual - expected) < 0.0003, `${label}: ${actual} ~= ${expected}`);

function boundsOf(root: Object3D, suffix: string): Box3 {
  const matching: Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh && object.name.endsWith(suffix)) matching.push(object);
  });
  assert.equal(matching.length, 1, `One canonical ${suffix} occurrence`);
  return new Box3().setFromObject(matching[0], true);
}

function installedDisplay(p: Parameters) {
  const occurrence = configuredPieces(p, 'assembled').find(
    (piece) => piece.component.id === 'heltec-board',
  )!;
  assert.deepEqual(occurrence.component.placement.translation, [0, 25, 16.9]);
  assert.deepEqual(occurrence.component.placement.rotation, [0, 0, 0]);
  const module = componentGeometry(libraries, [occurrence]);
  try {
    module.updateMatrixWorld(true);
    const face = boundsOf(module, 'OLED active face');
    const glass = boundsOf(module, 'OLED glass');
    const frame = boundsOf(module, 'PC OLED guard and integrated FPC antenna envelope');
    const pcb = boundsOf(module, 'PCB — heltec-wifi-lora32-v4');
    const usb = boundsOf(module, 'USB Type-C housing');
    module.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        material.side = DoubleSide;
    });
    for (const u of [0.001, 0.5, 0.999])
      for (const v of [0.001, 0.5, 0.999]) {
        const ray = new Raycaster(
          new Vector3(
            face.min.x + (face.max.x - face.min.x) * u,
            face.min.y + (face.max.y - face.min.y) * v,
            face.max.z + 0.005,
          ),
          new Vector3(0, 0, 1),
          0,
          0.3,
        );
        assert.equal(
          ray.intersectObject(module, true).length,
          0,
          'The fixed protective-frame opening exposes the calibrated face',
        );
      }
    return { face, glass, frame, pcb, usb };
  } finally {
    disposeModel(module);
  }
}

test('All seven library assemblies align the actual V4 display with the lid without moving PCB, USB or frame', () => {
  assert.equal(part.presets.length, 7);
  for (const preset of part.presets) {
    const p = { ...part.defaults, ...preset.parameters };
    const d = layout(p);
    close(d.display.y, 18.65, `${preset.id}: calibrated lid window Y`);
    const { face, glass, frame, pcb, usb } = installedDisplay(p);
    for (const [label, bounds] of [
      ['face', face],
      ['glass', glass],
    ] as const) {
      const center = bounds.getCenter(new Vector3());
      close(center.x, d.display.x, `${preset.id}: ${label} / lid X alignment`);
      close(center.y, d.display.y, `${preset.id}: ${label} / lid Y alignment`);
      close(center.x, 2, `${preset.id}: calibrated display X`);
      close(center.y, 18.65, `${preset.id}: calibrated display Y`);
    }
    close(face.max.z, 27.5, 'Unchanged display face height');
    close(frame.getCenter(new Vector3()).x, 0, 'Fixed protective-frame center');
    close(frame.getCenter(new Vector3()).y, 19.65, 'Fixed protective-frame center Y');
    close(frame.min.x, -9.3, 'Fixed protective-frame left edge');
    close(frame.max.x, 9.3, 'Fixed protective-frame right edge');
    close(frame.max.z, 27.6, 'Fixed protective-frame height');
    close(pcb.min.x, -12.7, 'Fixed PCB left edge');
    close(pcb.max.x, 12.7, 'Fixed PCB right edge');
    close(pcb.min.z, 20.5, 'Fixed PCB lower datum');
    close(pcb.max.z, 22.1, 'Fixed PCB upper datum');
    close(usb.getCenter(new Vector3()).x, 0, 'Fixed USB center X');
    close(usb.getCenter(new Vector3()).z, 23.59, 'Fixed USB center Z');
    close(usb.max.y, 51.6, 'Fixed USB mating plane');
    close(d.display.maskBottom - frame.max.z, 0.35, 'Nominal frame / mask gap');
    close((d.display.windowWidth - (face.max.x - face.min.x)) / 2, 0.2, 'X aperture margin');
    close((d.display.windowLength - (face.max.y - face.min.y)) / 2, 0.2, 'Y aperture margin');
  }
});

test('Rendered Straight, Palm and Palm Lock lids expose the full V4 face and preserve the opaque surround', () => {
  const bodyModels = ['original', 'contoured', 'web-grip'];
  for (const bodyModel of bodyModels) {
    const preset = part.presets.find((preset) => preset.parameters.bodyModel === bodyModel)!;
    const p = { ...part.defaults, ...preset.parameters };
    const d = layout(p);
    const { face, frame } = installedDisplay(p);
    const lid = part.buildGeometry(p, 'lid-only');
    try {
      lid.updateMatrixWorld(true);
      lid.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          material.side = DoubleSide;
        }
      });
      const lidTop = new Box3().setFromObject(lid, true).max.z;
      close(lidTop - face.max.z, 1.5, `${bodyModel}: face recess`);
      // Include the four near-corners and all four near-edges, not just the center ray.
      const fractions = [0.001, 0.25, 0.5, 0.75, 0.999];
      for (const u of fractions)
        for (const v of fractions) {
          const x = face.min.x + (face.max.x - face.min.x) * u;
          const y = face.min.y + (face.max.y - face.min.y) * v;
          const ray = new Raycaster(
            new Vector3(x, y, face.max.z + 0.005),
            new Vector3(0, 0, 1),
            0,
            lidTop - face.max.z + 0.5,
          );
          assert.equal(
            ray.intersectObject(lid, true).length,
            0,
            `${bodyModel}: lid clips display at X=${x}, Y=${y}`,
          );
        }
      const center = face.getCenter(new Vector3());
      const openingEdges: Vector3[] = [];
      for (const direction of [
        new Vector3(-1, 0, 0),
        new Vector3(1, 0, 0),
        new Vector3(0, -1, 0),
        new Vector3(0, 1, 0),
      ]) {
        const ray = new Raycaster(
          new Vector3(center.x, center.y, d.display.maskBottom + 0.1),
          direction,
          0,
          15,
        );
        const hit = ray.intersectObject(lid, true)[0];
        assert.ok(hit, `${bodyModel}: the opaque surround is present`);
        openingEdges.push(hit.point.clone());
        const faceHalf = direction.x
          ? (face.max.x - face.min.x) / 2
          : (face.max.y - face.min.y) / 2;
        close(hit.distance - faceHalf, 0.2, `${bodyModel}: measured opening margin`);
        const undersideRay = new Raycaster(
          new Vector3(
            hit.point.x + direction.x * 0.3,
            hit.point.y + direction.y * 0.3,
            frame.max.z + 0.005,
          ),
          new Vector3(0, 0, 1),
          0,
          2,
        );
        const underside = undersideRay.intersectObject(lid, true)[0];
        assert.ok(underside, `${bodyModel}: continuous mask stock surrounds the opening`);
        close(underside.point.z - frame.max.z, 0.35, `${bodyModel}: actual frame / mask gap`);
      }
      close(
        (openingEdges[2].y + openingEdges[3].y) / 2,
        18.65,
        `${bodyModel}: measured window center Y after the 1 mm upward correction`,
      );
    } finally {
      disposeModel(lid);
    }
  }
});

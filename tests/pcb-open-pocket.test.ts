import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { Mesh, Vector3 } from 'three';
import { box, subtract, type Shape } from '../src/core/assembly/boundary/shapes';
import {
  initializeManifoldGeometry,
  manifoldBoundaryComponent,
} from '../src/core/assembly/manifold-boundary';
import { disposeModel } from '../src/core/mechanical';
import { pcbOpenTriangleSeat } from '../src/core/pcb-retention';

before(initializeManifoldGeometry);

function volume(shape: Shape): number {
  const model = manifoldBoundaryComponent(shape, 'Open PCB pocket witness', 0xffffff);
  try {
    let result = 0;
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const positions = object.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i += 3) {
        const a = new Vector3().fromBufferAttribute(positions, i),
          b = new Vector3().fromBufferAttribute(positions, i + 1),
          c = new Vector3().fromBufferAttribute(positions, i + 2);
        result += a.dot(b.cross(c)) / 6;
      }
    });
    return result;
  } finally {
    disposeModel(model);
  }
}

const edgeX = 19,
  edgeY = -23,
  baseZ = 3,
  seatZ = 8,
  boardThickness = 1.6;

function witness(
  ix: -1 | 1,
  sy: -1 | 1,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  z0: number,
  z1: number,
): Shape {
  return box(
    [u1 - u0, v1 - v0, z1 - z0],
    [edgeX + Math.min(ix * u0, ix * u1), edgeY + Math.min(sy * v0, sy * v1), z0],
  );
}

for (const ix of [-1, 1] as const)
  for (const sy of [-1, 1] as const)
    for (const clearance of [0.15, 0.25, 0.5]) {
      const configuration = `X${ix}/Y${sy}/clearance ${clearance}`;
      test(`open triangular pocket has broad floor and a continuous buttressed rim: ${configuration}`, () => {
        const pocket = pcbOpenTriangleSeat({
          edgeX,
          edgeY,
          insideX: ix,
          outsideY: sy,
          baseZ,
          seatZ,
          boardThickness,
          clearance,
        });
        // These material probes cross the old small ledge and thin fin envelopes.
        // Full containment requires a useful underside contact and an uninterrupted
        // broad load path from the raised rim into the host floor.
        for (const [label, probe] of [
          ['underside ledge', witness(ix, sy, 0.5, 2.5, -6, -3, baseZ + 0.1, seatZ)],
          [
            'rim-to-floor column',
            witness(ix, sy, 0.5, 2.5, 2, 5, baseZ + 0.1, seatZ + boardThickness + clearance + 1.5),
          ],
          ['upper rim breadth', witness(ix, sy, 1, 3, 1, 5, seatZ + 0.1, seatZ + 1.5)],
        ] as const)
          assert.ok(
            Math.abs(volume(pocket) - volume(subtract(pocket, probe)) - volume(probe)) < 0.001,
            `${label} is incomplete`,
          );
      });

      test(`open triangular pocket centers the corner while clearing X and Z service: ${configuration}`, () => {
        const pocket = pcbOpenTriangleSeat({
          edgeX,
          edgeY,
          insideX: ix,
          outsideY: sy,
          baseZ,
          seatZ,
          boardThickness,
          clearance,
        });
        const nominal = witness(ix, sy, 0, 3, -3, 0, seatZ, seatZ + boardThickness),
          fitLimit = witness(
            ix,
            sy,
            0,
            3,
            -3 + clearance,
            clearance,
            seatZ,
            seatZ + boardThickness,
          ),
          displaced = witness(
            ix,
            sy,
            0,
            3,
            -3 + clearance + 0.2,
            clearance + 0.2,
            seatZ,
            seatZ + boardThickness,
          );
        assert.ok(Math.abs(volume(nominal) - volume(subtract(nominal, pocket))) < 0.001);
        assert.ok(Math.abs(volume(fitLimit) - volume(subtract(fitLimit, pocket))) < 0.001);
        assert.ok(volume(displaced) - volume(subtract(displaced, pocket)) > 0.1);

        for (const [label, probe] of [
          ['open upward', witness(ix, sy, 0, 10.5, -10.5, 0, seatZ, seatZ + 20)],
          ['X service corridor', witness(ix, sy, -9.5, 20, -10.5, 0, seatZ, seatZ + 3)],
          ['central bay', witness(ix, sy, -10, 0, -12, 8, baseZ, seatZ + 5)],
        ] as const)
          assert.ok(
            Math.abs(volume(probe) - volume(subtract(probe, pocket))) < 0.001,
            `${label} is obstructed`,
          );
      });
    }

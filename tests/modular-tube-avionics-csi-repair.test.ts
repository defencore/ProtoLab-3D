import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { Euler, Vector3 } from 'three';
import { pythonShape } from '../src/core/assembly/boundary/shapes';
import {
  camera19CsiInterface,
  camera19CsiRoute,
  camera19CsiRibbonGauges,
  cameraCsiPassage,
} from '../src/parts/modular-tube-avionics/lib/nose-cables';
import { guidedCameraProfile } from '../src/parts/rocket-camera-nose/lib/guided-camera';
import { noseParameters } from '../src/parts/modular-tube-avionics/lib/nose';
import part from '../src/parts/modular-tube-avionics/part';
import { pi5Interface } from '../src/parts/raspberry-pi/part';

const near = (actual: number[], expected: readonly number[]) => {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++)
    assert.ok(Math.abs(actual[i] - expected[i]) < 1e-6, `${actual} / ${expected}`);
};
const subtract = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);

test('clocked camera ribbon matches both independently transformed source mouths and width axes', () => {
  const route = camera19CsiRoute();
  const source = guidedCameraProfile(
    noseParameters({ ...part.defaults, cameraSetup: 'camera-19' }),
  ).connector!;
  const fromNose = (v: number[]) =>
    new Vector3(...(v as [number, number, number])).applyEuler(new Euler(0, -Math.PI / 2, 0));
  near(
    route.at(-1)!.point,
    fromNose(source.mouth)
      .add(new Vector3(-100, 0, 0))
      .toArray(),
  );
  near(route.at(-1)!.tangent, fromNose(source.approach).toArray());
  near(route.at(-1)!.width, fromNose(source.widthAxis).toArray());
  const pi = pi5Interface.connectors.cam1;
  const piRotation = new Euler(0, 0, Math.PI);
  near(
    route[0].point,
    new Vector3(...pi.mouth)
      .applyEuler(piRotation)
      .add(new Vector3(-146, 0, -3))
      .toArray(),
  );
  near(route[0].tangent, new Vector3(...pi.exit).applyEuler(piRotation).toArray());
  near(route[0].width, new Vector3(...pi.widthAxis).applyEuler(piRotation).toArray());
});

test('Pi and PCIe detour stays fixed through the fore clearance plane and the new fore route has no quarter twist', () => {
  const route = camera19CsiRoute();
  near(route[64].point, [-162.33, 13, 16.2]);
  near(route[128].point, [-194, 13, 16.2]);
  near(route[128].width, [0, -1, 0]);
  near(route.at(-1)!.point, [-227.5, -1, 5.5]);
  near(route.at(-1)!.tangent, [-1, 0, 0]);
  near(route.at(-1)!.width, [0, -1, 0]);
  for (const station of route.slice(128)) {
    assert.ok(
      station.width[1] < -0.7,
      'Fore ribbon remains based on -Y, rather than rotating its width into Z',
    );
    assert.ok(station.point[2] > 0, 'Only upper stock can be removed for the new fore passage');
    assert.ok(
      Math.abs(station.tangent.reduce((sum, v, i) => sum + v * station.width[i], 0)) < 1e-10,
    );
    near(
      [Math.hypot(...station.tangent), Math.hypot(...station.width), Math.hypot(...station.normal)],
      [1, 1, 1],
    );
  }
  assert.throws(() => camera19CsiRoute(7));
  assert.throws(() => camera19CsiRoute(8.5));
});

test('fore ribbon edges retain positive longitudinal progression throughout the authored reference path', () => {
  const stations = camera19CsiRoute(512);
  let minimum = Infinity;
  for (let i = 1; i < stations.length; i++) {
    const now = stations[i],
      prior = stations[i - 1];
    const ds = Math.hypot(...subtract(now.point, prior.point));
    if (ds < 1e-9) continue;
    const meanTangent = now.tangent.map((v, k) => v + prior.tangent[k]);
    const norm = Math.hypot(...meanTangent);
    const widthChange = subtract(now.width, prior.width);
    const factor =
      1 -
      (Math.abs(widthChange.reduce((sum, v, k) => sum + (v * meanTangent[k]) / norm, 0)) *
        camera19CsiInterface.ribbonWidth) /
        2 /
        ds;
    minimum = Math.min(minimum, factor);
  }
  assert.ok(minimum > 0.25, `Edge reversal/cusp factor: ${minimum}`);
});

test('OV9281 cut is unchanged and the IMX cut is removal-only relative to that common passage', () => {
  const inherited = cameraCsiPassage('ov9281');
  assert.equal(
    createHash('sha256').update(pythonShape(inherited)).digest('hex'),
    '7c4b83b0eb1301d1dfc11788117abe58b0e9e4711182bf8357cb13836e78db9f',
  );
  assert.deepEqual(cameraCsiPassage(), inherited);
  const imx = cameraCsiPassage('camera-19');
  assert.equal(imx.kind, 'union');
  if (imx.kind === 'union') assert.deepEqual(imx.children[0], inherited);
  assert.throws(() => cameraCsiPassage('unknown'));
  const gauges = camera19CsiRibbonGauges();
  assert.deepEqual(
    gauges.map((gauge) => gauge.id),
    ['camera-19-csi-ribbon-assumed', 'camera-19-csi-clearance'],
  );
  for (const gauge of gauges) assert.match(pythonShape(gauge.shape), /Part.makeLoft/);
});

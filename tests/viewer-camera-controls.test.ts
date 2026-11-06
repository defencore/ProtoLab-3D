import assert from 'node:assert/strict';
import test from 'node:test';
import { Euler, Matrix4, OrthographicCamera, Quaternion, Vector3 } from 'three';
import { setCameraDirection, ViewerCameraControls } from '../src/components/viewer/camera-controls';
import {
  animatePresetCameraView,
  cameraViewUp,
  cameraViews,
  setPresetCameraView,
} from '../src/components/viewer/camera-views';

class ViewerDocument extends EventTarget {
  documentElement = { clientLeft: 0, clientTop: 0 };
}
class ViewerElement extends EventTarget {
  ownerDocument = new ViewerDocument();
  style = { touchAction: '' };
  clientWidth = 800;
  clientHeight = 600;
  setPointerCapture() {}
  releasePointerCapture() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 800, height: 600 };
  }
}

function fixture(context: { after(callback: () => void): void }) {
  const previousWindow = globalThis.window;
  const fakeWindow = Object.assign(new EventTarget(), { pageXOffset: 0, pageYOffset: 0 });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });
  const element = new ViewerElement();
  const camera = new OrthographicCamera(-100, 100, 75, -75, 0.1, 10000);
  camera.position.set(0, 0, 400);
  const controls = new ViewerCameraControls(camera, element as unknown as HTMLElement);
  context.after(() => {
    controls.dispose();
    Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
  });
  const pointer = (
    type: string,
    x: number,
    y: number,
    { id = 1, touch = false, button = 0 } = {},
  ) => {
    const event = Object.assign(new Event(type), {
      pageX: x,
      pageY: y,
      pointerId: id,
      pointerType: touch ? 'touch' : 'mouse',
      button,
    });
    (type === 'pointermove' || type === 'pointerup'
      ? element.ownerDocument
      : element
    ).dispatchEvent(event);
  };
  return { camera, controls, element, pointer };
}

function closeVector(actual: Vector3, expected: Vector3, tolerance = 1e-9) {
  assert.ok(
    actual.distanceTo(expected) < tolerance,
    `${actual.toArray()} != ${expected.toArray()}`,
  );
}

test('vertical rotation passes both poles and completes a full turn', (context) => {
  const { camera, controls, pointer } = fixture(context);
  controls.staticMoving = true;
  pointer('pointerdown', 400, 300);
  let upsideDown = false;
  let behind = false;
  for (let step = 1; step <= 21; step++) {
    pointer('pointermove', 400, 300 + step * 80);
    controls.update();
    upsideDown ||= camera.up.y < -0.9;
    behind ||= camera.position.z < -390;
  }
  pointer('pointerup', 400, 1980);
  assert.ok(upsideDown, 'screen-up must be allowed to rotate past the pole');
  assert.ok(behind, 'the camera must reach the opposite hemisphere');
  assert.ok(camera.position.z > 399, 'continued dragging must complete the turn');
  assert.ok(Math.abs(camera.position.length() - 400) < 1e-8);
});

test('exact axis views discard all inertia, including the exact top pole', (context) => {
  const { camera, controls, pointer } = fixture(context);
  controls.staticMoving = false;
  pointer('pointerdown', 400, 300);
  pointer('pointermove', 450, 500);
  controls.update();
  pointer('pointerup', 450, 500);
  const target = new Vector3(12, -8, 30);
  camera.zoom = 2.5;
  setCameraDirection(controls, new Vector3(0, 1, 0), new Vector3(0, 0, -1), 250, target);
  for (let frame = 0; frame < 30; frame++) controls.update();
  closeVector(camera.position, new Vector3(12, 242, 30));
  closeVector(camera.up, new Vector3(0, 0, -1));
  closeVector(controls.target, target);
  assert.equal(camera.zoom, 2.5);
  closeVector(camera.getWorldDirection(new Vector3()), new Vector3(0, -1, 0));
});

test('all seven preview views select distinct, stable camera orientations', (context) => {
  const { camera, controls, pointer } = fixture(context);
  controls.staticMoving = false;
  assert.deepEqual(
    cameraViews.map((view) => view.value),
    ['isometric', 'front', 'back', 'left', 'right', 'top', 'bottom'],
  );
  const expected = {
    isometric: [1.2, 1.7, 1.45],
    front: [0, 0, 1],
    back: [0, 0, -1],
    left: [-1, 0, 0],
    right: [1, 0, 0],
    top: [0, 1, 0],
    bottom: [0, -1, 0],
  };
  const target = new Vector3(12, -8, 30);
  for (const { value } of cameraViews) {
    pointer('pointerdown', 400, 300);
    pointer('pointermove', 450, 500);
    controls.update();
    pointer('pointerup', 450, 500);
    camera.zoom = 2.5;
    setPresetCameraView(controls, value, 250, target);
    for (let frame = 0; frame < 30; frame++) controls.update();
    const direction = new Vector3().fromArray(expected[value]).normalize();
    closeVector(camera.position, target.clone().addScaledVector(direction, 250));
    closeVector(camera.getWorldDirection(new Vector3()), direction.clone().negate());
    closeVector(controls.target, target);
    closeVector(
      camera.up,
      value === 'top'
        ? new Vector3(0, 0, -1)
        : value === 'bottom'
          ? new Vector3(0, 0, 1)
          : new Vector3(0, 1, 0),
    );
    assert.equal(camera.zoom, 2.5);
    assert.ok(camera.getWorldDirection(new Vector3()).cross(camera.up).length() > 0.5);
  }
});

test('inverse view preserves pan and zoom and returns exactly after two clicks', (context) => {
  const { camera, controls, pointer } = fixture(context);
  controls.staticMoving = false;
  const target = new Vector3(13, 27, -9);
  setCameraDirection(controls, new Vector3(1, 2, 3), new Vector3(0, 1, 0), 250, target);
  camera.zoom = 3.4;
  pointer('pointerdown', 400, 300);
  pointer('pointermove', 500, 430);
  controls.update();
  pointer('pointerup', 500, 430);
  const position = camera.position.clone();
  const up = camera.up.clone();
  const offset = position.clone().sub(target);
  controls.invertView();
  for (let frame = 0; frame < 30; frame++) controls.update();
  closeVector(camera.position, target.clone().sub(offset));
  closeVector(camera.up, up);
  closeVector(controls.target, target);
  assert.equal(camera.zoom, 3.4);
  controls.invertView();
  closeVector(camera.position, position);
  closeVector(camera.up, up);
});

test('mouse and one-finger pan move the target without rotating the camera', (context) => {
  const { camera, controls, pointer } = fixture(context);
  controls.staticMoving = true;
  controls.setNavigationMode('pan');
  const direction = camera.getWorldDirection(new Vector3());
  pointer('pointerdown', 400, 300);
  pointer('pointermove', 480, 360);
  controls.update();
  pointer('pointerup', 480, 360);
  closeVector(controls.target, new Vector3(-20, 15, 0));
  closeVector(camera.getWorldDirection(new Vector3()), direction);
  const mouseTarget = controls.target.clone();
  pointer('pointerdown', 400, 300, { touch: true });
  pointer('pointermove', 480, 360, { touch: true });
  controls.update();
  pointer('pointerup', 480, 360, { touch: true });
  closeVector(controls.target, mouseTarget.multiplyScalar(2));
  closeVector(camera.getWorldDirection(new Vector3()), direction);
});

test('touch pinch transitions to one finger without stale zoom or rotation', (context) => {
  const { camera, controls, pointer } = fixture(context);
  controls.staticMoving = true;
  controls.setNavigationMode('pan');
  pointer('pointerdown', 300, 300, { id: 1, touch: true });
  pointer('pointerdown', 500, 300, { id: 2, touch: true });
  pointer('pointermove', 600, 300, { id: 2, touch: true });
  controls.update();
  assert.ok(camera.zoom > 1);
  pointer('pointerup', 600, 300, { id: 2, touch: true });
  const zoom = camera.zoom;
  const direction = camera.getWorldDirection(new Vector3());
  const target = controls.target.clone();
  pointer('pointermove', 340, 340, { id: 1, touch: true });
  controls.update();
  assert.ok(controls.target.distanceTo(target) > 0);
  assert.equal(camera.zoom, zoom);
  closeVector(camera.getWorldDirection(new Vector3()), direction);
  pointer('pointerup', 340, 340, { id: 1, touch: true });
});

test('wheel and pointer input wake demand rendering and respect zoom limits', (context) => {
  const { camera, controls, element, pointer } = fixture(context);
  controls.staticMoving = true;
  let requests = 0;
  controls.addEventListener('change', () => requests++);
  pointer('pointerdown', 400, 300);
  requests = 0;
  pointer('pointermove', 500, 350);
  assert.ok(requests > 0, 'pointer movement must schedule a frame before update');
  pointer('pointerup', 500, 350);
  controls.cancelMotion();
  const wheel = (delta: number) => {
    element.dispatchEvent(
      Object.assign(new Event('wheel', { cancelable: true }), { deltaY: delta, deltaMode: 0 }),
    );
    controls.update();
  };
  requests = 0;
  wheel(-2000);
  assert.ok(requests > 0, 'wheel input must schedule a frame');
  for (let i = 0; i < 50; i++) wheel(-2000);
  assert.equal(camera.zoom, 15);
  for (let i = 0; i < 50; i++) wheel(2000);
  assert.equal(camera.zoom, 0.25);
});

test('damped pan settles at the visible cursor displacement across model sizes and zooms', (context) => {
  const { camera, controls, pointer } = fixture(context);
  controls.staticMoving = false;
  controls.setNavigationMode('pan');
  for (const [distance, span, zoom] of [
    [400, 200, 1],
    [4000, 800, 2.5],
  ]) {
    controls.cancelMotion();
    controls.target.set(0, 0, 0);
    camera.position.set(0, 0, distance);
    camera.up.set(0, 1, 0);
    camera.left = -span / 2;
    camera.right = span / 2;
    camera.top = span * 0.375;
    camera.bottom = -span * 0.375;
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    pointer('pointerdown', 400, 300);
    pointer('pointermove', 480, 360);
    pointer('pointerup', 480, 360);
    for (let frame = 0; frame < 200; frame++) controls.update();
    closeVector(controls.target, new Vector3((-span * 0.1) / zoom, (span * 0.075) / zoom, 0));
  }
});

test('pan follows the screen plane in an oblique view', (context) => {
  const { camera, controls, pointer } = fixture(context);
  controls.staticMoving = true;
  controls.setNavigationMode('pan');
  setCameraDirection(controls, new Vector3(1.2, 1.7, 1.45), new Vector3(0, 1, 0), 400);
  const eye = camera.position.clone().sub(controls.target).normalize();
  camera.updateMatrixWorld();
  const marker = new Vector3(10, 20, 30);
  const before = marker.clone().project(camera);
  pointer('pointerdown', 400, 300);
  pointer('pointermove', 480, 360);
  controls.update();
  camera.updateMatrixWorld();
  const after = marker.clone().project(camera);
  assert.ok(Math.abs(controls.target.dot(eye)) < 1e-9, 'pan must not move into the screen');
  assert.ok(Math.abs((after.x - before.x) * 400 - 80) < 1e-9);
  assert.ok(Math.abs((after.y - before.y) * -300 - 60) < 1e-9);
  pointer('pointerup', 480, 360);
});

test('default CAD rotation stops when the pointer stops', (context) => {
  const { camera, controls, pointer } = fixture(context);
  pointer('pointerdown', 400, 300);
  pointer('pointermove', 460, 380);
  controls.update();
  pointer('pointerup', 460, 380);
  const position = camera.position.clone();
  const up = camera.up.clone();
  for (let frame = 0; frame < 30; frame++) controls.update();
  closeVector(camera.position, position);
  closeVector(camera.up, up);
});

test('canceled mouse drag cannot continue rotating on unpressed pointer movement', (context) => {
  const { camera, controls, pointer } = fixture(context);
  controls.staticMoving = false;
  pointer('pointerdown', 400, 300);
  pointer('pointermove', 460, 380);
  controls.update();
  pointer('pointercancel', 460, 380);
  const position = camera.position.clone();
  const up = camera.up.clone();
  pointer('pointermove', 700, 500);
  for (let frame = 0; frame < 30; frame++) controls.update();
  closeVector(camera.position, position);
  closeVector(camera.up, up);
});

test('canceled pinch returns the remaining finger to its chosen pan gesture', (context) => {
  const { camera, controls, pointer } = fixture(context);
  controls.setNavigationMode('pan');
  pointer('pointerdown', 300, 300, { id: 1, touch: true });
  pointer('pointerdown', 500, 300, { id: 2, touch: true });
  pointer('pointermove', 600, 300, { id: 2, touch: true });
  controls.update();
  pointer('pointercancel', 600, 300, { id: 2, touch: true });
  const zoom = camera.zoom;
  const direction = camera.getWorldDirection(new Vector3());
  const target = controls.target.clone();
  pointer('pointermove', 340, 340, { id: 1, touch: true });
  controls.update();
  assert.ok(controls.target.distanceTo(target) > 0);
  assert.equal(camera.zoom, zoom);
  closeVector(camera.getWorldDirection(new Vector3()), direction);
  pointer('pointercancel', 340, 340, { id: 1, touch: true });
});

test('coincident pinch positions keep zoom finite through repeated updates', (context) => {
  const { camera, controls, pointer } = fixture(context);
  pointer('pointerdown', 300, 300, { id: 1, touch: true });
  pointer('pointerdown', 500, 300, { id: 2, touch: true });
  pointer('pointermove', 300, 300, { id: 2, touch: true });
  for (let frame = 0; frame < 30; frame++) controls.update();
  assert.ok(Number.isFinite(camera.zoom));
  assert.ok(camera.zoom >= 0.25 && camera.zoom <= 15);
  pointer('pointercancel', 300, 300, { id: 2, touch: true });
  pointer('pointercancel', 300, 300, { id: 1, touch: true });
});

test('touch release retains movement queued before the next render frame', (context) => {
  const { camera, controls, pointer } = fixture(context);
  pointer('pointerdown', 400, 300, { touch: true });
  pointer('pointermove', 460, 380, { touch: true });
  pointer('pointerup', 460, 380, { touch: true });
  controls.update();
  assert.ok(camera.position.distanceTo(new Vector3(0, 0, 400)) > 1);
});

test('animated opposite views follow an orbit and settle without a continuing render loop', (context) => {
  let now = 1000;
  context.mock.method(performance, 'now', () => now);
  const { camera, controls } = fixture(context);
  const target = new Vector3(12, -8, 30);
  setPresetCameraView(controls, 'front', 250, target);
  camera.zoom = 2.5;
  let changes = 0;
  controls.addEventListener('change', () => changes++);
  animatePresetCameraView(controls, 'back');
  closeVector(camera.position, target.clone().add(new Vector3(0, 0, 250)));
  assert.ok(changes > 0, 'starting a transition must wake demand rendering');
  for (const elapsed of [0, 70, 140, 175, 210, 280, 350]) {
    const before = changes;
    controls.update(now + elapsed);
    assert.ok(Math.abs(camera.position.distanceTo(target) - 250) < 1e-9);
    closeVector(controls.target, target);
    assert.equal(camera.zoom, 2.5);
    assert.ok(changes > before, 'each active frame must schedule demand rendering');
    if (elapsed === 175)
      assert.ok(
        Math.abs(camera.position.x - target.x) > 249,
        'a 180° turn must not cross the target',
      );
  }
  closeVector(camera.position, target.clone().add(new Vector3(0, 0, -250)));
  closeVector(camera.up, new Vector3(0, 1, 0));
  const settledChanges = changes;
  controls.update(now + 700);
  assert.equal(changes, settledChanges, 'completed transitions must stop requesting frames');
});

test('animated preset views pass stable poles and retain a valid face quarter-roll or canonical Home up', (context) => {
  let now = 0;
  context.mock.method(performance, 'now', () => now);
  const { camera, controls } = fixture(context);
  const target = new Vector3(15, 20, -8);
  setPresetCameraView(controls, 'front', 300, target);
  camera.zoom = 3;
  for (const preset of cameraViews) {
    animatePresetCameraView(controls, preset.value);
    for (const elapsed of [0, 87.5, 175, 262.5, 350]) {
      controls.update(now + elapsed);
      const eye = camera.position.clone().sub(target);
      assert.ok(Math.abs(eye.length() - 300) < 1e-9);
      assert.ok(eye.clone().normalize().cross(camera.up).length() > 0.1);
      assert.ok([...camera.quaternion.toArray(), ...camera.up.toArray()].every(Number.isFinite));
      closeVector(controls.target, target);
      assert.equal(camera.zoom, 3);
    }
    closeVector(
      camera.position,
      target.clone().addScaledVector(new Vector3(...preset.direction).normalize(), 300),
    );
    const canonicalUp = new Vector3(...preset.up);
    if (preset.value === 'isometric') closeVector(camera.up, canonicalUp);
    else
      assert.ok(
        [0, 1, 2, 3].some(
          (quarter) =>
            camera.up.distanceTo(
              canonicalUp
                .clone()
                .applyAxisAngle(new Vector3(...preset.direction), (quarter * Math.PI) / 2),
            ) < 1e-9,
        ),
        preset.value + ': endpoint must remain an orthographic quarter-roll',
      );
    now += 400;
  }
});

test('pure roll transitions keep rendering and finish with nonorthogonal requested up', (context) => {
  let now = 100;
  context.mock.method(performance, 'now', () => now);
  const { camera, controls } = fixture(context);
  const position = camera.position.clone();
  const requestedUp = new Vector3(0, -2, 0.5);
  let changes = 0;
  controls.addEventListener('change', () => changes++);
  controls.animateToDirection(new Vector3(0, 0, 1), requestedUp);
  const startedChanges = changes;
  controls.update(now + 175);
  closeVector(camera.position, position);
  assert.ok(Math.abs(camera.up.x) > 1, 'screen-up must roll through an intermediate orientation');
  assert.ok(changes > startedChanges, 'unchanged position must still advance the rendered roll');
  controls.update(now + 350);
  closeVector(camera.position, position);
  closeVector(camera.up, requestedUp);
  const finishedChanges = changes;
  controls.update(now + 400);
  assert.equal(changes, finishedChanges);
});

test('retargeting begins at the visible pose and interpolates target and distance deliberately', (context) => {
  let now = 1000;
  context.mock.method(performance, 'now', () => now);
  const { camera, controls } = fixture(context);
  animatePresetCameraView(controls, 'back');
  controls.update(now + 100);
  const visiblePosition = camera.position.clone();
  const visibleUp = camera.up.clone();
  now += 200;
  const target = new Vector3(20, -10, 30);
  controls.animateToDirection(new Vector3(0, 1, 0), new Vector3(0, 0, -1), 200, target);
  closeVector(camera.position, visiblePosition);
  closeVector(camera.up, visibleUp);
  controls.update(now);
  closeVector(camera.position, visiblePosition);
  closeVector(camera.up, visibleUp);
  controls.update(now + 175);
  closeVector(controls.target, target.clone().multiplyScalar(0.5));
  assert.ok(Math.abs(camera.position.distanceTo(controls.target) - 300) < 1e-9);
  controls.update(now + 350);
  closeVector(camera.position, target.clone().add(new Vector3(0, 200, 0)));
  closeVector(camera.up, new Vector3(0, 0, -1));
});

test('wheel and pointer starts interrupt animation without erasing newly queued zoom', (context) => {
  let now = 1000;
  context.mock.method(performance, 'now', () => now);
  const { camera, controls, element, pointer } = fixture(context);
  animatePresetCameraView(controls, 'back');
  controls.update(now + 100);
  const wheelPosition = camera.position.clone();
  element.dispatchEvent(
    Object.assign(new Event('wheel', { cancelable: true }), { deltaY: -300, deltaMode: 0 }),
  );
  controls.update(now + 175);
  closeVector(camera.position, wheelPosition);
  assert.ok(camera.zoom > 1, 'the interrupting wheel input must still zoom');
  const wheelZoom = camera.zoom;
  controls.update(now + 700);
  closeVector(camera.position, wheelPosition);
  assert.equal(camera.zoom, wheelZoom);

  now += 1000;
  animatePresetCameraView(controls, 'top');
  controls.update(now + 100);
  const pointerPosition = camera.position.clone();
  pointer('pointerdown', 400, 300);
  pointer('pointerup', 400, 300);
  controls.update(now + 700);
  closeVector(camera.position, pointerPosition);
});

test('animated inversion retains target, zoom and raw up through two opposite turns', (context) => {
  let now = 0;
  context.mock.method(performance, 'now', () => now);
  const { camera, controls } = fixture(context);
  const target = new Vector3(13, 27, -9);
  setCameraDirection(controls, new Vector3(1, 2, 3), new Vector3(0, 1, 0), 250, target);
  camera.zoom = 3.4;
  const position = camera.position.clone();
  const up = camera.up.clone();
  for (let turn = 0; turn < 2; turn++) {
    controls.invertView(350);
    controls.update(now + 175);
    assert.ok(Math.abs(camera.position.distanceTo(target) - 250) < 1e-9);
    controls.update(now + 350);
    closeVector(camera.up, up);
    closeVector(controls.target, target);
    assert.equal(camera.zoom, 3.4);
    now += 350;
  }
  closeVector(camera.position, position);
});

test('instant duration, cancelMotion and disposal leave no pending camera transition', (context) => {
  let now = 0;
  context.mock.method(performance, 'now', () => now);
  const { camera, controls } = fixture(context);
  animatePresetCameraView(controls, 'top', undefined, undefined, 0);
  closeVector(camera.position, new Vector3(0, 400, 0));
  closeVector(camera.up, new Vector3(0, 0, -1));
  animatePresetCameraView(controls, 'back');
  controls.update(100);
  controls.cancelMotion();
  const canceledPosition = camera.position.clone();
  controls.update(700);
  closeVector(camera.position, canceledPosition);
  now = 1000;
  animatePresetCameraView(controls, 'front');
  controls.update(1100);
  const disposedPosition = camera.position.clone();
  controls.dispose();
  controls.update(2000);
  closeVector(camera.position, disposedPosition);
});

test('upside-down and sideways face snaps keep the nearest roll instead of resetting upright', (context) => {
  let now = 1000;
  context.mock.method(performance, 'now', () => now);
  const { camera, controls } = fixture(context);
  const target = new Vector3(12, -8, 30);
  camera.zoom = 2.7;
  const cases = [
    { up: [0, -1, 0], view: 'front', expected: [0, -1, 0] },
    { up: [0, -1, 0], view: 'right', expected: [0, -1, 0] },
    { up: [0, -1, 0], view: 'back', expected: [0, -1, 0] },
    { up: [1, 0, 0], view: 'front', expected: [1, 0, 0] },
    { up: [1, 0, 0], view: 'right', expected: [0, 0, -1] },
    { up: [1, 0, 0], view: 'top', expected: [1, 0, 0] },
    { up: [1, 0, 0], view: 'back', expected: [1, 0, 0] },
  ] as const;
  for (const item of cases) {
    setCameraDirection(controls, new Vector3(0, 0, 1), new Vector3(...item.up), 250, target);
    const start = camera.quaternion.clone();
    animatePresetCameraView(controls, item.view);
    controls.update(now + 175);
    assert.ok(Math.abs(camera.position.distanceTo(target) - 250) < 1e-9);
    if (item.view === 'front')
      assert.ok(camera.quaternion.angleTo(start) < 1e-7, 'same face must not roll');
    controls.update(now + 350);
    closeVector(camera.up, new Vector3(...item.expected));
    closeVector(controls.target, target);
    assert.equal(camera.zoom, 2.7);
    now += 500;
  }
});

test('opposite-face quaternion ties preserve screen-up for every face and quarter-roll', () => {
  const faces = cameraViews.filter((view) => view.value !== 'isometric');
  for (const face of faces)
    for (let quarter = 0; quarter < 4; quarter++) {
      const direction = new Vector3(...face.direction);
      const up = new Vector3(...face.up).applyAxisAngle(direction, (quarter * Math.PI) / 2);
      const orientation = new Quaternion().setFromRotationMatrix(
        new Matrix4().lookAt(direction, new Vector3(), up),
      );
      const opposite = faces.find(
        (candidate) => new Vector3(...candidate.direction).dot(direction) < -0.99,
      )!;
      const selected = cameraViewUp(
        direction.clone().negate(),
        orientation,
        new Vector3(...opposite.up),
      );
      closeVector(selected, up);
      const negated = new Quaternion(
        -orientation.x,
        -orientation.y,
        -orientation.z,
        -orientation.w,
      );
      closeVector(
        cameraViewUp(direction.clone().negate(), negated, new Vector3(...opposite.up)),
        selected,
      );
    }
});

test('oblique rolled cameras select a globally nearest orthographic quarter-roll without mutating inputs', () => {
  const orientations = [
    new Quaternion().setFromEuler(new Euler(0.7, -1.1, 2.8)),
    new Quaternion().setFromEuler(new Euler(-2.2, 0.4, 1.3)),
    new Quaternion().setFromEuler(new Euler(1.5, 2.7, -0.9)),
  ];
  for (const current of orientations)
    for (const face of cameraViews.filter((view) => view.value !== 'isometric')) {
      const direction = new Vector3(...face.direction);
      const canonicalUp = new Vector3(...face.up);
      const before = [direction.toArray(), canonicalUp.toArray(), current.toArray()];
      const selected = cameraViewUp(direction, current, canonicalUp);
      const candidates = [0, 1, 2, 3].map((quarter) =>
        canonicalUp.clone().applyAxisAngle(direction, (quarter * Math.PI) / 2),
      );
      assert.ok(candidates.some((up) => up.distanceTo(selected) < 1e-9));
      const distance = (up: Vector3) =>
        current.angleTo(
          new Quaternion().setFromRotationMatrix(
            new Matrix4().lookAt(direction, new Vector3(), up),
          ),
        );
      assert.ok(
        Math.abs(distance(selected) - Math.min(...candidates.map(distance))) < 1e-7,
        face.value + ': shortest orientation change',
      );
      assert.deepEqual([direction.toArray(), canonicalUp.toArray(), current.toArray()], before);
    }
});

test('face snaps remain stable around an upside-down top pole', (context) => {
  const { camera, controls } = fixture(context);
  for (const epsilon of [-1e-9, 0, 1e-9]) {
    setCameraDirection(controls, new Vector3(epsilon, 1, epsilon), new Vector3(0, 0, 1), 400);
    const selected = cameraViewUp(new Vector3(0, 1, 0), camera.quaternion, new Vector3(0, 0, -1));
    closeVector(selected, new Vector3(0, 0, 1));
    animatePresetCameraView(controls, 'top', undefined, undefined, 0);
    closeVector(camera.up, new Vector3(0, 0, 1));
    assert.ok([...camera.up.toArray(), ...camera.quaternion.toArray()].every(Number.isFinite));
    animatePresetCameraView(controls, 'front', undefined, undefined, 0);
    closeVector(camera.up, new Vector3(0, -1, 0));
  }
});

test('edge and corner snaps transport actual screen-up, including the opposite-direction tie', (context) => {
  const { camera, controls } = fixture(context);
  const target = new Vector3(5, -12, 30);
  camera.zoom = 3.2;
  const directions = [
    new Vector3(1, 0, 1),
    new Vector3(1, 1, 0),
    new Vector3(1, -1, 1),
    new Vector3(0, 0, -1),
  ];
  for (const requested of directions) {
    setCameraDirection(controls, new Vector3(0, 0, 1), new Vector3(0, -1, 0), 250, target);
    const orientation = camera.quaternion.clone();
    const eye = new Vector3(0, 0, 1).applyQuaternion(orientation);
    const screenUp = new Vector3(0, 1, 0).applyQuaternion(orientation);
    const direction = requested.clone().normalize();
    const swing =
      eye.dot(direction) < -1 + 1e-10
        ? new Quaternion().setFromAxisAngle(screenUp, Math.PI)
        : new Quaternion().setFromUnitVectors(eye, direction);
    const expected = screenUp.clone().applyQuaternion(swing).normalize();
    const up = cameraViewUp(direction, orientation);
    closeVector(up, expected);
    assert.ok(Math.abs(up.dot(direction)) < 1e-9);
    controls.animateToDirection(direction, up, undefined, undefined, 0);
    closeVector(camera.up, expected);
    closeVector(controls.target, target);
    assert.ok(Math.abs(camera.position.distanceTo(target) - 250) < 1e-9);
    assert.equal(camera.zoom, 3.2);
  }
});

test('rapid face retargeting chooses roll from the visible pose, while initial and Home views remain canonical', (context) => {
  let now = 1000;
  context.mock.method(performance, 'now', () => now);
  const { camera, controls } = fixture(context);
  const target = new Vector3(12, -8, 30);
  setCameraDirection(controls, new Vector3(0, 0, 1), new Vector3(0, -1, 0), 250, target);
  camera.zoom = 2.5;
  animatePresetCameraView(controls, 'right');
  controls.update(now + 100);
  const visible = camera.quaternion.clone();
  const expected = cameraViewUp(new Vector3(0, 1, 0), visible, new Vector3(0, 0, -1));
  const previousDestination = new Quaternion().setFromRotationMatrix(
    new Matrix4().lookAt(new Vector3(1, 0, 0), new Vector3(), new Vector3(0, -1, 0)),
  );
  const stale = cameraViewUp(new Vector3(0, 1, 0), previousDestination, new Vector3(0, 0, -1));
  assert.ok(
    expected.distanceTo(stale) > 1,
    'fixture must distinguish visible pose from the previous destination',
  );
  now += 100;
  animatePresetCameraView(controls, 'top');
  assert.ok(camera.quaternion.angleTo(visible) < 1e-7);
  controls.update(now + 350);
  closeVector(camera.up, expected);
  closeVector(controls.target, target);
  assert.equal(camera.zoom, 2.5);
  setPresetCameraView(controls, 'front', 250, target);
  closeVector(camera.up, new Vector3(0, 1, 0));
  setCameraDirection(controls, new Vector3(0, 0, 1), new Vector3(0, -1, 0), 250, target);
  animatePresetCameraView(controls, 'isometric', undefined, undefined, 0);
  closeVector(camera.up, new Vector3(0, 1, 0));
  closeVector(
    camera.position.clone().sub(target).normalize(),
    new Vector3(...cameraViews[0].direction).normalize(),
  );
});

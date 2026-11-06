import assert from 'node:assert/strict';
import test from 'node:test';
import { Euler, OrthographicCamera, Quaternion, Vector3 } from 'three';
import { setCameraDirection, ViewerCameraControls } from '../src/components/viewer/camera-controls';
import { cameraViews, setPresetCameraView } from '../src/components/viewer/camera-views';
import {
  navigationCubeRegions,
  projectNavigationCube,
} from '../src/components/viewer/navigation-cube-geometry';

type Point = [number, number];
const cross = (a: Point, b: Point, c: Point) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const area = (points: Point[]) =>
  Math.abs(
    points.reduce((sum, point, i) => {
      const next = points[(i + 1) % points.length];
      return sum + point[0] * next[1] - point[1] * next[0];
    }, 0),
  ) / 2;

function containsInterior(points: Point[], point: Point): boolean {
  const sides = points.map((a, i) => cross(a, points[(i + 1) % points.length], point));
  return sides.every((side) => side > 1e-7) || sides.every((side) => side < -1e-7);
}

function hull(points: Point[]): Point[] {
  const unique = new Map<string, Point>();
  for (const point of points) {
    const rounded = point.map((value) => Math.round(value * 1e9) / 1e9) as Point;
    unique.set(rounded.join(','), rounded);
  }
  const sorted = [...unique.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (ordered: Point[]) => {
    const result: Point[] = [];
    for (const point of ordered) {
      while (result.length > 1 && cross(result.at(-2)!, result.at(-1)!, point) <= 1e-9)
        result.pop();
      result.push(point);
    }
    return result.slice(0, -1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

function projectionUp(direction: Vector3): Vector3 {
  return Math.abs(direction.y) > 0.99
    ? new Vector3(0, 0, direction.y > 0 ? -1 : 1)
    : new Vector3(0, 1, 0);
}

function orientation(direction: Vector3, up = projectionUp(direction)): Quaternion {
  const camera = new OrthographicCamera();
  camera.position.copy(direction);
  camera.up.copy(up);
  camera.lookAt(new Vector3());
  return camera.quaternion;
}

function closeVector(actual: Vector3, expected: Vector3) {
  assert.ok(actual.distanceTo(expected) < 1e-9, `${actual.toArray()} != ${expected.toArray()}`);
}

test('the navigation cube has 26 unique outward regions forming one closed picking surface', () => {
  assert.equal(navigationCubeRegions.length, 26);
  assert.deepEqual(
    ['face', 'edge', 'corner'].map(
      (kind) => navigationCubeRegions.filter((region) => region.kind === kind).length,
    ),
    [6, 12, 8],
  );
  assert.equal(new Set(navigationCubeRegions.map((region) => region.id)).size, 26);
  const edges = new Map<string, { count: number; winding: number }>();
  const key = (point: Vector3) =>
    point
      .toArray()
      .map((value) => value.toFixed(9))
      .join(',');
  for (const region of navigationCubeRegions) {
    assert.ok(Math.abs(region.direction.length() - 1) < 1e-12);
    const axes = region.direction.toArray().filter((value) => Math.abs(value) > 1e-9);
    assert.equal(axes.length, region.kind === 'face' ? 1 : region.kind === 'edge' ? 2 : 3);
    assert.ok(
      axes.every((value) => Math.abs(Math.abs(value) - 1 / Math.sqrt(axes.length)) < 1e-12),
    );
    const [a, b, c] = region.vertices;
    assert.ok(
      b.clone().sub(a).cross(c.clone().sub(a)).dot(region.direction) > 0,
      region.id + ': outward winding',
    );
    for (const [index, vertex] of region.vertices.entries()) {
      assert.ok(
        Math.abs(vertex.dot(region.direction) - a.dot(region.direction)) < 1e-12,
        region.id + ': planar region',
      );
      const first = key(vertex),
        second = key(region.vertices[(index + 1) % region.vertices.length]);
      const id = [first, second].sort().join('|');
      const edge = edges.get(id) ?? { count: 0, winding: 0 };
      edge.count++;
      edge.winding += first < second ? 1 : -1;
      edges.set(id, edge);
    }
  }
  for (const edge of edges.values()) assert.deepEqual(edge, { count: 2, winding: 0 });
  for (let i = 0; i < navigationCubeRegions.length; i++)
    for (let j = i + 1; j < navigationCubeRegions.length; j++)
      assert.ok(
        navigationCubeRegions[i].direction.distanceTo(navigationCubeRegions[j].direction) > 0.1,
      );
});

test('all six face centers select the established native-axis views with readable face labels', () => {
  const expected: Record<string, number[]> = {
    front: [0, 0, 1],
    back: [0, 0, -1],
    left: [-1, 0, 0],
    right: [1, 0, 0],
    top: [0, 1, 0],
    bottom: [0, -1, 0],
  };
  for (const [view, direction] of Object.entries(expected)) {
    const projected = projectNavigationCube(orientation(new Vector3().fromArray(direction)));
    const selected = projected.filter(({ points }) => containsInterior(points, [60, 60]));
    assert.equal(selected.length, 1);
    assert.equal(selected[0].region.view, view);
    assert.equal(selected[0].region.kind, 'face');
    assert.ok(
      !projected.some(
        ({ region }) =>
          region.kind === 'face' && region.direction.dot(new Vector3().fromArray(direction)) < 0,
      ),
    );
    const transform = selected[0].labelTransform!;
    [1, 0, 0, 1, 60, 60].forEach((value, i) =>
      assert.ok(Math.abs(transform[i] - value) < 1e-9, view + ': readable canonical label'),
    );
  }
});

test('face, edge and corner polygons cover the cube silhouette and each provide a unique center hit', () => {
  for (const region of navigationCubeRegions) {
    const quaternion = orientation(region.direction);
    const towardCamera = new Vector3(0, 0, 1).applyQuaternion(quaternion);
    const projected = projectNavigationCube(quaternion);
    const selected = projected.filter(({ points }) => containsInterior(points, [60, 60]));
    assert.equal(selected.length, 1, region.id + ': no overlapping center targets');
    assert.equal(selected[0].region.id, region.id);
    for (const [i, item] of projected.entries()) {
      assert.ok(item.region.direction.dot(towardCamera) > 0);
      assert.ok(
        item.points.every((point) =>
          point.every((value) => Number.isFinite(value) && value >= 0 && value <= 120),
        ),
      );
      assert.ok(area(item.points) > 1e-7, item.region.id + ': nondegenerate hit area');
      if (i) assert.ok(projected[i - 1].depth <= item.depth, 'far-to-near painter order');
    }
    const silhouette = hull(projected.flatMap(({ points }) => points));
    const filled = projected.reduce((sum, item) => sum + area(item.points), 0);
    assert.ok(
      Math.abs(filled - area(silhouette)) < 1e-6,
      region.id + ': closed silhouette without gaps or overlapping hit areas',
    );
  }
});

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

test('cube orientation follows actual orbit, roll and inversion while direction snaps retain pan and zoom', (context) => {
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: Object.assign(new EventTarget(), { pageXOffset: 0, pageYOffset: 0 }),
  });
  const element = new ViewerElement();
  const camera = new OrthographicCamera(-100, 100, 75, -75, 0.1, 10000);
  camera.position.set(0, 0, 400);
  const controls = new ViewerCameraControls(camera, element as unknown as HTMLElement);
  context.after(() => {
    controls.dispose();
    Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
  });
  const target = new Vector3(12, -8, 30);
  const centerFace = () =>
    projectNavigationCube(camera.quaternion).find(({ points }) =>
      containsInterior(points, [60, 60]),
    )?.region.id;
  const pointer = (type: string, x: number, y: number) => {
    const event = Object.assign(new Event(type), {
      pageX: x,
      pageY: y,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
    });
    (type === 'pointerdown' ? element : element.ownerDocument).dispatchEvent(event);
  };
  camera.zoom = 2.5;
  for (const region of navigationCubeRegions) {
    setCameraDirection(controls, region.direction, projectionUp(region.direction), 250, target);
    for (let frame = 0; frame < 30; frame++) controls.update();
    closeVector(controls.target, target);
    closeVector(camera.position, target.clone().addScaledVector(region.direction, 250));
    assert.equal(camera.zoom, 2.5);
    assert.equal(centerFace(), region.id);
  }
  setPresetCameraView(controls, 'isometric', 250, target);
  closeVector(
    camera.position.clone().sub(target).normalize(),
    new Vector3(...cameraViews[0].direction).normalize(),
  );
  setPresetCameraView(controls, 'front', 250, target);
  assert.equal(centerFace(), 'front');
  const initial = camera.quaternion.clone();
  pointer('pointerdown', 400, 300);
  pointer('pointermove', 520, 390);
  controls.update();
  pointer('pointerup', 520, 390);
  assert.ok(initial.angleTo(camera.quaternion) > 0.1);
  assert.notDeepEqual(
    projectNavigationCube(initial).map((region) => region.points),
    projectNavigationCube(camera.quaternion).map((region) => region.points),
  );
  setPresetCameraView(controls, 'front', 250, target);
  controls.invertView();
  assert.equal(centerFace(), 'back');
  controls.invertView();
  assert.equal(centerFace(), 'front');
  camera.up.set(1, 0, 0);
  controls.update();
  const rolled = projectNavigationCube(camera.quaternion).find(
    ({ region }) => region.id === 'front',
  )!.labelTransform!;
  [0, -1, 1, 0, 60, 60].forEach((value, i) => assert.ok(Math.abs(rolled[i] - value) < 1e-9));
  for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const projected = projectNavigationCube(
      new Quaternion().setFromEuler(new Euler(angle, 0.4, -0.7)),
    );
    assert.ok(projected.every(({ points }) => points.flat().every(Number.isFinite)));
    for (const item of projected.filter(({ region }) => region.kind === 'face')) {
      const [a, b, c, d] = item.labelTransform!;
      assert.ok(a * d - b * c > 0, 'visible labels retain handedness through upside-down orbit');
    }
  }
});

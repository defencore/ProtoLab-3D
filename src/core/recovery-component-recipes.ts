import { Euler, Matrix4, Vector3 } from 'three';
import type { Shape, Vec } from './assembly/recovery/shapes';
import type { AssemblyComponent, SupplyKind } from './product-types';
import { nativeThreadDepth } from './thread-native';

/** Structured authored features only; supplier CAD and executable source are never detail recipes. */
export function parseRecoveryRecipe(source: string): Shape {
  if (source.length > 4_000_000) throw new Error('Recovery detail recipe exceeds the size limit.');
  const root: unknown = JSON.parse(source);
  let nodes = 0;
  const finite = (n: unknown): n is number =>
    typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e7;
  const positive = (n: unknown): n is number => finite(n) && n > 0;
  const vector = (v: unknown, count = 3) =>
    Array.isArray(v) && v.length === count && v.every(finite);
  const points = (v: unknown) =>
    Array.isArray(v) && v.length >= 3 && v.length <= 50000 && v.every((p) => vector(p, 2));
  function check(raw: unknown, depth = 0): void {
    if (++nodes > 50000 || depth > 64) throw new Error('Recovery detail recipe is too complex.');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new Error('Invalid recovery feature.');
    const s = raw as Record<string, unknown>;
    const fail = () => {
      throw new Error('Invalid recovery feature: ' + String(s.kind));
    };
    const keys = (...allowed: string[]) => {
      if (Object.keys(s).some((k) => !['kind', ...allowed].includes(k))) fail();
    };
    function thread(t: Record<string, unknown>, extra: string[] = []) {
      if (
        Object.keys(t).some(
          (k) =>
            ![
              'kind',
              'diameter',
              'pitch',
              'length',
              'clearance',
              'internal',
              'process',
              'designation',
              ...extra,
            ].includes(k),
        ) ||
        !positive(t.diameter) ||
        !positive(t.pitch) ||
        !positive(t.length) ||
        !finite(t.clearance) ||
        typeof t.internal !== 'boolean' ||
        (t.process !== undefined && t.process !== 'printed') ||
        (t.designation !== undefined &&
          (typeof t.designation !== 'string' || t.designation.length > 512)) ||
        Number(t.length) / Number(t.pitch) > 1024
      )
        fail();
      const major = Number(t.diameter) / 2 + (t.process === 'printed' ? Number(t.clearance) : 0);
      if (major <= nativeThreadDepth(Number(t.pitch), t.internal === true)) fail();
    }
    switch (s.kind) {
      case 'box':
        keys('size', 'origin');
        if (!vector(s.size) || !(s.size as number[]).every(positive) || !vector(s.origin)) fail();
        break;
      case 'cylinder':
        keys('radius', 'height', 'origin', 'axis');
        if (
          !positive(s.radius) ||
          !positive(s.height) ||
          !vector(s.origin) ||
          !['x', 'z'].includes(String(s.axis))
        )
          fail();
        break;
      case 'cone':
        keys('bottom', 'top', 'height', 'z');
        if (
          !finite(s.bottom) ||
          Number(s.bottom) < 0 ||
          !finite(s.top) ||
          Number(s.top) < 0 ||
          Number(s.bottom) + Number(s.top) <= 0 ||
          !positive(s.height) ||
          !finite(s.z)
        )
          fail();
        break;
      case 'plate':
        keys('outline', 'holes', 'z', 'height');
        if (
          !points(s.outline) ||
          !Array.isArray(s.holes) ||
          !s.holes.every(points) ||
          !finite(s.z) ||
          !positive(s.height)
        )
          fail();
        break;
      case 'torus':
        keys('radius', 'wireRadius', 'arc');
        if (
          !positive(s.radius) ||
          !positive(s.wireRadius) ||
          Number(s.radius) <= Number(s.wireRadius) ||
          !positive(s.arc) ||
          Number(s.arc) > 360
        )
          fail();
        break;
      case 'thread':
        thread(s);
        break;
      case 'threadedPlate':
        keys('plate', 'holes');
        check(s.plate, depth + 1);
        if ((s.plate as Record<string, unknown>).kind !== 'plate' || !Array.isArray(s.holes))
          fail();
        for (const h of s.holes as Record<string, unknown>[]) {
          if (!h || typeof h !== 'object') fail();
          thread(h, ['x', 'y', 'z']);
          if (![h.x, h.y, h.z].every(finite)) fail();
        }
        break;
      case 'springBarrel':
      case 'springPlug':
        keys('travel');
        if (!positive(s.travel) || Number(s.travel) > 10000) fail();
        break;
      case 'spring':
        keys('radius', 'wire', 'height', 'turns', 'origin');
        if (
          ![s.radius, s.wire, s.height, s.turns].every(positive) ||
          Number(s.turns) > 512 ||
          !vector(s.origin)
        )
          fail();
        break;
      case 'fastener': {
        keys('parameters');
        const p = s.parameters as Record<string, unknown>;
        const numeric = [
          'diameter',
          'length',
          'shankDiameter',
          'headSize',
          'headHeight',
          'headSides',
          'flangeDiameter',
          'flangeThickness',
          'neckSize',
          'neckHeight',
          'countersinkAngle',
          'driveWidth',
          'driveThickness',
          'driveDepth',
          'driveSides',
          'pitch',
          'threadStart',
          'threadLength',
          'tipLength',
          'tipDiameter',
        ];
        const options: Record<string, string[]> = {
          head: [
            'socket-cap',
            'hex',
            'button',
            'countersunk',
            'countersunk-square',
            'pan',
            'round',
            'carriage',
            'elevator',
            'flange',
            'headless',
            'thumb',
            'fillister',
          ],
          drive: ['hex', 'slot', 'cross', 'torx', 'none', 'square'],
          threadMode: ['envelope', 'none', 'full', 'detailed'],
          threadSpan: ['full', 'partial'],
          handedness: ['right', 'left'],
          tip: ['chamfer', 'flat', 'cone', 'dog', 'cup', 'point'],
        };
        if (
          !p ||
          typeof p !== 'object' ||
          Array.isArray(p) ||
          Object.keys(p).some((k) => !numeric.includes(k) && !(k in options)) ||
          !numeric.every((k) => finite(p[k]) && Number(p[k]) >= 0) ||
          !['diameter', 'length', 'pitch'].every((k) => positive(p[k])) ||
          !Object.entries(options).every(([k, v]) => v.includes(String(p[k])))
        )
          fail();
        break;
      }
      case 'transform':
        keys('child', 'angle', 'offset');
        if (!finite(s.angle) || !vector(s.offset)) fail();
        check(s.child, depth + 1);
        break;
      case 'rotate':
        keys('child', 'angle', 'axis');
        if (!finite(s.angle) || !['x', 'y'].includes(String(s.axis))) fail();
        check(s.child, depth + 1);
        break;
      case 'fusedLayers':
        keys('children', 'planes', 'solid');
        if (
          !Array.isArray(s.children) ||
          !s.children.length ||
          !Array.isArray(s.planes) ||
          !s.planes.every(finite)
        )
          fail();
        for (const c of s.children as unknown[]) check(c, depth + 1);
        check(s.solid, depth + 1);
        break;
      case 'union':
      case 'subtract':
        keys('children');
        if (!Array.isArray(s.children) || s.children.length < (s.kind === 'union' ? 1 : 2)) fail();
        for (const c of s.children as unknown[]) check(c, depth + 1);
        break;
      default:
        throw new Error('Unsupported recovery detail feature: ' + String(s.kind));
    }
  }
  check(root);
  return root as Shape;
}

/** Installation pose is independent of the reusable local feature configuration. */
export function recoveryDetailComponent(
  id: string,
  name: string,
  shape: Shape,
  supply: SupplyKind = 'manufactured',
): AssemblyComponent {
  let local = shape;
  const pose = new Matrix4();
  while (local.kind === 'transform' || local.kind === 'rotate') {
    if (local.kind === 'transform')
      pose
        .multiply(new Matrix4().makeTranslation(...local.offset))
        .multiply(new Matrix4().makeRotationZ((local.angle * Math.PI) / 180));
    else
      pose.multiply(
        local.axis === 'x'
          ? new Matrix4().makeRotationX((local.angle * Math.PI) / 180)
          : new Matrix4().makeRotationY((local.angle * Math.PI) / 180),
      );
    local = local.child;
  }
  const recipe = JSON.stringify(local);
  parseRecoveryRecipe(recipe);
  const angles = new Euler().setFromRotationMatrix(pose, 'ZYX');
  return {
    id,
    name,
    libraryId: supply === 'manufactured' ? 'recovery-detail' : 'purchased-recovery-component',
    parameters: { recipe },
    state: 'default',
    supply,
    quantity: 1,
    placement: {
      translation: new Vector3().setFromMatrixPosition(pose).toArray() as Vec,
      rotation: [angles.x, angles.y, angles.z].map((n) => (n * 180) / Math.PI) as Vec,
    },
  };
}

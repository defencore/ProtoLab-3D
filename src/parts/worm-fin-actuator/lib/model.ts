import { Box3, Euler, Quaternion, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../../../core/types';
import type { AssemblyComponent } from '../../../core/product-types';
import {
  componentGeometry,
  componentPython,
  type ConfiguredPiece,
} from '../../../core/assembly/detail-instances';
import {
  cylinder,
  prism,
  union,
  subtract,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { detailComponent } from '../../../core/component-recipes';
import { disposeModel } from '../../../core/mechanical';
import { withGeometryMode } from '../../../core/geometry-mode';
import { screwShape } from '../../tr8-compact-actuator/lib/drive';
import bearingPart from '../../flanged-ball-bearing/part';
import ringPart from '../../retaining-ring/part';
import detailPart from '../../manufactured-detail/part';
import { layout, type Layout, type BearingSize, type Groove } from './layout';
import { finishedSector } from './gear';
import { housingShapes, housingHardware, housingLibraries } from './housing';

export const libraries: PartDefinition[] = [detailPart, bearingPart, ringPart, ...housingLibraries];
const steel = 0xa7afb7,
  bronze = 0xc3a263,
  frameColor = 0x526773;
const move = (child: Shape, translation: Vec, rotation: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation,
});
const ring = (outer: number, inner: number, z: number, depth: number) =>
  subtract(cylinder(outer, depth, [0, 0, z]), cylinder(inner, depth + 2, [0, 0, z - 1]));
const rad = (degrees: number) => (degrees * Math.PI) / 180;
const tap = (height: number, origin: Vec): Shape => ({
  kind: 'cylinder',
  radius: 1.5,
  height,
  origin,
  axis: 'z',
  thread: { pitch: 0.5, internal: true, radialClearance: 0.04 },
});
const ringGroove = (g: Groove, radius: number, axis: 'z' | 'x' = 'z', y = 0): Shape =>
  subtract(
    cylinder(
      radius + 1,
      g.width,
      axis === 'z' ? [0, 0, g.center - g.width / 2] : [g.center - g.width / 2, y, 0],
      axis,
    ),
    cylinder(
      g.diameter / 2,
      g.width + 0.2,
      axis === 'z' ? [0, 0, g.center - g.width / 2 - 0.1] : [g.center - g.width / 2 - 0.1, y, 0],
      axis,
    ),
  );
function made(id: string, label: string, shape: Shape, color = steel): ConfiguredPiece {
  const component = detailComponent(id, label, shape, { edgeTolerance: 1e-6 });
  component.manufacturing = {
    material:
      color === bronze
        ? 'Gear bronze or selected gear steel'
        : color === frameColor
          ? 'Aluminium alloy'
          : 'Steel',
    blank: 'Stock sized to the configured drawing',
    processes: ['turning', 'milling', 'drilling'],
    requirements: [
      'Specify fits, runout, finish and material on the configured component drawing.',
    ],
  };
  return { component, label, color, requireSingleSolid: true };
}
function configured(
  part: PartDefinition,
  id: string,
  name: string,
  parameters: Parameters,
  translation: Vec,
  rotation: Vec = [0, 0, 0],
): ConfiguredPiece {
  return {
    component: {
      id,
      libraryId: part.id,
      name,
      parameters,
      state: part.states?.[0]?.id ?? 'default',
      quantity: 1,
      supply: part.product.supply,
      placement: { translation, rotation },
    },
    label: name,
    color: steel,
    preserveLibraryAppearance: true,
  };
}
function bearing(id: string, size: BearingSize, position: Vec, rotation: Vec = [0, 0, 0]) {
  const item = configured(
    bearingPart,
    id,
    `${size.id} · ${size.bore}×${size.outer}×${size.width}`,
    {
      bore: size.bore,
      outer: size.outer,
      width: size.width,
      flangeOuter: size.flangeOuter,
      flangeWidth: size.flangeWidth,
      seals: 'metal',
      balls: 8,
    },
    position,
    rotation,
  );
  item.component.procurement = {
    designation: size.id,
    manufacturer: 'Select matching bearing supplier',
    source: size.source,
  };
  return item;
}
function clip(id: string, groove: Groove, position: Vec, rotation: Vec = [0, 0, 0]) {
  const presetId =
    groove.ring === 5
      ? 'gvyntok-c7a656a5a8c7'
      : groove.ring === 8
        ? 'gvyntok-03f63128a6a2'
        : 'gvyntok-f69d9cca5668';
  const preset = ringPart.presets.find((p) => p.id === presetId)!;
  const item = configured(
    ringPart,
    id,
    `DIN 471 · Ø${groove.ring} retaining ring`,
    { ...preset.parameters, boreEnvelope: groove.diameter },
    position,
    rotation,
  );
  item.component.presetId = preset.id;
  item.component.procurement = {
    designation: `DIN 471-${groove.ring}`,
    manufacturer: 'Standard hardware',
    source: preset.catalog!.sourceUrl,
  };
  return item;
}
function sleeve(v: Layout): Shape {
  return subtract(
    union(
      cylinder(4, v.landBottom - v.sleeveBottom + 0.05, [0, 0, v.sleeveBottom]),
      cylinder(5, v.gearBottom - v.landBottom + 0.05, [0, 0, v.landBottom]),
      prism(
        [
          [-5, -4.75],
          [-4.75, -5],
          [4.75, -5],
          [5, -4.75],
          [5, 4.75],
          [4.75, 5],
          [-4.75, 5],
          [-5, 4.75],
        ],
        v.plateThickness + 0.05,
        v.gearBottom,
      ),
      cylinder(v.front.bore / 2, v.sleeveHeadBottom - v.gearTop + 0.05, [0, 0, v.gearTop]),
      cylinder(v.sleeveHeadRadius, v.sleeveHeadThickness, [0, 0, v.sleeveHeadBottom]),
    ),
    cylinder(1.6, v.sleeveHeadTop - v.sleeveBottom + 2, [0, 0, v.sleeveBottom - 1]),
    ringGroove(v.gearClip, 5),
    ringGroove(v.rearClip, 4),
    ...[-1, 1].map((s) => tap(6, [(s * v.mountHoleSpacing) / 2, 0, v.sleeveHeadTop - 5.9])),
  );
}
function rotateWorm(c: AssemblyComponent, v: Layout): AssemblyComponent {
  const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), rad(v.wormAngle)),
    center = new Vector3(0, v.centerDistance, 0);
  const t = new Vector3(...c.placement.translation)
    .sub(center)
    .applyQuaternion(q)
    .add(center)
    .toArray() as Vec;
  const previous = new Quaternion().setFromEuler(
    new Euler(...(c.placement.rotation.map(rad) as Vec), 'ZYX'),
  );
  const e = new Euler().setFromQuaternion(q.multiply(previous), 'ZYX');
  return {
    ...c,
    placement: { translation: t, rotation: [e.x, e.y, e.z].map((a) => (a * 180) / Math.PI) as Vec },
  };
}
function measuredThread(shape: Shape, v: Layout): Shape {
  if (shape.kind === 'transform') return { ...shape, child: measuredThread(shape.child, v) };
  if (shape.kind === 'union' || shape.kind === 'subtract' || shape.kind === 'intersect')
    return { ...shape, children: shape.children.map((s) => measuredThread(s, v)) };
  if (shape.kind !== 'helical-worm') return shape;
  const root = v.rootDiameter / 2,
    tip = 4,
    tangent = Math.tan(Math.PI / 12);
  const halfRoot = 0.5 - (root - 3.5) * tangent,
    halfTip = 0.5 - (tip - 3.5) * tangent;
  const rootAngle = (2 * Math.PI * halfRoot) / 8,
    tipAngle = (2 * Math.PI * halfTip) / 8;
  const outline: [number, number][] = [];
  const point = (r: number, a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)];
  for (let start = 0; start < 4; start++) {
    const center = (start * Math.PI) / 2;
    for (let i = 0; i <= 4; i++)
      outline.push(
        point(root + ((tip - root) * i) / 4, center - rootAngle + ((rootAngle - tipAngle) * i) / 4),
      );
    for (let i = 1; i <= 8; i++)
      outline.push(point(tip, center - tipAngle + (2 * tipAngle * i) / 8));
    for (let i = 1; i <= 4; i++)
      outline.push(
        point(tip - ((tip - root) * i) / 4, center + tipAngle + ((rootAngle - tipAngle) * i) / 4),
      );
    const next = ((start + 1) * Math.PI) / 2 - rootAngle;
    for (let i = 1; i < 8; i++)
      outline.push(point(root, center + rootAngle + ((next - center - rootAngle) * i) / 8));
  }
  return {
    ...shape,
    root,
    grooveRoot: 1 - halfRoot,
    grooveTip: 1 - halfTip + shape.radialExtra * tangent,
    rings: shape.rings.map((old) => {
      const z = old[0][2],
        a = shape.phase + (2 * Math.PI * z) / 8;
      return outline.map(([x, y]): Vec => [
        x * Math.cos(a) - y * Math.sin(a),
        x * Math.sin(a) + y * Math.cos(a),
        z,
      ]);
    }),
  };
}
export function pieces(p: Parameters, state = 'assembled'): ConfiguredPiece[] {
  const v = layout(p, state);
  const housing = housingShapes(p);
  const worm = withGeometryMode('full', () =>
    screwShape({
      threadStartX: -v.threadHalf,
      threadEndX: v.threadHalf,
      screwAxisZ: 0,
      journals: v.screwStations
        .filter((s) => s.diameter < 8)
        .map((s) => ({ from: s.from, to: s.to, diameter: s.diameter })),
      grooves: v.wormGrooves.map((g) => ({
        from: g.center - g.width / 2,
        to: g.center + g.width / 2,
        rootDiameter: g.diameter,
      })),
      angleDeg: 0,
    }),
  );
  const out: ConfiguredPiece[] = [
    made('housing-base', 'Split housing · base · CNC or 3D print', housing.base, frameColor),
    made('housing-lid', 'Split housing · lid · CNC or 3D print', housing.lid, frameColor),
    made('output-sleeve', 'Turned stepped output sleeve · square 10 mm AF', sleeve(v)),
    made(
      'sector-wheel',
      `${v.teeth}T equivalent · 3D tooth-finished laser sector`,
      finishedSector(p),
      bronze,
    ),
    made(
      'worm',
      'Tr8x8(P2) RH · four starts · turned Ø5 journals',
      move(measuredThread(worm, v), [0, v.centerDistance, 0]),
    ),
    bearing('front-bearing', v.front, [0, 0, (v.frontBottom + v.frontTop) / 2]),
    bearing('inner-bearing', v.inner, [0, 0, (v.innerBottom + v.innerTop) / 2], [180, 0, 0]),
    made(
      'front-thrust-shim',
      'Selected outer bearing thrust shim · 0.15',
      ring(v.sleeveHeadRadius, v.front.bore / 2 + 0.03, v.frontTop, v.thrustShims.front),
    ),
    made(
      'gear-thrust-washer',
      'Selected gear thrust shim · 10.1×16×0.65',
      ring(8, 5.05, v.gearWasherBottom, v.thrustShims.gear),
    ),
    clip('gear-clip', v.gearClip, [0, 0, v.gearClip.center]),
    made(
      'rear-thrust-washer',
      'Selected inner bearing thrust shim · 8.1×10.4×0.65',
      ring(5.2, 4.05, v.rearWasherBottom, v.thrustShims.rear),
    ),
    clip('rear-clip', v.rearClip, [0, 0, v.rearClip.center]),
    ...housingHardware(p),
  ];
  for (const side of [-1, 1]) {
    const name = side < 0 ? 'left' : 'right';
    out.push(
      bearing(
        `worm-bearing-${name}`,
        v.wormBearing,
        [side * (v.wormBearingStart + v.wormBearing.width / 2), v.centerDistance, 0],
        [0, side * 90, 0],
      ),
    );
    for (const [kind, position] of [
      ['inner', v.wormInnerClip],
      ['outer', v.wormOuterClip],
    ] as const) {
      const g: Groove = { center: side * position, width: 0.7, diameter: 4.8, ring: 5 };
      out.push(
        clip(`worm-${kind}-clip-${name}`, g, [side * position, v.centerDistance, 0], [0, 90, 0]),
      );
      const from = kind === 'inner' ? v.wormInnerClip + 0.3 : v.wormBearingEnd;
      out.push(
        made(
          `worm-${kind}-washer-${name}`,
          `${name} ${kind} worm thrust spacer`,
          move(
            ring(3.8, 2.525, 0, v.thrustShims.worm),
            [side < 0 ? -from - v.thrustShims.worm : from, v.centerDistance, 0],
            [0, 90, 0],
          ),
        ),
      );
    }
  }
  const rotating = new Set([
    'output-sleeve',
    'front-thrust-shim',
    'sector-wheel',
    'gear-thrust-washer',
    'gear-clip',
    'rear-thrust-washer',
    'rear-clip',
  ]);
  out.find((i) => i.component.id === 'sector-wheel')!.component.manufacturing = {
    material: 'Gear steel sheet, grade selected for the tooth finishing process',
    blank: `${v.plateThickness} mm laser-cut sector blank`,
    processes: ['cutting', 'milling'],
    requirements: [
      'Laser-cut the supplied 1:1 blank and square opening; retain the flank machining allowance.',
      'Finish the helical/enveloping flanks to the supplied 3D surface; the flat blank is not a finished transmission.',
      'Deburr and check tooth contact, backlash and the square seat with the actual machined sleeve.',
    ],
  };
  out.find((i) => i.component.id === 'worm')!.component.manufacturing = {
    material: 'Purchased steel Tr8x8(P2) right-hand four-start threaded stock',
    blank: `Tr8x8(P2) blank longer than ${v.driveEnd + v.wormEnd} mm to allow facing`,
    processes: ['turning'],
    requirements: [
      'Measure the actual thread root and indicate the thread axis before turning.',
      'Turn both Ø5 bearing journals, the Ø4 coupling stub and four Ø4.8 × 0.7 DIN471 grooves to the supplied station drawing.',
      'Specify bearing fits, coaxiality and finish; threaded-stock crests are not bearing shoulders.',
    ],
  };
  for (const item of out) {
    if (rotating.has(item.component.id)) item.angle = v.angle;
    if (
      item.component.id === 'worm' ||
      item.component.id.startsWith('worm-inner-') ||
      item.component.id.startsWith('worm-outer-')
    )
      item.component = rotateWorm(item.component, v);
  }
  for (const item of out.filter((i) => i.component.id.startsWith('housing-'))) {
    item.component.manufacturing = {
      material: 'Aluminium alloy for milling, or a selected engineering polymer for 3D printing',
      blank: 'Two separate rounded housing halves, split at the worm axis',
      processes: ['milling', 'drilling', 'printing'],
      requirements: [
        'Alternative routes: mill each half from both Z faces, or print exterior face down and open mating face up.',
        'Ball-end/form-finish the open worm trough and split bearing seats; finish bearing bores to the selected fit.',
        'Four flush M3 screws and captive hex nuts join the case. Bearing retention uses opposed flanges, shaft shoulders and circlips.',
        'R1.5 captive nut pocket corners permit a Ø3 finishing end mill; use the solid model for the exterior and bearing steps.',
      ],
    };
  }
  if (state === 'internals') return out.filter((i) => !/^(housing-|case-)/.test(i.component.id));
  if (state === 'sector') return out.filter((i) => i.component.id === 'sector-wheel');
  if (state === 'sleeve') return out.filter((i) => i.component.id === 'output-sleeve');
  if (state === 'housing-base' || state === 'housing-lid')
    return out.filter((i) => i.component.id === state);
  if (state === 'housing-open')
    for (const item of out)
      if (item.component.id === 'housing-lid' || item.component.id.startsWith('case-screw-'))
        item.position = [0, 0, 22];
  if (state === 'exploded')
    for (const item of out) {
      const id = item.component.id;
      if (id === 'housing-base' || id.startsWith('case-nut-')) item.position = [0, 0, -24];
      else if (id === 'housing-lid' || id.startsWith('case-screw-')) item.position = [0, 0, 30];
      else if (id === 'front-bearing' || id === 'front-thrust-shim') item.position = [0, 0, 10];
      else if (id === 'output-sleeve') item.position = [0, 0, 17];
      else if (id === 'inner-bearing') item.position = [0, 0, -12];
      else if (id.startsWith('rear-')) item.position = [0, 0, -18];
      else if (id.startsWith('worm')) item.position = [0, 15, 0];
    }
  return out;
}

export const geometry = (p: Parameters, state: string) =>
  componentGeometry(libraries, pieces(p, state));
export const python = (p: Parameters, state: string) =>
  componentPython(libraries, pieces(p, state));
export function dimensions(p: Parameters, state: string): Vec {
  const model = geometry(p, state);
  try {
    return new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() as Vec;
  } finally {
    disposeModel(model);
  }
}

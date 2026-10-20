import { Group, Box3, Mesh, Vector3 } from 'three';
import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {
  component,
  cylinder,
  pythonShape,
  rotate,
  subtract,
  transform,
  type Shape,
} from '../../core/assembly/recovery/shapes';
import native from '../../core/assembly/recovery/st3215-native.json';
import { disposeModel } from '../../core/mechanical';
import profile from './product.json';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
export type ServoHornMount = 'original' | 'rocker-m3';
const discHoleCenters = [
  [7, 0],
  [0, 7],
  [-7, 0],
  [0, -7],
] as const;

/** Custom installation modifies only the supplied discs, not the servo housing. */
export function servoCadShape(index: number, hornMount: ServoHornMount = 'original'): Shape {
  if (!Number.isInteger(index) || index < 0 || index >= native.components.length)
    throw new Error('Invalid supplier servo component.');
  if (hornMount !== 'original' && hornMount !== 'rocker-m3')
    throw new Error('Invalid servo disc installation.');
  const source: Shape = { kind: 'native', index };
  if (hornMount === 'original') return source;
  if (index === 6)
    return subtract(source, ...discHoleCenters.map(([x, y]) => cylinder(1.5, 6, [x, y, 28.5])));
  if (index === 7)
    return transform(
      rotate(
        subtract(source, ...discHoleCenters.map(([x, y]) => cylinder(1.6, 6, [x, y, -5]))),
        180,
        'x',
      ),
      0,
      [0, 0, 40.35],
    );
  return source;
}

function servoCadLabel(index: number, hornMount: ServoHornMount) {
  if (hornMount === 'rocker-m3' && index === 6)
    return 'Lower output disc · four tapped M3 × 0.5 holes (nominal envelope)';
  if (hornMount === 'rocker-m3' && index === 7)
    return 'Relocated upper pressure disc · four drilled Ø3.2 mm holes';
  return native.components[index].label;
}

export function servoCadGeometry(index: number, hornMount: ServoHornMount = 'original') {
  servoCadShape(index, hornMount);
  const item = native.components[index];
  const root = component(
    { kind: 'native', index },
    servoCadLabel(index, hornMount),
    Number.parseInt(item.color.slice(1), 16),
  );
  if (hornMount !== 'rocker-m3' || (index !== 6 && index !== 7)) return root;
  const radius = index === 6 ? 1.5 : 1.6;
  const changed = discHoleCenters.map(() => 0);
  // Preserve the source's closed topology while widening its cylindrical holes.
  // Meshed Boolean subtraction creates sub-micron slivers in the upper disc.
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const positions = object.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        y = positions.getY(i);
      for (let hole = 0; hole < discHoleCenters.length; hole++) {
        const [cx, cy] = discHoleCenters[hole];
        const distance = Math.hypot(x - cx, y - cy);
        if (Math.abs(distance - 1.25) > 1e-5) continue;
        positions.setXY(
          i,
          cx + ((x - cx) * radius) / distance,
          cy + ((y - cy) * radius) / distance,
        );
        changed[hole]++;
      }
    }
    positions.needsUpdate = true;
    object.geometry.computeVertexNormals();
    object.geometry.computeBoundingBox();
    object.geometry.computeBoundingSphere();
  });
  if (changed.some((count) => count !== 168)) {
    disposeModel(root);
    throw new Error('Supplier disc hole topology changed; revalidate the M3 installation.');
  }
  if (index === 7) {
    root.rotation.x = Math.PI;
    root.position.z = 40.35;
  }
  return root;
}
export const servoCadShapePython = (index: number, hornMount: ServoHornMount = 'original') =>
  pythonShape(servoCadShape(index, hornMount));
export const servoCadPython = [
  'import base64,zlib',
  '_release_native_data=' + JSON.stringify(native.components.map((c) => c.brep)),
  'def _release_native(index):',
  '    s=Part.Shape()',
  '    s.importBrepFromString(zlib.decompress(base64.b64decode(_release_native_data[index])).decode())',
  '    return s',
  'def _release_rotate(shape,angle,axis):',
  '    shape.rotate(App.Vector(),App.Vector(1,0,0) if axis=="x" else App.Vector(0,1,0),angle)',
  '    return shape',
  'def _release_place(shape,angle,offset):',
  '    shape.rotate(App.Vector(),App.Vector(0,0,1),angle)',
  '    shape.translate(App.Vector(*offset))',
  '    return shape',
];
const indices = (p: Parameters) => [0, 1, 2, 3, 4, 5, ...(p.showHorn ? [6, 7] : []), 8];
const part: PartDefinition = {
  id: 'bus-servo',
  product: profile as ProductProfile,
  name: 'Waveshare ST3215 bus servo',
  category: 'MOTORS & ACTUATORS',
  subgroup: 'SERVOS',
  icon: 'gear',
  complexity: 'Supplier CAD assembly',
  description: 'ST3215 12 V bus servo with native supplier case, gears, spline and output screw.',
  keywords: ['Waveshare', 'ST3215', 'bus', 'servo', 'supplier CAD'],
  defaults,
  parameters,
  presets: presets as Preset[],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description:
        'One complete supplier servo. The custom M3 installation reworks the supplied discs around an 8 mm printed rocker stack; the housing remains unchanged.',
    },
  ],
  validate(p, s) {
    return p.model !== 'st3215-12v' ||
      s !== 'assembled' ||
      !Number.isFinite(+p.outputAngle) ||
      Math.abs(+p.outputAngle) > 180 ||
      typeof p.showHorn !== 'boolean' ||
      (p.hornMount !== 'original' && p.hornMount !== 'rocker-m3')
      ? ['Select a valid ST3215 supplier configuration.']
      : [];
  },
  buildGeometry(p) {
    return new Group().add(
      ...indices(p).map((index) => {
        const placed = new Group().add(servoCadGeometry(index, p.hornMount as ServoHornMount));
        placed.rotation.z = ((index >= 5 ? +p.outputAngle : 0) * Math.PI) / 180;
        placed.name = servoCadLabel(index, p.hornMount as ServoHornMount);
        return placed;
      }),
    );
  },
  python(p) {
    return [
      ...servoCadPython,
      'components=[]',
      ...indices(p).flatMap((index) => [
        'component=' + servoCadShapePython(index, p.hornMount as ServoHornMount),
        ...(index >= 5
          ? ['component.rotate(App.Vector(),App.Vector(0,0,1),' + p.outputAngle + ')']
          : []),
        'components.append(component)',
      ]),
      'shape=Part.makeCompound(components)',
      'component_labels=' +
        JSON.stringify(
          indices(p).map((index) => servoCadLabel(index, p.hornMount as ServoHornMount)),
        ),
    ].join('\n');
  },
  dimensions(p) {
    const root = part.buildGeometry(p, 'assembled');
    root.updateMatrixWorld(true);
    try {
      return new Box3().setFromObject(root, true).getSize(new Vector3()).toArray() as [
        number,
        number,
        number,
      ];
    } finally {
      disposeModel(root);
    }
  },
  notes:
    'Original disc installation preserves the native supplier STEP geometry. The custom M3 installation requires tapping the lower disc perimeter holes M3 × 0.5 and drilling the relocated, inverted upper disc holes Ø3.2 mm for an 8 mm printed rocker stack. Tapped holes use smooth nominal Ø3 mm major-diameter envelopes without helical threads; these are custom machining instructions, not verified original disc threads. All housing, gears, spline and retaining-screw solids remain unchanged. The rear-cover annular topology repair and unverified nominal output-retaining thread remain source limitations. Measure the delivered discs and retaining hardware before machining; installation geometry does not establish mechanism load capacity.',
  sources: [
    {
      label: 'Waveshare ST3215 supplier documentation and CAD',
      url: 'https://www.waveshare.com/wiki/ST3215_Servo',
    },
  ],
};
export default part;

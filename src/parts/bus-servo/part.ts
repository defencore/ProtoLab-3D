import { Group, Box3, Vector3 } from 'three';
import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { component, transform } from '../../core/assembly/recovery/shapes';
import native from '../../core/assembly/recovery/st3215-native.json';
import { disposeModel } from '../../core/mechanical';
import profile from './product.json';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
export function servoCadGeometry(index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= native.components.length)
    throw new Error('Invalid supplier servo component.');
  const item = native.components[index];
  return component({ kind: 'native', index }, item.label, Number.parseInt(item.color.slice(1), 16));
}
export const servoCadPython = [
  'import base64,zlib',
  '_release_native_data=' + JSON.stringify(native.components.map((c) => c.brep)),
  'def _release_native(index):',
  '    s=Part.Shape()',
  '    s.importBrepFromString(zlib.decompress(base64.b64decode(_release_native_data[index])).decode())',
  '    return s',
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
        'One complete supplier servo. Optional horn visibility changes installation inspection.',
    },
  ],
  validate(p, s) {
    return p.model !== 'st3215-12v' ||
      s !== 'assembled' ||
      !Number.isFinite(+p.outputAngle) ||
      Math.abs(+p.outputAngle) > 180 ||
      typeof p.showHorn !== 'boolean'
      ? ['Select a valid ST3215 supplier configuration.']
      : [];
  },
  buildGeometry(p) {
    return new Group().add(
      ...indices(p).map((index) => {
        const item = native.components[index];
        return component(
          transform({ kind: 'native', index }, index >= 5 ? +p.outputAngle : 0),
          item.label,
          Number.parseInt(item.color.slice(1), 16),
        );
      }),
    );
  },
  python(p) {
    return [
      ...servoCadPython,
      'components=[]',
      ...indices(p).flatMap((index) => [
        'component=_release_native(' + index + ')',
        ...(index >= 5
          ? ['component.rotate(App.Vector(),App.Vector(0,0,1),' + p.outputAngle + ')']
          : []),
        'components.append(component)',
      ]),
      'shape=Part.makeCompound(components)',
      'component_labels=' +
        JSON.stringify(indices(p).map((index) => native.components[index].label)),
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
    'Native supplier STEP geometry. The existing rear-cover annular topology repair and unverified nominal output-retaining thread remain documented source limitations in both modes; Full does not invent a pitch or profile absent from the supplier CAD. Verify the delivered 12 V variant and retaining hardware. Installation geometry does not establish mechanism load capacity.',
  sources: [
    {
      label: 'Waveshare ST3215 supplier documentation and CAD',
      url: 'https://www.waveshare.com/wiki/ST3215_Servo',
    },
  ],
};
export default part;

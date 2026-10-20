import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { box, cylinder, subtract, union } from '../../core/assembly/mechanical/shapes';
import { geometry, python, type Piece } from '../../core/assembly/mechanical/assembly';
import models from './lib/models.json';
import profile from './product.json';
import presets from './presets.json';
import { defaults, parameters } from './configurator';
export function coolingSpec(p: Parameters | string) {
  const id = typeof p === 'string' ? p : p.model;
  const model = models.find((m) => m.id === id);
  if (!model) throw new Error('Select a published cooling equipment model.');
  return model;
}
export function coolingPieces(p: Parameters): Piece[] {
  const m = coolingSpec(p);
  if (m.id === 'teyu-cw5000-tity') {
    const out: Piece[] = [
      {
        label: 'CW-5000TITY purchased case: source overall envelope, reconstructed contours',
        color: 0xc3d5df,
        shape: subtract(
          box([m.width, m.length - 20, m.height - 35], [-m.width / 2, -(m.length - 20) / 2, 10]),
          ...Array.from({ length: 15 }, (_, i) =>
            box([3, 180, 3], [-m.width / 2 - 1, -90, 90 + i * 16]),
          ),
        ),
      },
      {
        label: 'Active chiller temperature display: illustrative mounting position',
        color: 0x263b45,
        shape: box([70, 1, 32], [-100, (m.length - 20) / 2 - 1, 330]),
      },
      {
        label: 'Carry handle: reconstructed external contour',
        color: 0x333d45,
        shape: subtract(
          box([110, 20, 25], [-55, -10, m.height - 25]),
          box([85, 22, 18], [-42.5, -11, m.height - 25]),
        ),
      },
    ];
    for (const x of [-120, 120])
      for (const y of [-260, 260])
        out.push({
          label: 'Purchased chiller foot: illustrative contour and position',
          color: 0x313840,
          shape: cylinder(12, 10, [x, y, 0]),
        });
    for (const x of [-35, 35])
      out.push({
        label: 'Source 10 mm fast connector: nominal external installation proxy',
        color: 0xaab6bd,
        shape: subtract(
          cylinder(5, 20, [x, -m.length / 2 - 10, 110], 'y'),
          cylinder(3, 22, [x, -m.length / 2 - 11, 110], 'y'),
        ),
      });
    return out;
  }
  if (m.id === 'vertex-vwp81-150k')
    return [
      {
        label: 'Purchased coolant kit: published tank envelope',
        color: 0x648273,
        shape: box([250, 350, 185], [-125, -175, 0]),
      },
      {
        label: 'Purchased pump head: illustrative installation reservation',
        color: 0x425659,
        shape: union(cylinder(55, 150, [0, 45, 185]), box([120, 120, 50], [-60, -15, 335])),
      },
    ];
  const vents = Array.from({ length: 12 }, (_, i) => box([2.5, 130, 3], [-136, -65, 80 + i * 14]));
  const out: Piece[] = [
    {
      label: 'CW3000 purchased case: external reference contours',
      color: 0xb5d6e5,
      shape: subtract(box([270, 470, 345], [-135, -235, 10]), ...vents),
    },
    {
      label: 'Temperature display: illustrative position',
      color: 0x263b45,
      shape: box([65, 1, 24], [-95, 234, 260]),
    },
    {
      label: 'Carry handle: illustrative contour',
      color: 0x333d45,
      shape: subtract(box([110, 20, 25], [-55, -10, 355]), box([85, 22, 18], [-42.5, -11, 355])),
    },
  ];
  for (const x of [-110, 110])
    for (const y of [-225, 225])
      out.push({
        label: 'Purchased anti-vibration foot',
        color: 0x313840,
        shape: cylinder(12, 10, [x, y, 0]),
      });
  for (const x of [-35, 35])
    out.push({
      label: 'Water port OD10: illustrative position',
      color: 0xb19b63,
      shape: subtract(cylinder(5, 20, [x, -255, 90], 'y'), cylinder(3, 22, [x, -256, 90], 'y')),
    });
  return out;
}
const part: PartDefinition = {
  id: 'cnc-process-accessory',
  name: 'Spindle coolers and cutting coolant kits',
  product: profile as ProductProfile,
  category: 'WORKSHOP TOOLS',
  subgroup: 'COOLING & COOLANT',
  icon: 'box',
  complexity: 'Purchased equipment',
  description:
    'Separate purchased spindle-water and cutting-coolant circuits with procurement sources and explicit dimensional evidence.',
  keywords: ['CNC', 'coolant', 'chiller', 'pump', 'metal', 'CW3000', 'CW5000', 'Vertex'],
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelectionOnly: true,
  catalogFilterFields: [
    {
      key: 'temperatureStabilityC',
      label: 'Temperature stability +/-',
      type: 'number',
      unit: 'C',
      group: 'Published ratings',
    },
    { key: 'massKg', label: 'Net mass', type: 'number', unit: 'kg', group: 'Published ratings' },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', group: 'Dimensions' },
    { key: 'height', label: 'Height', type: 'number', unit: 'mm', group: 'Dimensions' },
    {
      key: 'activeCooling',
      label: 'Active compressor cooling',
      type: 'boolean',
      group: 'Published ratings',
      catalogSummary: true,
    },
    {
      key: 'nominalCoolingWatts',
      label: 'Nominal cooling capacity',
      type: 'number',
      unit: 'W',
      group: 'Published ratings',
      catalogSummary: true,
    },
    {
      key: 'ratedFlowLitersPerMinute',
      label: 'Rated pump flow',
      type: 'number',
      unit: 'L/min',
      group: 'Published ratings',
    },
    {
      key: 'pumpMaxPressureBar',
      label: 'Maximum pump pressure',
      type: 'number',
      unit: 'bar',
      group: 'Published ratings',
    },
    {
      key: 'width',
      label: 'Width',
      type: 'number',
      unit: 'mm',
      min: 0,
      max: 1000,
      step: 1,
      group: 'Dimensions',
      catalogSummary: true,
    },
  ],
  catalogSelection: [{ key: 'model' }],
  presetMatchKeys: ['model'],
  validate: (p) =>
    models.some((m) => m.id === p.model) ? [] : ['Select a published cooling equipment model.'],
  buildGeometry: (p) => geometry(coolingPieces(p)),
  dimensions: (p) => {
    const m = coolingSpec(p);
    return [m.width, m.length, m.height];
  },
  python: (p) =>
    python(coolingPieces(p)) +
    `\ncomponent_manufactured = [False]*${coolingPieces(p).length}\ncomponent_metadata = [${JSON.stringify({ Procurement: 'BUY_STANDARD', GeometryEvidence: coolingSpec(p).evidence })}]*${coolingPieces(p).length}`,
  assessment: (p) => [coolingSpec(p).spec, coolingSpec(p).evidence],
  notes:
    'Purchased installations, not drawings for making the pump or cooler. The coolant pump reservation has unverified head dimensions; hoses, cable bends and service ventilation require layout allowance.',
  sources: models.map((m) => ({ label: m.name, url: m.source })),
};
export default part;

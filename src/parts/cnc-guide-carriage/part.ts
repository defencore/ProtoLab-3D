import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { box, cylinder, subtract, type Shape } from '../../core/assembly/boundary/shapes';
import { geometry, python, dimensions, type Piece } from '../../core/assembly/boundary/assembly';
import { boundaryThreadCallouts } from '../../core/assembly/boundary/shapes';
import { threadMetadata } from '../../core/thread-callouts';
import product from './product.json';
import presets from './presets.json';
export const HGH20CA = {
  length: 77.5,
  bodyLength: 50.5,
  width: 44,
  bottom: 4.6,
  top: 30,
  mountPitchX: 36,
  mountPitchY: 32,
  mountDiameter: 5,
  mountDepth: 6,
  railWidth: 20,
  railHeight: 17.5,
} as const;
export function carriageParameters(threadFitAllowance = 0): Parameters {
  return { model: 'hgh20ca', threadFitAllowance };
}
export function carriageMountingHoles(): [number, number, number][] {
  return [-1, 1].flatMap((x) =>
    [-1, 1].map((y) => [x * 18, y * 16, 30] as [number, number, number]),
  );
}
function pieces(p: Parameters, state: string): Piece[] {
  const v = HGH20CA,
    gap = 0.15;
  const channel = box(
    [v.length + 2, v.railWidth + 2 * gap, v.railHeight + gap + 1],
    [-v.length / 2 - 1, -v.railWidth / 2 - gap, -1],
  );
  const holes: Shape[] = carriageMountingHoles().map(([x, y, z]) => ({
    kind: 'cylinder',
    radius: 2.5,
    height: 6,
    origin: [x, y, z - 6],
    axis: 'z',
    thread: {
      pitch: 0.8,
      internal: true,
      designation: 'M5',
      radialClearance: Number(p.threadFitAllowance),
    },
  }));
  let body = subtract(
    box([v.bodyLength, v.width, v.top - v.bottom], [-v.bodyLength / 2, -v.width / 2, v.bottom]),
    channel,
    ...holes,
  );
  if (state === 'cutaway')
    body = subtract(body, box([v.length + 2, 25, 31], [-v.length / 2 - 1, 0, 0]));
  const result: Piece[] = [{ label: 'HGH20CA steel carriage body', color: 0xa4aaae, shape: body }];
  const coverLength = (v.length - v.bodyLength) / 2;
  for (const side of [-1, 1])
    result.push({
      label: `HGH20CA ${side < 0 ? 'left' : 'right'} end cover`,
      color: 0x248865,
      shape: subtract(
        box(
          [coverLength, v.width, v.top - v.bottom],
          [side < 0 ? -v.length / 2 : v.bodyLength / 2, -v.width / 2, v.bottom],
        ),
        channel,
      ),
    });
  return result;
}
const part: PartDefinition = {
  id: 'cnc-guide-carriage',
  name: 'Profile guide carriage',
  product: product as ProductProfile,
  category: 'LINEAR MOTION',
  subgroup: 'PROFILE RAILS',
  icon: 'rail',
  complexity: 'Fixed HGH20CA source interfaces',
  description:
    'One purchased HGH20CA carriage with its actual mounting pattern, source height datum and visible end covers.',
  keywords: ['CNC', 'HGH20CA', 'HIWIN', 'HGR20', 'carriage', 'guide block'],
  defaults: carriageParameters(),
  catalogFilterFields: [
    {
      key: 'length',
      label: 'Source overall length',
      type: 'number',
      group: 'Source dimensions',
      unit: 'mm',
      catalogSummary: true,
    },
    {
      key: 'width',
      label: 'Carriage width',
      type: 'number',
      group: 'Source dimensions',
      unit: 'mm',
      catalogSummary: true,
    },
    {
      key: 'height',
      label: 'Height from rail mounting base',
      type: 'number',
      group: 'Source dimensions',
      unit: 'mm',
      catalogSummary: true,
    },
    {
      key: 'bodyLength',
      label: 'Steel body length',
      type: 'number',
      group: 'Source dimensions',
      unit: 'mm',
    },
    {
      key: 'baseClearance',
      label: 'Carriage bottom from rail mounting base',
      type: 'number',
      group: 'Source dimensions',
      unit: 'mm',
    },
    {
      key: 'mountPitchX',
      label: 'Mounting pitch along rail',
      type: 'number',
      group: 'Source dimensions',
      unit: 'mm',
    },
    {
      key: 'mountPitchY',
      label: 'Mounting pitch across rail',
      type: 'number',
      group: 'Source dimensions',
      unit: 'mm',
    },
    {
      key: 'mountDiameter',
      label: 'Top thread nominal diameter',
      type: 'number',
      group: 'Source dimensions',
      unit: 'mm',
    },
    {
      key: 'mountDepth',
      label: 'Top thread depth',
      type: 'number',
      group: 'Source dimensions',
      unit: 'mm',
    },
  ],
  parameters: [
    {
      key: 'model',
      label: 'Carriage',
      type: 'select',
      group: 'Model',
      options: [{ value: 'hgh20ca', label: 'HIWIN HGH20CA' }],
    },
    {
      key: 'threadFitAllowance',
      label: 'Modeled female thread radial allowance',
      type: 'number',
      unit: 'mm',
      group: 'Inspection model',
      min: 0,
      max: 0.2,
      step: 0.01,
      visibleWhen: () => false,
      filterable: false,
      description: 'Numerical assembly fit allowance; not a published supplier thread tolerance.',
    },
  ],
  presets: presets as Preset[],
  catalogSelectionOnly: true,
  presetMatchKeys: ['model'],
  states: [
    { id: 'assembled', label: 'Assembly', description: 'Complete purchased carriage.' },
    {
      id: 'cutaway',
      label: 'Cutaway',
      description: 'Open the steel body for rail-channel inspection; covers remain installed.',
    },
  ],
  validate: (p) => {
    const errors = p.model === 'hgh20ca' ? [] : ['Choose the HGH20CA carriage.'];
    if (
      typeof p.threadFitAllowance !== 'number' ||
      !Number.isFinite(p.threadFitAllowance) ||
      p.threadFitAllowance < 0 ||
      p.threadFitAllowance > 0.2
    )
      errors.push('Keep the inspection thread allowance between 0 and 0.2 mm.');
    return errors;
  },
  buildGeometry: (p, s) => geometry(pieces(p, s)),
  python: (p, s) => {
    const model = pieces(p, s);
    const source = python(model);
    if (Number(p.threadFitAllowance) === 0) return source;
    const metadata = model.map(({ shape }) => {
      const features = boundaryThreadCallouts(shape);
      return {
        ...threadMetadata(features),
        ...(features.length
          ? {
              ThreadFitAllowance: `M5 source nominal / 6 mm span: ${p.threadFitAllowance} mm modeled radial allowance, female cutting-tool diameter ${5 + 2 * Number(p.threadFitAllowance)} mm. This is an inspection-model fit; the supplier tolerance/fit class is unverified.`,
            }
          : {}),
      };
    });
    return `${source}\ncomponent_metadata = ${JSON.stringify(metadata)}`;
  },
  dimensions: (p, s) => dimensions(pieces(p, s)),
  notes:
    'Native X is rail direction; Y0 is rail centre. Source H=30 and H1=4.6 use the rail mounting plane Z0, so this independent carriage has bottomZ4.6/topZ30. HIWIN G99TE22-2011 printed p37 supplies L77.5, L1=50.5, W44, B32, C36 and M5×6 mounting holes. M5 coarse pitch0.8 is the ISO metric interpretation. A configured threadFitAllowance enlarges only the modeled female cutter; the source nominal M5 and 6 mm depth remain unchanged. That inspection allowance is not a supplier tolerance or production fit class. Undimensioned channel clearance0.15, cover contours and small radii are illustrative; installed balls/return circuits and grease nipple are not supplied as manufacturable internals. This whole carriage remains one purchased unit.',
  sources: [
    {
      label: 'HIWIN HGH-CA/HGR mounting drawing, printed p37',
      url: 'https://www.hiwin.com/wp-content/uploads/Linear_Guideway-E.pdf',
    },
  ],
};
export default part;

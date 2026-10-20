import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { box, cylinder, subtract, union, type Shape } from '../../core/assembly/boundary/shapes';
import { geometry, python, type Piece } from '../../core/assembly/boundary/assembly';
import product from './product.json';
import presets from './presets.json';

export type FeedServoModel = 'ecm-a3h-c20807rs1' | 'ecm-a3h-c20807ss1';
export const feedServoSource = 'https://deltaww.com.ua/deltaww/ECMA-C3.pdf';
export function feedServoParameters(
  model: FeedServoModel = 'ecm-a3h-c20807rs1',
  includeKey = true,
): Parameters {
  return { model, includeKey };
}
export function feedServoLayout(p: Parameters) {
  const brake = p.model === 'ecm-a3h-c20807ss1';
  return {
    model: p.model as FeedServoModel,
    brake,
    flange: 80,
    flangeThickness: 8,
    bodyLength: brake ? 153.2 : 115.8,
    pilotDiameter: 70,
    pilotLength: 3,
    shaftDiameter: 19,
    shaftStart: 0,
    shaftEnd: 40,
    usableShaftStart: 3,
    holeDiameter: 6.6,
    mountCircle: 90,
    mountingHalfPitch: 90 / (2 * Math.sqrt(2)),
    keyWidth: 6,
    keyHeight: 6,
    keySeat: 6,
    keyStart: 15,
    keyEnd: 40,
    tipThread: 'M6',
    tipThreadDepth: 10,
    massKg: brake ? 3.6 : 2.8,
    ratedTorqueNm: 2.39,
    peakTorqueNm: 8.36,
    ratedRpm: 3000,
    rotorInertiaKgM2: brake ? 1.66e-4 : 1.51e-4,
    brakeTorqueNm: brake ? 2.5 : 0,
    brakePowerW: brake ? 8 : 0,
  };
}
export function feedServoMountingHoles(): [number, number, number][] {
  const h = 90 / (2 * Math.sqrt(2));
  return [-1, 1].flatMap((x) => [-1, 1].map((y) => [x * h, y * h, 0] as [number, number, number]));
}
function pieces(p: Parameters): Piece[] {
  const v = feedServoLayout(p);
  const body = subtract(
    union(
      {
        kind: 'prism',
        points: [
          [-38, -16],
          [-16, -38],
          [16, -38],
          [38, -16],
          [38, 16],
          [16, 38],
          [-16, 38],
          [-38, 16],
        ],
        depth: v.bodyLength - 8,
        origin: -v.bodyLength,
        axis: 'z',
      },
      box([80, 80, 8], [-40, -40, -8]),
      cylinder(35, 3, [0, 0, 0]),
    ),
    cylinder(9.6, 4, [0, 0, 0]),
    ...feedServoMountingHoles().map(([x, y]) => cylinder(3.3, 10, [x, y, -9])),
  );
  const slot = box([6.02, 10, 25.01], [-3.01, 6, 15]);
  const tip: Shape = {
    kind: 'cylinder',
    radius: 3,
    height: 10,
    origin: [0, 0, 30],
    axis: 'z',
    thread: { pitch: 1, internal: true, designation: 'M6' },
  };
  const result: Piece[] = [
    {
      label: `${String(p.model).toUpperCase()} housing and flange; illustrative housing contours`,
      color: 0x343c46,
      shape: body,
    },
    {
      label: 'Source Ø19h6 shaft; M6 depth10 and keyseat',
      color: 0xb8c0c7,
      shape: subtract(cylinder(9.5, 40, [0, 0, 0]), slot, tip),
    },
    {
      label: 'Source cable exit height54.5; connector contours illustrative',
      color: 0x20262b,
      shape: box([18, 16.5, 18], [-9, 38, -v.bodyLength + 15]),
    },
  ];
  if (p.includeKey)
    result.push({
      label: 'Removable6×6 key; end form illustrative',
      color: 0xacb4bc,
      shape: box([6, 6, 25], [-3, 6, 15]),
    });
  return result;
}
const part: PartDefinition = {
  id: 'cnc-feed-servo',
  name: 'Industrial feed servo motor',
  product: product as ProductProfile,
  category: 'MOTORS & ACTUATORS',
  subgroup: 'SERVOS',
  icon: 'gear',
  complexity: 'Delta750 W high inertia; optional factory brake',
  description:
    'Purchased Delta ECM-A3H80mm750W feed servo with source mounting interfaces and factory-braked execution.',
  keywords: ['Delta', 'ECM-A3H', '750W', 'servo', 'factory brake', '19mm shaft', 'A3'],
  defaults: feedServoParameters(),
  parameters: [
    {
      key: 'model',
      label: 'Manufacturer execution',
      type: 'select',
      group: 'Model',
      options: [
        { value: 'ecm-a3h-c20807rs1', label: 'ECM-A3H-C20807RS1 · without brake' },
        { value: 'ecm-a3h-c20807ss1', label: 'ECM-A3H-C20807SS1 ·24 V factory holding brake' },
      ],
    },
    {
      key: 'includeKey',
      label: 'Install supplied shaft key',
      type: 'boolean',
      group: 'Installation',
      filterable: false,
      description: 'Remove only for a manufacturer-approved clamping hub on this keyed shaft.',
    },
  ],
  presets: presets as Preset[],
  presetMatchKeys: ['model'],
  catalogSelectionOnly: true,
  catalogFilterFields: [
    {
      key: 'ratedTorque',
      label: 'Continuous rated torque',
      type: 'number',
      unit: 'Nm',
      group: 'Ratings',
      catalogSummary: true,
    },
    {
      key: 'brake',
      label: 'Factory holding brake',
      type: 'boolean',
      group: 'Ratings',
      catalogSummary: true,
    },
    { key: 'mass', label: 'Manufacturer mass', type: 'number', unit: 'kg', group: 'Ratings' },
  ],
  validate(p) {
    const errors = ['ecm-a3h-c20807rs1', 'ecm-a3h-c20807ss1'].includes(String(p.model))
      ? []
      : ['Choose the actual Delta750 W high-inertia execution.'];
    if (typeof p.includeKey !== 'boolean')
      errors.push('Specify whether the removable shaft key is installed.');
    return errors;
  },
  buildGeometry: (p) => geometry(pieces(p)),
  python(p) {
    const data = {
      SupplierExecution: String(p.model).toUpperCase(),
      ServoRatings: JSON.stringify(feedServoLayout(p)),
      GeometryQualification:
        'Source flange/pilot/shaft/tapped-end interfaces; housing details, cable plugs and loose-key end form are envelopes. No OEM internal motor/brake parts reconstructed.',
      CoolingRequirement:
        'Rated output requires manufacturer 250×250×6mm aluminium heat-sink plate at0–40 °C.',
      BrakeQualification:
        p.model === 'ecm-a3h-c20807ss1'
          ? '24 V / 8 W; minimum2.5Nm static hold; release≤20ms/pull-in≤60ms. Holding brake only: servo must decelerate before engagement; powered stop and control sequence require validation.'
          : 'No holding brake.',
      KeyInstallation: p.includeKey
        ? 'Supplied6×6key installed; verify actual key length/end form.'
        : 'Key removed for explicitly approved keyed-shaft clamping installation; obtain hub maker approval.',
    };
    return `${python(pieces(p))}\ncomponent_manufactured=[False]*len(components)\nfor _pl_servo_meta in component_metadata: _pl_servo_meta.update(${JSON.stringify(data)})`;
  },
  dimensions: (p) => [80, 94.5, feedServoLayout(p).bodyLength + 40],
  notes:
    'Native shaft axisZ; front flange mounting faceZ0, body behind. Source current C20807 drawing gives80flange, PCD90 fourØ6.6, Ø70pilot×3, Ø19h6shaft0..40,6mm key, M6 blind depth 10. Continuous2.39Nm at 3000 rpm is a rated maker condition, not a guaranteed commissioned machine result. Source model S has standard connectors; waterproof J cable execution is not silently substituted. Shaft/race manufacturing tolerances and thermal commissioning must be checked against the delivered unit.',
  sources: [
    { label: 'Delta ECM-A3 current C2 motor catalogue, pp63–65', url: feedServoSource },
    {
      label: 'Delta manufacturer ASDA-A3 catalogue and H0807 torque curve',
      url: 'https://landing.deltaww.com/IA/downloadcenter/catalogue/2.Motion/ASDA-A3/DELTA_IA-ASDA_ASDA-A3_C_EN_20210104_Web.pdf',
    },
  ],
};
export default part;

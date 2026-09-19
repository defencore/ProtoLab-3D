import type { Parameters, ParameterDefinition } from '../../core/types';
export const defaults: Parameters = {
  wingBattery: 'lipo',
  wingCellDiameter: 18.6,
  wingCellLength: 65.2,
  wingCellMass: 46,
  wingBoardMass: 15.8,
  wingServoMass: 55,
  wingServoCgX: 10.35,
  wingHolePitchX: 18,
  wingHolePitchY: 22,
  lipoTrimX: 0,
  lipoCells: '3',
  lipoLength: 58,
  lipoWidth: 31,
  lipoThickness: 16,
  lipoMass: 59,
  pwmMountPitch: 48,
  pwmRowPitch: 10,
  pwmSplineDiameter: 6,
  pwmSplineRoot: 5.5,
  lockFriction: 0.15,
  gearEfficiency: 0.7,
  tubeSeam: 0.4,
  springWire: 0.7,
  springPreload: 2,
  noseMass: 0.3,
  extractionForce: 5,
  extractionDistance: 30,
  exitSpeed: 1,
  drive: 'four-motors',
  tubeOD: 80,
  tubeID: 76,
  release: 0,
  unlockAngle: 14,
  separation: 28,
  springTravel: 8,
  motor: '12',
  fitClearance: 0.5,
  cellMass: 46,
  driverMass: 25,
  driverCgX: 0,
  driverCgY: 0,
  designG: 50,
  servoMass: 55,
  servoCgX: 12.5,
  servoCgY: 0,
  batteryPack: 'none',
  cellSeatMaterial: 'pom',
};
const number = (
  key: string,
  label: string,
  group: string,
  min: number,
  max: number,
  step = 1,
  unit = 'mm',
): ParameterDefinition => ({ key, label, group, type: 'number', min, max, step, unit });
export const parameters: ParameterDefinition[] = [
  {
    key: 'drive',
    label: 'Drive layout',
    group: 'Drive',
    type: 'select',
    options: [
      { value: 'four-motors', label: 'Four gearmotors · 4 pinions' },
      { value: 'central-servo', label: 'Original micro servo · MG90S + 4 idlers' },
      { value: 'wing-mini-nose', label: 'MG996R + LiPo / 2×18650 + F405 WING-MINI · Ø90/86' },
      { value: 'st3215-nose', label: 'ST3215 · lightweight nose release · Ø90/86' },
    ],
    description:
      'The single-servo layout uses fixed idler axes and a 20:40:100 gear set. A 14° ring turn requires 70° of servo travel in the opposite direction.',
  },
  {
    key: 'wingBattery',
    label: 'Battery arrangement',
    group: 'LiPo / PWM package',
    type: 'select',
    options: [
      { value: 'lipo', label: 'Tattu 650 mAh · transverse pouch' },
      { value: '2x18650', label: '2S1P · two vertical 18650 beside servo' },
    ],
    visibleWhen: (p) => p.drive === 'wing-mini-nose',
  },
  ...[
    number(
      'wingCellDiameter',
      'Measured 18650 diameter including wrapper',
      '18650 / PWM package',
      18,
      19,
      0.1,
    ),
    number('wingCellLength', 'Measured 18650 overall length', '18650 / PWM package', 64, 67, 0.1),
    number('wingCellMass', 'One 18650 cell mass', '18650 / PWM package', 35, 55, 0.1, 'g'),
  ].map((control) => ({
    ...control,
    visibleWhen: (p: Parameters) => p.drive === 'wing-mini-nose' && p.wingBattery === '2x18650',
  })),
  {
    key: 'lipoCells',
    label: 'Tattu 650 mAh pack',
    group: 'LiPo / PWM package',
    type: 'select',
    options: [
      { value: '3', label: '3S1P 75C · 11.1 V · 58×31×16 mm' },
      { value: '2', label: '2S1P 75C · 7.4 V · 57×31×12 mm' },
    ],
    visibleWhen: (p) => p.drive === 'wing-mini-nose' && p.wingBattery === 'lipo',
    description:
      'Selecting a pack resets its nominal dimensions and mass. Measure your pack including its wrapper before fabrication.',
  },
  ...[
    number('lipoLength', 'Measured pack length', 'LiPo / PWM package', 52, 63, 0.1),
    number('lipoWidth', 'Measured pack width', 'LiPo / PWM package', 29, 33, 0.1),
    number('lipoThickness', 'Measured pack thickness', 'LiPo / PWM package', 10, 18, 0.1),
    number('lipoMass', 'Installed pack mass', 'LiPo / PWM package', 30, 90, 0.1, 'g'),
    number(
      'wingBoardMass',
      'Installed FC stack mass (without wireless extender)',
      'Payload balance',
      10,
      30,
      0.1,
      'g',
    ),
    number('wingServoMass', 'Measured servo mass', 'Payload balance', 45, 70, 0.1, 'g'),
    number('wingServoCgX', 'Servo centre of mass X from shaft', 'Payload balance', 5, 16, 0.1),
    number('lipoTrimX', 'Battery balance trim X', 'Payload balance', -3, 3, 0.1),
    {
      ...number(
        'wingHolePitchX',
        'Measured PCB hole pitch, long axis',
        'FC fit references',
        17,
        18.3,
        0.1,
      ),
      description: '18 mm is inferred from the manual illustration, not a dimensioned drawing.',
    },
    {
      ...number(
        'wingHolePitchY',
        'Measured PCB hole pitch, short axis',
        'FC fit references',
        20,
        22,
        0.1,
      ),
      description: '22 mm is inferred from the manual illustration. Confirm on the actual boards.',
    },
    {
      ...number('pwmMountPitch', 'MG996R mounting pitch X', 'Servo fit references', 46, 49, 0.1),
      description: 'Initial 48 mm is a fit assumption. Measure the actual ears before machining.',
    },
    {
      ...number('pwmRowPitch', 'MG996R mounting pitch Y', 'Servo fit references', 9, 11, 0.1),
      description: 'Initial 10 mm is a fit assumption.',
    },
    {
      ...number(
        'pwmSplineDiameter',
        'Output spline major diameter',
        'Servo fit references',
        5.8,
        6.2,
        0.01,
      ),
      description: 'Prototype 25T profile. Supplier tooth-flank geometry is not verified.',
    },
    number('pwmSplineRoot', 'Output spline root diameter', 'Servo fit references', 5.2, 5.7, 0.01),
    number(
      'lockFriction',
      'Assumed lock friction coefficient',
      'Unlock estimate',
      0.05,
      0.5,
      0.01,
      '',
    ),
    number('gearEfficiency', 'Assumed gear efficiency', 'Unlock estimate', 0.4, 0.9, 0.01, ''),
  ].map((control) => ({
    ...control,
    visibleWhen: (p: Parameters) =>
      p.drive === 'wing-mini-nose' &&
      (!['lipoLength', 'lipoWidth', 'lipoThickness', 'lipoMass'].includes(control.key) ||
        p.wingBattery === 'lipo'),
  })),
  {
    key: 'batteryPack',
    label: 'Power and servo controller',
    group: 'Drive',
    type: 'select',
    options: [
      { value: 'none', label: 'Without batteries · compact' },
      { value: '3x18650', label: '3S1P 18650 + Waveshare HAT (A)' },
    ],
    visibleWhen: (p) => p.drive === 'st3215-nose',
  },
  {
    key: 'cellSeatMaterial',
    label: 'Cell insulating plates',
    group: 'Mounting loads',
    type: 'select',
    options: [
      { value: 'pom', label: 'Machined POM' },
      { value: 'pa12', label: 'Printed PA12 · prototype' },
    ],
    visibleWhen: (p) => p.drive === 'st3215-nose' && p.batteryPack === '3x18650',
    description:
      'Printed alternative uses the same full seat walls and metal backing. Layer adhesion, creep and impact retention require physical validation; no shock rating is assigned.',
  },
  ...[
    {
      ...number('driverMass', 'HAT installed mass', 'Mass balance', 10, 80, 0.1, 'g'),
      description: 'Initial 25 g is an assumption; include fixed connectors and lead.',
    },
    {
      ...number('driverCgX', 'HAT centre of mass X', 'Mass balance', -5, 5, 0.1),
      description: 'Installed board CG relative to the tube axis; initial zero is an assumption.',
    },
    {
      ...number('driverCgY', 'HAT centre of mass Y', 'Mass balance', -5, 5, 0.1),
      description: 'Installed board CG relative to the tube axis; initial zero is an assumption.',
    },
    {
      ...number('designG', 'Assumed acceleration / shock', 'Mounting loads', 1, 200, 1, 'g'),
      description:
        'Reports inertial load demand only. Does not certify PCB, fastener or frame strength.',
    },
    {
      ...number('cellMass', '18650 mass per cell', 'Mass balance', 35, 55, 0.1, 'g'),
      description:
        'Adjust to the measured cell mass. Initial 46 g is an assumption, not a selected battery model.',
    },
    {
      ...number('servoMass', 'ST3215 mass', 'Mass balance', 45, 75, 0.1, 'g'),
      description: 'Initial 55 g is an assumption; use the mass of your servo and lead.',
    },
    {
      ...number('servoCgX', 'Servo centre of mass X', 'Mass balance', 8, 16, 0.1),
      description: 'Relative to the output axis. Initial 12.5 mm is an assumed centre of mass.',
    },
    {
      ...number('servoCgY', 'Servo centre of mass Y', 'Mass balance', -1, 1, 0.1),
      description:
        'Initial 0 mm assumes lateral symmetry. Cells move to balance the servo and battery pack.',
    },
  ].map((control) => ({
    ...control,
    visibleWhen: (p: Parameters) =>
      (p.drive === 'st3215-nose' && p.batteryPack === '3x18650') ||
      (control.key === 'designG' && p.drive === 'wing-mini-nose'),
  })),
  number('tubeOD', 'Tube outside diameter', 'Housing', 80, 160, 0.1),
  number('tubeID', 'Tube inside diameter', 'Housing', 76, 156, 0.1),
  number('fitClearance', 'Radial sleeve clearance', 'Housing', 0.2, 0.8, 0.05),
  {
    ...number('release', 'Release sequence', 'Motion', 0, 100, 1, '%'),
    description:
      '0–60% rotates the ring under eight retaining heads; 60–100% separates the unlocked upper tube. Position sequence, not a time or force simulation.',
  },
  number('unlockAngle', 'Ring rotation to unlock', 'Motion', 12, 20, 1, '°'),
  number('separation', 'Displayed separation distance', 'Motion', 16, 60),
  number('springTravel', 'Spring expansion travel', 'Springs', 4, 12),
  ...[
    {
      ...number('tubeSeam', 'Axial tube seam', 'Housing', 0.2, 1, 0.05),
      description:
        'Nominal end gap. Match both tube outside diameters; verify actual tolerances and ovality.',
    },
    {
      ...number('springWire', 'Spring wire diameter', 'Spring sizing', 0.6, 0.75, 0.01),
      description:
        'Preliminary spring steel geometry: mean diameter 5 mm, six active turns, assumed G=79 GPa. Supplier load/stress rating must be verified.',
    },
    number('springPreload', 'Remaining preload at full stroke', 'Spring sizing', 0.5, 3, 0.1),
    {
      ...number('noseMass', 'Complete departing nose mass', 'Spring sizing', 0.05, 5, 0.01, 'kg'),
      description:
        'Initial 0.30 kg is an assumption. Include servo, mechanism and all hardware that depart.',
    },
    {
      ...number(
        'extractionForce',
        'Extraction and friction resistance',
        'Spring sizing',
        0,
        100,
        0.5,
        'N',
      ),
      description:
        'Initial 5 N is an assumption. Use measured resistance including packing, seals and guides. Gravity is added separately for upward extraction.',
    },
    number('extractionDistance', 'Distance to complete extraction', 'Spring sizing', 12, 200, 1),
    number('exitSpeed', 'Target exit speed after extraction', 'Spring sizing', 0.1, 5, 0.1, 'm/s'),
  ].map((control) => ({
    ...control,
    visibleWhen: (p: Parameters) => ['st3215-nose', 'wing-mini-nose'].includes(String(p.drive)),
  })),
  {
    key: 'motor',
    visibleWhen: (p) => p.drive === 'four-motors',
    label: 'Four gearmotor envelopes',
    group: 'Drive',
    type: 'select',
    options: [
      { value: '12', label: 'Ø12 mm × 35 mm · compact' },
      { value: '16', label: 'Ø16 mm × 35 mm' },
    ],
    description: 'Reconstructed installation envelopes; not manufacturer-specific motor models.',
  },
];

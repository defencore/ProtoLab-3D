import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {
  componentGeometry,
  componentPython,
  componentDimensions,
} from '../../core/assembly/detail-instances';
import { defaults, parameters } from './configurator';
import { libraries, configured, kinematics, composition } from './lib/model';
import presetData from './presets.json';
import productData from './product.json';

function validate(parametersValue: Parameters, state: string): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(parametersValue))
    if (!parameters.some((field) => field.key === key)) errors.push(`Unsupported setting: ${key}.`);
  for (const field of parameters) {
    if (field.key === 'manualState' && parametersValue.mechanism !== 'parallel-dual') {
      if (Object.hasOwn(parametersValue, 'manualState'))
        errors.push(
          'The ARM 1 manual switch setting is only available in the two-switch mechanism.',
        );
      continue;
    }
    const value = parametersValue[field.key];
    if (field.type === 'number') {
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        (field.min !== undefined && value < field.min) ||
        (field.max !== undefined && value > field.max)
      )
        errors.push(`${field.label} must be between ${field.min} and ${field.max} ${field.unit}.`);
    } else if (!field.options?.some((option) => option.value === value))
      errors.push(`Choose a supported ${field.label.toLowerCase()}.`);
  }
  if (!['assembled', 'exploded'].includes(state)) errors.push('Choose a supported assembly view.');
  if (errors.length) return errors;
  if (parametersValue.mechanism === 'parallel-dual') {
    if (Number(parametersValue.baseLength) < 100 || Number(parametersValue.baseWidth) < 150)
      errors.push('The two-switch rocker needs a mounting flange at least 100 × 150 mm.');
    return errors;
  }
  if (parametersValue.mechanism === 'parallel') {
    if (Number(parametersValue.baseLength) < 80 || Number(parametersValue.baseWidth) < 110)
      errors.push('The parallel-shaft rocker needs a mounting flange at least 80 × 110 mm.');
    return errors;
  }
  if (parametersValue.mechanism === 'rocker') {
    if (Number(parametersValue.baseLength) < 100 || Number(parametersValue.baseWidth) < 90)
      errors.push('The printed rocker needs a base at least 100 × 90 mm.');
    return errors;
  }
  if (Number(parametersValue.baseLength) < 160 || Number(parametersValue.baseWidth) < 96)
    errors.push('The guided fork needs a base at least 160 × 96 mm.');
  if (Number(parametersValue.deckHeight) < 50)
    errors.push('The guided fork needs a switch height of at least 50 mm.');
  if (errors.length) return errors;
  const motion = kinematics(parametersValue),
    pushTravel = 7 * Math.sin((Number(parametersValue.servoSweep) * Math.PI) / 180);
  if (motion.neutralClearance < 0.15)
    errors.push(
      'Increase the fork opening or lower the contact height to keep the lever clear at rest.',
    );
  if (pushTravel - motion.workingStroke < 0.15)
    errors.push(
      'Increase the servo push angle or reduce the opening/contact height to complete the push.',
    );
  if (motion.maxPadCompression > 1)
    errors.push(
      'Reduce the servo push angle or increase the opening/contact height to keep pad compression within 1 mm.',
    );
  return errors;
}

const phaseDescriptions: Record<string, string> = {
  off: 'OFF: the switch is off, with the fork and servo centred and clear of the lever.',
  'press-on': 'Press ON: the fork pushes the toggle on while the soft contact pad compresses.',
  on: 'ON: the maintained switch stays on after the fork and servo return to centre.',
  'press-off': 'Press OFF: the fork pushes the toggle off before returning to centre.',
};
const rockerPhases: Record<string, string> = {
  off: 'OFF: the toggle is off and both rocker fingers leave room to operate it by hand.',
  'press-on': 'Press ON: one rounded rocker finger reaches the lever to switch it on.',
  on: 'ON: the maintained toggle stays on after the rocker returns to centre.',
  'press-off': 'Press OFF: the opposite rounded finger reaches the lever to switch it off.',
};
const parallelPhases: Record<string, string> = {
  off: 'OFF: the toggle is off and the two-ended bar is centred, leaving manual operation clear.',
  'press-on': 'Press ON: one end of the opposed bar reaches the lever to switch it on.',
  on: 'ON: the maintained toggle stays on after the opposed bar returns to centre.',
  'press-off': 'Press OFF: the opposite end of the bar reaches the lever to switch it off.',
};
const manualDescriptions: Record<string, string> = {
  'guarded-off': 'ARM 1 · manual left switch: OFF, with its protective cover closed.',
  'open-off': 'ARM 1 · manual left switch: OFF, with its protective cover open.',
  'open-on': 'ARM 1 · manual left switch: ON, with its protective cover open.',
};

const part: PartDefinition = {
  id: 'servo-toggle-actuator',
  name: 'Servo toggle actuator',
  category: 'SWITCHES & BUTTONS',
  subgroup: 'PANEL CONTROLS',
  icon: 'gear',
  preview: 'worker',
  complexity: 'Printed rockers or guided fork',
  description:
    'Printed mounting parts operate an ST3215 servo and ASW-07D toggle with a horizontal or parallel-shaft rocker. A guided fork with soft pads is also available.',
  keywords: [
    'servo',
    'toggle',
    'switch',
    'actuator',
    'rocker',
    'parallel shaft',
    '3D printed',
    'PETG',
    'PA',
    'ST3215',
    'ASW-07D',
    'panel',
    'enclosure',
    'mounting',
    'fork',
    'linkage',
    'Scotch yoke',
  ],
  product: productData as ProductProfile,
  defaults,
  parameters,
  presets: presetData as Preset[],
  presetMatchKeys: ['mechanism', 'baseLength', 'baseWidth', 'deckHeight'],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Inspect the selected operating stage with all mounting and linkage components.',
    },
    {
      id: 'exploded',
      label: 'Separate components',
      description: 'Separate components for inspection while keeping the selected operating stage.',
    },
  ],
  validate,
  updateParameters(p, key) {
    if (key !== 'mechanism') return p;
    if (p.mechanism === 'parallel-dual')
      return {
        ...p,
        baseLength: 100,
        baseWidth: 150,
        deckHeight: 42,
        contactHeight: 12,
        padGap: 14.6,
        servoSweep: 50,
        manualState: 'guarded-off',
      };
    const next = { ...p };
    delete next.manualState;
    if (p.mechanism === 'parallel')
      return {
        ...next,
        baseLength: 80,
        baseWidth: 110,
        deckHeight: 42,
        contactHeight: 12,
        padGap: 14.6,
        servoSweep: 50,
      };
    if (p.mechanism === 'guided')
      return {
        ...next,
        baseLength: Math.max(160, Number(p.baseLength)),
        baseWidth: Math.max(96, Number(p.baseWidth)),
        deckHeight: Math.max(50, Number(p.deckHeight)),
        contactHeight: 10,
        padGap: 13,
        servoSweep: 50,
      };
    return {
      ...next,
      baseLength: Math.max(100, Number(p.baseLength)),
      baseWidth: Math.max(90, Number(p.baseWidth)),
      contactHeight: 12,
      padGap: 14.6,
      servoSweep: 50,
    };
  },
  composition,
  buildGeometry: (p, state) => componentGeometry(libraries, configured(p, state)),
  buildExportGeometry: (p, state) => componentGeometry(libraries, configured(p, state), true),
  python: (p, state) => componentPython(libraries, configured(p, state)),
  dimensions: (p, state) => componentDimensions(libraries, configured(p, state)),
  assessment(p) {
    const motion = kinematics(p);
    if (p.mechanism === 'parallel-dual')
      return [
        `ARM 2 · servo-operated right switch. ${parallelPhases[String(p.phase)]}`,
        manualDescriptions[String(p.manualState)],
        'Seven prints: four PETG parts form the flange, extended lower cradle, lid and opposed bar; three separate 1.5 mm TPU frames cushion the two switch seats and host-plate interface.',
        `Current servo angle ${motion.servoAngle.toFixed(2)}°. The ARM 2 rotor leaves at least ${motion.neutralClearance.toFixed(2)} mm clearance at neutral for manual OFF. ARM 1 is operated by hand and has no servo linkage.`,
        'ARM 1 sits 90 mm to the left of ARM 2. Both toggles lean toward the labels in OFF and away in ON; the SAC-01 hinge is behind ARM 1 and the cover opens away. The reconstructed cover seat and travel need a check on the delivered pair.',
        'Four M3×30 through-bolts join the servo housing; two additional M3×20 bolts retain the ARM 1 end of the cradle. Four M3×14 screws clamp the rocker between the reworked output disc and the flipped rear disc: tap the lower disc M3 and drill the upper disc to diameter 3.2 mm.',
        'Both side-terminal channels are 18.4 mm wide. The ARM 1 through-tie nearest the channel moves 3 mm toward the servo to retain a 3.1 mm wall; use the matching revised flange and cradle. Two additional pads under the stationary shaft-end case shoulders support the servo while keeping its control-wire approach open.',
        'Use the two-switch mounting template, including both negative-Y terminal-access branches. Select M4 hardware for the actual host plate and keep space below for plugs, receptacles and cable bends. Read the ARM 1 and ARM 2 labels from the marked edge.',
        'Print the full 6 mm PETG flange with its flat underside down; there are no gasket recesses or locator pockets. The three nominal 1.5 mm TPU frames sit externally below it. Top nut counterseats retain the original switch mounting heights. Two upper lands register the SAC-01 base in a 0.2 mm deep seat. ARM 2 uses its upper nut only, with the lower washer and nut removed. Fit both switch nut stacks and the M4 installation to actual TPU thickness. No gasket compression, sealing or force rating is assigned. Calibrate the ARM 2 drive on the purchased parts.',
      ];
    if (p.mechanism === 'parallel')
      return [
        parallelPhases[String(p.phase)],
        'Six prints: four PETG parts form the upper flange, lower servo and switch cradle, lid and opposed bar; two separate 1.5 mm TPU frames cushion the switch and host-plate interfaces.',
        `Current servo angle ${motion.servoAngle.toFixed(2)}°. At neutral, the rotor leaves at least ${motion.neutralClearance.toFixed(2)} mm clearance across the full manual toggle travel. You can switch OFF by hand without moving the servo.`,
        'The 6 mm flange spans Z1.5-7.5 above the host plate top at Z0, separated by the external 1.5 mm TPU frame. Use the matching template including the right terminal opening, and select M4 hardware for the actual installation stack.',
        'The underside is open for control leads. Reserve at least 25 mm below the servo face for the selected plug and wire bend; mating plugs and source ports require a check on the delivered unit.',
        'The lower cradle fits the servo and the switch-body flats to resist rotation. Four M3×30 through-bolts join it to the upper flange and lid. Four M3×14 screws clamp the 8 mm rocker stack between the reworked discs: tap the lower disc M3 and drill the flipped upper disc to diameter 3.2 mm.',
        'The side-terminal channel is 18.4 mm wide. Lower pads and matching upper lid ribs retain the stationary shaft-end case shoulders beside the open wire approach. A diameter 19.2 × 1 mm rocker boss leaves 2 mm under the broad arms and 0.9 mm radial clearance inside the lid opening.',
        'Both nominal 1.5 mm TPU frames sit externally beneath the flat flange without recesses or M4 hard lands. A 0.7 mm deep top nut seat retains 5.3 mm of PETG and preserves the switch height. The bare switch uses its upper nut only; remove the lower washer and nut, then fit the nut stack to actual TPU thickness. The model assigns no gasket compression or sealing rating.',
        'Print the broad, flat flange underside down. Use PETG with approximately five to six walls as a starting setup; qualify the separate cradle retention ledges and nut-slot bridges. Measure the purchased switch pivot and trip force, then calibrate push endpoints, speed and torque limit. The contact positions describe geometry rather than firmware settings or a force rating.',
      ];
    if (p.mechanism === 'rocker')
      return [
        rockerPhases[String(p.phase)],
        'Three printed parts: the integrated base, servo cradle and switch mount; the rear retaining clamp; and the two-finger rocker.',
        `Current servo angle ${motion.servoAngle.toFixed(2)}°. The fixed rounded fingers leave approximately ${motion.neutralClearance.toFixed(2)} mm clearance at rest. Push positions follow the calculated lever contact.`,
        `Space below switch blades ${(Number(p.deckHeight) - 35.3).toFixed(1)} mm; raise Switch height to suit the selected terminals and cable bend.`,
        'The rocker attaches to the supplied disc with four M1.6 through-fasteners. Separate M3 hardware retains the printed mounting parts. Keep access to the toggle by hand.',
        'Use PETG or PA for prototype prints. Measure the purchased switch pivot and trip force, then calibrate servo endpoints, speed and torque limit. The contact positions are an inspection model, not firmware settings or a force rating.',
      ];
    const pushTravel = 7 * Math.sin((Number(p.servoSweep) * Math.PI) / 180);
    return [
      phaseDescriptions[String(p.phase)],
      `Current fork movement ${motion.slide.toFixed(2)} mm; servo angle ${motion.servoAngle.toFixed(1)}°. Each push has ${pushTravel.toFixed(2)} mm available travel from centre.`,
      `Clearance at rest ${motion.neutralClearance.toFixed(2)} mm; proposed maximum pad compression ${motion.maxPadCompression.toFixed(2)} mm during a push.`,
      'The 6 mm aluminium base mounts through four M4 slots. The servo has a fitted retaining cage; the switch mounts through a keyed 3 mm plate. The toggle remains accessible by hand.',
      'Measure the purchased switch force and trip positions, then calibrate servo endpoints, speed and torque limit with the selected TPU pads. The source drawing does not publish the actual pivot position or operating force.',
    ];
  },
  notes:
    'Select a three-part printed rocker or the guided fork with soft pads. ST3215 12 V supplier CAD and the ASW-07D drawing define the purchased interfaces. Printed mounting parts, rounded fingers, guide fits and contact envelopes are custom prototype choices. The operating stages show geometric positions rather than programmed servo control or a force simulation. Calibrate the purchased switch, mounting and travel before use; no assembly load or operating-force rating is assigned.',
  sources: [
    {
      label: 'Waveshare ST3215 supplier documentation and CAD',
      url: 'https://www.waveshare.com/wiki/ST3215_Servo',
    },
    {
      label: 'Waveshare ST servo speed, acceleration and torque-limit controls',
      url: 'https://docs.waveshare.com/Memory_Map_Explanation/ST_Servo_Memory_Map_Explanation',
    },
    {
      label: 'DAIER ASW-07D manufacturer dimensional drawing',
      url: 'https://www.chinadaier.com/wp-content/uploads/2018/05/ASW-07D-1.pdf',
    },
  ],
};
export default part;

import type { Parameters } from '../../../core/types';
import type { AssemblyComponent, AssemblyDefinition } from '../../../core/product-types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import detail from '../../manufactured-detail/part';
import servo from '../../bus-servo/part';
import toggle from '../../panel-switch/part';
import { frame } from './frame';
import { servoMount } from './servo-mount';
import { drive, kinematics as guidedKinematics } from './drive';
import { rockerDetails, rockerHardware, rockerKinematics, rockerLayout } from './rocker';
import { parallelDetails, parallelHardware, parallelKinematics, parallelLayout } from './parallel';
import { isParallel, isDual, dualPanelPoint } from './parallel-installation';
import { hardware, hardwareLibraries } from './hardware';
import { layout } from './layout';
import { casePanelDetails, casePanelHardware, casePanelPose } from './case-panel';
import { casePanelLibraries, casePanelPurchased, caseConnectorHardware } from './case-components';
import { caseElectronicsLibraries, caseElectronicsPurchased } from './case-electronics-components';
import { caseElectronicsDetails, caseElectronicsHardware } from './case-electronics';
import { caseFitDetails, caseFitHardware } from './case-fit';
import type { DetailSpec } from './types';
import { casePanelAssessment } from './case-description';

export const kinematics = (p: Parameters) =>
  isParallel(p)
    ? parallelKinematics(p)
    : p.mechanism === 'rocker'
      ? rockerKinematics(p)
      : guidedKinematics(p);
export const libraries = [
  detail,
  servo,
  toggle,
  ...hardwareLibraries,
  ...casePanelLibraries,
  ...caseElectronicsLibraries,
];

function custom(piece: DetailSpec): ConfiguredPiece {
  const component = detailComponent(piece.id, piece.label, piece.shape, { meshBackend: 'jscad' });
  component.manufacturing = {
    material: piece.material,
    blank: piece.blank,
    processes: piece.processes,
    requirements: piece.requirements ?? [
      'Confirm fits, edge radii, material grade and measured loads before producing this prototype detail.',
    ],
  };
  return { component, label: piece.label, color: piece.color, requireSingleSolid: true };
}

function purchased(p: Parameters): ConfiguredPiece[] {
  const m = layout(p),
    k = kinematics(p);
  const simple = p.mechanism === 'rocker',
    r = rockerLayout(p),
    v = parallelLayout(p),
    parallel = isParallel(p);
  const servoComponent: AssemblyComponent = {
    id: 'drive-servo',
    libraryId: servo.id,
    name: parallel
      ? 'Waveshare ST3215 12 V with reworked M3 disc pair'
      : 'Waveshare ST3215 12 V with supplied disc pair',
    parameters: {
      ...servo.defaults,
      model: 'st3215-12v',
      showHorn: true,
      hornMount: parallel ? 'rocker-m3' : 'original',
      outputAngle: k.servoAngle,
    },
    state: 'assembled',
    quantity: 1,
    supply: 'purchased',
    placement: parallel
      ? { translation: [0, v.servoY, v.servoZ], rotation: [0, 0, -90] }
      : simple
        ? { translation: [0, r.servoY, r.axisZ], rotation: [90, 0, 0] }
        : { translation: [m.servoX, 0, m.servoZ], rotation: [0, 0, 0] },
    procurement: {
      designation: 'ST3215 12 V',
      manufacturer: 'Waveshare',
      source: 'https://www.waveshare.com/wiki/ST3215_Servo',
    },
    notes: parallel
      ? 'Custom accessory installation: remove the supplied discs before rework. Tap the lower output disc M3 × 0.5 and drill the rear disc to diameter 3.2 mm. Refit the output disc and shaft fastener, then flip the rear disc above the 8 mm rocker stack with its boss down. Four M3 × 14 screws enter from above without underside nuts; modeled tips clear the front cover by 0.9 mm. The closed housing, fixed rear pivot and spline stay unchanged. Tapped bores use smooth nominal envelopes without helical threads. Measure the delivered discs and unverified CAD-fit shaft retaining hardware.'
      : 'Original supplier solids retained. The output retaining screw remains the existing unverified CAD-fit reference; measure the delivered retaining hardware.',
  };
  const switchComponent: AssemblyComponent = {
    id: 'toggle-switch',
    libraryId: toggle.id,
    name: isDual(p)
      ? 'ARM 2 · DAIER ASW-07D servo-operated toggle'
      : 'DAIER ASW-07D illuminated toggle',
    parameters: {
      ...toggle.defaults,
      model: 'daier-asw-07d',
      position: k.switchPosition,
      guard: 'closed',
      colour: 'red',
      panelThickness: 3,
      ...(parallel ? { panelThickness: 3.8, mountingHardware: 'upper-only' } : {}),
    },
    state: 'assembled',
    quantity: 1,
    supply: 'purchased',
    placement: {
      translation: [simple || parallel ? 0 : m.switchX, 0, parallel ? v.switchZ : m.switchZ],
      rotation: [0, 0, parallel ? 180 : 0],
    },
    procurement: {
      designation: 'ASW-07D',
      manufacturer: 'DAIER',
      source: 'https://www.chinadaier.com/wp-content/uploads/2018/05/ASW-07D-1.pdf',
    },
    notes: parallel
      ? 'Bare maintained toggle with the removable lower washer and nut omitted. The 1.5 mm case gasket and 5.3 mm residual PETG web meet the unchanged upper nut at its Z6.8 top counterseat; measure the delivered bushing and trip force.'
      : 'Bare maintained toggle. Its installed 3 mm panel occupies local Z3…6; the lever force and true internal pivot require measurement.',
  };
  const manualComponent: AssemblyComponent = {
    id: 'manual-toggle-switch',
    libraryId: toggle.id,
    name: 'ARM 1 · DAIER ASW-07D with SAC-01 manual protective cover',
    parameters: {
      ...toggle.defaults,
      model: 'daier-asw-07d-sac-01',
      position: p.manualState === 'open-on' ? 'last' : 'first',
      guard: p.manualState === 'guarded-off' ? 'closed' : 'open',
      colour: 'red',
    },
    state: 'assembled',
    quantity: 1,
    supply: 'purchased',
    placement: { translation: [0, -90, 0], rotation: [0, 0, 180] },
    procurement: {
      designation: 'ASW-07D + SAC-01',
      manufacturer: 'DAIER',
      source: 'https://www.chinadaier.com/wp-content/uploads/2018/05/SAC-01.pdf',
    },
    notes:
      p.mechanism === 'case-panel'
        ? 'Independent ARM 1 switch. The common control cassette carries source-cleared guard end lips and low side registers at the original Z9.5 steel-base datum. Verify the full guard travel and delivered mounting stack before tightening.'
        : 'Independent manual switch. Two upper end lands register the source guard base at Z9.5 in a 0.2 mm deep top seat. The reconstructed guard height and opening angle require fitting to the purchased assembly. No electrical circuit or safety function is assigned.',
  };
  return [servoComponent, switchComponent, ...(isDual(p) ? [manualComponent] : [])].map(
    (component) => ({
      component,
      label: component.name,
      color: 0xaab1bb,
      preserveLibraryAppearance: true,
    }),
  );
}

export function configured(p: Parameters, state: string): ConfiguredPiece[] {
  const simple = p.mechanism === 'rocker';
  const parallel = isParallel(p);
  const detailSpecs =
    p.mechanism === 'case-panel'
      ? [...casePanelDetails(p), ...caseElectronicsDetails(p), ...caseFitDetails(p)]
      : parallel
        ? parallelDetails(p)
        : simple
          ? rockerDetails(p)
          : [...frame(p), ...servoMount(p), ...drive(p)];
  const pieces = detailSpecs.map(custom);
  const result = [
    ...pieces,
    ...purchased(p),
    ...(p.mechanism === 'case-panel'
      ? [...casePanelPurchased(p), ...caseElectronicsPurchased(p)]
      : []),
    ...(p.mechanism === 'case-panel'
      ? [
          ...parallelHardware({ ...p, mechanism: 'parallel' }).filter(
            (piece) => !piece.component.id.startsWith('parallel-clamp-'),
          ),
          ...casePanelHardware(p),
          ...caseConnectorHardware(p),
          ...caseElectronicsHardware(p),
          ...caseFitHardware(p),
        ]
      : parallel
        ? parallelHardware(p)
        : simple
          ? rockerHardware(p)
          : hardware(p)),
  ];
  if (p.mechanism === 'case-panel')
    for (const piece of result) {
      const placement = piece.component.placement;
      const offset = casePanelPose(p, piece.component.id);
      piece.component.placement = {
        ...placement,
        translation: [
          placement.translation[0] + offset[0],
          placement.translation[1] + offset[1],
          placement.translation[2] + offset[2],
        ],
      };
    }
  const repeated = new Map<string, number>();
  for (const piece of result) repeated.set(piece.label, (repeated.get(piece.label) ?? 0) + 1);
  for (const piece of result)
    if (repeated.get(piece.label)! > 1) piece.label += ` · ${piece.component.id}`;
  const inspectionOffsets = new Map(detailSpecs.map((piece) => [piece.id, piece.explode]));
  if (state === 'exploded')
    for (const piece of result) {
      const id = piece.component.id;
      const offset = inspectionOffsets.get(id);
      if (p.mechanism === 'case-panel' && offset) {
        piece.position = offset;
        continue;
      }
      if (p.mechanism === 'case-panel' && id.startsWith('case-power-connector-')) {
        piece.position = [0, 0, -55];
        continue;
      }
      if (
        p.mechanism === 'case-panel' &&
        (id.startsWith('case-battery-pack-') ||
          id.startsWith('case-indicator-') ||
          id.startsWith('case-sp20-connector-'))
      ) {
        piece.position = [0, 0, 55];
        continue;
      }
      if (
        p.mechanism === 'case-panel' &&
        (/^case-(servo-driver-hat|heltec-v4|adc-cjmcu1220|pwm-mosfet)$/.test(id) ||
          /^case-(buck|lc-filter)-\d+$/.test(id))
      ) {
        piece.position = [0, 0, -85];
        continue;
      }
      if (p.mechanism === 'case-panel' && /^case-test-clip-(red|black)$/.test(id)) {
        piece.position = [0, 0, -55];
        continue;
      }
      if (p.mechanism === 'case-panel' && id.startsWith('case-electronics-')) {
        piece.position = [0, 0, -85];
        continue;
      }
      if (p.mechanism === 'case-panel' && id.startsWith('case-fit-')) {
        piece.position = [0, 0, id.includes('-screw-') ? 35 : -15];
        continue;
      }
      if (p.mechanism === 'case-panel' && id.startsWith('case-')) {
        if (id.startsWith('case-lid-screw-')) piece.position = [0, 0, 30];
        else if (id.startsWith('case-lid-nut-')) piece.position = [0, 0, -85];
        else if (id.startsWith('case-xt60-')) piece.position = [0, 0, 55];
      }
      if (parallel) {
        if (
          id === 'parallel-cradle' ||
          id.startsWith('parallel-clamp-nut-') ||
          id.startsWith('manual-clamp-nut-')
        )
          piece.position = [0, 0, -35];
        else if (id === 'parallel-panel-gasket') piece.position = [0, 0, -10];
        else if (id === 'parallel-switch-gasket') piece.position = [40, 20, 35];
        else if (id === 'parallel-manual-gasket') piece.position = [50, 0, 35];
        else if (id === 'manual-toggle-switch') piece.position = [0, -35, 45];
        else if (id.startsWith('manual-clamp-screw-')) piece.position = [0, 0, 25];
        else if (id === 'parallel-rocker' || id.startsWith('parallel-disc-'))
          piece.position = [45, 0, 25];
        else if (id === 'parallel-clamp' || id.startsWith('parallel-clamp-'))
          piece.position = [0, -45, 25];
        else if (id === 'toggle-switch') piece.position = [0, 0, 40];
      } else if (simple) {
        if (id === 'printed-rocker' || id.startsWith('rocker-disc-')) piece.position = [0, -35, 0];
        else if (id === 'printed-clamp' || id.startsWith('clamp-')) piece.position = [0, 25, 0];
        else if (id === 'toggle-switch') piece.position = [0, 0, 40];
      } else if (id === 'switch-deck' || id === 'toggle-switch') piece.position = [0, 0, 20];
      else if (
        id.startsWith('rod-guide-') ||
        id.startsWith('guide-lock-') ||
        id.startsWith('guide-shaft-') ||
        id.startsWith('fork-') ||
        id.startsWith('contact-pad-') ||
        id.startsWith('crank-') ||
        id.startsWith('disc-') ||
        id.startsWith('pad-')
      )
        piece.position = [0, 0, 60];
    }
  if (isDual(p))
    for (const piece of result) {
      const placement = piece.component.placement!;
      piece.component.placement = {
        translation: dualPanelPoint(placement.translation),
        rotation: [placement.rotation[0], placement.rotation[1], placement.rotation[2] - 90],
      };
      if (piece.position) piece.position = dualPanelPoint(piece.position);
    }
  return result;
}

export function composition(p: Parameters): AssemblyDefinition {
  return {
    components: configured(p, 'assembled').map((p) => p.component),
    issues:
      p.mechanism === 'case-panel'
        ? casePanelAssessment(p)
        : isDual(p)
          ? [
              'The horizontal panel places manual ARM 1 with SAC-01 on the left and servo-operated ARM 2 on the right, with both legends engraved 0.6 mm into the upper carrier. Four PETG parts and three nominal 1.5 mm TPU frames form seven prints.',
              'The 6 mm mounting flange has one flat underside at Z1.5. Three nominal 1.5 mm TPU frames sit outside the PETG, without gasket pockets or blind locating sockets. Four M3 × 30 servo ties and two staggered M3 × 20 rear ties clamp the lower cradle against flat rigid shoulders.',
              'Both switches are clocked with OFF toward the engraved-label edge and the manual cover hinge behind the toggle. The cover opens away from the operator, clear of the servo. Manual cover and toggle positions are independent inspection controls; check actual guard travel, insertion access and trip loads.',
            ]
          : p.mechanism === 'parallel'
            ? [
                'Four PETG parts form the upper flange, removable lower servo/switch cradle, lid and opposed rocker. Two nominal 1.5 mm TPU sheets sit beneath the flat 6 mm flange, with no gasket pockets or blind locating sockets.',
                'Four M3 through-bolts clamp flat rigid shoulders at Z1.5. The bare toggle omits its removable lower washer and nut; the upper nut meets Z6.8. Fit the body pockets and keep the bottom cable and side terminal paths clear.',
                'Measure the actual switch trip force and pivot, calibrate low speed and torque limit and return to neutral after each push. Neither nominal gasket contact nor the body register establishes a physical load or sealing rating.',
              ]
            : p.mechanism !== 'guided'
              ? [
                  'The printed rocker has three custom printed parts and retains the purchased servo and switch interfaces. Fit and physically qualify the printed clamps, mounting floor and cantilever fingers.',
                  'The nominal contact angle uses the reconstructed switch pivot. Measure the actual trip positions and force, calibrate low speed and torque limit, then return to neutral after each push. No physical load rating is assigned.',
                  'Fit captive nuts, verify the source disc hardware engagement, maintain access to terminals and select M4 mounting hardware for the actual enclosure thickness.',
                ]
              : [
                  'Measure the delivered toggle actuation force and pivot before setting fork height, gap and end positions. The CAD pulse and TPU envelope do not establish a force limit.',
                  'Qualify pad material, compression, creep and service life. Calibrate low speed, acceleration and torque limit, pulse the maintained switch, return to neutral and verify the resulting switch state.',
                  'Confirm clamp contact spacing, screw engagement, rod fits, wire clearance and the enclosure mounting stack. Assign toleranced drawings and an acceptance test before production.',
                ],
  };
}

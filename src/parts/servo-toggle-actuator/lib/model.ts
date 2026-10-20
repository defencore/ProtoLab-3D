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
import type { DetailSpec } from './types';

export const kinematics = (p: Parameters) =>
  isParallel(p)
    ? parallelKinematics(p)
    : p.mechanism === 'rocker'
      ? rockerKinematics(p)
      : guidedKinematics(p);
export const libraries = [detail, servo, toggle, ...hardwareLibraries];

function custom(piece: DetailSpec): ConfiguredPiece {
  const component = detailComponent(piece.id, piece.label, piece.shape);
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
    name: 'Waveshare ST3215 12 V with supplied disc pair',
    parameters: {
      ...servo.defaults,
      model: 'st3215-12v',
      showHorn: true,
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
    notes:
      'Original supplier solids retained. The output retaining screw remains the existing unverified CAD-fit reference; measure the delivered retaining hardware.',
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
    },
    state: 'assembled',
    quantity: 1,
    supply: 'purchased',
    placement: {
      translation: [simple || parallel ? 0 : m.switchX, 0, parallel ? v.switchZ : m.switchZ],
      rotation: [0, 0, 0],
    },
    procurement: {
      designation: 'ASW-07D',
      manufacturer: 'DAIER',
      source: 'https://www.chinadaier.com/wp-content/uploads/2018/05/ASW-07D-1.pdf',
    },
    notes:
      'Bare maintained toggle. Its installed 3 mm panel occupies local Z3…6; the lever force and true internal pivot require measurement.',
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
    placement: { translation: [0, -90, 0], rotation: [0, 0, 0] },
    procurement: {
      designation: 'ASW-07D + SAC-01',
      manufacturer: 'DAIER',
      source: 'https://www.chinadaier.com/wp-content/uploads/2018/05/SAC-01.pdf',
    },
    notes:
      'Independent manual switch. The source guard seat at Z9.5 and opening angle are illustrative; fit and check the purchased assembly. No electrical circuit or safety function is assigned.',
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
  const pieces = (
    parallel
      ? parallelDetails(p)
      : simple
        ? rockerDetails(p)
        : [...frame(p), ...servoMount(p), ...drive(p)]
  ).map(custom);
  const result = [
    ...pieces,
    ...purchased(p),
    ...(parallel ? parallelHardware(p) : simple ? rockerHardware(p) : hardware(p)),
  ];
  const repeated = new Map<string, number>();
  for (const piece of result) repeated.set(piece.label, (repeated.get(piece.label) ?? 0) + 1);
  for (const piece of result)
    if (repeated.get(piece.label)! > 1) piece.label += ` · ${piece.component.id}`;
  if (state === 'exploded')
    for (const piece of result) {
      const id = piece.component.id;
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
          piece.position = [0, -30, 25];
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
    issues: isDual(p)
      ? [
          'The horizontal panel places manual ARM 1 with SAC-01 on the left and servo-operated ARM 2 on the right, with both legends engraved 0.6 mm into the upper carrier. Four PETG parts and three nominal 0.8 mm TPU frames form seven prints.',
          'Four M3 × 30 servo ties and two staggered M3 × 20 rear ties clamp the located lower cradle. The rear full-height keyed seat reacts between the source case face and the lower guard adjustment nut at Z6.8; fit the illustrative source stack to the purchased switch.',
          'The rear cover opens sideways clear of the servo. Manual cover and toggle positions are independent inspection controls; no wiring, electrical interlock or safety function is specified. Check actual guard travel, insertion access and switch trip loads.',
        ]
      : p.mechanism === 'parallel'
        ? [
            'Four PETG parts form the upper flange, removable lower servo/switch cradle, lid and opposed rocker. Two nominal 0.8 mm TPU gaskets fit flush into shallow recesses; rigid seating lands preserve alignment.',
            'Four M3 through-bolts clamp the located split housing. Fit the servo and switch body pockets, verify nut engagement and keep the bottom cable and side terminal paths clear.',
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

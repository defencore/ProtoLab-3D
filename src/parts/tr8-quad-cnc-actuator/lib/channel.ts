import { Euler, Matrix4 } from 'three';
import { detailComponent } from '../../../core/component-recipes';
import { cylinder, subtract, type Shape, type Vec } from '../../../core/assembly/boundary/shapes';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import type { Parameters } from '../../../core/types';
import {
  actuatorPieces,
  actuatorLibraries,
  actuatorFastenerPiece,
  configureActuatorPiece,
  alignActuatorThreads,
} from '../../tr8-compact-actuator/part';
import dowel from '../../dowel-pin/part';
import { linkage, outputBearing, nutTravel, type CncLayout } from './layout';
import {
  carrierShape,
  forkShape,
  outputShaftShape,
  outputSleeves,
  driveShapes,
  crossPinDatum,
} from './linkage';

export const libraries = [...actuatorLibraries, dowel];
const outputBearingParameters = { ...outputBearing, seals: 'metal', balls: 10 };

function custom(id: string, label: string, shape: Shape, color = 0xaeb8c0): ConfiguredPiece {
  const component = detailComponent(id, label, shape),
    fork = id.endsWith('-crank');
  const turned = /shaft|spacer|screw/.test(id);
  component.manufacturing = {
    material:
      fork || turned ? 'Steel; grade and fit per production drawing' : 'Aluminium alloy 6061-T6',
    blank: fork
      ? '3 mm steel sheet'
      : id === 'lead-screw'
        ? 'TR8×8(P2), 250 mm threaded stock'
        : id === 'output-shaft'
          ? 'Ø6 steel round bar; plain closed inner end'
          : 'Stock sized to the detail drawing',
    processes: fork
      ? ['cutting', 'drilling', 'milling']
      : turned
        ? ['turning', 'drilling']
        : ['milling', 'drilling'],
    requirements: [
      fork
        ? 'Finish the slot and shaft bore; match-drill/ream the transverse Ø2 hole with the shaft before pressing the dowel.'
        : 'Assign manufacturing fits, surface finish and load qualification before manufacture.',
    ],
  };
  return { component, label, color, requireSingleSolid: true };
}

/** All purchased internals remain real library configurations; only one outward fork is installed. */
export function channelPieces(
  p: Parameters,
  angle: number,
  layout: CncLayout,
  unit = 0,
): ConfiguredPiece[] {
  if (!Number.isInteger(unit) || unit < 0 || unit >= layout.outputStations.length)
    throw new Error('A CNC drive needs one of its four unit indices.');
  const outputX = layout.outputStations[unit],
    travel = nutTravel(layout, angle),
    phase = (-360 * travel) / 8;
  const rotationEuler = new Euler().setFromRotationMatrix(
    new Matrix4()
      .makeRotationY(Math.PI / 2)
      .multiply(new Matrix4().makeRotationZ((phase * Math.PI) / 180)),
    'ZYX',
  );
  const spinRotation = [rotationEuler.x, rotationEuler.y, rotationEuler.z].map(
    (v) => (v * 180) / Math.PI,
  ) as Vec;
  const kept = actuatorPieces({ ...p, outputAngle: angle })
    .filter(
      ({ component: c }) =>
        c.id === 'gearmotor' ||
        c.id === 'coupling' ||
        c.id.startsWith('screw-bearing-') ||
        c.id.startsWith('screw-circlip-') ||
        c.id.startsWith('output-bearing-') ||
        c.id === 'output-circlip-1' ||
        c.id.startsWith('motor-front-M2-'),
    )
    .map((piece) => {
      const c = piece.component,
        t = [...c.placement.translation] as Vec;
      if (c.id === 'gearmotor') {
        t[0] = layout.motorFront;
        t[2] = layout.lever;
      }
      if (c.id === 'coupling') {
        t[0] = layout.couplingCentre;
        t[2] = layout.lever;
      }
      if (c.id.startsWith('motor-front-M2-')) {
        t[0] += layout.motorFront + 51;
        t[2] += layout.lever - 10;
      }
      if (c.id.startsWith('screw-bearing-')) {
        t[0] = layout.screwBearingCentres[Number(c.id.at(-1))];
        t[2] = layout.lever;
      }
      if (c.id.startsWith('screw-circlip-')) {
        t[0] = layout.screwClipCentres[Number(c.id.at(-1))];
        t[2] = layout.lever;
      }
      const bearing = c.id.startsWith('output-bearing-');
      if (bearing) {
        t[0] = outputX;
        t[1] = layout.outputBearingCentres[Number(c.id.at(-1))];
        t[2] = 0;
      }
      if (c.id === 'output-circlip-1') {
        t[0] = outputX;
        t[1] = layout.outputClip;
        t[2] = 0;
      }
      const label = bearing
        ? `${c.id.endsWith('0') ? 'Inner' : 'Outer'} opposed-flange output bearing · EZO SMF106ZZ`
        : piece.label;
      const component = {
        ...c,
        name: bearing ? label : c.name,
        parameters: bearing
          ? { ...outputBearingParameters }
          : c.id === 'gearmotor'
            ? { ...c.parameters, outputAngle: ((((phase + 180) % 360) + 360) % 360) - 180 }
            : c.parameters,
        placement: {
          ...c.placement,
          translation: t,
          rotation:
            c.id === 'coupling' || c.id.startsWith('screw-circlip-')
              ? spinRotation
              : c.placement.rotation,
        },
      };
      if (bearing) {
        delete component.presetId;
        component.procurement = {
          designation: 'EZO SMF106ZZ · 6×10×3 · flange Ø11.2 × 0.6',
          manufacturer: 'EZO / Sapporo Precision',
          source: 'https://www.ezo-brg.co.jp/english/product/spec.php?eid=00582',
        };
      }
      return { ...piece, label, component };
    });
  const drive = driveShapes(layout, outputX, travel);
  const nut = custom(
    'lead-nut',
    'TR8×8(P2) purchased H nut · long-Z orientation',
    drive.nut,
    0xc7a448,
  );
  nut.component.supply = 'purchased';
  delete nut.component.manufacturing;
  nut.component.procurement = {
    designation: 'TR8×8(P2) H nut · 22×11×15',
    manufacturer: 'User-supplied nut drawing',
    source: 'User-supplied TR8 H-flange nut drawing (public URL unavailable)',
  };
  const result = [
    ...kept,
    custom(
      'lead-screw',
      `TR8×8(P2) · ${layout.screwEnds[1] - layout.screwEnds[0]} mm finished`,
      drive.screw,
    ),
    nut,
    custom(
      'nut-yoke',
      'One-sided nut carrier · integral outward follower · machined anti-roll flat',
      carrierShape(layout, outputX + travel),
      0xc7a448,
    ),
    custom(
      'output-shaft',
      'Ø6 outward shaft · plain closed end · one DIN 471 groove',
      outputShaftShape(layout, outputX, angle),
    ),
    custom(
      'output-rear-crank',
      'One outward steel closed-slot fork · Ø2 pressed cross-pin',
      forkShape(layout, outputX, angle),
      0x759bb3,
    ),
    ...outputSleeves(layout, outputX, angle).map((item) =>
      custom(item.id, 'SMF106 inner-race-only sleeve · Ø6.85', item.shape),
    ),
    ...layout.screwSpacerStarts.map((start, index) =>
      custom(
        [
          'fixed-outer-spacer',
          'fixed-inner-spacer',
          'floating-inner-spacer',
          'floating-outer-spacer',
        ][index],
        'Screw inner-race sleeve · 5.05×7.6×0.5',
        subtract(
          cylinder(3.8, 0.5, [start, 0, layout.lever], 'x'),
          cylinder(2.525, 0.7, [start - 0.1, 0, layout.lever], 'x'),
        ),
      ),
    ),
    ...[-8, 8].map((offset) =>
      actuatorFastenerPiece({
        id: `nut-flange-${offset < 0 ? 'negative' : 'positive'}`,
        diameter: 3,
        length: 8,
        underHead: [outputX + travel - 6, 0, layout.lever + offset],
        direction: [1, 0, 0],
        head: 'button',
      }),
    ),
  ];
  const datum = crossPinDatum(outputX, angle);
  const pin = configureActuatorPiece(
    dowel,
    datum.id,
    'Pressed cross-pin · ISO 8734 Ø2×10',
    {
      ...dowel.defaults,
      form: 'straight',
      diameter: linkage.crossPinDiameter,
      length: linkage.crossPinLength,
      chamfer: 0.1,
    },
    datum.origin,
    datum.rotation,
    'assembled',
    0x87919c,
  );
  pin.component.supply = 'purchased';
  delete pin.component.manufacturing;
  pin.component.procurement = {
    designation: 'ISO 8734 Ø2×10 m6 hardened steel dowel',
    manufacturer: 'FIBRO or dimensionally equivalent supplier',
    source: 'https://static.shop.fibro.com/assets/EN/document/doc_2351_1_english.pdf',
  };
  result.push(pin);
  return alignActuatorThreads(result);
}

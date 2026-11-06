import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import { box, cylinder, subtract, union, type Shape } from '../../../core/assembly/boundary/shapes';
import { actuatorFastenerPiece, alignActuatorThreads } from '../../tr8-compact-actuator/part';
import { type CncLayout, type Vec, outputBearing } from './layout';

const discThickness = 3;
const podRadius = 7.1;
const outputSeatRadius = 5.01;
const screwSeatRadius = 6.51;
const screwFlangeReliefRadius = 7.6;
const postTapDepth = 8;

function channelShape(layout: CncLayout, child: Shape, index: number): Shape {
  const angle = layout.clock + 90 * index;
  const radians = angle * Math.PI / 180;
  return {
    kind: 'transform', child,
    translation: [0, layout.outputRadial * Math.cos(radians), layout.outputRadial * Math.sin(radians)],
    rotation: [angle, 0, 0],
  };
}

function postLines(layout: CncLayout): [number, number][] {
  return [0, 1, 2, 3].map((index) => {
    const angle = (layout.postClock + 90 * index) * Math.PI / 180;
    return [layout.postRadius * Math.cos(angle), layout.postRadius * Math.sin(angle)];
  });
}

function tappedHole(origin: Vec, length: number): Shape {
  return {
    kind: 'cylinder', radius: 1.5, height: length, origin, axis: 'x',
    thread: { pitch: .5, internal: true, radialClearance: .05, designation: 'M3x0.5' },
  };
}

/** One finished CNC body includes the central disc, all posts and bearing pods. */
export function cncMiddleShape(layout: CncLayout): Shape {
  const [baseBack, baseFront] = layout.middleBase;
  const postBack = layout.motorPlateX + discThickness;
  const postFront = layout.endPlateX;
  const innerPodFace = layout.outputBearingCentres[0] - outputBearing.width / 2 + outputBearing.flangeWidth;
  const outerPodFace = layout.outputBearingCentres[1] + outputBearing.width / 2 - outputBearing.flangeWidth;
  const podLength = outerPodFace - innerPodFace;
  const staggered = layout.variant === 'staggered-56';
  const webHalfHeight = staggered ? 2 : 3;
  const stock: Shape[] = [cylinder(layout.diameter / 2, baseFront - baseBack, [baseBack, 0, 0], 'x')];
  const cuts: Shape[] = [];

  for (const [index, [postY, postZ]] of postLines(layout).entries()) {
    stock.push(cylinder(layout.postDiameter / 2, postFront - postBack, [postBack, postY, postZ], 'x'));
    // Each tool extends 0.1 mm through its entry face; 8 mm remains in the post.
    cuts.push(tappedHole([postBack - .1, postY, postZ], postTapDepth + .1));
    cuts.push(tappedHole([postFront - postTapDepth, postY, postZ], postTapDepth + .1));

    const station = layout.outputStations[index];
    stock.push(channelShape(layout, union(
      cylinder(podRadius, podLength, [station, innerPodFace, 0], 'y'),
      box([station - baseFront, podLength, 2 * webHalfHeight], [baseFront, innerPodFace, -webHalfHeight]),
    ), index));
    cuts.push(channelShape(layout,
      cylinder(outputSeatRadius, podLength + .2, [station, innerPodFace - .1, 0], 'y'), index));
    if (staggered) {
      // The output flange passes through the intersecting integral post.
      cuts.push(channelShape(layout,
        cylinder(5.7, 8, [station, outerPodFace, 0], 'y'), index));
    }
    cuts.push(channelShape(layout,
      cylinder(screwSeatRadius, baseFront - baseBack + .2, [baseBack - .1, 0, layout.lever], 'x'), index));
    cuts.push(channelShape(layout,
      cylinder(screwFlangeReliefRadius, baseFront - discThickness - baseBack + .1, [baseBack - .1, 0, layout.lever], 'x'), index));
  }
  return subtract(union(...stock), union(...cuts));
}

function outerDiscShape(layout: CncLayout, motor: boolean): Shape {
  const station = motor ? layout.motorPlateX : layout.endPlateX;
  const cuts: Shape[] = postLines(layout).map(([y, z]) =>
    cylinder(1.7, discThickness + .2, [station - .1, y, z], 'x'));
  for (let index = 0; index < 4; index++) {
    if (motor) {
      cuts.push(channelShape(layout, cylinder(3.1, 3.2, [station - .1, 0, layout.lever], 'x'), index));
      for (const offset of [-5.25, 5.25]) {
        cuts.push(channelShape(layout,
          cylinder(1.1, 3.2, [station - .1, 0, layout.lever + offset], 'x'), index));
      }
    } else {
      cuts.push(channelShape(layout,
        cylinder(screwSeatRadius, 3.2, [station - .1, 0, layout.lever], 'x'), index));
    }
  }
  return subtract(cylinder(layout.diameter / 2, discThickness, [station, 0, 0], 'x'), union(...cuts));
}

function frameDetail(id: string, label: string, shape: Shape, layout: CncLayout, milled: boolean): ConfiguredPiece {
  const component = detailComponent(id, label, shape);
  const blankLength = layout.endPlateX - layout.motorPlateX - discThickness;
  component.manufacturing = {
    material: 'Steel; grade and production fits per drawing',
    blank: milled ? `Round billet, diameter ${layout.diameter} x ${blankLength} mm minimum plus machining allowance` : '3 mm steel sheet',
    processes: milled ? ['milling', 'drilling'] : ['cutting', 'drilling'],
    requirements: milled ? [
      'Machine the middle disc, four posts and all output-bearing supports as one piece; do not add separate columns or cheeks.',
      'Finish the eight output-bearing seats to the assigned fit; the model uses diameter 10.02 mm. Opposed SMF106ZZ flanges sit outside each pod.',
      'Finish the fixed screw-bearing seats to the assigned fit; the model uses diameter 13.02 mm and a diameter 15.2 mm rear flange relief.',
      'Tap the eight post-end holes M3x0.5 to 8 mm depth. Each M3x8 end bolt engages 5 mm beyond its 3 mm outer disc.',
      layout.variant === 'staggered-56'
        ? 'Index four radial output-bearing bores and diameter 11.4 mm outward flange reliefs through the intersecting posts.'
        : 'Index four radial output-bearing bores after machining the axial pockets.',
      'Assign root fillets, surface finish, bearing fits and material grade; verify frame deflection, post loads and bearing capacity before manufacture.',
    ] : [
      'Cut one circular profile and the supplied holes from 3 mm steel; deburr and finish the assigned bearing or motor fits.',
      'The four M3 clearance holes are diameter 3.4 mm; fit to the integral CNC posts with M3x8 bolts.',
    ],
  };
  return { component, label, color: milled ? 0x79909f : 0xb6bec6, requireSingleSolid: true };
}

/** Two outer discs bolt directly to the eight tapped ends of the integral posts. */
export function cncFramePieces(layout: CncLayout): ConfiguredPiece[] {
  const result: ConfiguredPiece[] = [
    frameDetail('cnc-middle-body', `CNC middle body - diameter ${layout.diameter} - integral posts and bearing pods`, cncMiddleShape(layout), layout, true),
    frameDetail('cnc-motor-disc', `Motor disc - diameter ${layout.diameter} x 3 mm`, outerDiscShape(layout, true), layout, false),
    frameDetail('cnc-end-disc', `End bearing disc - diameter ${layout.diameter} x 3 mm`, outerDiscShape(layout, false), layout, false),
  ];
  for (const [index, [y, z]] of postLines(layout).entries()) {
    result.push(
      actuatorFastenerPiece({ id: `frame-front-bolt-${index + 1}`, diameter: 3, length: 8, underHead: [layout.motorPlateX, y, z], direction: [1, 0, 0] }),
      actuatorFastenerPiece({ id: `frame-rear-bolt-${index + 1}`, diameter: 3, length: 8, underHead: [layout.endPlateX + discThickness, y, z], direction: [-1, 0, 0] }),
    );
  }
  return alignActuatorThreads(result);
}

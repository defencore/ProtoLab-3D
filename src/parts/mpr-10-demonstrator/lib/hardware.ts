import type { Parameters, PartDefinition, Preset } from '../../../core/types';
import motorDefinition from '../../stepper-motor/part';
import screwDefinition from '../../ball-screw/part';
import nutDefinition from '../../ball-nut/part';
import bearingDefinition from '../../ball-bearing/part';
import boltDefinition from '../../bolt-screw/part';
import hexNutDefinition from '../../hex-nut/part';
import eRingDefinition from '../../e-ring/part';
import standoffDefinition from '../../pcb-standoff/part';
import studDefinition from '../../threaded-rod/part';

export const motor: PartDefinition = motorDefinition;
export const screw: PartDefinition = screwDefinition;
export const nut: PartDefinition = nutDefinition;
export const bearing: PartDefinition = bearingDefinition;
export const bolt: PartDefinition = boltDefinition;
export const hexNut: PartDefinition = hexNutDefinition;
export const eRing: PartDefinition = eRingDefinition;
export const standoff: PartDefinition = standoffDefinition;
export const stud: PartDefinition = studDefinition;

function selected(part: PartDefinition, predicate: (preset: Preset) => boolean): Parameters {
  const preset = part.presets.find(predicate);
  if (!preset) throw new Error(`Missing demonstrator hardware selection in ${part.id}.`);
  return { ...part.defaults, ...preset.parameters };
}

export const motorParameters = selected(motor, (row) => row.id === '8hs12-0506s');
export const screwParameters = selected(screw, (row) => row.id === 'sfk0601-100');
export const nutParameters = selected(nut, (row) => row.id === 'sfk0601');

// Shielded 688 bearings are 5 mm wide; open 688A bearings can be only 4 mm wide.
// Internal ball/cage geometry remains the existing library's representative model.
export const outputBearingParameters = selected(
  bearing,
  (row) =>
    row.parameters.bore === 8 &&
    row.parameters.outer === 16 &&
    row.parameters.width === 5 &&
    row.parameters.seals === 'metal',
);
export const screwBearingParameters = selected(
  bearing,
  (row) =>
    row.parameters.bore === 4 &&
    row.parameters.outer === 9 &&
    row.parameters.width === 4 &&
    row.parameters.seals === 'metal',
);
export const followerBearingParameters = selected(
  bearing,
  (row) =>
    row.parameters.bore === 3 &&
    row.parameters.outer === 7 &&
    row.parameters.width === 3 &&
    row.parameters.seals === 'metal',
);

/** Source-drawn motor interface. Mounting face Z=0; body extends towards -Z. */
export const motorInterface = {
  designation: 'STEPPERONLINE 8HS12-0506S',
  frame: 20.3,
  bodyLength: 28.3,
  shaftDiameter: 4,
  shaftExtension: 10,
  pilotDiameter: 16,
  pilotHeight: 1.5,
  squareHolePitch: 15.4,
  mountingThread: 'M2',
  minimumThreadDepth: 2.5,
} as const;

/** Manufacturer SFK0601 nut interface; shaft-end machining is a separate choice. */
export const screwInterface = {
  designation: 'Wangong SFK0601',
  shaftDiameter: 6,
  lead: 1,
  nutDiameter: 12,
  nutLength: 15,
  flangeDiameter: 24,
  flangeWidth: 16,
  flangeThickness: 3.5,
  mountingCircle: 18,
  mountingHoleDiameter: 3.4,
  mountingHoleCount: 4,
} as const;

export function socketBoltParameters(diameter: 2 | 3 | 5, length: number): Parameters {
  return selected(
    bolt,
    (row) =>
      row.parameters.diameter === diameter &&
      row.parameters.length === length &&
      row.parameters.head === 'socket-cap',
  );
}

export const outputEClipParameters = {
  ...selected(eRing, (row) => row.parameters.grooveDiameter === 6),
  installedGrooveDiameter: 6,
};
export const screwEClipParameters = {
  ...selected(eRing, (row) => row.parameters.grooveDiameter === 3.2),
  installedGrooveDiameter: 3.2,
};
export const lowerStandoffParameters = selected(standoff, (row) => row.id === 'dremec-138x20');
export const upperStandoffParameters = selected(standoff, (row) => row.id === 'dremec-138x30');

export const hardwareSources = [
  {
    label: 'American Ring DIN 6799 size 6 shaft groove dimensions',
    url: 'https://www.americanring.com/products/snap-ring.aspx?item=DIN6799-006&units=metric',
  },
  {
    label: 'American Ring DIN 6799 size 3.2 shaft groove dimensions',
    url: 'https://www.americanring.com/products/snap-ring.aspx?item=DIN6799-3.2&units=metric',
  },
  {
    label: 'Wangong SFK miniature screw and nut dimensions',
    url: 'https://www.wangong.net/product/ball-screw/mini-type-sfk-series-ball-screw.html',
  },
  {
    label: 'STEPPERONLINE 8HS12-0506S specifications',
    url: 'https://www.omc-stepperonline.com/nema-8-unipolar-1-8deg-1-2ncm-1-70oz-in-0-5a-20x20x28mm-6-wires-8hs12-0506s',
  },
  {
    label: 'STEPPERONLINE 8HS12-0506S dimensional drawing',
    url: 'https://www.omc-stepperonline.com/image/catalog/dimensions/8HS12-0506S_Dimension.svg',
  },
  {
    label: 'NSK 688AZZ1 shielded bearing envelope 8 × 16 × 5 mm',
    url: 'https://www.nsk.com/in-en/engineering/products/bearings/ball-bearings/deep-groove-ball-bearings/extra-small-ball-bearings-and-miniature-ball-bearings-metric-series/688azz1-esm-md.html',
  },
  {
    label: 'NSK 684AZZ1 shielded bearing envelope 4 × 9 × 4 mm',
    url: 'https://www.nsk.com/in-en/engineering/products/bearings/ball-bearings/deep-groove-ball-bearings/extra-small-ball-bearings-and-miniature-ball-bearings-metric-series/684azz1-esm-md.html',
  },
  {
    label: 'EZO 683ZZ shielded follower bearing envelope 3 × 7 × 3 mm',
    url: 'https://www.ezo-brg.co.jp/english/product/spec.php?eid=00191&unit=mm',
  },
];

export const hardwareLibraries: PartDefinition[] = [
  motor,
  screw,
  nut,
  bearing,
  bolt,
  hexNut,
  eRing,
  standoff,
  stud,
];

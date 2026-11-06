import type { Parameters } from '../../../core/types';

export interface BearingSize {
  id: string;
  bore: number;
  outer: number;
  width: number;
  flangeOuter: number;
  flangeWidth: number;
  source: string;
}
export const frontBearings: BearingSize[] = [
  {
    id: 'F6802ZZ',
    bore: 15,
    outer: 24,
    width: 5,
    flangeOuter: 26,
    flangeWidth: 1.1,
    source:
      'https://www.smbbearings.com/firebrick/ckeditor/plugins/upload/Uploads/Documents/bearingpdfs/F6802ZZ-flanged-thin-section-bearing-15x24x5mm.pdf',
  },
  {
    id: 'F6804ZZ',
    bore: 20,
    outer: 32,
    width: 7,
    flangeOuter: 35,
    flangeWidth: 1.5,
    source:
      'https://www.smbbearings.com/firebrick/ckeditor/plugins/upload/Uploads/Documents/bearingpdfs/F6804ZZ-flanged-thin-section-bearing-20x32x7mm.pdf',
  },
];
export const innerBearing: BearingSize = {
  id: 'F688ZZ',
  bore: 8,
  outer: 16,
  width: 5,
  flangeOuter: 18,
  flangeWidth: 1.1,
  source:
    'https://www.smbbearings.com/firebrick/ckeditor/plugins/upload/Uploads/Documents/bearingpdfs/F688ZZ-flanged-miniature-bearing-8x16x5mm.pdf',
};
export const wormBearings: BearingSize[] = [
  {
    id: 'F685ZZ',
    bore: 5,
    outer: 11,
    width: 5,
    flangeOuter: 12.5,
    flangeWidth: 1,
    source: 'https://www.fitrunbearing.com/product/f685zz/',
  },
  {
    id: 'F625ZZ',
    bore: 5,
    outer: 16,
    width: 5,
    flangeOuter: 18,
    flangeWidth: 1,
    source: 'https://koyo.jtekt.co.jp/en/products/detail/?pno=F625+ZZ',
  },
];
export const tr8 = {
  diameter: 8,
  pitchDiameter: 7,
  pitch: 2,
  lead: 8,
  starts: 4,
  includedAngle: 30,
} as const;
export interface Station {
  from: number;
  to: number;
  diameter: number;
  label: string;
}
export interface Groove {
  center: number;
  width: number;
  diameter: number;
  ring: 5 | 8 | 10;
}

export function layout(p: Parameters, state = 'assembled') {
  const front =
    p.frontBearing === 'custom'
      ? {
          id: 'custom',
          bore: Number(p.frontBore),
          outer: Number(p.frontOuter),
          width: Number(p.frontWidth),
          flangeOuter: Number(p.frontFlangeOuter),
          flangeWidth: Number(p.frontFlangeWidth),
          source: 'Select the actual flanged bearing supplier drawing',
        }
      : frontBearings.find((b) => b.id === p.frontBearing)!;
  const inner = innerBearing,
    wormBearing = wormBearings.find((b) => b.id === p.wormBearing)!;
  const travel = Number(p.travel),
    targetTurns = Number(p.inputTurns),
    gap = Number(p.clearance);
  const module = tr8.pitch / Math.PI,
    squareAF = 10,
    plateThickness = Number(p.plateThickness);
  const meshClearance = Number(p.meshClearance),
    backlash = Number(p.backlash),
    rootDiameter = Number(p.screwRootDiameter);
  // Bearing clearance and requested input motion choose integer teeth. TR8 pitch never changes.
  const minimumRadius = Math.max(
    front.outer / 2 + 0.5 + meshClearance + gap,
    (Math.SQRT2 * squareAF) / 2 + 3,
  );
  const teeth =
    4 * Math.ceil(Math.max(32, Math.PI * minimumRadius, (4 * 360 * targetTurns) / travel) / 4);
  const pitchRadius = (teeth * tr8.pitch) / (2 * Math.PI),
    ratio = teeth / tr8.starts;
  const centerDistance = pitchRadius + tr8.pitchDiameter / 2 + meshClearance;
  const gearTipRadius = centerDistance - rootDiameter / 2 - meshClearance;
  const hubRadius = (Math.SQRT2 * squareAF) / 2 + 2;
  const halfSector = travel / 2 + (2 * 360) / teeth;
  const wall = Number(p.housingWall),
    seatClearance = Number(p.seatClearance),
    washerThickness = 0.65;
  const gearTop = plateThickness / 2,
    gearBottom = -plateThickness / 2;
  const gearClip: Groove = {
    center: gearBottom - 1.15,
    width: 1.1,
    diameter: 9.6,
    ring: 10,
  };
  const gearWasherBottom = gearClip.center + 0.5;
  const landBottom = gearClip.center - gearClip.width / 2 - 0.25;
  const innerTop = landBottom - 0.15,
    innerBottom = innerTop - inner.width;
  const rearClip: Groove = {
    center: innerBottom - 1.05,
    width: 0.9,
    diameter: 7.6,
    ring: 8,
  };
  const rearWasherBottom = rearClip.center + 0.4;
  const sleeveBottom = rearClip.center - rearClip.width / 2 - 0.7;
  const frontBottom = gearTop + gap,
    frontTop = frontBottom + front.width;
  const sleeveHeadBottom = frontTop + 0.15,
    sleeveHeadThickness = 1.5;
  const sleeveHeadTop = sleeveHeadBottom + sleeveHeadThickness;
  const sleeveHeadRadius = front.bore / 2 + 1.5;
  const mountHoleSpacing = 9;
  const thrustShims = { front: 0.15, gear: washerThickness, rear: 0.65, worm: 0.75 };
  const wormAxisZ = 0;
  const bearingOffset = 0.35 + 0.7 + 0.1 + 0.5 + 0.1;
  const standOff = Math.sqrt(
    Math.max(0, (gearTipRadius + gap) ** 2 - (centerDistance - wormBearing.outer / 2) ** 2),
  );
  const wormLength = 2 * Math.ceil(Math.max(8, standOff - bearingOffset + 0.5));
  const threadHalf = wormLength / 2;
  const wormInnerClip = threadHalf + 0.35 + 0.7 / 2;
  const wormBearingStart = threadHalf + bearingOffset;
  const wormBearingEnd = wormBearingStart + wormBearing.width;
  const wormOuterClip = wormBearingEnd + 0.1 + 0.5 + 0.1 + 0.7 / 2;
  const wormEnd = wormOuterClip + 0.7 / 2 + 0.7;
  const driveEnd = wormEnd + Number(p.driveStubLength);
  const wormGrooves: Groove[] = [-1, 1].flatMap((s) =>
    [wormInnerClip, wormOuterClip].map((x) => ({
      center: s * x,
      width: 0.7,
      diameter: 4.8,
      ring: 5 as const,
    })),
  );
  const screwStations: Station[] = [
    { from: -wormEnd, to: -threadHalf, diameter: 5, label: 'Turn left bearing journal' },
    { from: -threadHalf, to: threadHalf, diameter: 8, label: 'Retain Tr8x8(P2) four-start thread' },
    { from: threadHalf, to: wormEnd, diameter: 5, label: 'Turn right bearing journal' },
    { from: wormEnd, to: driveEnd, diameter: 4, label: 'Turn drive coupling stub' },
  ];
  const sleeveStations: Station[] = [
    {
      from: sleeveBottom,
      to: landBottom,
      diameter: 8,
      label: 'Inner bearing journal; DIN471-8 groove',
    },
    {
      from: landBottom,
      to: gearBottom,
      diameter: 10,
      label: 'Gear retaining-ring land; DIN471-10 groove',
    },
    { from: gearBottom, to: gearTop, diameter: squareAF, label: 'Mill 10 mm AF square gear seat' },
    { from: gearTop, to: sleeveHeadBottom, diameter: front.bore, label: 'Outer bearing journal' },
    {
      from: sleeveHeadBottom,
      to: sleeveHeadTop,
      diameter: 2 * sleeveHeadRadius,
      label: 'External mounting shoulder with two blind M3 holes',
    },
  ];
  const angle =
    state === 'negative-limit'
      ? -travel / 2
      : state === 'positive-limit'
        ? travel / 2
        : Number(p.outputAngle);
  const wormAngle = angle * ratio;
  const bodyDepth = sleeveHeadTop - sleeveBottom;
  return {
    front,
    inner,
    wormBearing,
    travel,
    targetTurns,
    gap,
    module,
    squareAF,
    plateThickness,
    meshClearance,
    backlash,
    rootDiameter,
    teeth,
    pitchRadius,
    ratio,
    centerDistance,
    gearTipRadius,
    hubRadius,
    halfSector,
    wall,
    seatClearance,
    washerThickness,
    gearTop,
    gearBottom,
    gearWasherBottom,
    gearClip,
    landBottom,
    innerTop,
    innerBottom,
    rearWasherBottom,
    rearClip,
    sleeveBottom,
    frontBottom,
    frontTop,
    sleeveHeadBottom,
    sleeveHeadThickness,
    sleeveHeadTop,
    sleeveHeadRadius,
    mountHoleSpacing,
    thrustShims,
    wormAxisZ,
    wormLength,
    threadHalf,
    wormInnerClip,
    wormBearingStart,
    wormBearingEnd,
    wormOuterClip,
    wormEnd,
    driveEnd,
    wormGrooves,
    screwStations,
    sleeveStations,
    angle,
    wormAngle,
    bodyDepth,
    actualTurns: (travel * ratio) / 360,
  };
}
export type Layout = ReturnType<typeof layout>;

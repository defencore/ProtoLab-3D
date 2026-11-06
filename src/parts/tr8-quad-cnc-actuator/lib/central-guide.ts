import { box, union, type Shape, type Vec } from '../../../core/assembly/boundary/shapes';
import { linkage, nutTravel, type CncLayout } from './layout';

/** Nominal running geometry; production fits and surface finish remain drawing items. */
export const centralGuide = {
  runningGap: .05,
  finThickness: 1.5,
  rootOverlap: .1,
  coreFinOverlap: .2,
  padEndMargin: .3,
  axialEndMargin: .5,
} as const;

export function centralGuideLayout(layout: CncLayout) {
  const coreHalfWidth = layout.outputRadial - linkage.coverHalfWidth - centralGuide.runningGap;
  const xStart = layout.middleBase[1] - centralGuide.rootOverlap;
  const xEnd = Math.max(...layout.outputStations) + nutTravel(layout, 20) + linkage.coverEndOffset + centralGuide.axialEndMargin;
  return {
    coreHalfWidth,
    xSpan: [xStart, xEnd] as const,
    finThickness: centralGuide.finThickness,
    localFaceY: -linkage.coverHalfWidth - centralGuide.runningGap,
    localZSpan: [coreHalfWidth - centralGuide.coreFinOverlap, layout.lever + 4 + centralGuide.padEndMargin] as const,
    coreFaceZSpan: [-coreHalfWidth, coreHalfWidth] as const,
    combinedFaceZSpan: [-coreHalfWidth, layout.lever + 4 + centralGuide.padEndMargin] as const,
    padZSpan: [layout.lever - 4, layout.lever + 4] as const,
    runningGap: centralGuide.runningGap,
    commonClock: layout.clock,
  };
}

/** Four integral faces form a pinwheel around a small square spine, rather than a filled cross. */
export function centralGuideFaces(layout: CncLayout) {
  const specification = centralGuideLayout(layout);
  return layout.outputStations.map((station, channel) => {
    const clock = layout.clock + 90 * channel, radians = clock * Math.PI / 180;
    return {
      channel,
      clock,
      origin: [0, layout.outputRadial * Math.cos(radians), layout.outputRadial * Math.sin(radians)] as Vec,
      rotation: [clock, 0, 0] as Vec,
      xSpan: specification.xSpan,
      localFaceY: specification.localFaceY,
      localZSpan: specification.localZSpan,
      coreFaceZSpan: specification.coreFaceZSpan,
      combinedFaceZSpan: specification.combinedFaceZSpan,
      padZSpan: specification.padZSpan,
      padXEnvelope: [station - nutTravel(layout, 20) - 2.5, station + nutTravel(layout, 20) + linkage.coverEndOffset] as const,
      runningGap: specification.runningGap,
      finThickness: specification.finThickness,
    };
  });
}

/** Add to the finished CNC body: the back 0.1 mm intersects the existing 5 mm middle base. */
export function guideShape(layout: CncLayout): Shape {
  const spec = centralGuideLayout(layout), [from, to] = spec.xSpan;
  if (spec.coreHalfWidth <= spec.finThickness || spec.localZSpan[0] >= spec.padZSpan[0])
    throw new Error('Central guide requires the authored carrier and CNC arrangement.');
  const core: Shape = {
    kind: 'transform', translation: [0, 0, 0], rotation: [layout.clock, 0, 0],
    child: box([to - from, 2 * spec.coreHalfWidth, 2 * spec.coreHalfWidth], [from, -spec.coreHalfWidth, -spec.coreHalfWidth]),
  };
  const fins: Shape[] = centralGuideFaces(layout).map(face => ({
    kind: 'transform', translation: face.origin, rotation: face.rotation,
    child: box([to - from, spec.finThickness, spec.localZSpan[1] - spec.localZSpan[0]],
      [from, spec.localFaceY - spec.finThickness, spec.localZSpan[0]]),
  }));
  return union(core, ...fins);
}

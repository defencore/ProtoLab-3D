import type { Parameters } from '../../../core/types';
import { cylinder, subtract, union, type Shape, type Vec } from '../../../core/assembly/boundary/shapes';
import { caseElectronicsLayout } from './case-electronics-layout';
import { caseBrassLayout } from './case-brass-supports';
import { caseLowerFloorFootprint } from './case-lower-split';

type Point = readonly [number, number];
export const electronicsAdapterIds = [
  'case-electronics-hat-adapter',
  'case-electronics-heltec-adapter',
  'case-electronics-buck-1-adapter',
  'case-electronics-buck-2-adapter',
  'case-electronics-filter-1-adapter',
  'case-electronics-adc-adapter',
  'case-electronics-filter-2-adapter',
] as const;
const definitions = [
  { id: electronicsAdapterIds[0], boardId: 'case-servo-driver-hat', label: 'HAT (A)', axes: [[150, 10], [150, 70], [190, 70]], orientation: 'horizontal' },
  { id: electronicsAdapterIds[1], boardId: 'case-heltec-v4', label: 'Heltec V4 / LoRa32', axes: [[30, 30], [70, 50]], orientation: 'horizontal' },
  { id: electronicsAdapterIds[2], boardId: 'case-buck-1', label: '12 V BEC', axes: [[10, 10], [10, 30]], orientation: 'vertical' },
  { id: electronicsAdapterIds[3], boardId: 'case-buck-2', label: '5 V BEC', axes: [[10, 50], [10, 70]], orientation: 'vertical' },
  { id: electronicsAdapterIds[4], boardId: 'case-lc-filter-1', label: 'LC1', axes: [[130, 90], [150, 90]], orientation: 'horizontal' },
  { id: electronicsAdapterIds[5], boardId: 'case-adc-cjmcu1220', label: 'ADS1220', axes: [[170, 90], [190, 90]], orientation: 'horizontal' },
  { id: electronicsAdapterIds[6], boardId: 'case-lc-filter-2', label: 'LC2', axes: [[170, 130], [190, 130]], orientation: 'horizontal' },
] as const;
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const nodeId = ([x, y]: Point) => `grid-${x}-${y}`;

/** A square metric interface; not dimensional compatibility with any commercial ecosystem. */
export function caseModularElectronics(p: Parameters) {
  const m = caseElectronicsLayout(p),
    pitch = 20,
    radius = 4.8,
    bottom = m.floorBottom,
    headSeat = bottom + 3.1,
    nodeTop = bottom + 6,
    footTop = nodeTop + 2,
    nutBottom = footTop,
    nutTop = nutBottom + 2.4,
    screwTip = headSeat + 8,
    bankMin = [18.9, 76.9] as const,
    bankMax = [111.1, 138.6] as const,
    brass = caseBrassLayout();
  const nodes: { id: string; centre: Point; minZ: number; topZ: number; headSeatZ: number; boreProbe: { min: Vec; max: Vec }; bearingProbe: { centre: Vec; innerRadius: number; outerRadius: number; minimumAreaMm2: number }; webProbe: { centre: Point; minZ: number; maxZ: number; innerRadius: number; outerRadius: number } }[] = [];
  for (let x = 10; x <= 200; x += pitch)
    for (let y = 10; y <= 140; y += pitch) {
      if (x > caseLowerFloorFootprint.centre[0] + caseLowerFloorFootprint.size[0] / 2 - radius - 0.4 || y > caseLowerFloorFootprint.centre[1] + caseLowerFloorFootprint.size[1] / 2 - radius - 0.4) continue;
      if (x > bankMin[0] - radius && x < bankMax[0] + radius && y > bankMin[1] - radius && y < bankMax[1] + radius) continue;
      if (brass.some((s) => distance([x, y], s.at) < radius + 4.5 + 0.4)) continue;
      if (distance([x, y], m.shieldBond) < radius + 4) continue;
      if (x + radius > m.xt60MiddleReactionPier.min[0] && x - radius < m.xt60MiddleReactionPier.max[0] && y + radius > m.xt60MiddleReactionPier.min[1] && y - radius < m.xt60MiddleReactionPier.max[1]) continue;
      nodes.push({
        id: nodeId([x, y]), centre: [x, y], minZ: bottom, topZ: nodeTop, headSeatZ: headSeat,
        boreProbe: { min: [x - 1.65, y - 1.65, bottom - 0.1], max: [x + 1.65, y + 1.65, nodeTop + 0.1] },
        bearingProbe: { centre: [x, y, nodeTop], innerRadius: 1.75, outerRadius: 4.5, minimumAreaMm2: 50 },
        webProbe: { centre: [x, y], minZ: headSeat, maxZ: nodeTop, innerRadius: 1.75, outerRadius: 4.5 },
      });
    }
  const ids = new Set(nodes.map((n) => n.id));
  const probes: Record<string, readonly (readonly [number,number,number,number,number,number])[]> = {
    'case-electronics-hat-adapter': [[145,8.5,148,11.5,.2,1.8],[145,68.5,148,71.5,.2,1.8],[182,68.5,185,71.5,.2,1.8]],
    'case-electronics-heltec-adapter': [[32,28.5,35,31.5,.2,1.5],[68.5,45,71.5,48,.2,1.5]],
    'case-electronics-buck-1-adapter': [[12,8.5,15,11.5,.2,1.8],[8.5,23,11.5,26,.2,1.8],[30,6.7,33,9.7,.2,.7]],
    'case-electronics-buck-2-adapter': [[12,48.8,15,51.8,.2,1.8],[8.5,63,11.5,66,.2,1.8],[30,48.7,33,51.7,.2,.7]],
    'case-electronics-filter-1-adapter': [[132,88.5,135,91.5,.2,1.8],[145,88.5,148,91.5,.2,1.8]],
    'case-electronics-adc-adapter': [[172,89,175,92,.2,1.8],[185,89,188,92,.2,1.8]],
    'case-electronics-filter-2-adapter': [[171,125.5,174,128.5,.2,1.8],[185,128.5,188,131.5,.2,1.8]],
  };
  const adapters = definitions.map((d) => {
    for (const axis of d.axes) if (!ids.has(nodeId(axis))) throw new Error(`Missing modular node ${nodeId(axis)} for ${d.id}`);
    return {
      id: d.id, boardId: d.boardId, hostIds: [d.boardId], label: d.label, orientation: d.orientation,
      seatRootZ: nodeTop, baseThicknessMm: 2, footTopZ: footTop,
      nutPockets: { loading: 'top-open; hold loose nuts during underside screw installation', axialCaptureWhenUnfastened: false, minimumFullHexWallDepthMm: 1.2, upperPcbClearanceReliefMm: 0.3 },
      loadPathProbes: probes[d.id].map(([x0,y0,x1,y1,z0,z1],i) => ({ id: `${d.id}-load-root-${i+1}`, min: [x0,y0,nodeTop+z0] as Vec, max: [x1,y1,nodeTop+z1] as Vec, minimumWidthMm: 3 })),
      anchors: d.axes.map((axis, i) => ({
        id: `${d.id}-anchor-${i + 1}`, nodeId: nodeId(axis), axisPoint: [...axis, nodeTop] as Vec,
        screwId: `${d.id}-screw-${i + 1}`, nutId: `${d.id}-nut-${i + 1}`,
        underHeadZ: headSeat, screwLengthMm: 8, screwTipZ: screwTip,
        footBottomZ: nodeTop, footTopZ: footTop, nutBottomZ: nutBottom, nutTopZ: nutTop,
        boreDiameterMm: 3.4, nutAcrossFlatsMm: 5.5, nutPocketAcrossFlatsMm: 5.8, nutPocketTopZ: nutTop + 0.3,
        nutInsertion: [0, 0, -1] as Vec,
        footBearingProbe: { centre: [...axis, nodeTop] as Vec, innerRadius: 1.75, outerRadius: 4.5, minimumAreaMm2: 50 },
        footWebProbe: { centre: axis, minZ: nodeTop, maxZ: footTop, innerRadius: 1.75, outerRadius: 4.5 },
      })),
      removal: 'Disconnect leads, lift the complete insert out of the case and support it on the bench. Remove only this adapter\'s recessed underside M3 screws; support the loose anti-rotation nuts until the screws engage; an unfastened open-top pocket does not retain its nut axially. Board retention is independent of the tray.',
    };
  });
  return {
    coordinateSystem: 'operator XYZ, millimetres',
    grid: {
      pitchMm: pitch, origin: [10, 10] as const, axes: ['X', 'Y'] as const,
      boreDiameterMm: 3.4, nodeDiameterMm: 2 * radius, floorBottomZ: bottom, floorTopZ: m.floorTop,
      nodeTopZ: nodeTop, headSeatZ: headSeat, headRecessDiameterMm: 6.2, screwHeadBottomZ: headSeat - 3,
      minimumHeadBottomClearanceMm: 0.1, bearingWebThicknessMm: 2.9,
      nodeCount: nodes.length, nodes,
      reservedRegions: {
        batteryBank: { min: bankMin, max: bankMax, reason: 'Permanent closed protective battery pockets and XT60 reaction supports.' },
        brassAxes: brass.map((s) => ({ id: s.id, centre: s.at, exclusionRadiusMm: radius + 4.5 + 0.4 })),
        shieldBond: { centre: m.shieldBond, exclusionRadiusMm: radius + 4 },
        xt60ReactionPier: m.xt60MiddleReactionPier,
      },
      basis: 'One regular 20 mm square M3 clearance-hole raster with identical raised load nodes. Only permanent battery, brass-support and shield-bond geometry removes nodes; no PCB outline controls the raster. The 20/40 mm rectangular adapter patterns rotate through 90 degrees and move by whole grid increments subject to actual component, cable and structural clearances.',
    },
    fastening: {
      screw: 'Stock socket-cap M3 × 8, inserted from below on the bench',
      nut: 'Ordinary M3 AF5.5 × 2.4, loaded into the small adapter from above before installing its PCB; hold with temporary removable tape until the underside screw engages',
      floorLoadWebMm: 2.9, adapterFootWebMm: 2, totalGripToNutMm: 4.9,
      fullNutEngagementMm: 2.4, tipPastNutMm: 0.7,
      noHardwareBelowFloor: true,
    },
    adapters,
    moduleCount: adapters.length,
    futureModules: {
      horizontal: 'Keep the two or four M3 feet on the same 20 mm raster; edit only the small insulating cradle, tie ports and keeper above them.',
      vertical: 'The two BEC adapters demonstrate a direct straight 90-degree wall with the same M3 feet and broad wall roots. Keep heavy connectors supported and check the full installed and service envelopes for a replacement board.',
      limitations: 'A matching hole raster establishes mounting compatibility only. A moved or substituted board still needs actual electrical, thermal, wiring, EMI, collision and service checks. Reprint only its adapter/keeper when the new board fits the available bay.',
    },
  };
}

/** Identical stock-screw nodes rise from the common flat tray; their counterbores are bottom-open. */
export function caseElectronicsGridNodes(p: Parameters): Shape {
  const g = caseModularElectronics(p).grid;
  return union(...g.nodes.map(({ centre: [x, y] }) => cylinder(g.nodeDiameterMm / 2, g.nodeTopZ - g.floorTopZ + 0.1, [x, y, g.floorTopZ - 0.1])));
}
export function caseElectronicsGridCuts(p: Parameters): Shape[] {
  const g = caseModularElectronics(p).grid;
  return g.nodes.flatMap(({ centre: [x, y] }) => [
    cylinder(g.boreDiameterMm / 2, g.nodeTopZ - g.floorBottomZ + 0.2, [x, y, g.floorBottomZ - 0.1]),
    cylinder(g.headRecessDiameterMm / 2, g.headSeatZ - g.floorBottomZ + 0.1, [x, y, g.floorBottomZ - 0.1]),
  ]);
}

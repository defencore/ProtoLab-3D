import type { PartDefinition, Preset } from '../../../core/types';
import type { Vec } from '../../../core/assembly/boundary/shapes';
import type { FrameHole } from '../../cnc-frame-part/part';
import threadedRod from '../../threaded-rod/part';
import hexNut from '../../hex-nut/part';
import washer from '../../washer/part';
import type { MillingPiece } from './composition';
import type { MillingBuilders } from './builders';
import type { millingLayout } from './layout';

function requirePreset(part: PartDefinition, id: string): Preset {
  const row = part.presets.find((one) => one.id === id);
  if (!row) throw new Error(`Missing source-backed portal preset ${part.id}/${id}.`);
  return row;
}
function requireSource(row: Preset, match: string): string {
  const source = row.catalog?.alternateSourceUrls?.find((url) => url.includes(match));
  if (!source) throw new Error(`Missing exact portal stock/class source ${row.id}/${match}.`);
  return source;
}
const tieNut = requirePreset(hexNut, 'gvyntok-aa23a479b2c3');
const tieWasher = requirePreset(washer, 'gvyntok-bddf036ed0d4');
const tieStock = requirePreset(threadedRod, 'gvyntok-85a99fa56456');
const rodSource = requireSource(tieStock, 'kl-pr-8-8');
const nutSource = requireSource(tieNut, 'kl-pr-8-0');
const washerSource = requireSource(tieWasher, 'hv-200');

/** Raw-stock input for the eight manufactured installed ties; not a finished supplier SKU. */
export const portalTieStockInput = Object.freeze({
  libraryId: threadedRod.id,
  presetId: tieStock.id,
  source: rodSource,
  stockLengthMm: Number(tieStock.parameters.length),
  cutLengthMm: 287.2,
  maximumCutsPerBar: 3,
});

const tap = (axis: FrameHole['axis'], at: Vec, diameter: number, depth: number): FrameHole => ({
  axis,
  at,
  diameter,
  depth,
  threadPitch: ({ 6: 1, 8: 1.25, 10: 1.5 } as Record<number, number>)[diameter],
  threadDesignation: `M${diameter}`,
});
const clearance = (
  axis: FrameHole['axis'],
  at: Vec,
  diameter: number,
  depth: number,
): FrameHole => ({ axis, at, diameter: diameter + 0.6, depth });

/** One real portal side. Primary closed steel sections and all source guide/drive datums remain unchanged. */
export function addPortalSide(
  side: number,
  v: ReturnType<typeof millingLayout>,
  builders: MillingBuilders,
  footHoles: FrameHole[],
  portalBeamHoles: FrameHole[],
  out: MillingPiece[],
): void {
  const { add, fabricated, fastener, washeredM8 } = builders;
  const postX = side * v.portalPostCenterX,
    capThickness = v.portalCapThickness,
    beamBottom = v.beamCenter - v.beamHeight / 2,
    topCapCenter = beamBottom - capThickness / 2,
    bottomCapCenter = v.gantryFootTop + capThickness / 2,
    bottomCapHoles: FrameHole[] = [],
    topCapHoles: FrameHole[] = [];
  // Cut standard threaded stock clamps the real cap/post seats through the open RHS bore.
  for (const dx of [-25, 25])
    for (const dy of [-95, 95]) {
      const worldX = postX + dx,
        worldY = v.portalPostCenterY + dy;
      footHoles.push(
        tap(
          'z',
          [worldX - side * v.footPlateCenterX, worldY, v.footPlateThickness / 2 - 26],
          10,
          26,
        ),
      );
      bottomCapHoles.push(
        clearance('z', [dx, dy, -capThickness / 2 - 0.1], 10, capThickness + 0.2),
      );
      topCapHoles.push({
        ...clearance('z', [dx, dy, -capThickness / 2 - 0.1], 10, capThickness + 0.1),
        counterboreDiameter: 25,
        counterboreDepth: 13.7,
      });
      const id = `portal-post-${side}-tie-${dx}-${dy}`;
      const washerBottom = beamBottom - 13.7,
        nutBottom = washerBottom + Number(tieWasher.parameters.thickness),
        rodTop = nutBottom + Number(tieNut.parameters.height) + 2.8,
        rodLength = portalTieStockInput.cutLengthMm;
      add(
        id + '-washer',
        washer,
        tieWasher.parameters,
        'default',
        [worldX, worldY, washerBottom + Number(tieWasher.parameters.thickness) / 2],
        [0, 0, 0],
        'gantry',
        'mechanism',
        0xb6b9bd,
        tieWasher.id,
      );
      out[out.length - 1].component.procurement = {
        designation: 'DIN 125 M10 hardened steel HV200 washer; material certificate required',
        manufacturer: '',
        source: washerSource,
        standard: 'DIN 125',
      };
      add(
        id,
        threadedRod,
        { ...threadedRod.defaults, ...tieStock.parameters, length: rodLength },
        'default',
        [worldX, worldY, rodTop - rodLength / 2],
        [0, 0, 0],
        'gantry',
        'mechanism',
        0x69727b,
      );
      const rod = out[out.length - 1];
      rod.component.name = 'M10 x 287.2 cut threaded tie / class8.8 stock, certificate pending';
      rod.label = rod.component.name;
      rod.component.supply = 'manufactured';

      rod.component.manufacturing = {
        material: 'Steel property class8.8 threaded stock; actual certificate required',
        blank:
          'Three published M10 x 1000 RH stock bars; cut eight finished ties to287.2 mm, at most3 per bar with kerf/end allowance',
        processes: ['cutting'],
        requirements: [
          `Manufacturing input: M10 x1000 right-hand steel stock class8.8, supplier DIN975 label; ${rodSource}. Confirm delivered DIN976-1 execution and certificate; no supplier identity is assigned to the finished cut detail.`,
          'This cut detail is not a287.2 mm supplier SKU. Purchase certified stock, cut to the released length, deburr and chamfer both ends without damaging the first usable thread.',
          'Verify the delivered DIN975/DIN976-1 execution, property class, coating, cut-end finish, usable engagement and actual nut class before release.',
          'Cut-length tolerance must be released against actual foot and cap datums. After preload, dry-fit the beam and measure at least0.3 mm clearance above every stud tip; nominal geometry gives0.9 mm. Do not trim by moving structural seats.',
          'Preload the tie nuts before installing the beam. Wera8790HMB17x30 socket05003562001 has published23.5 mm front/24 mm rear diameters; the25 mm recess provides at least0.5 mm radial model clearance. Verify actual tool and torque rating for the released preload.',
          'Installed nominal foot engagement24.1 mm, blind-floor reserve1.9 mm and protrusion2.8 mm are geometric checks; release preload/torque, aluminium thread strength and locking method separately.',
        ],
      };
      add(
        id + '-nut',
        hexNut,
        { ...tieNut.parameters, threadAllowance: 0.05 },
        'default',
        [worldX, worldY, nutBottom],
        [0, 0, 0],
        'gantry',
        'mechanism',
        0x69727b,
        tieNut.id,
      );
      out[out.length - 1].component.procurement = {
        designation:
          'DIN934 M10 class8 nut; nominal catalog identity, Full CAD radial inspection allowance0.05 mm, delivered fit/certificate pending',
        manufacturer: '',
        source: nutSource,
        standard: 'DIN 934',
      };
    }
  // The beam seats on the upper cap. Short bolts are reached through actual side ports.
  for (const dx of [-25, 25])
    for (const worldY of [-45, 45]) {
      const worldX = postX + dx;
      topCapHoles.push(
        clearance(
          'z',
          [dx, worldY - v.portalPostCenterY, -capThickness / 2 - 0.1],
          8,
          capThickness + 0.2,
        ),
      );
      portalBeamHoles.push(tap('z', [worldX, worldY, -v.beamHeight / 2], 8, v.beamWall));
      washeredM8(
        `portal-post-${side}-beam-${dx}-${worldY}`,
        capThickness + 10,
        [worldX, worldY, v.portalPostTop],
        [0, 0, -1],
      );
    }
  fabricated(
    `portal-post-${side}-lower-cap`,
    'foot-plate',
    [v.portalPostWidth, v.portalPostDepth, capThickness],
    [postX, v.portalPostCenterY, bottomCapCenter],
    bottomCapHoles,
    'gantry',
  );
  fabricated(
    `portal-post-${side}-upper-cap`,
    'foot-plate',
    [v.portalPostWidth, v.portalPostDepth, capThickness],
    [postX, v.portalPostCenterY, topCapCenter],
    topCapHoles,
    'gantry',
  );
  const postCenterZ = (v.portalPostBottom + v.portalPostTop) / 2;
  fabricated(
    `portal-post-${side}`,
    'portal-post',
    [v.portalPostWidth, v.portalPostDepth, v.portalPostHeight],
    [postX, v.portalPostCenterY, postCenterZ],
    [-45, 45].map((worldY) => ({
      axis: 'x' as const,
      at: [
        -v.portalPostWidth / 2 - 0.1,
        worldY - v.portalPostCenterY,
        v.portalPostTop - 40 - postCenterZ,
      ] as Vec,
      diameter: 32,
      depth: v.portalPostWidth + 0.2,
    })),
    'gantry',
    'steel',
    { tubeAxis: 'z', wall: v.portalPostWall, cornerRadius: v.portalPostCornerRadius },
  );
  const linkCenterZ = (v.driveLinkBottom + v.driveLinkTop) / 2,
    linkHoles: FrameHole[] = [];
  for (const y of [-190, 190]) {
    footHoles.push(
      tap(
        'z',
        [side * (v.driveLinkCenterX - v.footPlateCenterX), y, -v.footPlateThickness / 2],
        8,
        26,
      ),
    );
    linkHoles.push(
      clearance(
        'z',
        [0, y, (v.driveLinkTop - v.driveLinkBottom) / 2 - v.driveLinkTopHeight - 0.1],
        8,
        v.driveLinkTopHeight + 0.2,
      ),
    );
    washeredM8(
      `drive-link-foot-${side}-${y}`,
      75,
      [side * v.driveLinkCenterX, y, v.driveLinkTop - v.driveLinkTopHeight],
      [0, 0, -1],
    );
  }
  const tiePlugHoles: FrameHole[] = [];
  for (const yy of [-v.tiebarDepth / 4, v.tiebarDepth / 4])
    for (const zz of [-v.tiebarHeight / 4, v.tiebarHeight / 4]) {
      tiePlugHoles.push(tap('x', [side < 0 ? -20 : 0, yy, zz], 8, 20));
      linkHoles.push(
        clearance(
          'x',
          [-v.driveLinkThickness / 2 - 0.1, yy, v.tiebarCenter + zz - linkCenterZ],
          8,
          v.driveLinkThickness + 0.2,
        ),
      );
      washeredM8(
        `tiebar-link-${side}-${yy}-${zz}`,
        40,
        [side * (v.driveLinkCenterX + v.driveLinkThickness / 2), yy, v.tiebarCenter + zz],
        [side, 0, 0],
      );
    }
  for (const xx of [-8, 8])
    for (const zz of [-v.tiebarHeight / 4, v.tiebarHeight / 4]) {
      tiePlugHoles.push(tap('y', [xx, -(v.tiebarDepth - 24) / 2, zz], 6, 15));
      fastener(
        `tiebar-insert-${side}-${xx}-${zz}`,
        6,
        25,
        [side * (v.sideInnerX - 20) + xx, -v.tiebarDepth / 2, v.tiebarCenter + zz],
        [0, -1, 0],
        'gantry',
      );
    }
  fabricated(
    `tiebar-end-insert-${side}`,
    'section-insert',
    [40, v.tiebarDepth - 24.2, v.tiebarHeight - 24.2],
    [side * (v.sideInnerX - 20), 0, v.tiebarCenter],
    tiePlugHoles,
    'gantry',
    'steel',
    { tubeAxis: 'x' },
  );
  fabricated(
    `gantry-drive-link-${side}`,
    'gantry-drive-link',
    [v.driveLinkThickness, v.driveLinkTopDepth, v.driveLinkTop - v.driveLinkBottom],
    [side * v.driveLinkCenterX, 0, linkCenterZ],
    linkHoles,
    'gantry',
    'aluminium',
    { ribDepth: v.driveLinkDepth, rearWebHeight: v.driveLinkTopHeight, internalFillet: 5 },
  );
  fabricated(
    'gantry-foot-' + side,
    'foot-plate',
    [v.footPlateWidth, v.footPlateDepth, v.footPlateThickness],
    [side * v.footPlateCenterX, 0, v.gantryFootBottom + v.footPlateThickness / 2],
    footHoles,
    'gantry',
  );
  // Preserve the old X servo datum as a short, separately bolted left end plate.
  if (side < 0) {
    const plateHoles: FrameHole[] = [],
      insertHoles: FrameHole[] = [];
    for (const yy of [-50, 50])
      for (const zz of [-50, 50]) {
        insertHoles.push(tap('x', [-20, yy, zz], 8, 20));
        plateHoles.push(
          clearance('x', [-v.sideThickness / 2 - 0.1, yy, zz], 8, v.sideThickness + 0.2),
        );
        washeredM8(
          `beam-side-${side}-${yy}-${zz}`,
          60,
          [-v.sideCenterX - v.sideThickness / 2, yy, v.beamCenter + zz],
          [-1, 0, 0],
        );
      }
    for (const xx of [-8, 8])
      for (const zz of [-50, 50]) {
        insertHoles.push(tap('y', [xx, -88, zz], 6, 15));
        fastener(
          `beam-insert-${side}-${xx}-${zz}`,
          6,
          25,
          [-v.sideInnerX + 20 + xx, -100, v.beamCenter + zz],
          [0, -1, 0],
          'gantry',
        );
      }
    insertHoles.push({
      axis: 'x',
      at: [-20.1, 0, 0],
      diameter: 60,
      slotLength: 120,
      slotAxis: 'z',
      depth: 40.2,
    });
    fabricated(
      'beam-end-insert--1',
      'section-insert',
      [40, 174.8, 174.8],
      [-v.sideInnerX + 20, 0, v.beamCenter],
      insertHoles,
      'gantry',
      'steel',
      { tubeAxis: 'x', cornerRadius: v.beamCornerRadius - v.beamWall + 0.2 },
    );
    plateHoles.push({
      axis: 'x',
      at: [-v.sideThickness / 2 - 0.1, -160, 0],
      diameter: 72,
      depth: v.sideThickness + 0.2,
    });
    plateHoles.push({
      axis: 'x',
      at: [-v.sideThickness / 2 - 0.1, 140, 0],
      diameter: 60,
      slotLength: 150,
      slotAxis: 'z',
      depth: v.sideThickness + 0.2,
    });
    fabricated(
      'x-drive-end-plate',
      'gantry-side',
      [v.sideThickness, v.sideDepth, v.xDriveEndPlateHeight],
      [-v.sideCenterX, 0, v.beamCenter],
      plateHoles,
      'gantry',
    );
  }
}

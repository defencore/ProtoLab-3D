import type { Parameters } from '../../../core/types';
import type { AssemblyComponent, AssemblyDefinition } from '../../../core/product-types';
import { detailComponent } from '../../../core/component-recipes';
import { n } from '../../../core/geometry';
import {
  cylinder,
  box,
  prism,
  union,
  subtract,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { layout, bearingSource } from './selection';

export interface JigPiece {
  id: string;
  label: string;
  shape: Shape;
  color: number;
  supply: 'manufactured' | 'purchased';
  designation?: string;
  source?: string;
}
const radial = (diameter: number, from: number, to: number, tangent = 0): Shape =>
  cylinder(diameter / 2, to - from, [from, tangent, 0], 'x');
const flange = (from: number, to: number, width: number, height: number): Shape =>
  box([to - from, width, height], [from, -width / 2, -height / 2]);
const place = (shape: Shape, angle: number, z: number, outward = 0): Shape => ({
  kind: 'transform',
  child: shape,
  rotation: [0, 0, angle],
  translation: [
    outward * Math.cos((angle * Math.PI) / 180),
    outward * Math.sin((angle * Math.PI) / 180),
    z,
  ],
});

export function jigPieces(p: Parameters): JigPiece[] {
  const d = layout(p),
    offset = d.axisHeight,
    bottom = n(p, 'stopThickness');
  const seat = d.outer + n(p, 'seatClearance');
  // Retain the outer race while clearing the rotating inner race at both faces.
  // The nominal relief must still be checked against the actual bearing drawing.
  const relief =
    d.kind === 'bearing'
      ? d.drill + (d.outer - d.drill) * 0.75
      : d.drill + n(p, 'guideClearance') + 0.6;
  const collarTools: Shape[] = [
    cylinder(d.bore / 2, d.top + 1, [0, 0, 0]),
    cylinder(d.stopBore / 2, d.top + bottom + 2, [0, 0, -bottom - 1]),
  ];
  const out: JigPiece[] = [];
  const add = (
    id: string,
    label: string,
    shape: Shape,
    color: number,
    supply: JigPiece['supply'] = 'manufactured',
    designation?: string,
    source?: string,
  ) => out.push({ id, label, shape, color, supply, designation, source });
  for (const { index, angle } of d.stations) {
    const suffix = `${index + 1}`;
    if (d.kind === 'plain') {
      collarTools.push(
        place(
          radial(d.drill + n(p, 'guideClearance'), d.bore / 2 - 1, d.radius + 1),
          angle,
          offset,
        ),
      );
      continue;
    }
    collarTools.push(
      place(radial(relief, d.bore / 2 - 1, d.radius + 1), angle, offset),
      place(radial(d.barrelOD + n(p, 'cartridgeClearance'), d.floor, d.radius + 1), angle, offset),
      place(
        flange(d.flangeStart - 0.15, d.radius + 1, d.flangeWidth + 0.3, d.flangeHeight + 0.3),
        angle,
        offset,
      ),
    );
    const screwHoles = [-1, 1].map((sign) =>
      radial(3.4, d.flangeStart - 0.1, d.capEnd + 0.1, sign * d.screwOffset),
    );
    for (const sign of [-1, 1])
      collarTools.push(
        place(
          radial(2.5, d.flangeStart - 7, d.flangeStart + 0.1, sign * d.screwOffset),
          angle,
          offset,
        ),
      );

    const seatTools: Shape[] =
      d.kind === 'bearing'
        ? [
            radial(seat, d.start - 0.1, d.start + d.width),
            radial(seat, d.flangeEnd - d.width, d.flangeEnd + 0.1),
          ]
        : [radial(seat, d.flangeEnd - d.width, d.flangeEnd + 0.1)];
    const cartridge = subtract(
      union(
        radial(d.barrelOD, d.start, d.flangeEnd),
        flange(d.flangeStart, d.flangeEnd, d.flangeWidth, d.flangeHeight),
      ),
      radial(relief, d.start - 0.1, d.flangeEnd + 0.1),
      ...seatTools,
      ...screwHoles,
    );
    add(
      `cartridge-${suffix}`,
      `Guide cartridge ${suffix}`,
      place(cartridge, angle, offset),
      0x316ce8,
    );
    const cap = subtract(
      flange(d.capStart, d.capEnd, d.flangeWidth, d.flangeHeight),
      radial(relief, d.capStart - 0.1, d.capEnd + 0.1),
      ...screwHoles,
    );
    add(`retainer-${suffix}`, `Guide retainer ${suffix}`, place(cap, angle, offset), 0x26354c);

    const guideStarts =
      d.kind === 'bearing' ? [d.start, d.flangeEnd - d.width] : [d.flangeEnd - d.width];
    guideStarts.forEach((from, guideIndex) => {
      const designation = d.bearing
        ? `${d.bearing.id} / ${d.drill} x ${d.outer} x ${d.width} mm`
        : `Custom hardened drill bushing / ID ${d.drill + n(p, 'guideClearance')} x OD ${d.outer} x L ${d.width} mm`;
      const guide = subtract(
        radial(d.outer, from, from + d.width),
        radial(
          d.bearing ? d.drill : d.drill + n(p, 'guideClearance'),
          from - 0.1,
          from + d.width + 0.1,
        ),
      );
      add(
        `guide-${suffix}-${guideIndex + 1}`,
        `${designation} / station ${suffix}.${guideIndex + 1}`,
        place(guide, angle, offset),
        0xc5cad1,
        'purchased',
        designation,
        d.bearing ? bearingSource : undefined,
      );
    });
    for (const sign of [-1, 1]) {
      const end = d.capEnd + 0.1;
      // Nominal screw envelope, with a socket recess. Actual thread detail is supplier-owned.
      const screw = subtract(
        union(
          radial(3, end - 12, end, sign * d.screwOffset),
          radial(5.5, end, end + 3, sign * d.screwOffset),
        ),
        radial(2.5, end + 1.5, end + 3.1, sign * d.screwOffset),
      );
      add(
        `screw-${suffix}-${sign}`,
        `M3 retainer screw / station ${suffix}.${sign === -1 ? 1 : 2}`,
        place(screw, angle, offset),
        0x727c89,
        'purchased',
        'M3 socket-head screw / nominal 12 mm under head / printed 2.5 mm pilot',
      );
    }
  }
  let spacerZ = 0;
  for (const [index, thickness] of d.stack.entries()) {
    add(
      `spacer-${index + 1}`,
      `Height spacer ${thickness} mm / ring ${index + 1}`,
      subtract(
        cylinder(d.spacerOD / 2, thickness, [0, 0, spacerZ]),
        cylinder(d.stopBore / 2, thickness + 2, [0, 0, spacerZ - 1]),
      ),
      index % 2 ? 0x537a8a : 0x83a5ae,
    );
    spacerZ += thickness;
  }
  out.unshift({
    id: 'collar',
    label: `Flat-sided collar / tube OD ${n(p, 'tubeOD')} / ${d.count} holes / fixed drill height ${offset} mm`,
    shape: subtract(prism(d.outline, d.top + bottom, -bottom), ...collarTools),
    color: 0xe9ac45,
    supply: 'manufactured',
  });
  return out;
}

function component(piece: JigPiece): AssemblyComponent {
  const item = detailComponent(piece.id, piece.label, piece.shape);
  if (piece.supply === 'manufactured') {
    const isSpacer = piece.id.startsWith('spacer-');
    item.manufacturing = {
      material: isSpacer
        ? 'Measured spacer stock or calibrated print; use shim stock for thin rings'
        : 'PETG or PA / qualify actual print',
      blank: isSpacer ? 'Annular spacer / measured parallel faces' : 'FDM print',
      processes: isSpacer ? ['cutting', 'printing'] : ['printing'],
      requirements: [
        isSpacer
          ? 'Measure actual thickness and face parallelism. The measured stack, rather than nominal print dimensions, sets the hole offset.'
          : 'Print collar bottom down. Measure tube and guide fits on a test coupon before printing the complete jig.',
      ],
    };
  } else {
    item.libraryId = 'purchased-component';
    item.supply = 'purchased';
    item.procurement = {
      designation: piece.designation!,
      manufacturer: '',
      source: piece.source ?? 'Custom manufacture / supplier to be selected',
    };
  }
  return item;
}
export function jigComposition(p: Parameters): AssemblyDefinition {
  return {
    components: jigPieces(p).map(component),
    issues: [
      'Qualify printed fits, purchased guide bore and free drill passage. Bearing envelopes do not model internal races or establish drill-guiding accuracy.',
      'Clamp both tube and jig against rotation and lift. Seat the tube on the calculated spacer stack, or directly at Z=0 without spacers. Drill each wall from its own station with a depth stop; remove the jig before cutting threads.',
      'The fixed-height polygonal collar is reusable across offsets. Measure and combine 0.5/1/2/5/10/20 mm rings to obtain H minus the desired offset; verify face parallelism and axial seating.',
      'Retainer screws use printed 2.5 mm pilots; qualify engagement and torque in the chosen polymer. Select final screw length and thread engagement from the finished print.',
    ],
  };
}
export function configuredPieces(p: Parameters, state: string): ConfiguredPiece[] {
  // Physical identity and recipe stay in the assembled pose; explosion is an inspection transform.
  const physical = jigPieces(p),
    exploded = state === 'exploded';
  return physical.map((piece) => {
    const station = /^(?:cartridge|retainer|guide|screw)-(\d+)/.exec(piece.id);
    let distance = 0;
    if (exploded && station)
      distance = piece.id.startsWith('cartridge')
        ? 12
        : piece.id.startsWith('retainer')
          ? 40
          : piece.id.startsWith('guide')
            ? 24 + (piece.id.endsWith('-2') ? 6 : 0)
            : 48;
    const angle = station ? (layout(p).stations[Number(station[1]) - 1].angle * Math.PI) / 180 : 0;
    return {
      component: component(piece),
      label: piece.label,
      color: piece.color,
      requireSingleSolid: true,
      position:
        exploded && piece.id.startsWith('spacer-')
          ? [-2 * layout(p).radius - 15, 0, 0]
          : [distance * Math.cos(angle), distance * Math.sin(angle), 0],
    };
  });
}

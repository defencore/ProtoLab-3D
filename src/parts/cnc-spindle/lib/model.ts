import type { Parameters } from '../../../core/types';
import {
  cylinder,
  union,
  subtract,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { boundaryThreadCallouts } from '../../../core/assembly/boundary/shapes';
import { threadMetadata } from '../../../core/thread-callouts';
import * as assembly from '../../../core/assembly/boundary/assembly';
import { spindleSpec } from './specs';

const axial = (radius: number, height: number, z: number, x = 0, y = 0): Shape => ({
  kind: 'cylinder',
  radius,
  height,
  origin: [x, y, z],
  axis: 'z',
  segments: 96,
});
const withThread = (s: Shape, pitch: number, internal = false, designation?: string): Shape =>
  s.kind === 'cylinder' && pitch > 0 ? { ...s, thread: { pitch, internal, designation } } : s;
function radialHoles(radius: number, z: number): Shape[] {
  return Array.from({ length: 8 }, (_, i): Shape => ({
    kind: 'transform',
    child: cylinder(2.3, 8, [radius - 4, 0, z], 'x'),
    translation: [0, 0, 0],
    rotation: [0, 0, i * 45],
  }));
}
export function spindlePieces(p: Parameters): assembly.Piece[] {
  const s = spindleSpec(p),
    r = s.bodyDiameter / 2;
  const frontCap = s.id === 'jst-3000-water-100' ? 12 : 10;
  const rearCap = s.id === 'jst-3000-water-100' ? 25 : s.cooling === 'air' ? 28 : 24;
  const span = s.threadPitch > 0 ? s.threadSpan : s.shaftLength;
  const designation = `M${s.threadDiameter}x${s.threadPitch}; ${s.id.startsWith('zhj') ? 'standard-derived; ' : ''}inspection span unverified`;
  const shaft =
    s.threadPitch > 0
      ? union(
          withThread(axial(s.threadDiameter / 2, span, 0), s.threadPitch, false, designation),
          axial(s.threadDiameter / 2, s.shaftLength - span, span),
        )
      : axial(s.threadDiameter / 2, span, 0);
  const nose = subtract(
    union(
      shaft,
      ...(s.neckLength ? [axial(s.neckDiameter! / 2, s.neckLength, s.shaftLength)] : []),
      axial(
        s.shoulderDiameter / 2,
        s.bodyStartZ - s.shaftLength - (s.neckLength ?? 0),
        s.shaftLength + (s.neckLength ?? 0),
      ),
    ),
    axial(s.collet === 'ER11' ? 3.5 : 6.5, Math.min(s.shaftLength - 2, 22), 0),
  );
  const nutBlank: Shape = {
    kind: 'cylinder',
    radius: s.collet === 'ER11' ? 11 : 17,
    height: s.nutLength,
    origin: [0, 0, 0],
    axis: 'z',
    segments: 6,
  };
  const nut = subtract(
    nutBlank,
    withThread(axial(s.threadDiameter / 2, s.nutLength, 0), s.threadPitch, true, designation),
  );
  const rear = axial(r, rearCap, s.bodyEndZ - rearCap);
  const items: assembly.Piece[] = [
    {
      label: 'Spindle housing / reconstructed external shell',
      color: 0xc4cbd0,
      shape: axial(r, s.bodyLength - frontCap - rearCap, s.bodyStartZ + frontCap),
    },
    {
      label: 'Front bearing cover / external envelope',
      color: 0x6e7882,
      shape: axial(r, frontCap, s.bodyStartZ),
    },
    { label: 'Spindle nose / declared tool interface', color: 0xb0bac4, shape: nose },
    { label: s.collet + ' collet nut / inspection envelope', color: 0x363c43, shape: nut },
    {
      label:
        s.cooling === 'air'
          ? 'Air-cooling end cover / nominal vents'
          : 'Rear cover / external envelope',
      color: 0x515b65,
      shape:
        s.cooling === 'air' ? subtract(rear, ...radialHoles(r, s.bodyEndZ - rearCap / 2)) : rear,
    },
  ];
  const connector = subtract(
    axial(9, s.connectorExtension, s.bodyEndZ),
    ...[-2.3, 2.3].flatMap((x) =>
      [-2.3, 2.3].map((y) => axial(1, 5, s.bodyEndZ + s.connectorExtension - 5, x, y)),
    ),
  );
  items.push({
    label: 'Electrical connector / nominal four-pole socket',
    color: 0x343a41,
    shape: connector,
  });
  if (s.cooling === 'water')
    for (const x of [-r * 0.55, r * 0.55])
      items.push({
        label: 'Coolant hose fitting / nominal external interface',
        color: 0xadb4b8,
        shape: subtract(
          union(axial(6, 7, s.bodyEndZ, x), axial(4.8, s.portExtension - 7, s.bodyEndZ + 7, x)),
          axial(2.5, s.portExtension + 2, s.bodyEndZ - 1, x),
        ),
      });
  return items;
}
export function spindleMetadata(p: Parameters, items = spindlePieces(p)): Record<string, string>[] {
  const s = spindleSpec(p);
  return items.map((item) => ({
    ...threadMetadata(boundaryThreadCallouts(item.shape)),
    SupplierDrawingExecution: s.drawingDesignation,
    PurchasedUnitScope:
      'Visible external pieces of one purchased spindle; not a manufacturing BOM or supplier internal CAD.',
    SourceGeometryNotes: s.sourceNotes,
    ThreadSpanBasis: s.threadNotes,
    ToolInterface: s.collet,
    ...(s.id === 'zhj-3000-air-100'
      ? {
          SupplierThreadDesignation: 'ER20; shaft thread unspecified',
          StandardDerivedThreadInterface:
            'M25x1.5 qualified ER20 inspection geometry only; diameter, pitch, fit and span require measurement and are not manufacturer-verified.',
        }
      : {}),
  }));
}
export function spindlePython(p: Parameters): string {
  const items = spindlePieces(p);
  return (
    assembly.python(items) + '\ncomponent_metadata = ' + JSON.stringify(spindleMetadata(p, items))
  );
}
export function spindleDimensions(p: Parameters): Vec {
  const s = spindleSpec(p);
  return [s.bodyDiameter, s.bodyDiameter, s.totalHeight];
}

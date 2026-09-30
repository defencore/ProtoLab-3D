import { Matrix4, Vector3 } from 'three';
import type { Piece } from './assembly';
import type { Shape } from './shapes';
import type { Thread } from './thread';
import { barrelShape, plugShape } from './barrel';
import { fastenerCatalog } from './fastener-catalog';
import { manufactured, material } from './names';

export interface ThreadFeature {
  designation: string;
  internal: boolean;
  length: number;
  origin: number[];
  axis: number[];
  nominalDiameter: number;
  pitch: number;
  representation: 'nominal-cylinder' | 'printed-helix';
}
/** Nominal thread tools, in assembly coordinates. These are NOT measured engagement lengths. */
export function threadFeatures(shape: Shape): ThreadFeature[] {
  const result: ThreadFeature[] = [];
  const add = (
    d: number,
    p: number,
    length: number,
    internal: boolean,
    matrix: Matrix4,
    thread?: Thread,
    hand = 'RH',
  ) => {
    const round = (v: number) => +v.toFixed(6);
    result.push({
      designation: thread?.designation ?? `M${d}×${p} ${hand}`,
      internal,
      length,
      origin: new Vector3().applyMatrix4(matrix).toArray().map(round),
      axis: new Vector3(0, 0, 1).transformDirection(matrix).toArray().map(round),
      nominalDiameter: d,
      pitch: p,
      representation: thread?.process === 'printed' ? 'printed-helix' : 'nominal-cylinder',
    });
  };
  const walk = (s: Shape, m = new Matrix4()) => {
    if (s.kind === 'transform') {
      walk(
        s.child,
        m
          .clone()
          .multiply(new Matrix4().makeTranslation(...s.offset))
          .multiply(new Matrix4().makeRotationZ((s.angle * Math.PI) / 180)),
      );
    } else if (s.kind === 'rotate') {
      const a = (s.angle * Math.PI) / 180;
      walk(
        s.child,
        m
          .clone()
          .multiply(
            s.axis === 'x' ? new Matrix4().makeRotationX(a) : new Matrix4().makeRotationY(a),
          ),
      );
    } else if (s.kind === 'thread') add(s.diameter, s.pitch, s.length, s.internal, m, s);
    else if (s.kind === 'fastener') {
      const p = s.parameters;
      if (p.threadMode === 'none') return;
      add(
        +p.diameter,
        +p.pitch,
        p.threadSpan === 'partial'
          ? +p.threadLength
          : +p.length - (p.head === 'countersunk' ? +p.headHeight : 0),
        false,
        m
          .clone()
          .multiply(
            new Matrix4().makeTranslation(0, 0, p.threadSpan === 'partial' ? +p.threadStart : 0),
          ),
        undefined,
        p.handedness === 'left' ? 'LH' : 'RH',
      );
    } else if (s.kind === 'threadedPlate') {
      s.holes.forEach((h) =>
        add(
          h.diameter,
          h.pitch,
          h.length,
          true,
          m.clone().multiply(new Matrix4().makeTranslation(h.x, h.y, h.z)),
          h,
        ),
      );
    } else if (s.kind === 'fusedLayers') walk(s.solid, m);
    else if (s.kind === 'springBarrel') walk(barrelShape(s.travel), m);
    else if (s.kind === 'springPlug') walk(plugShape(s.travel), m);
    else if (s.kind === 'union' || s.kind === 'subtract') s.children.forEach((c) => walk(c, m));
  };
  walk(shape);
  return [...new Map(result.map((t) => [JSON.stringify(t), t])).values()];
}
export function threadLabel(piece: Piece): string {
  const callouts = [
    ...new Set(
      threadFeatures(piece.shape).map(
        (t) => `${t.internal ? 'internal' : 'external'} ${t.designation}`,
      ),
    ),
  ];
  return piece.label + (callouts.length ? ` · threads: ${callouts.join('; ')}` : '');
}
export function manufacturingMetadata(piece: Piece): Record<string, string> {
  const catalog = fastenerCatalog(piece.shape, piece.label);
  const make = manufactured(piece);
  const threads = threadFeatures(piece.shape);
  const print = /PRINT|PA12|TPU|PETG/.test(piece.label);
  const threadGroups = new Map<string, number>();
  threads.forEach((t) => {
    const key = `${t.internal ? 'internal' : 'external'} ${t.designation}; nominal tool L${t.length} mm`;
    threadGroups.set(key, (threadGroups.get(key) ?? 0) + 1);
  });
  return {
    Procurement:
      catalog?.procurement ??
      (make ? (print ? 'MAKE_PRINT' : 'MAKE') : 'BUY_ASSEMBLY_OR_COMPONENT'),
    Material: material(piece),
    Standard: catalog?.standard ?? (make ? 'Custom drawing' : 'Supplier specification'),
    OrderDesignation: catalog?.designation ?? piece.label,
    SupplierSource: catalog?.source ?? '',
    ManufacturingProcess:
      catalog?.procurement === 'MAKE_CUSTOM_FASTENER'
        ? 'Turn / thread / socket; drawing required'
        : make
          ? print
            ? '3D print; material/process qualification required'
            : /silicone/.test(piece.label)
              ? 'Cut elastomer'
              : 'Machine / fabricate to drawing'
          : 'Purchase',
    ThreadCallouts:
      [...threadGroups].map(([key, count]) => `${count}× ${key}`).join('; ') ||
      'No generated thread feature',
    ThreadLabels: [
      ...new Set(threads.map((t) => `${t.internal ? 'internal' : 'external'} ${t.designation}`)),
    ].join('; '),
    ThreadFeaturesJSON: JSON.stringify(threads),
    ThreadModel: threads.length
      ? threads.some((t) => t.representation === 'printed-helix')
        ? 'Printed threads retain helical geometry and the specified print fit allowance. Nominal cylinders represent any machined threads.'
        : 'Smooth nominal-diameter bores and shafts; no helical faces. Bore diameter is a symbolic thread envelope, NOT a tap-drill or clearance-hole size. Use thread callouts and machining depth notes; specify tolerance class on the drawing.'
      : '',
    DrawingStatus: make
      ? 'DRAFT - not released for manufacture; datum, fits, tolerances, deburr and loads require approval'
      : /fit reference|verify|placement reference|envelope reference/.test(piece.label)
        ? 'Supplier interface must be measured'
        : 'Catalog envelope; verify delivered part',
    ProcurementNotes:
      catalog?.note ??
      (/BUY WING MINI|BUY SpeedyBee/.test(piece.label)
        ? 'Subcomponent of ONE F405 WING MINI kit; do not buy one board kit per modeled component.'
        : ''),
    ...piece.metadata,
  };
}

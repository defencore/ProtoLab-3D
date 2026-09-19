import { Matrix4, Vector3 } from 'three';
import type { Piece } from './assembly';
import type { Shape } from './shapes';
import { barrelShape, plugShape } from './barrel';
import { fastenerCatalog } from './fastener-catalog';
import { manufactured, material } from './names';

export interface ThreadFeature {
  designation: string;
  internal: boolean;
  length: number;
  origin: number[];
  axis: number[];
}
/** Nominal thread tools, in assembly coordinates. These are NOT measured engagement lengths. */
export function threadFeatures(shape: Shape): ThreadFeature[] {
  const result: ThreadFeature[] = [];
  const add = (d: number, p: number, length: number, internal: boolean, matrix: Matrix4) => {
    const round = (v: number) => +v.toFixed(6);
    result.push({
      designation: `M${d}×${p} RH`,
      internal,
      length,
      origin: new Vector3().applyMatrix4(matrix).toArray().map(round),
      axis: new Vector3(0, 0, 1).transformDirection(matrix).toArray().map(round),
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
    } else if (s.kind === 'thread') add(s.diameter, s.pitch, s.length, s.internal, m);
    else if (s.kind === 'fastener') {
      const p = s.parameters;
      add(
        +p.diameter,
        +p.pitch,
        p.threadSpan === 'partial'
          ? +p.threadLength
          : +p.length - (p.head === 'countersunk' ? +p.headHeight : 0),
        false,
        m,
      );
    } else if (s.kind === 'threadedPlate') {
      s.holes.forEach((h) =>
        add(
          h.diameter,
          h.pitch,
          h.length,
          true,
          m.clone().multiply(new Matrix4().makeTranslation(h.x, h.y, h.z)),
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
    ThreadFeaturesJSON: JSON.stringify(threads),
    ThreadModel: threads.length
      ? 'Modeled RH helices; nominal CAD fit; internal radial clearance 0.04 mm. Drawing tolerance class, lead-in and runout to be specified.'
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

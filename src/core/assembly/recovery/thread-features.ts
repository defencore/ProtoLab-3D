import { currentGeometryMode } from '../../geometry-mode';
import { Matrix4, Vector3 } from 'three';
import type { Shape } from './shapes';
import type { Thread } from './thread';
import { barrelShape, plugShape } from './barrel';

export interface ThreadFeature {
  designation: string;
  internal: boolean;
  length: number;
  origin: number[];
  axis: number[];
  nominalDiameter: number;
  pitch: number;
  representation: 'nominal-cylinder' | 'printed-helix' | 'machined-helix';
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
      representation:
        currentGeometryMode() === 'simple'
          ? 'nominal-cylinder'
          : thread?.process === 'printed'
            ? 'printed-helix'
            : 'machined-helix',
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

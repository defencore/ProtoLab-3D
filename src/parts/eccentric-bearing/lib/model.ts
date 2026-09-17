import type { Parameters } from '../../../core/types';
import { box, cylinder, subtract, ring, type Shape } from './shapes';
import { C } from './helpers';
import type { Piece } from './assembly';
export function pieces(p: Parameters, state: string): Piece[] {
  const R = +p.outer / 2,
    w = +p.outerWidth,
    iw = +p.innerWidth,
    e = +p.eccentricity;
  const pitch = 0.8 * R,
    ball = 0.09 * R,
    groove = ball + 0.08;
  const innerFace = 0.74 * R,
    outerFace = 0.86 * R;
  // Both raceways are concentric; only the shaft bore is eccentric.
  // All pieces rotate together about the fixed shaft axis at (0,0).
  const profile = (inner: boolean): [number, number][] => {
    const edge: [number, number][] = [];
    const h = inner ? iw : w;
    for (let i = 0; i <= 64; i++) {
      const z = -h / 2 + (h * i) / 64;
      const arc = Math.sqrt(Math.max(0, groove * groove - z * z));
      edge.push([inner ? Math.min(innerFace, pitch - arc) : Math.max(outerFace, pitch + arc), z]);
    }
    return inner
      ? [[0, -h / 2], ...edge, [0, h / 2]]
      : ([[R, -h / 2], [R, h / 2], ...edge.reverse()] as [number, number][]);
  };
  const translated = (shape: Shape): Shape => ({
    kind: 'transform',
    child: shape,
    translation: [e, 0, 0],
    rotation: [0, 0, 0],
  });
  const inner = subtract(
    translated({ kind: 'revolve', profile: profile(true) }),
    C(+p.bore, iw + 2, -iw / 2 - 1),
    // Keyway opens into the bore on the thick side of the eccentric inner ring.
    box([+p.bore / 2 + +p.keyDepth, +p.keyWidth, iw + 2], [0, -+p.keyWidth / 2, -iw / 2 - 1]),
  );
  const result: Piece[] = [
    { label: 'Eccentric inner ring · keyed shaft bore', color: 0xb2b8be, shape: inner },
    {
      label: 'Outer ring · ball raceway',
      color: 0xa9b0b8,
      shape: translated({ kind: 'revolve', profile: profile(false) }),
      z: state === 'exploded' ? w * 2 : 0,
    },
  ];
  const balls: Shape[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (2 * Math.PI * i) / 10,
      x = e + pitch * Math.cos(a),
      y = pitch * Math.sin(a);
    const shape: Shape = { kind: 'sphere', radius: ball, origin: [x, y, 0] };
    result.push({ label: `Ball ${i + 1}`, color: 0xd2d6db, shape });
    // Radial cage windows clear each ball without fragile intersecting sphere seams
    // in STEP. The continuous axial rails keep the separator a single solid.
    balls.push({
      kind: 'transform',
      child: cylinder(ball + 0.18, 4, [pitch - 2, 0, 0], 'x'),
      translation: [e, 0, 0],
      rotation: [0, 0, (a * 180) / Math.PI],
    });
  }
  const cage = subtract(
    ring(pitch + 0.5, pitch - 0.5, -ball - 0.65, 2 * (ball + 0.65), e),
    ...balls,
  );
  result.push({
    label: 'Ball separator cage',
    color: 0xc3a469,
    shape: cage,
    z: state === 'exploded' ? -w * 2 : 0,
  });
  if (p.closure === 'sealed' && state !== 'open') {
    const t = 0.45,
      z = w / 2 - t - 0.15;
    for (const side of [-1, 1])
      result.push({
        label: side < 0 ? 'Rear rubber seal' : 'Front rubber seal',
        color: 0x242a30,
        shape: ring(outerFace - 0.03, innerFace + 0.03, side < 0 ? -z - t : z, t, e),
        z: state === 'exploded' ? side * w * 4 : 0,
      });
  }
  return result.map((piece) => ({ ...piece, angle: +p.angle }));
}

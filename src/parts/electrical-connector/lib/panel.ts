import type { Parameters } from '../../../core/types';
import type { Piece } from '../../../core/assembly/mechanical/assembly';
import type { Shape } from '../../../core/assembly/mechanical/shapes';
import { B, C, T, poly, move, union, cut, finish } from '../../../core/assembly/mechanical/helpers';

interface PanelModel {
  name: string;
  sex: string;
  width: number;
  height: number;
  length: number;
  pitch: number;
  contact: number;
  bodyWidth?: number;
  bodyHeight?: number;
  flangeThickness?: number;
  mountPitch?: number;
  mountDiameter?: number;
  gasket?: boolean;
}

/** Mounting datum Z=0 is the rear face of the flange/gasket stack; mating is +Z. */
export function panelPieces(m: PanelModel, p: Parameters, state: string): Piece[] {
  const { bodyWidth: w, bodyHeight: h, flangeThickness: flange, mountPitch, mountDiameter } = m;
  if ([w, h, flange, mountPitch, mountDiameter].some((value) => value === undefined))
    throw new Error('Incomplete AMASS panel connector drawing dimensions');
  const W = w!,
    H = h!,
    F = flange!,
    P = mountPitch!,
    D = mountDiameter!;
  const female = m.sex === 'F',
    detailed = p.detail === 'detailed',
    tail = female ? 3.9 : m.width > 40 ? 5.4 : 3.7,
    rear = F - m.length,
    rearBody = rear + tail,
    floor = F - (female ? 10.2 : m.width > 40 ? 10 : 7.8),
    contactOD = m.contact * 1.2,
    points = [-m.pitch / 2, m.pitch / 2],
    holes = (z: number, depth: number) => [-P / 2, P / 2].map((x) => C(D, depth, z, x)),
    gasketThickness = m.gasket ? 0.65 : 0;
  const out: Piece[] = [],
    add = (label: string, shape: Shape, color: number) => out.push({ label, shape, color });
  const keyed = (width: number, height: number, depth: number, z: number) => {
    if (female) {
      // S0 shows a square left end and rounded right corners. The housing radius
      // is reconstructed below the drawing's 3.90 mm panel-opening radius.
      const radius = Math.min(height / 2 - 0.01, 3.8 - (H - height) / 2),
        right = width / 2,
        points: [number, number][] = [
          [-right, -height / 2],
          [right - radius, -height / 2],
        ];
      for (let step = 1; step <= 16; step++) {
        const angle = -Math.PI / 2 + (step * Math.PI) / 32;
        points.push([
          right - radius + radius * Math.cos(angle),
          -height / 2 + radius + radius * Math.sin(angle),
        ]);
      }
      points.push([right, height / 2 - radius]);
      for (let step = 1; step <= 16; step++) {
        const angle = (step * Math.PI) / 32;
        points.push([
          right - radius + radius * Math.cos(angle),
          height / 2 - radius + radius * Math.sin(angle),
        ]);
      }
      points.push([-right, height / 2]);
      return poly(points, depth, z);
    }
    const bevel = height * 0.25;
    return poly(
      [
        [-width / 2, -height / 2],
        [width / 2 - bevel, -height / 2],
        [width / 2, -height / 2 + bevel],
        [width / 2, height / 2 - bevel],
        [width / 2 - bevel, height / 2],
        [-width / 2, height / 2],
      ],
      depth,
      z,
    );
  };
  const flangeOutline = (depth: number, z: number) => {
    const endHeight = female ? H : m.height - 1.4,
      shoulder = W / 2 + (female ? 1.7 : 1.3),
      end = m.width / 2,
      e = 0.6;
    return poly(
      [
        [-end + e, -endHeight / 2],
        [-shoulder, -endHeight / 2],
        [-shoulder + 2, -m.height / 2],
        [shoulder - 2, -m.height / 2],
        [shoulder, -endHeight / 2],
        [end - e, -endHeight / 2],
        [end, -endHeight / 2 + e],
        [end, endHeight / 2 - e],
        [end - e, endHeight / 2],
        [shoulder, endHeight / 2],
        [shoulder - 2, m.height / 2],
        [-shoulder + 2, m.height / 2],
        [-shoulder, endHeight / 2],
        [-end + e, endHeight / 2],
        [-end, endHeight / 2 - e],
        [-end, -endHeight / 2 + e],
      ],
      depth,
      z,
    );
  };
  const color = m.width > 40 ? 0x25292d : 0xe5b934;
  let housing: Shape = union(
    keyed(W, H, F - rearBody - gasketThickness, rearBody),
    flangeOutline(F - gasketThickness, gasketThickness),
  );
  // Open male shroud / female tongue relief, with a solid rear contact-retention web.
  if (!female) housing = cut(housing, keyed(W - 1.4, H - 1.4, F - floor + 1, floor));
  else {
    const recess = keyed(W - 2.2, H - 2.2, 0.6, F - 0.55);
    housing = cut(housing, recess);
  }
  housing = cut(
    housing,
    ...holes(-1, F + 2),
    ...points.map((x) => C(contactOD + 0.16, m.length + 2, rear - 1, x)),
  );
  if (female) {
    // Front counterbores follow the illustrated countersinks; angle/depth are reconstructed.
    housing = cut(
      housing,
      ...[-P / 2, P / 2].map((x) =>
        move(
          T([
            [0, F - 1.7],
            [D / 2, F - 1.7],
            [3.2, F + 0.01],
            [0, F + 0.01],
          ]),
          x,
        ),
      ),
    );
  }
  if (detailed)
    housing = cut(
      housing,
      ...[-1, 1].map((side) => B(W * 0.45, 0.4, 0.6, 0, (side * H) / 2, rearBody + 1.1)),
    );
  add(`${m.name} · mounting flange and ${female ? 'socket tongue' : 'pin shroud'}`, housing, color);
  if (m.gasket) {
    const gasket = cut(
      flangeOutline(gasketThickness, 0),
      keyed(W + 0.12, H + 0.12, gasketThickness + 2, -1),
      ...holes(-1, gasketThickness + 2),
    );
    add(`${m.name} · flange gasket · reconstructed thickness`, gasket, 0x303236);
  }
  for (const [index, x] of points.entries()) {
    const front = F - (female ? 0.7 : 0.6),
      shoulder = rearBody + 0.2;
    let metal: Shape;
    if (female) {
      metal = union(
        C(contactOD, front - shoulder, shoulder, x),
        C(m.contact, shoulder - rear, rear, x),
      );
      metal = cut(
        metal,
        C(m.contact + 0.05, front - floor + 1, floor, x),
        C(m.contact * 0.7, tail + 0.1, rear - 0.1, x),
      );
    } else {
      metal = move(
        T([
          [0, rear],
          [m.contact * 0.6, rear],
          [m.contact * 0.6, floor - 0.5],
          [m.contact / 2, floor + 0.1],
          [m.contact / 2, front - 0.4],
          [m.contact * 0.37, front],
          [0, front],
        ]),
        x,
      );
      metal = cut(metal, C(m.contact * 0.7, tail + 0.1, rear - 0.1, x));
    }
    if (detailed) metal = cut(metal, B(0.2, contactOD + 0.2, 2, x, 0, front - 1.5));
    add(`${female ? 'Female socket' : 'Male pin'} ${index + 1} · solder cup`, metal, 0xc8a65a);
  }
  return finish(out, state);
}

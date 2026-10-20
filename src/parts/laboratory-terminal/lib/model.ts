import type { Parameters } from '../../../core/types';
import type { Piece } from '../../../core/assembly/mechanical/assembly';
import type { Shape } from '../../../core/assembly/mechanical/shapes';
import { B, C, T, poly, move, cut, union, finish } from '../../../core/assembly/mechanical/helpers';
import { cylinder } from '../../../core/assembly/mechanical/shapes';
import data from './models.json';

export interface TerminalModel {
  id: string;
  name: string;
  manufacturer: string;
  designation: string;
  kind: string;
  source: string;
  sourceSha256?: string;
  notes: string;
  verified: string[];
  poles: number;
  mount: string;
  length: number;
  bodyWidth: number;
  bodyDepth: number;
  color: number;
  contactDiameter?: number;
  bore?: number;
  wireBore?: number;
  pitch?: number | null;
  pinLength?: number;
  front?: number;
  shank?: number;
  cutoutDiameter?: number;
  cutoutFlat?: number | null;
  recessDiameter?: number;
  tail?: number;
  mountPitch?: number;
  mountHole?: number;
}
export const models: TerminalModel[] = data;
export function selected(p: Parameters): TerminalModel {
  const model = models.find((m) => m.id === p.model);
  if (!model) throw new Error('Choose a supported laboratory terminal.');
  return model;
}
const metal = 0xb9b9ad;
const hex = (acrossFlats: number, height: number, z: number, bore = 0): Shape => {
  const radius = acrossFlats / Math.sqrt(3);
  const solid = poly(
    Array.from({ length: 6 }, (_, i) => {
      const angle = (i * Math.PI) / 3;
      return [radius * Math.cos(angle), radius * Math.sin(angle)] as [number, number];
    }),
    height,
    z,
  );
  return bore ? cut(solid, C(bore, height + 2, z - 1)) : solid;
};
const alongY = (diameter: number, length: number, x: number, y: number, z: number): Shape =>
  cylinder(diameter / 2, length, [x, y, z], 'y');
const alongX = (diameter: number, length: number, x: number, y: number, z: number): Shape =>
  cylinder(diameter / 2, length, [x, y, z], 'x');
const positions = (count: number, pitch: number): number[] =>
  Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * pitch);

/** Each physical housing, conductor and moving cap is one direct purchased-unit component. */
export function pieces(p: Parameters, state: string): Piece[] {
  const m = selected(p),
    out: Piece[] = [];
  const add = (label: string, shape: Shape, color = metal) => out.push({ label, shape, color });
  const xs = positions(m.poles, m.pitch ?? 0);
  if (m.kind === 'banana-plug') {
    const exposed = m.pinLength!,
      bodyHeight = m.length - exposed;
    const small = m.contactDiameter === 2;
    const shaft = small ? 4.0 : 5.8;
    const endOpening = small ? 4.2 : m.bore!;
    let body =
      m.poles === 2
        ? B(m.bodyWidth, m.bodyDepth, bodyHeight)
        : small
          ? B(m.bodyWidth, m.bodyDepth, bodyHeight)
          : C(m.bodyWidth, bodyHeight);
    const sockets = xs.map((x) => C(small ? 4.2 : shaft + 0.12, bodyHeight + 2, -1, x));
    body = cut(body, ...sockets);
    // A real open rear cable/stack-up inlet and cross-wire entry remain visible.
    if (!small)
      body = cut(body, ...xs.map((x) => alongY(m.wireBore!, 12, x, -6, bodyHeight * 0.23)));
    if (m.poles === 2)
      body = cut(body, B(10, 0.8, bodyHeight * 0.68, 0, -m.bodyDepth / 2, bodyHeight * 0.26));
    add(`${m.designation} · insulating handle`, body, m.color);
    xs.forEach((x, i) => {
      const d = small ? 2 : 4.2;
      const contactTop = small ? 6.0 : bodyHeight;
      let contact = move(
        T([
          [0, -exposed],
          [d * 0.35, -exposed],
          [d / 2, -exposed + 1],
          [d / 2, -1],
          [shaft / 2, 0],
          [shaft / 2, contactTop],
          [0, contactTop],
        ]),
        x,
      );
      const rearDepth = small ? 5.0 : bodyHeight * 0.76;
      contact = cut(contact, C(small ? 1.5 : endOpening, rearDepth + 1, contactTop - rearDepth, x));
      if (!small) contact = cut(contact, alongY(m.wireBore!, 12, x, -6, bodyHeight * 0.23));
      contact = cut(contact, B(0.22, d + 1, exposed * 0.65, x, 0, -exposed * 0.84));
      add(`Banana contact ${i + 1} · ${small ? 'solder cup' : 'open stack-up socket'}`, contact);
    });
  } else if (m.kind === 'banana-jack' || m.kind === 'recessed-jack') {
    const small = m.contactDiameter === 2,
      recessed = m.kind === 'recessed-jack';
    const front = m.front!,
      rear = m.length - front;
    const flange = recessed ? 14.5 : small ? 6.53 : 12.7;
    const shaft = recessed ? 5.8 : small ? 3.2 : 5.8;
    const shank = m.shank!;
    let insulator = union(C(flange, front), C(shank, rear - m.tail!, -(rear - m.tail!)));
    insulator = cut(insulator, C(recessed ? 8 : shaft + 0.15, m.length + 2, -rear - 1));
    // Retain the insulating bottom behind a recessed socket while opening the solder tab exit.
    if (recessed)
      insulator = union(
        insulator,
        cut(C(shank, 1.2, -rear + m.tail!), C(shaft + 0.15, 3, -rear + m.tail! - 1)),
      );
    add(`${m.designation} · panel insulator and flange`, insulator, m.color);
    const socketTop = recessed ? front - 4 : front;
    const socketBottom = -rear + m.tail!;
    let conductor = union(
      C(shaft, socketTop - socketBottom, socketBottom),
      recessed ? B(0.8, 4.8, m.tail! + 1, 0, 0, -rear) : C(small ? 2.69 : 2.29, m.tail! + 1, -rear),
    );
    conductor = cut(conductor, C(m.bore!, socketTop - socketBottom - 0.9, socketBottom + 1));
    if (!recessed)
      conductor = cut(conductor, alongX(small ? 1.52 : 1.2, 8, -4, 0, -rear + m.tail! / 2));
    else conductor = cut(conductor, alongX(1.6, 3, -1.5, 0, -rear + m.tail! / 2));
    add(
      `${m.designation} · recessed socket and solder termination`,
      conductor,
      recessed ? 0xc7a34b : metal,
    );
    add(
      'Mounting nut · thread simplified',
      hex(recessed ? 13.86 : small ? 6.16 : 10.0, 2.5, -6, shank + 0.12),
    );
    if (!small && !recessed)
      add(
        'Panel rear insulating washer',
        cut(C(12.7, 1.8, -3.1), C(shank + 0.12, 3, -3.6)),
        m.color,
      );
  } else if (m.kind === 'binding-post' || m.kind === 'spring-banana') {
    const spring = m.kind === 'spring-banana';
    const front = m.front!,
      rear = m.length - front;
    const capDiameter = spring ? 12.6 : 11.18;
    const shaft = spring ? 7.9 : 6.5;
    const capBase = spring ? front - 15 : 6.5;
    const capInner = shaft + 0.15;
    const cap = cut(
      C(capDiameter, front - capBase, capBase),
      C(capInner, front - capBase + 2, capBase - 1),
      ...(spring
        ? [alongX(m.wireBore!, capDiameter + 2, -capDiameter / 2 - 1, 0, capBase + 5.6)]
        : []),
    );
    if (m.poles === 2) {
      const mount = cut(B(m.bodyWidth, m.bodyDepth, 3.2), ...xs.map((x) => C(6.7, 5, -1, x)));
      add('Double binding post · common insulating mounting base', mount, 0x282a2e);
    }
    xs.forEach((x, i) => {
      add(`Captive ${spring ? 'spring cap' : 'thumb nut'} ${i + 1}`, move(cap, x), m.color);
      let spindle = union(
        C(shaft, front - 0.4, 0, x),
        C(spring ? (m.id.endsWith('spt1') ? 3 : 4) : 4.15, rear, -rear, x),
      );
      spindle = cut(
        spindle,
        C(m.bore!, front * 0.76, front * 0.28, x),
        alongX(m.wireBore!, shaft + 2, x - shaft / 2 - 1, 0, spring ? capBase + 5.6 : 4.8),
      );
      add(`Post ${i + 1} · open banana socket and cross-wire entry`, spindle);
      if (m.poles === 1 && !m.id.endsWith('spt1'))
        add(
          `Front insulating shoulder ${i + 1}`,
          cut(C(capDiameter, spring ? 4.8 : 3.2, 0, x), C(shaft + 0.15, 6, -0.5, x)),
          m.color,
        );
      if (rear > 10)
        add(
          `Rear insulating shoulder ${i + 1}`,
          cut(C(capDiameter, 3.2, -6.4, x), C((spring ? 4 : 4.15) + 0.15, 5, -7, x)),
          m.color,
        );
      const nutZ = rear > 10 ? -10.2 : -4;
      add(
        `Mounting nut ${i + 1} · thread simplified`,
        move(
          hex(
            spring ? 7 : 6.35,
            2.4,
            nutZ,
            (spring ? (m.id.endsWith('spt1') ? 3 : 4) : 4.15) + 0.15,
          ),
          x,
        ),
      );
    });
  } else if (m.kind === 'spring-post') {
    const capBase = 11.3,
      capTop = 25.4;
    let body = union(C(7.6, 43.8, -25.4), C(10.4, 4, 2));
    body = cut(body, alongX(m.wireBore!, 15, -7.5, 0, 17));
    add('Spring post · cross-wire conductor and solder turret', body);
    const cap = cut(
      C(12.7, capTop - capBase, capBase),
      C(7.75, capTop - capBase - 1, capBase - 0.2),
      alongX(m.wireBore!, 15, -7.5, 0, 17),
    );
    add('Spring loaded rubber cap', cap, m.color);
    for (const z of [-3.0, -10.0])
      add('Nylon panel insulator ' + z, cut(C(14.73, 2.7, z), C(7.75, 5, z - 1)), 0xe1dfc8);
    add('Mounting nut · thread simplified', hex(9.525, 2.6, -18, 7.75));
  } else if (m.kind === 'speaker-spring') {
    const doubleRow = m.poles === 8,
      columns = doubleRow ? 4 : 2;
    const depth = m.bodyDepth,
      upper = doubleRow ? 14 : 15.2;
    const centres = positions(columns, m.pitch!);
    const rows = doubleRow ? [-5.5, 5.5] : [0];
    const holes: Shape[] = [],
      pockets: Shape[] = [];
    centres.forEach((x) =>
      rows.forEach((y) => {
        holes.push(alongY(3.5, depth + 2, x, -depth / 2 - 1, 7.5));
        pockets.push(B(8.0, doubleRow ? 10 : 13, upper - 6, x, y, 6));
      }),
    );
    const flange = cut(
      union(
        B(m.bodyWidth - 7, depth, 2, 0, 0, -2),
        ...[-1, 1].map((s) => C(doubleRow ? 7 : 8, 2, -2, (s * m.mountPitch!) / 2)),
      ),
      ...[-1, 1].map((s) => C(m.mountHole!, 4, -3, (s * m.mountPitch!) / 2)),
    );
    let housing = union(
      flange,
      B(m.bodyWidth - 14, depth - 4, upper, 0, 0, 0),
      ...[-1, 1].map((s) => C(5.7, 7.4, -9.4, (s * m.mountPitch!) / 2)),
    );
    housing = cut(
      housing,
      ...holes,
      ...pockets,
      ...[-1, 1].map((s) => C(m.mountHole!, 14, -12, (s * m.mountPitch!) / 2)),
      ...centres.flatMap((x) => rows.map((y) => B(5.4, 4.4, 9.2, x, y, -2.5))),
      ...centres.flatMap((x) => rows.map((y) => B(1.4, 0.7, 4, x, y, -3))),
    );
    add(`${m.designation} · moulded housing and mounting ears`, housing, 0x282b30);
    let n = 0;
    centres.forEach((x, column) =>
      rows.forEach((y, row) => {
        const red = doubleRow ? column === 0 || column === 3 : column === 1;
        const cage = cut(
          union(B(4.5, 3.2, 4.9, x, y, 4.5), B(1.2, 0.5, 19, x, y, -13)),
          alongY(3, 5, x, y - 2.5, 7.5),
        );
        add(`Spring contact ${++n} · wire entry and solder tag`, cage);
        let lever = B(7.6, doubleRow ? 9.4 : 12.2, 4.2, x, y, upper - 4.4);
        lever = cut(lever, alongY(3.5, depth + 2, x, -depth / 2 - 1, upper - 2.3));
        add(`Release lever ${n}`, lever, red ? 0xcd282c : 0x3c4044);
      }),
    );
  } else if (m.kind === 'lever-splice') {
    const h = m.length,
      d = m.bodyDepth,
      pitch = m.pitch!,
      xs = positions(m.poles, pitch);
    const bores = xs.map((x) => alongY(m.wireBore!, d - 2, x, -d / 2 - 1, 2.65));
    let shell = cut(
      B(m.bodyWidth, d, h),
      ...bores,
      ...xs.map((x) => B(4.6, 11, h - 4.45, x, 1.0, 4.55)),
      B(m.bodyWidth - 2, 8, 3.7, 0, 1.5, 1.05),
    );
    add(`${m.designation} · insulating shell with wire channels`, shell, 0xbac3c6);
    // Common conductor bus connects every wire; copper does not obstruct the entrance.
    add(
      'Common bus · one electrical potential',
      B(m.bodyWidth - 2.3, 7.6, 1.1, 0, 1.5, 1.2),
      0xb5924d,
    );
    xs.forEach((x, i) => {
      const clip = cut(B(3.8, 5.5, 2.2, x, 2, 2.5), alongY(m.wireBore! + 0.2, 7, x, -1.5, 2.65));
      add(`Wire clamp ${i + 1}`, clip);
      const lever = cut(B(4.2, 10.2, 3.2, x, 1, 4.75), B(2.6, 4, 1.4, x, 1.2, 4.65));
      add(`Operating lever ${i + 1}`, lever, 0xe46e21);
    });
  } else if (m.kind === 'screw-plug') {
    const h = m.length,
      d = m.bodyDepth,
      xs = positions(m.poles, m.pitch!);
    const wireZ = 6,
      socketZ = 3.2;
    const shell = cut(
      union(B(m.bodyWidth, d - 5, h, 0, -2.5), B(m.bodyWidth - 1, 5, 8.5, 0, d / 2 - 2.5)),
      ...xs.flatMap((x) => [
        alongY(3.4, d + 2, x, -d / 2 - 1, wireZ),
        C(3.7, 8.5, h - 8.4, x, -1.5),
        B(2.8, 6.0, 3, x, d / 2 - 2.7, socketZ - 1.5),
        B(3.6, 5.5, 4.4, x, -2.8, 3.8),
      ]),
    );
    add(`${m.designation} · keyed insulating housing`, shell, m.color);
    xs.forEach((x, i) => {
      const cage = cut(
        B(3.4, 5.1, 4.0, x, -2.8, 4.0),
        alongY(2.4, 6, x, -6, wireZ),
        C(2.6, 2.2, 6.8, x, -1.5),
      );
      add(`Screw cage ${i + 1} · open wire entry`, cage);
      const screw = cut(C(3.35, 2.1, 10.2, x, -1.5), B(0.65, 3.8, 1.2, x, -1.5, 11.4));
      add(`Clamp screw ${i + 1} · thread simplified`, screw);
      const socket = cut(
        B(2.5, 5.2, 2.6, x, d / 2 - 2.7, socketZ - 1.3),
        B(1.25, 6, 1.35, x, d / 2 - 2.7, socketZ - 0.675),
      );
      add(`Female mating contact ${i + 1}`, socket);
    });
  }
  // Separate existing physical components rigidly for inspection; this is not a mounting pose.
  return finish(out, state);
}

import type { Parameters } from '../../../core/types';
import type { Piece } from '../../../core/assembly/mechanical/assembly';
import { B, C, T, poly, move, union, cut, finish } from '../../../core/assembly/mechanical/helpers';
import { cylinder, type Shape } from '../../../core/assembly/mechanical/shapes';

interface PcbModel {
  name: string;
  sex: string;
  width: number;
  height: number;
  length: number;
  pitch: number;
  contact: number;
  pcb?: string;
  bodyLength?: number;
  bodyHeight?: number;
  pinProjection?: number;
  pcbPinDiameter?: number;
  pcbRowOffset?: number;
  pcbHoldPitch?: number;
  pcbTabProjection?: number;
  pcbFront?: number;
  pcbAxisHeight?: number;
}

/** +Z is mating for both types. PCB plane is Z=0 (UPB) or Y=0 (PW). */
export function pcbPieces(m: PcbModel, p: Parameters, state: string): Piece[] {
  const required = [m.pinProjection, m.pcbPinDiameter, m.pcbFront, m.pcbAxisHeight];
  if (required.some((value) => value === undefined))
    throw new Error('Incomplete AMASS PCB connector drawing dimensions');
  const rightAngle = m.pcb === 'right-angle',
    female = m.sex === 'F',
    detailed = p.detail === 'detailed',
    front = m.pcbFront!,
    pinProjection = m.pinProjection!,
    pinDiameter = m.pcbPinDiameter!,
    axisY = m.pcbAxisHeight!,
    back = rightAngle ? front - m.length : 0,
    bodyHeight = rightAngle ? m.bodyHeight! : m.height,
    floor = rightAngle ? front - 7.8 : female ? 2.6 : 3.2,
    contactOD = m.contact * 1.2,
    pinRowZ = -(m.pcbRowOffset ?? 0),
    gap = 0.16,
    points = [-m.pitch / 2, m.pitch / 2],
    out: Piece[] = [],
    add = (label: string, shape: Shape, color: number) => out.push({ label, shape, color });
  const keyed = (width: number, height: number, depth: number, z: number) => {
    const bevel = height * 0.27;
    return poly(
      [
        [-width / 2, axisY - height / 2],
        [width / 2 - bevel, axisY - height / 2],
        [width / 2, axisY - height / 2 + bevel],
        [width / 2, axisY + height / 2 - bevel],
        [width / 2 - bevel, axisY + height / 2],
        [-width / 2, axisY + height / 2],
      ],
      depth,
      z,
    );
  };
  let housing: Shape;
  if (female) {
    const shoulder = rightAngle ? front - 7.1 : 3.1,
      inset = rightAngle ? 1.2 : 0.8;
    housing = union(
      keyed(m.width, bodyHeight, shoulder - back, back),
      keyed(m.width - inset, bodyHeight - inset, front - shoulder, shoulder),
    );
    housing = cut(
      housing,
      ...[-1, 1].map((side) =>
        B(0.65, 0.65, front - shoulder + 1, 0, axisY + (side * (bodyHeight - inset)) / 2, shoulder),
      ),
    );
  } else {
    housing = cut(
      keyed(m.width, bodyHeight, front - back, back),
      keyed(m.width - 1.4, bodyHeight - 1.4, front - floor + 1, floor),
    );
  }
  housing = cut(
    housing,
    ...points.map((x) =>
      C(
        contactOD + gap,
        front - (rightAngle ? pinRowZ - 0.2 : -0.1) + 1,
        rightAngle ? pinRowZ - 0.2 : -0.1,
        x,
        axisY,
      ),
    ),
  );
  if (rightAngle) {
    housing = cut(
      housing,
      // The undimensioned internal elbow clearance is a square pocket around
      // the round tail. Flat walls avoid sub-0.01 mm slivers where perpendicular
      // tessellated bores intersect, while retaining the same pin clearance.
      ...points.map((x) =>
        B(
          pinDiameter + gap,
          axisY + 0.2,
          pinDiameter + gap,
          x,
          axisY / 2,
          pinRowZ - (pinDiameter + gap) / 2,
        ),
      ),
      ...[-1, 1].map((side) =>
        B(0.5 + gap, 1.7, 1.6 + gap, (side * m.pcbHoldPitch!) / 2, 0.75, -0.8 - gap / 2),
      ),
    );
  }
  if (detailed)
    housing = cut(
      housing,
      ...[-1, 1].map((side) =>
        B(m.width * 0.4, 0.35, 0.5, 0, axisY + (side * bodyHeight) / 2, back + 1.2),
      ),
    );
  add(`${m.name} · ${rightAngle ? 'right-angle' : 'vertical'} PCB housing`, housing, 0xe5b934);
  for (const [index, x] of points.entries()) {
    const tip = front - 0.6,
      stem = rightAngle ? pinRowZ - 0.1 : 0,
      tail: Shape = rightAngle
        ? cylinder(pinDiameter / 2, axisY + pinProjection, [x, -pinProjection, pinRowZ], 'y')
        : C(pinDiameter, pinProjection + 0.2, -pinProjection, x);
    let metal: Shape;
    if (female) {
      metal = cut(
        C(contactOD, tip - stem, stem, x, axisY),
        C(m.contact + 0.05, tip - floor + 1, floor, x, axisY),
      );
    } else {
      metal = move(
        T([
          [0, stem],
          [contactOD / 2, stem],
          [contactOD / 2, floor - 0.2],
          [m.contact / 2, floor + 0.2],
          [m.contact / 2, tip - 0.3],
          [m.contact * 0.37, tip],
          [0, tip],
        ]),
        x,
        axisY,
      );
    }
    metal = union(metal, tail);
    if (detailed) metal = cut(metal, B(0.18, contactOD + 0.2, 1.6, x, axisY, tip - 1.2));
    add(`${female ? 'Female socket' : 'Male pin'} ${index + 1} · PCB tail`, metal, 0xc8a65a);
  }
  if (rightAngle)
    for (const [index, side] of [-1, 1].entries()) {
      const projection = m.pcbTabProjection!;
      add(
        `Hold-down tab ${index + 1}`,
        B(0.5, projection + 1.4, 1.6, (side * m.pcbHoldPitch!) / 2, (1.4 - projection) / 2, -0.8),
        0xabb1ba,
      );
    }
  return finish(out, state);
}

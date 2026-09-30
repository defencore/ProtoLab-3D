import type { Parameters } from '../../../core/types';
import type { MachinePiece } from './model';
import { box, cylinder, subtract, union, type Shape, type Vec } from './shapes';
import { maCylinderPieces, socketScrew } from './hardware';
import { TABLE, section, pose } from './layout';
import { extrudedSection } from './profiles';
/** Two perpendicular datum faces; cylinder brackets slide in orthogonal bolted slots. */
export function clampPieces(p: Parameters, q: ReturnType<typeof pose>): MachinePiece[] {
  const out: MachinePiece[] = [],
    { w, h } = section(p);
  const add = (
    label: string,
    shape: Shape,
    group: string,
    color = 0x536675,
    procurement: MachinePiece['procurement'] = 'MAKE',
  ) => out.push({ label, shape, group, color, procurement });
  const tr = (child: Shape, translation: Vec, rotation: Vec = [0, 0, 0]): Shape => ({
    kind: 'transform',
    child,
    translation,
    rotation,
  });
  const slotZ = (x: number, y: number, z: number, length: number, r: number, depth: number) =>
    union(
      box([2 * r, depth, length], [x - r, y, z]),
      cylinder(r, depth, [x, y, z], 'y'),
      cylinder(r, depth, [x, y, z + length], 'y'),
    );
  const slotY = (x: number, y: number, z: number, length: number, r: number, depth: number) =>
    union(
      box([2 * r, length, depth], [x - r, y, z]),
      cylinder(r, depth, [x, y, z]),
      cylinder(r, depth, [x, y + length, z]),
    );
  for (const [name, x, closed, group, jawWidth] of [
    ['Station', -55, q.stationClosed, 'Fixed vise', 40],
    ['Shuttle', q.carriage, q.gripperClosed, 'Feed carriage', 70],
  ] as const) {
    const mid = TABLE + h / 2,
      gap = closed ? 0 : 12,
      rear = w / 2 + 199;
    // Station uses the common support plate. Shuttle has a short shoe, above the roller envelope.
    add(
      `${name} L datum wall`,
      box([jawWidth, 10, h + 10], [x - jawWidth / 2, -w / 2 - 10, TABLE]),
      group,
      0x167c83,
    );
    if (name === 'Shuttle') {
      add(
        'Shuttle L datum floor',
        box([jawWidth, w + 20, 12], [x - jawWidth / 2, -w / 2 - 10, 888]),
        group,
        0x167c83,
      );
      for (const y of [-w / 2 - 10, w / 2])
        add(
          `Shuttle L shoe riser ${y}`,
          box([jawWidth, 10, 41], [x - jawWidth / 2, y, 847]),
          group,
        );
    }
    const shoeY = p.profile === 'triangular' ? w / 4 : w / 2;
    const blank = box([jawWidth, 12 + (w / 2 - shoeY), 20], [x - jawWidth / 2, shoeY, mid - 10]);
    add(
      `${name} lateral swivel pressure shoe`,
      tr(
        subtract(
          blank,
          extrudedSection(String(p.profile), w, h, jawWidth + 2, x - jawWidth / 2 - 1, TABLE),
          cylinder(5.1, 15, [x, w / 2 - 1, mid], 'y'),
        ),
        [0, gap, 0],
      ),
      group,
      0x303c46,
    );
    add(
      `${name} side piston rod M10`,
      cylinder(5, 45 - 4 - gap, [x, w / 2 + 4 + gap, mid], 'y', { pitch: 1.25 }),
      group,
      0xb4bec8,
      'BUY',
    );
    // A threaded swivel stud seats in the shoe, with an axial shoulder at its rear face.
    add(
      `${name} shoe swivel shoulder`,
      subtract(
        cylinder(8, 3, [x, w / 2 + 12 + gap, mid], 'y'),
        cylinder(5.1, 5, [x, w / 2 + 11 + gap, mid], 'y'),
      ),
      group,
      0xb4bec8,
      'BUY',
    );
    for (const item of maCylinderPieces(`${name} MA32x50`, [0, 0, 0], 'z', 154))
      add(item.label, tr(item.shape, [x, w / 2 + 45, mid], [90, 0, 180]), group, item.color, 'BUY');
    add(
      `${name} side cylinder slotted angle`,
      subtract(
        union(
          box([jawWidth + 20, 60, 8], [x - jawWidth / 2 - 10, rear - 40, 847]),
          box([jawWidth + 20, 8, 140], [x - jawWidth / 2 - 10, rear, 855]),
        ),
        slotZ(x, rear - 1, TABLE + 15, 45, 8.2, 10),
        ...[-jawWidth / 2 + 12, jawWidth / 2 - 12].map((dx) =>
          slotY(x + dx, rear - 28, 846, 36, 3.3, 10),
        ),
      ),
      group,
    );
    add(
      `${name} side mounting tail M16`,
      subtract(
        cylinder(8, 22, [x, rear, mid], 'y', { pitch: 1.5 }),
        cylinder(5.1, 24, [x, rear - 1, mid], 'y'),
      ),
      group,
      0xb4bec8,
      'BUY',
    );
    add(
      `${name} side large mounting washer`,
      subtract(cylinder(19, 3, [x, rear + 8, mid], 'y'), cylinder(8.2, 5, [x, rear + 7, mid], 'y')),
      group,
      0xb4bec8,
      'BUY',
    );
    add(
      `${name} side M16 retaining nut`,
      subtract(
        cylinder(12, 8, [x, rear + 11, mid], 'y'),
        cylinder(8.1, 10, [x, rear + 10, mid], 'y', { pitch: 1.5, internal: true }),
      ),
      group,
      0x303c46,
      'BUY',
    );
    const topZ = TABLE + h + gap,
      topRear = TABLE + h + 209;
    // The bridge has a lateral slot; vertical slots in the rear post set its height.
    const postY = -w / 2 - 65;
    add(
      `${name} top clamp slotted upright`,
      subtract(
        box([jawWidth + 20, 10, 402], [x - jawWidth / 2 - 10, postY, 847]),
        ...[-jawWidth / 2 + 5, jawWidth / 2 - 5].map((dx) =>
          slotZ(x + dx, postY - 1, TABLE + 229, 90, 3.3, 12),
        ),
      ),
      group,
    );
    add(
      `${name} top clamp adjustable angle`,
      subtract(
        union(
          box([jawWidth + 20, w / 2 + 90, 8], [x - jawWidth / 2 - 10, postY + 10, topRear]),
          box([jawWidth + 20, 8, 36], [x - jawWidth / 2 - 10, postY + 10, topRear - 28]),
        ),
        slotY(x, -18, topRear - 1, 36, 8.2, 10),
        ...[-jawWidth / 2 + 5, jawWidth / 2 - 5].map((dx) =>
          cylinder(3.3, 10, [x + dx, postY + 9, topRear - 10], 'y'),
        ),
      ),
      group,
    );
    const footHoles = [-jawWidth / 4, jawWidth / 4].map((dx) =>
      cylinder(3.3, 10, [x + dx, postY + 32, 846]),
    );
    add(
      `${name} top upright mounting foot`,
      subtract(box([jawWidth + 20, 45, 8], [x - jawWidth / 2 - 10, postY + 10, 847]), ...footHoles),
      group,
    );
    for (const dx of [-jawWidth / 4, jawWidth / 4]) {
      const bolt = socketScrew(
        `${name} top foot M6x20 ${dx}`,
        [x + dx, postY + 32, 855],
        'z',
        6,
        20,
      );
      add(bolt.label, bolt.shape, group, bolt.color, 'BUY');
    }
    for (const dx of [-jawWidth / 2 + 5, jawWidth / 2 - 5]) {
      const screw = socketScrew(
        `${name} top angle M6x20 ${dx}`,
        [x + dx, postY + 18, topRear - 10],
        'y',
        6,
        20,
      );
      add(screw.label, screw.shape, group, screw.color, 'BUY');
      // Bolt passes through a slot in the upright and a drilled hole in the angle.
    }
    for (const item of maCylinderPieces(`${name} top MA32x50`, [x, 0, TABLE + h + 55], 'z', 154))
      add(item.label, item.shape, group, item.color, 'BUY');
    add(`${name} top piston rod`, cylinder(5, 47 - gap, [x, 0, topZ + 8]), group, 0xb4bec8, 'BUY');
    add(
      `${name} top flat pressure shoe`,
      subtract(
        box([jawWidth, 24, 12], [x - jawWidth / 2, -12, topZ]),
        cylinder(5.1, 5, [x, 0, topZ + 8]),
      ),
      group,
      0x303c46,
    );
    add(
      `${name} top mounting tail M16`,
      subtract(
        cylinder(8, 22, [x, 0, topRear], 'z', { pitch: 1.5 }),
        cylinder(5.1, 24, [x, 0, topRear - 1]),
      ),
      group,
      0xb4bec8,
      'BUY',
    );
    add(
      `${name} top large mounting washer`,
      subtract(cylinder(19, 3, [x, 0, topRear + 8]), cylinder(8.2, 5, [x, 0, topRear + 7])),
      group,
      0xb4bec8,
      'BUY',
    );
    add(
      `${name} top M16 retaining nut`,
      subtract(
        cylinder(12, 8, [x, 0, topRear + 11]),
        cylinder(8.1, 10, [x, 0, topRear + 10], 'z', { pitch: 1.5, internal: true }),
      ),
      group,
      0x303c46,
      'BUY',
    );
    // Fasteners for the sliding side bracket and datum wall; corresponding holes in base plates are cut in model.ts.
    for (const dx of [-jawWidth / 2 + 12, jawWidth / 2 - 12]) {
      const screw = socketScrew(
        `${name} side bracket M6x18 ${dx}`,
        [x + dx, rear - 10, 855],
        'z',
        6,
        18,
      );
      add(screw.label, screw.shape, group, screw.color, 'BUY');
      add(
        `${name} side bracket washer ${dx}`,
        subtract(
          cylinder(7, 1.5, [x + dx, rear - 10, 855]),
          cylinder(3.2, 3, [x + dx, rear - 10, 854]),
        ),
        group,
        0xb4bec8,
        'BUY',
      );
      // Shift the bolt seat above its washer.
      out.find((v) => v.label === screw.label)!.shape = tr(screw.shape, [0, 0, 1.5]);
    }
  }
  // A fixed Y=-60 side datum replaces centring. Width changes move the opposite jaw and top cylinder.
  for (const item of out) item.shape = tr(item.shape, [0, w / 2 - 60, 0]);
  return out;
}

import type { Parameters } from '../../../core/types';
import type { Piece } from './assembly';
import { at, layout, springAngles } from './motion';
import { box, cylinder, union, subtract, transform, type Shape } from './shapes';
import { springAssessment } from './spring-assessment';
import { barrelPlug } from './barrel';

/** Open-mouth screw-in barrels; the external stop keeps each through-rod captive. */
export function springCartridges(p: Parameters, state: string): Piece[] {
  const assessment = springAssessment(p);
  const m = layout(p),
    seat = 34.5 - +p.springTravel;
  const out: Piece[] = [];
  springAngles.forEach((a, i) => {
    const [x, y] = at(m.lockRadius, a);
    const add = (label: string, shape: Shape, color = 0x929eac) =>
      out.push({ label, shape: transform(shape, 0, [x, y, 0]), color });
    const plug = barrelPlug(+p.springTravel);
    const barrel: Shape = { kind: 'springBarrel', travel: +p.springTravel };
    if (state !== 'mechanism') {
      add(
        `Threaded spring barrel ${i + 1} · Al6061 · M8×0.75×3.5 · bore Ø6 · open mouth Ø6.4 · stop throat Ø4 · flange Ø10×1.2`,
        barrel,
        0xc6cdd5,
      );
      add(`Spring barrel bottom plug ${i + 1} · M7×0.5×2 · AF7 · rod guide Ø2.2`, plug);
    }
    add(
      `Enclosed compression spring ${i + 1} · spring steel · mean Ø5 · wire Ø${p.springWire} · 6 turns · L0=${assessment.freeLength.toFixed(1)} · k≈${assessment.rate.toFixed(2)} N/mm · H${(9.2 + m.springExpansion).toFixed(1)}`,
      {
        kind: 'spring',
        radius: 2.5,
        wire: +p.springWire,
        height: 9.2 - +p.springWire + m.springExpansion,
        turns: 6,
        origin: [0, 0, seat + +p.springWire / 2],
      },
    );
    const piston = seat + 9.2 + m.springExpansion;
    const clipTop = seat - 3 - +p.springTravel + m.springExpansion,
      clipBottom = clipTop - 0.4,
      tail = clipBottom - 0.6;
    const groove = subtract(
      cylinder(1.1, 0.45, [0, 0, clipBottom - 0.025]),
      cylinder(0.75, 0.65, [0, 0, clipBottom - 0.125]),
    );
    add(
      `Captive spring piston ${i + 1} · Ø5.8×0.8 · through rod Ø2 · groove Ø1.5×0.45 · integral piston stop against Ø4 throat`,
      subtract(
        union(
          cylinder(2.9, 0.8, [0, 0, piston]),
          cylinder(1, 44.2 + m.springExpansion - tail, [0, 0, tail]),
          transform(
            { kind: 'thread', diameter: 2, pitch: 0.4, length: 3, clearance: 0, internal: false },
            0,
            [0, 0, 44.2 + m.springExpansion],
          ),
        ),
        groove,
      ),
    );
    add(
      `Piston contact button ${i + 1} · steel · Ø6×0.8 · neck Ø3.2×3 · M2×0.4×3 · threadlocked`,
      transform(
        subtract(union(cylinder(1.6, 3, [0, 0, 0]), cylinder(3, 0.8, [0, 0, 3])), {
          kind: 'thread',
          diameter: 2,
          pitch: 0.4,
          length: 3,
          clearance: 0.04,
          internal: true,
        }),
        0,
        [0, 0, 44.2 + m.springExpansion],
      ),
    );
    add(
      `Piston external retaining ring ${i + 1} · spring steel · Ø4.5/1.54×0.4 · split 0.8`,
      subtract(
        cylinder(2.25, 0.4, [0, 0, clipBottom]),
        cylinder(0.77, 0.6, [0, 0, clipBottom - 0.1]),
        box([3, 0.8, 0.6], [0, -0.4, clipBottom - 0.1]),
      ),
      0x414a55,
    );
  });
  return out;
}

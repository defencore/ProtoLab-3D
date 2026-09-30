import type { Parameters } from '../../../core/types';
import type { Piece } from './model';
import { layout, finderMounts } from './layout';
import {
  bore,
  polymer,
  metal,
  axialScrew,
  blindTapDimensions,
  blindTap,
  blindTapNote,
  at,
} from './mechanical';
import {
  box,
  circle,
  plate,
  subtract,
  union,
  rotate,
  type Shape,
} from '../../rocket-release/lib/shapes';

// User-supplied body dimensions in tray coordinates. Shared library models add
// illustrative visible details; electrical ratings are not inferred from photos.
export const finderModules = [
  {
    name: 'ZX908',
    label: 'ZX908 bare PCB',
    width: 35,
    depth: 20,
    height: 4.5,
    y: 0,
    color: 0x377966,
  },
  {
    name: 'JHE20B',
    label: 'JHEMCU JHE20B finder buzzer',
    width: 20,
    depth: 10,
    height: 8,
    y: 21.5,
    color: 0x343a40,
  },
  {
    name: 'PWM Switch',
    label: 'PWM Switch',
    width: 17,
    depth: 13,
    height: 10,
    y: -20.5,
    color: 0xe2e3df,
  },
] as const;

export function finder(p: Parameters): Piece[] {
  const v = layout(p),
    z = v.finderTrayZ,
    wrap = +p.finderWrapThickness,
    tape = +p.finderTapeThickness,
    out: Piece[] = [];
  const add = (
    label: string,
    shape: Shape,
    material = 'POM-C',
    process = 'TURN / DRILL',
    color = polymer,
    metadata?: Record<string, string>,
  ) => out.push({ label, shape, material, process, color, metadata });
  const tray = plate(
    circle(v.finderTrayRadius),
    [
      ...finderMounts(p).map(([x, y]) => circle(1.65, x, y)),
      circle(3, 26, 0),
      circle(3, -26, 0),
      circle(1.8, 0, 13.25),
      circle(2, 18, -22),
      circle(2, -18, -22),
    ],
    z,
    2,
  );
  // A flat turned plate, foam tape and two ties locate each wrapped module.
  // Round tie ports need only drilling; the plate has no milled pockets or stops.
  const ties = finderModules.flatMap((m, moduleIndex) =>
    [-1, 1].map((side) => ({
      moduleIndex,
      x: side * (m.width / 2 - 4),
      y: m.y,
      halfSpan: m.depth / 2 + wrap + 0.9,
      top: z - tape - m.height - 2 * wrap,
    })),
  );
  const tiePorts = ties.flatMap((t) =>
    [-1, 1].map((side) => bore(1.7, z - 0.1, 2.2, t.x, t.y + side * t.halfSpan)),
  );
  add(
    `Nose finder tray · POM-C D${v.finderTrayRadius * 2} t2 · six cable ties / twelve D3.4 tie ports · open wire exits`,
    subtract(tray, ...tiePorts),
    undefined,
    undefined,
    polymer,
    {
      Fit: `User-supplied bodies: ZX908 35x20x4.5, JHE20B 20x10x8, PWM Switch 17x13x10 mm. Heat-shrink wall allowance ${wrap} mm; tape ${tape} mm. Leads are excluded from body dimensions.`,
      Retention:
        'Two PA66 cable ties per module pass through the tray. Double-sided foam tape supports and locates each body. Open edges admit preattached leads. Deburr the drilled tie ports and tighten only enough to seat the wrapped module, without loading ceramic antennas, buttons or unsupported PCB components. Check strap positions on the purchased modules.',
      Location:
        'Beyond the duralumin tube lip under an unfilled dielectric fairing. Leave antenna, sound outlet and service controls accessible; heat-shrink is a fit reference and needs local openings matched to actual hardware.',
      Wiring:
        'ZX908 uses the requested B- / B1 single-cell tap, which unbalances the series pack. JHE20B uses the FC buzzer interface. PWM switched load, pinout and electrical limits remain unassigned. Route and strain-relieve leads through the open ends and round ports.',
    },
  );
  ties.forEach((t, i) => {
    // Installed band and locking-head envelopes; trimmed tail omitted.
    const band = subtract(
      box(
        [2.5, 2 * t.halfSpan + 1, z + 4 - t.top],
        [t.x - 1.25, t.y - t.halfSpan - 0.5, t.top - 1],
      ),
      box([2.7, 2 * t.halfSpan - 1, z + 2 - t.top], [t.x - 1.35, t.y - t.halfSpan + 0.5, t.top]),
    );
    add(
      `BUY finder cable tie ${i + 1} · PA66 2.5x150 · ${finderModules[t.moduleIndex].name} · trimmed installed envelope`,
      union(band, box([4.5, 4, 3.2], [t.x - 2.25, t.y + t.halfSpan - 4, z + 2.8])),
      'PA66',
      'BUY / FIT REFERENCE',
      0x343a40,
      {
        Fit: 'Nominal 2.5 mm wide cable tie, 150 mm stock length; 1 mm band / 4.5x4x3.2 mm head reference. Actual thickness, head, bend radius and tensile rating depend on the purchased tie. Locking head stays behind the tray; cut tail flush.',
      },
    );
  });
  finderMounts(p).forEach(([x, y], i) => {
    const rear = axialScrew(3, 8, v.clampTop - 8, x, y);
    const front = axialScrew(3, 8, z + 8, x, y, true);
    const rearTap = blindTapDimensions(3, 8 - v.t),
      frontTap = blindTapDimensions(3, 6);
    const postLength = v.clampBottom - z - 2;
    const web = postLength - rearTap.totalDepth - frontTap.totalDepth;
    if (web < 2) throw new Error('Finder post drill points leave less than 2 mm central web.');
    add(
      `Nose finder post ${i + 1} · POM-C D7 L${postLength.toFixed(2)} · M3x0.5 blind ends / drill points`,
      subtract(
        bore(3.5, z + 2, postLength, x, y),
        at(
          rotate(blindTap(rearTap, (-360 * rearTap.penetration) / 0.5), 180, 'x'),
          x,
          y,
          v.clampBottom,
        ),
        at(blindTap(frontTap, (-360 * frontTap.penetration) / 0.5), x, y, z + 2),
      ),
      'POM-C',
      'TURN / DRILL / TAP',
      polymer,
      {
        RearThread: blindTapNote(rearTap),
        FrontThread: blindTapNote(frontTap),
        ResidualWeb: `${web.toFixed(2)} mm between drill tips. Turn from POM-C bar; drill D2.5 blind ends and finish with M3 cutting taps. Verify creep and thread strength on the selected grade.`,
      },
    );
    add(`BUY finder rear screw ${i + 1} · ISO 4762 M3x8`, rear, 'stainless steel', 'BUY', metal);
    add(`BUY finder front screw ${i + 1} · ISO 4762 M3x8`, front, 'stainless steel', 'BUY', metal);
  });
  for (const m of finderModules) {
    out.push({
      label: `${m.label} · ${m.width}x${m.depth}x${m.height} mm · library component model`,
      color: m.color,
      material: 'electronic assembly',
      process: 'BUY',
      library: {
        kind: 'module',
        model: m.name === 'ZX908' ? 'zx908' : m.name === 'JHE20B' ? 'jhe20b' : 'pwm-switch-17x13',
        offset: [0, m.y, z - tape - wrap],
        inverted: true,
      },
      metadata: {
        Source:
          'Selected user-supplied body dimensions; lightweight shared library geometry. Small component and contact locations are illustrative; verify actual hardware.',
        Service:
          'Keep antenna, sound outlet, buttons and wire exits accessible. Verify input limits; ZX908 remains on the requested B-/B1 single-cell tap.',
      },
    });
    add(
      `${m.name} double-sided mounting tape · foam ${m.width - 2}x${m.depth - 2}x${tape}`,
      box([m.width - 2, m.depth - 2, tape], [-m.width / 2 + 1, m.y - m.depth / 2 + 1, z - tape]),
      'double-sided foam tape',
      'CUT',
      0xa2a5a0,
    );
    if (wrap > 0)
      add(
        `Nose finder heat-shrink sleeve · ${m.name} · wall allowance ${wrap} · open ends`,
        subtract(
          box(
            [m.width, m.depth + 2 * wrap, m.height + 2 * wrap],
            [-m.width / 2, m.y - m.depth / 2 - wrap, z - tape - m.height - 2 * wrap],
          ),
          box(
            [m.width + 0.2, m.depth, m.height],
            [-m.width / 2 - 0.1, m.y - m.depth / 2, z - tape - wrap - m.height],
          ),
          box(
            [m.width - 2, m.depth - 2, wrap + 0.2],
            [-m.width / 2 + 1, m.y - m.depth / 2 + 1, z - tape - m.height - 2 * wrap - 0.1],
          ),
        ),
        'heat-shrink polymer',
        'REFERENCE',
        0x515a60,
        {
          Scope:
            'Open-ended sleeve with front inspection/service window. Match actual sound/button/connector openings and keep ties off sensitive components; no sealed electronics enclosure is implied.',
        },
      );
  }
  return out;
}

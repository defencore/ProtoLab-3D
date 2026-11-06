import {
  box,
  cylinder,
  roundedRect,
  subtract,
  union,
  type Shape,
  type SmoothLoftSection,
  type Vec,
} from '../../../core/assembly/boundary/shapes';

/** Photo reconstruction inside the nominal envelope, not dimensioned interfaces. */
export const exteriorLayout = {
  pcb: { size: [22, 16, 0.8], underside: 7.4, cornerRadius: 0.7 },
  battery: { size: [21, 15, 6.55], underside: 0.25, cornerRadius: 1.1 },
  buzzer: { center: [-4.3, 0], diameter: 13.2, underside: 8.2, top: 16.85 },
  soundMouth: { min: [-11.35, -2.1, 11.6], size: [0.9, 4.2, 4.4] },
  led: { center: [4.7, -2], body: [3, 3, 0.8], lensDiameter: 2.3 },
  connector: { min: [7.3, 1, 8.2], size: [3.9, 5.8, 3.2], contactPitch: 1 },
  cancelSwitch: { min: [8.1, -6.6, 8.2], size: [2.7, 3.8, 2.4] },
  sleeve: { thickness: 0.12, opacity: 0.22, highEnd: 2.4, transitionEnd: 5 },
} as const;

export interface ExteriorPiece {
  label: string;
  shape: Shape;
  color: number;
  opacity?: number;
}
const move = (child: Shape, translation: Vec, rotation: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation,
});

/** Rounded YZ section: exact lines/arcs, with no triangulated native surfaces. */
function sleeveSection(x: number, top: number, topHalf: number, inset: number): SmoothLoftSection {
  const half = 8.5 - inset,
    bottom = inset,
    radius = 1.2 - inset;
  const a = half - radius,
    low = bottom + radius,
    high = 8.8;
  const crown = topHalf - inset,
    shoulder = 0.3;
  const p = (y: number, z: number): Vec => [x, y, z];
  const d = radius / Math.sqrt(2);
  return {
    segments: [
      { kind: 'line', points: [p(-a, bottom), p(a, bottom)] },
      { kind: 'arc', points: [p(a, bottom), p(a + d, low - d), p(half, low)] },
      { kind: 'line', points: [p(half, low), p(half, high)] },
      { kind: 'line', points: [p(half, high), p(crown + shoulder, top - inset - shoulder)] },
      {
        kind: 'arc',
        points: [
          p(crown + shoulder, top - inset - shoulder),
          p(crown + shoulder / Math.sqrt(2), top - inset - shoulder + shoulder / Math.sqrt(2)),
          p(crown, top - inset),
        ],
      },
      { kind: 'line', points: [p(crown, top - inset), p(-crown, top - inset)] },
      {
        kind: 'arc',
        points: [
          p(-crown, top - inset),
          p(-crown - shoulder / Math.sqrt(2), top - inset - shoulder + shoulder / Math.sqrt(2)),
          p(-crown - shoulder, top - inset - shoulder),
        ],
      },
      { kind: 'line', points: [p(-crown - shoulder, top - inset - shoulder), p(-half, high)] },
      { kind: 'line', points: [p(-half, high), p(-half, low)] },
      { kind: 'arc', points: [p(-half, low), p(-a - d, low - d), p(-a, bottom)] },
    ],
  };
}

function sleeve(): Shape {
  const loft = (
    a: [number, number, number],
    b: [number, number, number],
    inset: number,
  ): Shape => ({
    kind: 'smooth-loft',
    previewSamples: 72,
    sections: [sleeveSection(...a, inset), sleeveSection(...b, inset)],
  });
  // Upper shoulders follow the round can; the lower band surrounds the battery.
  const stations: [number, number, number][] = [
    [-11.5, 17, 3.3],
    [-9.5, 17, 4.9],
    [-7.5, 17, 6.45],
    [-4.3, 17, 7.1],
    [-1.5, 17, 6.55],
    [0.5, 17, 5.25],
    [1.8, 17, 3.3],
    [2.4, 17, 2.8],
    [5, 11.9, 7.1],
    [11.5, 11.9, 7.1],
  ];
  const skin = (inset: number, extension = 0) => {
    const sections = stations.map((s) => [...s] as [number, number, number]);
    sections[0][0] -= extension;
    sections[sections.length - 1][0] += extension;
    return union(...sections.slice(1).map((b, i) => loft(sections[i], b, inset)));
  };
  return subtract(skin(0), skin(exteriorLayout.sleeve.thickness, 0.1));
}

/** Only visible exterior parts; they remain one purchased finder in composition. */
export function jhe42bExteriorPieces(): ExteriorPiece[] {
  const pieces: ExteriorPiece[] = [];
  const add = (label: string, shape: Shape, color: number, opacity?: number) =>
    pieces.push({ label, shape, color, ...(opacity === undefined ? {} : { opacity }) });
  add(
    'Integral pouch battery · estimated exterior',
    roundedRect(21, 15, 1.1, 0.25, 6.55),
    0xbec2c5,
  );
  add('Battery insulation pad', roundedRect(21, 15.2, 0.8, 6.85, 0.55), 0x202329);
  add(
    'Battery end tape',
    subtract(box([1.8, 15.2, 6.65], [-10.6, -7.6, 0.2]), box([2, 15, 6.55], [-10.7, -7.5, 0.25])),
    0xdca72c,
    0.72,
  );
  add(
    'Black PCB · rounded corners, no mounting holes',
    roundedRect(22, 16, 0.7, 7.4, 0.8),
    0x141a1b,
  );
  // Closed can with a blind side-mouth recess; no invented internal sound path.
  const can = cylinder(6.6, 8.65, [-4.3, 0, 8.2]);
  const hood = box([2.2, 5.4, 5.8], [-11.35, -2.7, 10.8]);
  add(
    'Buzzer · closed top and negative-X side sound mouth',
    subtract(union(can, hood), box([0.9, 4.2, 4.4], [-11.36, -2.1, 11.6])),
    0x181b1e,
  );
  add('White LED package', box([3, 3, 0.8], [3.2, -3.5, 8.2]), 0xeeeade);
  add('Yellow-white LED lens', cylinder(1.15, 0.15, [4.7, -2, 9]), 0xf0ee72);
  const connector = subtract(
    box([3.9, 5.8, 3.2], [7.3, 1, 8.2]),
    box([3, 4.5, 1.9], [8.4, 1.65, 8.65]),
    box([2, 2.1, 0.6], [9.6, 2.85, 10.8]),
  );
  add('Three-pin socket · positive-X mating mouth', connector, 0xe4deca);
  for (const y of [2.9, 3.9, 4.9])
    add(
      'Socket contact · illustrative 1 mm pitch',
      box([1.9, 0.22, 0.22], [8.4, y - 0.11, 9.15]),
      0xbfa665,
    );
  add(
    'Cancel switch metal housing',
    subtract(box([2.7, 3.8, 2.4], [8.1, -6.6, 8.2]), box([0.5, 2.5, 1.3], [10.5, -5.95, 8.6])),
    0x9a9d9f,
  );
  add('Cancel switch · positive-X actuator', box([0.7, 2.1, 1], [10.5, -5.75, 8.75]), 0x292c30);
  // The photographs show populated areas; package outlines do not assert a circuit BOM.
  for (const [x, y, length, width, color] of [
    [2.1, -5.9, 1.4, 0.8, 0xb6a889],
    [4.1, -6.2, 1.2, 0.7, 0x333439],
    [6.1, -5.5, 1.3, 1.1, 0x25282d],
    [4.2, 2.1, 1.4, 0.7, 0xc4b197],
    [4.1, 4.1, 1.7, 1.1, 0x272a30],
    [4.4, 6.2, 1.2, 0.65, 0xbda98b],
    [6.2, -0.1, 0.9, 0.65, 0xa49b8a],
    [2.4, 6.3, 0.8, 0.6, 0xc6b99b],
  ]) {
    add(
      'Visible SMD package · photo-estimated',
      box([length, width, 0.5], [x - length / 2, y - width / 2, 8.2]),
      color,
    );
    add(
      'Visible SMD terminations',
      union(
        box([0.18, width, 0.12], [x - length / 2, y - width / 2, 8.7]),
        box([0.18, width, 0.12], [x + length / 2 - 0.18, y - width / 2, 8.7]),
      ),
      0xbfc0bb,
    );
  }
  for (const [x, y, length, width] of [
    [3.9, -4.1, 2.7, 0.1],
    [3.1, 5.3, 0.1, 3.8],
    [0.9, -6.8, 1.5, 0.1],
  ])
    add(
      'PCB silkscreen · illustrative marking',
      box([length, width, 0.025], [x - length / 2, y - width / 2, 8.2]),
      0xd2d4cc,
    );
  for (const [y, radius, color] of [
    [-6.1, 1.6, 0xc62c24],
    [-4.8, 1.6, 0x202124],
  ]) {
    const loop = move(
      {
        kind: 'torus',
        major: radius,
        minor: 0.35,
        origin: [0, 0, 0],
        innerSegments: 64,
        outerSegments: 192,
      },
      [-9.2, y, 5.65],
      [90, 0, 0],
    );
    add(
      'Visible integral battery lead loop',
      subtract(
        loop,
        box([4, 5, 6], [-9.2, y - 2.5, 2.65]),
        // Trim the tape top before the larger packages to avoid coincident
        // thin-shell Boolean seams in native CAD.
        box([1.8, 15.2, 0.05], [-10.6, -7.6, 6.8]),
        roundedRect(21, 15, 1.1, 0.25, 6.55),
        roundedRect(21, 15.2, 0.8, 6.85, 0.55),
        roundedRect(22, 16, 0.7, 7.4, 0.8),
      ),
      color,
    );
  }
  add(
    'Clear heat-shrink sleeve · open ends, estimated thickness',
    sleeve(),
    0xd7e7ef,
    exteriorLayout.sleeve.opacity,
  );
  return pieces;
}

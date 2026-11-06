import type { Parameters } from '../../../core/types';
import { type Shape, type Vec } from '../../../core/assembly/boundary/shapes';
import type { Detail } from './details';
import { B, C, hex, move, outline, rounded, subtract, union } from './shapes';

const angle = (4.294 * Math.PI) / 180;
const frameOrigin: Vec = [-16.8, -17.5, 19.2];
const frameRotation: Vec = [0, -90, 4.294];
const normal: Vec = [-Math.cos(angle), -Math.sin(angle), 0];
export const webPoint = (x: number, y: number, w: number): Vec => [
  frameOrigin[0] - Math.sin(angle) * y + normal[0] * w,
  frameOrigin[1] + Math.cos(angle) * y + normal[1] * w,
  frameOrigin[2] + x,
];
const frame = (shape: Shape): Shape => move(shape, frameOrigin, frameRotation);
const ease = (t: number): number => {
  const q = Math.max(0, Math.min(1, t));
  return q * q * q * (10 + q * (-15 + 6 * q));
};

/** Local x is world height, local y follows the grip, and local w points outward. */
export const webButton = {
  mechanism: 'captive-linear-friction-clamp',
  frame: { origin: frameOrigin, rotation: frameRotation, outward: normal },
  stock: {
    model: 'daier-ds-225',
    position: webPoint(0, 0, -1.8),
    rotation: frameRotation,
    panelThickness: 2.2,
    panelW: -1.8,
    blackFrontW: 1.2,
    releasedCapW: 3.2,
    pressedCapW: 2.2,
  },
  mount: {
    backW: -4,
    frontW: -1.8,
    width: 16.5,
    length: 22,
    centerLocalX: -1.05,
    baseBottomZ: 9.9,
    baseTopZ: 26.4,
    upperHoleRim: 0.85,
    registrationLipClearance: 0.2,
    holeDiameter: 12.7,
    holeFlatHeight: 11.4,
    lidHoleDiameter: 13,
    lidHoleFlatHeight: 11.7,
    lidBackW: -3.8,
    lidFrontW: -2,
  },
  paddle: {
    width: 10.4,
    length: 20.4,
    radius: 5.2,
    backW: 8.55,
    faceW: 11.55,
    guideWidth: 10.8,
    guideLength: 20.8,
    guideRadius: 5.4,
    guideBackW: 8.85,
    guideFrontW: 12.3,
    contactDiameter: 8,
    contactW: 3.7,
    takeUp: 0.5,
    stroke: 1.5,
    flangeWidth: 14.4,
    flangeLength: 23.4,
    flangeRadius: 7.2,
    flangeBackW: 5.75,
    flangeFrontW: 8.75,
    flangeThickness: 3,
    pocketWidth: 14.8,
    pocketLength: 23.8,
    pocketRadius: 7.4,
    pocketBackW: 4.1,
    pocketFrontW: 8.85,
    outwardClearance: 0.1,
    fullStrokeStopW: 4.1,
    pulloutOverlap: 1.8,
    heel: { centerX: 0, centerY: 8.5, width: 10.4, length: 6, backW: 5.75, frontW: 8.75 },
    returnSource: 'stock-switch-spring-with-0.5mm-captured-freeplay',
    printedReturnFlexures: false,
  },
  slider: {
    axis: [0, 1, 0] as Vec,
    lockedTravel: 0,
    unlockedTravel: 8.4,
    stopProbeTravels: [-0.4, 8.8],
    normalClearance: 0.1,
    maximumInwardFloat: 0.1,
    lockedGap: 0.15,
    maximumLockedGapWithFloat: 0.25,
    gate: { width: 12.4, length: 6.8, centerY: 8.8, backW: 2.6, frontW: 5.6 },
    cam: { fromY: 4.7, toY: 5.4, startFrontW: 5.05, endFrontW: 5.6, minimumThickness: 2.45 },
    bearingMinimumArea: 60,
    lowerBlock: {
      width: 16,
      length: 12.8,
      centerX: -1.4,
      centerY: 18.5,
      backW: -0.4,
      frontW: 6.7,
    },
    thumbPad: {
      width: 16,
      length: 12.8,
      centerX: -1.4,
      centerY: 18.5,
      backW: 9.35,
      frontW: 11.85,
    },
    sideWebs: { centersX: [-8.1, 5.3], width: 2.4, backW: 6.2, frontW: 11.85 },
    rail: {
      width: 10.2,
      centerX: -1.4,
      backW: 6.7,
      frontW: 9.1,
      slotWidth: 3.4,
      slotLength: 11.8,
      centerY: 22.7,
    },
    track: { width: 16.4, length: 21.6, centerX: -1.4, centerY: 22.7, backW: -0.6, frontW: 6.7 },
    minimumHousingWall: 2.4,
    nominalHousingWall: 3,
    positionRetention: 'adjustable-metal-friction-clamp-no-printed-detent',
  },
  clamp: {
    movingWithSlider: true,
    localX: -1.4,
    localY: 18.5,
    axisOutward: normal,
    screwLength: 10,
    headHeight: 1.65,
    headDiameter: 5.7,
    headHex: 2,
    headSeatW: 9.6,
    washerBackW: 9.1,
    washerDiameter: 7,
    washerThickness: 0.5,
    nutBackW: -0.3,
    nutHeight: 4,
    nutAcrossFlats: 5.5,
    pocketAcrossFlats: 5.9,
    pocketCeilingW: 3.7,
    nutCeilingThickness: 3,
    counterboreDiameter: 7.5,
    headRecess: 0.6,
    toolDiameter: 3,
  },
  assembly: {
    loadingDirection: [0, 0, -1] as Vec,
    localLoadingDirection: [-1, 0, 0] as Vec,
    hoodSplitZ: 19.2,
    halfGap: 0.2,
    hoodRootClearance: 0.2,
    remainingBaseWallAtHoodRoot: 1.7,
    plungerLoadOffsetZ: 36,
    sliderLoadOffsetZ: 36,
    sliderLoadingAxis: [0, -1, 0] as Vec,
    sliderLoadingStartTravel: 36.4,
    sliderLoadingEndTravel: 8.4,
    stockLoadOffsetZ: 36,
    outerFairingBottomZ: 6.6,
    upperHoodTopZ: 29,
    bodyPartCount: 5,
    clampHardwareCount: 3,
    hoodRootHeight: 3.2,
    sequence:
      'Lower released switch and paddle; thread slider with captured nut from the open USB-side end along the rail to UNLOCK; lower lid and its solid USB-side end cap; insert washer and screw from outside; set clamp drag.',
  },
  witnesses: {
    lockedBearing: webPoint(0, 8.5, 5.675),
    stockContact: webPoint(0, 0, 3.2),
    frontCaptureUpper: webPoint(6.2, 0, 8.9),
    frontCaptureLower: webPoint(-6.2, 0, 8.9),
    flangePullout: webPoint(6.2, 0, 8.9),
    flangePulloutLower: webPoint(-6.2, 0, 8.9),
    strokeStop: webPoint(6, 4, 4.1),
    railContact: webPoint(2.8, 22.7, 6.7),
    nutCeiling: webPoint(-1.4, 18.5, 5.2),
  },
  print: {
    plungerCenter: [105, -100] as [number, number],
    sliderCenter: [135, -100] as [number, number],
  },
};

function keyedHole(diameter: number, flatHeight: number, w: number, depth: number): Shape {
  return {
    kind: 'intersect',
    children: [C(diameter, depth, w), B(flatHeight, diameter + 2, depth + 0.2, 0, 0, w - 0.1)],
  };
}

/** Clip the authored convex housing sections without resampling their curved skin. */
function clipHousing(shape: Shape, axis: 0 | 1, coordinate: number, keepAbove: boolean): Shape {
  if (shape.kind !== 'boundary') throw new Error('The housing slice needs an indexed boundary.');
  const points: Vec[] = shape.points.map((point) => [...point]),
    faces: number[][] = [],
    intersections = new Map<string, number>(),
    inside = (id: number) =>
      keepAbove ? points[id][axis] >= coordinate : points[id][axis] <= coordinate,
    intersection = (first: number, second: number): number => {
      if (points[first][axis] === coordinate) return first;
      if (points[second][axis] === coordinate) return second;
      const a = Math.min(first, second),
        b = Math.max(first, second),
        key = `${a}:${b}`,
        previous = intersections.get(key);
      if (previous !== undefined) return previous;
      const t = (coordinate - points[a][axis]) / (points[b][axis] - points[a][axis]),
        point = points[a].map((value, i) => value + t * (points[b][i] - value)) as Vec;
      point[axis] = coordinate;
      points.push(point);
      const id = points.length - 1;
      intersections.set(key, id);
      return id;
    };
  for (const face of shape.faces) {
    const clipped: number[] = [];
    for (let i = 0; i < face.length; i++) {
      const a = face[i],
        b = face[(i + 1) % face.length],
        aInside = inside(a),
        bInside = inside(b);
      if (aInside) clipped.push(a);
      if (aInside !== bInside) clipped.push(intersection(a, b));
    }
    const polygon = clipped.filter(
      (id, i) => id !== clipped[(i + clipped.length - 1) % clipped.length],
    );
    if (polygon.length < 3) continue;
    if (polygon.length === 3) faces.push(polygon);
    else {
      const center = [0, 1, 2].map(
        (dimension) => polygon.reduce((sum, id) => sum + points[id][dimension], 0) / polygon.length,
      ) as Vec;
      points.push(center);
      const centerId = points.length - 1;
      for (let i = 0; i < polygon.length; i++)
        faces.push([centerId, polygon[i], polygon[(i + 1) % polygon.length]]);
    }
  }
  const edges = new Map<string, { a: number; b: number; count: number }>();
  for (const face of faces)
    for (let i = 0; i < face.length; i++) {
      const a = face[i],
        b = face[(i + 1) % face.length],
        key = a < b ? `${a}:${b}` : `${b}:${a}`,
        edge = edges.get(key) ?? { a, b, count: 0 };
      edge.count++;
      edges.set(key, edge);
    }
  const rim = [...edges.values()].filter((edge) => edge.count === 1);
  if (!rim.length) throw new Error('The housing clipping plane must intersect its boundary.');
  const next = new Map<number, number>();
  for (const edge of rim) {
    if (
      points[edge.a][axis] !== coordinate ||
      points[edge.b][axis] !== coordinate ||
      next.has(edge.b)
    )
      throw new Error('The housing clipping plane has an open or branched cut loop.');
    next.set(edge.b, edge.a);
  }
  const loop: number[] = [];
  let id = rim[0].b;
  do {
    loop.push(id);
    const following = next.get(id);
    if (following === undefined || loop.length > rim.length)
      throw new Error('The housing cut loop must close.');
    id = following;
  } while (id !== loop[0]);
  if (loop.length !== rim.length) throw new Error('The housing cut must have one convex loop.');
  const center = [0, 1, 2].map(
    (dimension) => loop.reduce((sum, id) => sum + points[id][dimension], 0) / loop.length,
  ) as Vec;
  center[axis] = coordinate;
  points.push(center);
  const centerId = points.length - 1,
    dimensions = axis === 0 ? [1, 2] : [2, 0],
    outward = keepAbove ? -1 : 1;
  for (let i = 0; i < loop.length; i++) {
    const a = points[loop[i]],
      b = points[loop[(i + 1) % loop.length]],
      [u, v] = dimensions,
      area = (b[u] - a[u]) * (center[v] - a[v]) - (b[v] - a[v]) * (center[u] - a[u]);
    if (area * outward < -1e-9) throw new Error('The housing cap must remain convex.');
    faces.push([centerId, loop[i], loop[(i + 1) % loop.length]]);
  }
  const used = [...new Set(faces.flat())],
    remap = new Map(used.map((id, index) => [id, index]));
  return {
    kind: 'boundary',
    points: used.map((id) => points[id]),
    faces: faces.map((face) => face.map((id) => remap.get(id)!)),
  };
}

/** A monotone row grid preserves the curved shoulder without degenerate cap fans. */
function housingOuter(split?: 'base' | 'lid'): Shape {
  const cross = (inset: number, w: number): Vec[] => {
    const radius = 6.4 - inset,
      rows = [
        ...Array.from({ length: 9 }, (_, i) => {
          const angle = (i * Math.PI) / 16;
          return { y: -10.2 - radius * Math.cos(angle), halfWidth: 4.8 + radius * Math.sin(angle) };
        }),
        ...Array.from({ length: 33 }, (_, i) => ({ y: -1 + i * 0.5, halfWidth: 11.2 - inset })),
        ...Array.from({ length: 9 }, (_, i) => (i * Math.PI) / 16).map((angle) => ({
          y: 31.1 + radius * Math.sin(angle),
          halfWidth: 4.8 + radius * Math.cos(angle),
        })),
      ];
    return rows.flatMap(({ y, halfWidth }): Vec[] => {
      const transition = ease((13 - y) / 12),
        scale = 1 - 0.125 * transition,
        center = -1.4 * (1 - transition),
        left = center - halfWidth * scale,
        right = center + halfWidth * scale;
      return [
        [left, y, w],
        [right, y, w],
      ];
    });
  };
  const rings: Vec[][] = [cross(0, -3.2), cross(0, 10.8)];
  for (let i = 1; i <= 12; i++) {
    const angle = (i * Math.PI) / 24;
    rings.push(cross(1.5 * (1 - Math.cos(angle)), 10.8 + 1.5 * Math.sin(angle)));
  }
  const stride = rings[0].length,
    rows = stride / 2,
    points = rings.flat(),
    faces: number[][] = [],
    id = (layer: number, row: number, side: number) => layer * stride + 2 * row + side,
    quad = (a: number, b: number, c: number, d: number, reverse = false) => {
      faces.push(
        ...(reverse
          ? [
              [a, c, b],
              [a, d, c],
            ]
          : [
              [a, b, c],
              [a, c, d],
            ]),
      );
    };
  for (let layer = 0; layer + 1 < rings.length; layer++) {
    for (let row = 0; row + 1 < rows; row++) {
      quad(
        id(layer, row, 0),
        id(layer, row + 1, 0),
        id(layer + 1, row + 1, 0),
        id(layer + 1, row, 0),
        true,
      );
      quad(
        id(layer, row, 1),
        id(layer, row + 1, 1),
        id(layer + 1, row + 1, 1),
        id(layer + 1, row, 1),
      );
    }
    quad(id(layer, 0, 0), id(layer, 0, 1), id(layer + 1, 0, 1), id(layer + 1, 0, 0));
    quad(
      id(layer, rows - 1, 1),
      id(layer, rows - 1, 0),
      id(layer + 1, rows - 1, 0),
      id(layer + 1, rows - 1, 1),
    );
  }
  // Every cap strip has a positive width and Y interval. Collinear stations
  // remain on shared edges instead of becoming zero-area earcut triangles.
  for (const [layer, reverse] of [
    [0, true],
    [rings.length - 1, false],
  ] as const)
    for (let row = 0; row + 1 < rows; row++)
      quad(
        id(layer, row, 0),
        id(layer, row, 1),
        id(layer, row + 1, 1),
        id(layer, row + 1, 0),
        reverse,
      );
  const shape: Shape = { kind: 'boundary', points, faces };
  if (split === 'base') return clipHousing(clipHousing(shape, 0, -0.1, false), 1, 33.3, false);
  return split === 'lid' ? clipHousing(shape, 0, 0.1, true) : shape;
}

function lowerEndCap(): Shape {
  return clipHousing(clipHousing(housingOuter(), 1, 33.1, true), 0, -9.6, false);
}

function fixedRailStock(): Shape {
  return B(10.2, 21.4, 2.4, -1.4, 22.6, 6.7);
}

function fixedRailLidClearance(): Shape {
  return B(10.6, 21.8, 2.8, -1.4, 22.6, 6.5);
}

function operatingCavities(): Shape {
  return union(
    rounded(15.5, 15.5, 1.25, -1.81, 3.16),
    C(9.6, 2.9, 1.2),
    rounded(14.8, 23.8, 7.4, 4.1, 4.75),
    rounded(10.8, 20.8, 5.4, 8.85, 5),
    B(14.2, 16.3, 3.2, -0.7, 12.65, 2.5),
    // Clamp datums touch under preload; guide webs and the bridge are rigid stock.
    B(16.4, 21.6, 7.3, -1.4, 22.7, -0.6),
    B(16.4, 21.6, 5, -1.4, 22.7, 9.1),
    ...[-8.1, 5.3].map((x) => B(2.8, 21.6, 7.5, x, 22.7, 6.6)),
    rounded(3.4, 11.8, 1.7, 6.6, 7.5, -1.4, 22.7),
  );
}

function mountingPanel(): Shape {
  return B(webButton.mount.width, webButton.mount.length, 2.2, webButton.mount.centerLocalX, 0, -4);
}
export function webBaseAdditions(_p: Parameters): Shape {
  // The complete rail stays with the base: a closed slider loop cannot accept
  // a second rail half lowered through its side web while the lid closes.
  return frame(union(mountingPanel(), housingOuter('base'), lowerEndCap(), fixedRailStock()));
}

/** The lid opens the guide, mounting panel and thumb rail without bending hooks. */
export function webBaseCutouts(_p: Parameters): Shape {
  return frame(
    union(
      keyedHole(12.7, 11.4, -4.2, 2.5),
      B(60, 12.7, 2.5, 30, 0, -4.2),
      rounded(15.5, 15.5, 1.25, -1.8, 3.15),
      B(60, 15.5, 3.15, 30, 0, -1.8),
      B(40, 55, 0.7, 19.9, 10.45, -0.5),
      B(40, 19, 4.5, 28.45, 0, -4.2),
      // The closed thumb-pad loop threads along the rail from its open USB-side end.
      // The lid owns the entire thick end cap and closes this loading path.
      B(16.4, 65, 14.6, -1.4, 65.9, -0.6),
      ...[
        [0, 0, 0],
        [0.2, 0, 0],
        [0, -0.2, 0],
        [0, 0.2, 0],
        [0, 0, -0.2],
        [0, 0, 0.2],
      ].map((offset) => move(hoodLocal(), offset as Vec)),
      operatingCavities(),
    ),
  );
}

/** The hood joins the lid through a 3.2 mm deep solid roof root. */
function hoodLocal(): Shape {
  const endCap = clipHousing(clipHousing(housingOuter(), 1, 33.5, true), 0, -9.4, true),
    upperHousing = union(housingOuter('lid'), endCap),
    barrelClosure = subtract(B(9.7, 12.3, 1.8, 4.95, 0, -3.8), keyedHole(13, 11.7, -4, 2.2)),
    roofBridge = B(3.2, 18.6, 4.3, 8.2, 0, -4),
    hoodRoof = B(3.2, 18.6, 8.85, 8.2, 0, -0.3);
  return subtract(
    union(upperHousing, barrelClosure, roofBridge, hoodRoof),
    operatingCavities(),
    keyedHole(13, 11.7, -4.2, 2.5),
    fixedRailLidClearance(),
  );
}
export function webLidAdditions(_p: Parameters): Shape {
  return frame(hoodLocal());
}

function sliderLocal(travelMm = 0, normalOffset = 0): Shape {
  // This broad nose lifts the stock-returned free paddle while the safety
  // closes. Its 2.45 mm root replaces any need for a printed return spring.
  const profile: [number, number][] = [
      [4.7, 2.6],
      [5.6, 2.6],
      [5.6, 5.6],
      [5.4, 5.6],
      [4.7, 5.05],
    ],
    camNose: Shape = {
      kind: 'boundary',
      points: [-6.2, 6.2].flatMap((x) => profile.map(([y, w]): Vec => [x, y, w])),
      faces: [
        [4, 3, 2, 1, 0],
        [5, 6, 7, 8, 9],
        ...profile.map((_, i) => [i, (i + 1) % 5, ((i + 1) % 5) + 5, i + 5]),
      ],
    };
  const body = union(
    rounded(16, 12.8, 1.6, -0.4, 7.1, -1.4, 18.5),
    B(12.4, 6.8, 3, 0, 8.8, 2.6),
    camNose,
    B(12.4, 6.2, 3, -0.7, 12.5, 2.6),
    rounded(16, 12.8, 1.6, 9.35, 2.5, -1.4, 18.5),
    ...[-8.1, 5.3].map((x) => B(2.4, 12.8, 5.65, x, 18.5, 6.2)),
  );
  return move(
    subtract(
      body,
      union(
        hex(5.9, -0.6, 4.3, -1.4, 18.5),
        C(3.4, 6, 3.6, -1.4, 18.5),
        C(7.5, 3, 9.1, -1.4, 18.5),
        ...[-1, 1].map((sign) => B(2, 7.2, 0.1, -1.4 + sign * 5.5, 18.5, 11.8)),
      ),
    ),
    [0, travelMm, normalOffset],
  );
}

function plungerLocal(stroke = 0): Shape {
  const capsule = (w: number, l: number, r: number): [number, number][] =>
    outline(w, l, r).filter(
      (p, i, points) =>
        i === 0 || Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 1e-9,
    );
  const cap: Shape = {
    kind: 'loft',
    rings: [
      ...[8.55, 11.05].map((w) => capsule(10.4, 20.4, 5.2).map(([x, y]): Vec => [x, y, w])),
      ...Array.from({ length: 8 }, (_, i) => {
        const a = ((i + 1) * Math.PI) / 16,
          inset = 0.5 * (1 - Math.cos(a)),
          w = 11.05 + 0.5 * Math.sin(a);
        return capsule(10.4 - 2 * inset, 20.4 - 2 * inset, 5.2 - inset).map(([x, y]): Vec => [
          x,
          y,
          w,
        ]);
      }),
    ],
  };
  return move(union(rounded(14.4, 23.4, 7.2, 5.75, 3), cap, C(8, 5.05, 3.7)), [0, 0, -stroke]);
}

/** The stock spring returns the paddle to contact; captured free play remains. */
export function webPlungerAtTravel(strokeMm: number): Shape {
  return frame(plungerLocal(strokeMm));
}
export function webSliderAtTravel(travelMm: number, normalOffset = 0): Shape {
  return frame(sliderLocal(travelMm, normalOffset));
}

export function webPrintDetails(p: Parameters, forPrint = false): Detail[] {
  const stroke = !forPrint && p.buttonA === 'last' ? webButton.paddle.stroke : 0,
    travel = !forPrint && p.safetyPosition === 'unlocked' ? webButton.slider.unlockedTravel : 0,
    plunger = plungerLocal(stroke),
    slider = sliderLocal(travel);
  return [
    {
      id: 'web-plunger',
      label: 'Solid web paddle with 3 mm captive flange',
      shape: forPrint ? move(plunger, [105, -100, 11.55], [180, 0, 0]) : frame(plunger),
      color: 0x556774,
      material: 'PETG / qualify sliding clearance and stock-switch return',
    },
    {
      id: 'web-slider',
      label: 'Captive linear safety with recessed M3 friction clamp',
      shape: forPrint ? move(slider, [135, -118.5, 0.4]) : frame(slider),
      color: 0xe1a13d,
      material: 'PETG / M3 metal clamp; qualify drag and wear on printed sample',
    },
  ];
}

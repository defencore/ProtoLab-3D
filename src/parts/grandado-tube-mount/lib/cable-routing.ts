import type { Parameters } from '../../../core/types';
import { box, cylinder, type Shape, type Vec } from '../../../core/assembly/boundary/shapes';
import { layout, move } from './spec';

const add = (a: Vec, b: Vec): Vec => a.map((v, i) => v + b[i]) as Vec;
const scale = (a: Vec, value: number): Vec => a.map((v) => v * value) as Vec;
const difference = (a: Vec, b: Vec): Vec => a.map((v, i) => v - b[i]) as Vec;
const length = (v: Vec) => Math.hypot(...v);
const unit = (v: Vec) => scale(v, 1 / length(v));
const dot = (a: Vec, b: Vec) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Circular tangent transitions; adjacent small corners share the available space. */
function roundedPath(points: Vec[], requestedRadius: number): Vec[] {
  const result: Vec[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const previous = difference(points[i], points[i - 1]),
      next = difference(points[i + 1], points[i]);
    const incoming = unit(previous),
      outgoing = unit(next),
      angle = Math.acos(Math.max(-1, Math.min(1, dot(incoming, outgoing))));
    if (angle < 0.001) {
      result.push(points[i]);
      continue;
    }
    const tangent = Math.min(
      requestedRadius * Math.tan(angle / 2),
      length(previous) * 0.45,
      length(next) * 0.45,
    );
    const radius = tangent / Math.tan(angle / 2),
      axis = unit(cross(incoming, outgoing));
    const normal = unit(difference(outgoing, scale(incoming, Math.cos(angle))));
    const start = add(points[i], scale(incoming, -tangent)),
      center = add(start, scale(normal, radius)),
      radial = difference(start, center);
    const samples = Math.max(2, Math.ceil(angle / (Math.PI / 12)));
    for (let j = 0; j <= samples; j++) {
      const a = (angle * j) / samples;
      result.push(
        add(
          center,
          add(
            scale(radial, Math.cos(a)),
            add(
              scale(cross(axis, radial), Math.sin(a)),
              scale(axis, dot(axis, radial) * (1 - Math.cos(a))),
            ),
          ),
        ),
      );
    }
  }
  result.push(points.at(-1)!);
  return result;
}

/** Closed swept envelope, including overlapping round junctions between samples. */
function sweptTube(points: Vec[], radius: number): Shape {
  const pieces: Shape[] = points.map((origin) => ({
    kind: 'sphere',
    radius,
    origin,
    segments: 16,
  }));
  for (let i = 1; i < points.length; i++) {
    const delta = difference(points[i], points[i - 1]),
      size = length(delta);
    if (size < 0.0001) continue;
    pieces.push(
      move(cylinder(radius, size, [0, 0, 0]), points[i - 1], [
        0,
        (Math.acos(delta[2] / size) * 180) / Math.PI,
        (Math.atan2(delta[1], delta[0]) * 180) / Math.PI,
      ]),
    );
  }
  return { kind: 'union', children: pieces, nativeBatch: true };
}

export function cableRoutingSpec(p: Parameters) {
  const d = layout(p);
  const wireRadius = d.powerCableDiameter / 2,
    clearanceRadius = wireRadius + d.connectorClearance;
  const axialExtent = d.endMountX + 10;
  const coreHalfLength = d.mountPitch / 2 + Math.min(7, (d.mountPitch - d.boxLength) / 2 - d.fit);
  const plenumZ = d.holderBottom - 9.46;
  const highZ = d.cassetteJoinZ + 6.3;
  const transferX = -d.holderLength / 2 - d.fit - 6.85;
  const transitionZ = d.holderTop - 4.2;
  const transferWaypoints: Vec[] = [
    [0, -d.boxWidth / 2 - 3.5, d.powerCenterZ],
    [-6, -d.boxWidth / 2 - 3, highZ],
    [transferX, -d.boxWidth / 2 - 3, highZ],
    [transferX, -20, highZ],
    [transferX, -20, transitionZ],
    [transferX, -14.5, transitionZ],
    [transferX, -14.5, plenumZ],
    [transferX + 8, -17.5, plenumZ],
    [0, -17.5, plenumZ],
  ];
  const requestedWireBendRadius = 4;
  const transferCenterline = roundedPath(transferWaypoints, requestedWireBendRadius);
  const exitAxes = [-17.5, 17.5].map((y) => ({
    y,
    z: plenumZ,
    startX: -axialExtent,
    endX: axialExtent,
  }));
  const plenumCenterlines = [
    ...exitAxes.map((axis, i) => ({
      id: `underfloor-${i + 1}`,
      points: [
        [axis.startX, axis.y, axis.z],
        [axis.endX, axis.y, axis.z],
      ] as Vec[],
    })),
    {
      id: 'underfloor-junction',
      points: [
        [0, exitAxes[0].y, plenumZ],
        [0, exitAxes[1].y, plenumZ],
      ] as Vec[],
    },
  ];
  const centerlines = [
    { id: 'grandado-to-underfloor', points: transferCenterline },
    ...plenumCenterlines,
  ];
  const serviceCenterlines = [
    { id: 'grandado-to-underfloor-service', points: transferWaypoints },
    ...plenumCenterlines,
  ];
  return {
    wireRadius,
    clearanceRadius,
    clearanceDiameter: 2 * clearanceRadius,
    maximumClearanceRadius: 3,
    axialExtent,
    plenumZ,
    plenumTop: d.holderBottom - 3,
    exitAxes,
    highRun: { y: -d.boxWidth / 2 - 3, z: highZ },
    transferX,
    transferWaypoints,
    transferCenterline,
    requestedWireBendRadius,
    centerlines,
    serviceCenterlines,
    // Deliberately open the outer service flute; do not retain a thin curved roof.
    flute: {
      min: [transferX - clearanceRadius, -d.innerRadius - 2, highZ - clearanceRadius] as Vec,
      max: [
        clearanceRadius,
        -d.boxWidth / 2,
        Math.max(highZ, d.powerCenterZ) + clearanceRadius,
      ] as Vec,
    },
    // Clear the full printed wall thickness, preserving a 3 mm strip beside the ear opening.
    bodyPortal: {
      min: [-d.boxLength / 2 - d.fit - 3.1, -d.boxWidth / 2 - 0.1, d.boxBottom] as Vec,
      max: [-d.boxLength / 2 - d.fit, -20 + clearanceRadius, highZ + clearanceRadius + 0.1] as Vec,
    },
    grooveBottom: -d.innerRadius - 2,
    bodyLoading: {
      min: [-clearanceRadius - 3, -d.innerRadius - 2, -d.innerRadius - 2] as Vec,
      max: [clearanceRadius + 3, -d.boxWidth / 2, d.powerCenterZ + clearanceRadius] as Vec,
      leadStart: [0, -d.boxWidth / 2, d.powerCenterZ] as Vec,
      leadEnd: [0, -d.innerRadius - clearanceRadius - 1, d.powerCenterZ] as Vec,
      scope:
        'Upper cage only: hold the attached lead straight outward at X0 while lifting the body from below. Remove the complete local negative T-key section, not a thin stem. Lay the lead into its final route after seating the body and before joining the lower assembly.',
    },
    closing: {
      negativeEntryX: -coreHalfLength - clearanceRadius - 1,
      sections: [
        { id: 'upper-drop', from: transferWaypoints[3], to: transferWaypoints[4] },
        { id: 'inboard-turn', from: transferWaypoints[4], to: transferWaypoints[5] },
        { id: 'lower-drop', from: transferWaypoints[5], to: transferWaypoints[6] },
        { id: 'underfloor-turn', from: transferWaypoints[6], to: transferWaypoints[7] },
      ].map((segment) => ({
        ...segment,
        startX: -coreHalfLength - clearanceRadius - 1,
        endX: Math.max(segment.from[0], segment.to[0]) + clearanceRadius,
      })),
      sequence:
        'Route the connected lead through the open negative-end entries before sliding the loaded lower assembly from positive X into the upper cage. The fixed final lead remains inside axial clearance throughout closure; no lateral feed through the torque-key lands is required.',
    },
    layIn: {
      sidePortal: {
        min: [
          transferX - clearanceRadius,
          -d.innerRadius - 2,
          transitionZ - clearanceRadius,
        ] as Vec,
        max: [
          transferX + clearanceRadius,
          -20 + clearanceRadius,
          highZ + clearanceRadius + 0.1,
        ] as Vec,
      },
      lowerTurnPortal: {
        min: [
          transferX - clearanceRadius,
          -d.innerRadius - 2,
          transitionZ - clearanceRadius,
        ] as Vec,
        max: [
          transferX + clearanceRadius,
          -14.5 + clearanceRadius,
          transitionZ + clearanceRadius,
        ] as Vec,
      },
      downwardTransfer: {
        min: [transferX - clearanceRadius, -14.5 - clearanceRadius, -d.innerRadius - 2] as Vec,
        max: [transferX + clearanceRadius, -14.5 + clearanceRadius, transitionZ] as Vec,
      },
      bottomAxes: exitAxes.map((axis) => ({
        min: [axis.startX, axis.y - clearanceRadius, -d.innerRadius - 2] as Vec,
        max: [axis.endX, axis.y + clearanceRadius, axis.z] as Vec,
      })),
      bottomJunction: {
        min: [-clearanceRadius, exitAxes[0].y, -d.innerRadius - 2] as Vec,
        max: [clearanceRadius, exitAxes[1].y, plenumZ] as Vec,
      },
      sequence:
        'The exterior mouths permit placing and inspecting the attached lead before closure. Seat it in the final route and negative axial entries before moving the lower assembly. The pipe later closes the accessible trough; it does not provide strain relief.',
    },
  };
}

/** One fixed attached lead for the axial-closing motion audit and inspection. */
export function cableAssemblySpec(p: Parameters) {
  const s = cableRoutingSpec(p);
  const fixedEntry = [...s.transferWaypoints[0]] as Vec;
  const finalWaypoints: Vec[] = [
    ...s.transferWaypoints.slice(0, 8).map((point) => [...point] as Vec),
    [s.axialExtent, s.exitAxes[0].y, s.plenumZ],
  ];
  return {
    fixedEntry,
    finalWaypoints,
    finalCenterline: roundedPath(finalWaypoints, s.requestedWireBendRadius),
    wireRadius: s.wireRadius,
    clearanceRadius: s.clearanceRadius,
    closureDirection: [-1, 0, 0] as Vec,
    closingEntryX: s.closing.negativeEntryX,
    bodyEntryLeadStart: s.bodyLoading.leadStart,
    bodyEntryLeadEnd: s.bodyLoading.leadEnd,
    scope:
      'Lift the body from below with its attached lead held straight outward through the X0 upper-cage loading notch. After seating the body, lay the lead into its final route before the lower parts and discs join. The attached lead then stays fixed while the loaded lower assembly slides from positive X into the upper cage. Negative-end axial entries protect it from the moving end lands. This is not a wire strain, length or material-specific bend-radius model.',
  };
}

/** Service capsules cover the occupied lead and the optional underfloor route axes. */
export function cableRouteEnvelope(
  p: Parameters,
  radius = cableRoutingSpec(p).clearanceRadius,
): Shape {
  return {
    kind: 'union',
    children: cableRoutingSpec(p).serviceCenterlines.map((path) => sweptTube(path.points, radius)),
    nativeBatch: true,
  };
}

export function cableWireReference(p: Parameters): Shape {
  const s = cableAssemblySpec(p);
  const tube = sweptTube(s.finalCenterline, s.wireRadius) as Extract<Shape, { kind: 'union' }>;
  const nodes = s.finalCenterline.length;
  const cylinders = tube.children.slice(nodes);
  const connected: Shape[] = [tube.children[0]];
  let segment = 0;
  for (let i = 1; i < nodes; i++) {
    if (length(difference(s.finalCenterline[i], s.finalCenterline[i - 1])) >= 0.0001)
      connected.push(cylinders[segment++]);
    connected.push(tube.children[i]);
  }
  // Dense rounded nodes can lose whole branches in an all-at-once native fuse.
  // Keep the identical cylinders/spheres, adding each connecting segment before
  // its next cap so every native intermediate remains connected.
  return { kind: 'union', children: connected, nativeBatch: false };
}

/** Only the upper cage receives this complete local body-entry and key relief. */
export function bodyLoadingCableRelief(p: Parameters): Shape {
  const { min, max } = cableRoutingSpec(p).bodyLoading;
  return box(difference(max, min), min);
}

/** Project each Y/Z service capsule through the complete negative axial entry. */
export function cableClosingReliefs(p: Parameters): Shape {
  const s = cableRoutingSpec(p),
    r = s.clearanceRadius;
  const children: Shape[] = [];
  for (const segment of s.closing.sections) {
    const a = segment.from,
      b = segment.to,
      length = segment.endX - segment.startX;
    children.push(
      cylinder(r, length, [segment.startX, a[1], a[2]], 'x'),
      cylinder(r, length, [segment.startX, b[1], b[2]], 'x'),
    );
    if (Math.abs(a[1] - b[1]) < 1e-9)
      children.push(
        box(
          [length, 2 * r, Math.abs(b[2] - a[2])],
          [segment.startX, a[1] - r, Math.min(a[2], b[2])],
        ),
      );
    else if (Math.abs(a[2] - b[2]) < 1e-9)
      children.push(
        box(
          [length, Math.abs(b[1] - a[1]), 2 * r],
          [segment.startX, Math.min(a[1], b[1]), a[2] - r],
        ),
      );
    else
      throw new Error('Cable closing reliefs require explicit Y- or Z-aligned profile segments.');
  }
  return { kind: 'union', children, nativeBatch: true };
}

export function cassetteCableReliefs(p: Parameters): Shape[] {
  const s = cableRoutingSpec(p);
  const bounds = ({ min, max }: { min: Vec; max: Vec }) => box(difference(max, min), min);
  return [
    cableRouteEnvelope(p),
    cableClosingReliefs(p),
    bounds(s.flute),
    bounds(s.bodyPortal),
    bounds(s.layIn.sidePortal),
    bounds(s.layIn.lowerTurnPortal),
    bounds(s.layIn.downwardTransfer),
    ...s.layIn.bottomAxes.map(bounds),
    bounds(s.layIn.bottomJunction),
  ];
}

/** Broad lower lay-in portals would sever the upper cage's negative guide web. */
export function upperCageCableReliefs(p: Parameters): Shape[] {
  const s = cableRoutingSpec(p);
  const bounds = ({ min, max }: { min: Vec; max: Vec }) => box(difference(max, min), min);
  return [
    cableRouteEnvelope(p),
    cableClosingReliefs(p),
    bounds(s.flute),
    bounds(s.bodyPortal),
    bodyLoadingCableRelief(p),
  ];
}

/** Downward-open U grooves span both complete discs and their inner closure shoulders. */
export function discCableReliefs(p: Parameters): Shape[] {
  const s = cableRoutingSpec(p),
    r = s.clearanceRadius;
  return s.exitAxes.flatMap((axis) => [
    cylinder(r, axis.endX - axis.startX, [axis.startX, axis.y, axis.z], 'x'),
    box(
      [axis.endX - axis.startX, 2 * r, axis.z - s.grooveBottom],
      [axis.startX, axis.y - r, s.grooveBottom],
    ),
  ]);
}

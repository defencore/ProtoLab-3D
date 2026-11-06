import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import {
  box,
  cylinder,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { fastenerValues } from '../../../core/hardware/fasteners';
import { at, intersect, purchased, type PrintedItem } from './shared';
import gps from '../../gps-tracker/part';
import finder from '../../jhe42b-finder/part';
import bolt from '../../bolt-screw/part';
import nut from '../../hex-nut/part';
import washer from '../../washer/part';

/** Fixed source occurrences; the two TPU cradles are local manufactured details. */
export const auxiliaryDatums = {
  finder: { position: [-202, 0, -20.1] as Vec, rotation: [0, 0, 90] as Vec },
  tracker: { position: [-145, 0, -24.3] as Vec, rotation: [0, 0, 0] as Vec },
  finderFloor: { bottom: -21.3, top: -20.1 },
  trackerFloor: { bottom: -27.3, top: -24.3 },
  key: {
    diameter: 6,
    flatY: 2.4,
    holeDiameter: 6.4,
    holeFlatY: 2.6,
    height: 3.2,
    flangeHeight: 3,
    bore: 3.4,
  },
  mounts: [
    {
      id: 'nose-finder-tray',
      x: -217.5,
      y: 0,
      floor: -21.3,
      bottom: -24.3,
      screw: 'gvyntok-040-070-005',
      bottomEntry: true,
    },
    {
      id: 'nose-tracker-tray',
      x: -120.7,
      y: 0,
      floor: -27.3,
      bottom: -30.3,
      screw: 'gvyntok-040-190-006',
      bottomEntry: false,
    },
  ],
  strap: {
    width: 6.4,
    passageThickness: 0.8,
    maximumFinderTapeThickness: 0.2,
    finderBandY: [-6.4, 0],
    trackerBandX: [-134.2, -127.8],
    scope:
      'Removable tape is an unprocured consumable. Release the tracker tape for SIM or board removal. A thick tie must not cross the finder top.',
  },
  assembly:
    'Install both cases on the bare frame before the Pi island, camera cartridge, upper camera keeper and FFC. Thread the tape beneath the frame through the outboard slots. Device uplift restraint requires the accepted tape; it is not supplied or modeled as a procurement unit. Reverse that order for case removal.',
  scope:
    'Source shapes and device poses are fixed. JHE nominal length 23/photo 25 conflict is reserved as 25 mm plus 0.3 mm each end; photo-derived service coordinates and safe contact lands remain unverified.',
} as const;

const dKey = (x: number, y: number, z: number, height: number, radius = 3, flatY = 2.4): Shape =>
  intersect(
    cylinder(radius, height, [x, y, z]),
    box([2 * radius + 2, radius + flatY, height], [x - radius - 1, y - radius, z]),
  );
const flangeHole = (x: number, y: number, z: number): Shape => dKey(x, y, z - 0.1, 3.3, 3.2, 2.6);
const mountKey = (m: (typeof auxiliaryDatums.mounts)[number]): Shape =>
  dKey(m.x, m.y, m.floor, auxiliaryDatums.key.height);

/**
 * Retain the bought devices while preserving ports and the Pi plug reserve.
 * A roof worsens both clearance and TPU printing. The selected simple concept
 * assigns device uplift restraint to removable tape and case location to a
 * rigid key/washer. Both floors are backed; no source preload is fabricated.
 * Tape grade, safe contact lands, strength and RF behavior remain unqualified.
 */
function finderCradle(): Shape {
  const floor = auxiliaryDatums.finderFloor;
  const body = subtract(
    union(
      box([22.8, 25.6, 1.2], [-213.4, -12.8, floor.bottom]),
      box([2.6, 25.6, 7.2], [-213.4, -12.8, floor.top - 0.1]),
      box([2.6, 25.6, 7.2], [-193.2, -12.8, floor.top - 0.1]),
    ),
    // Cut the open washer-loading notch before joining the full-height foot.
    // The 0.1 mm extra radius joins the adjacent tape-slot void, avoiding a
    // zero-thickness tangent edge. The lower tool overlap avoids a coincident
    // subtraction plane while
    // the uncut foot retains its actual 3 mm capture height.
    cylinder(5.1, 5.5, [-217.5, 0, -18.4]),
  );
  return subtract(
    union(body, box([9.5, 12, 3], [-222.2, -6, floor.bottom])),
    flangeHole(-217.5, 0, floor.bottom),
    // Floor-to-top slots need no trapped roof or TPU bridge. Their broad wall
    // roots remain on both sides; the tape is threaded before bolting the case.
    ...[-212.5, -192.3].map((x) => box([0.8, 6.4, 12], [x, -6.4, floor.bottom - 0.1])),
  );
}

/** The low -Y lip leaves the source SIM/pad edge open; +Z remains wholly open. */
function trackerCradle(): Shape {
  const floor = auxiliaryDatums.trackerFloor;
  return subtract(
    union(
      box([39.6, 26.4, 3], [-164.8, -13.2, floor.bottom]),
      box([2, 26.4, 2.9], [-164.8, -13.2, floor.top - 0.1]),
      box([2, 26.4, 2.9], [-127.2, -13.2, floor.top - 0.1]),
      box([35.8, 2.9, 3.4], [-162.9, 10.3, floor.top - 0.1]),
      box([35.8, 2.9, 1.2], [-162.9, -13.2, floor.top - 0.1]),
      box([9, 16, 3], [-125.3, -8, floor.bottom]),
    ),
    flangeHole(-120.7, 0, floor.bottom),
    cylinder(5, 3.4, [-120.7, 0, floor.top]),
    ...[-12.15, 11.35].map((y) => box([6.4, 0.8, 12], [-134.2, y, floor.bottom - 0.1])),
  );
}

export function auxiliaryPrinted(): PrintedItem[] {
  return [
    {
      id: 'nose-finder-tray',
      name: 'Open TPU finder case with keyed mounting foot',
      shape: finderCradle(),
      material: 'TPU',
      module: 'nose',
      printRotation: [0, 0, 0],
    },
    {
      id: 'nose-tracker-tray',
      name: 'Open TPU tracker case with keyed mounting foot',
      shape: trackerCradle(),
      material: 'TPU',
      module: 'nose',
      printRotation: [0, 0, 0],
    },
  ];
}

/** Stock is confined to the central floor; both original primary rails remain whole. */
export function auxiliaryFrameAdditions(): Shape[] {
  return [
    box([12.6, 12, 3], [-223.4, -6, -24.3]),
    box([3.2, 25.6, 3], [-193.8, -12.8, -24.3]),
    ...auxiliaryDatums.mounts.map(mountKey),
  ];
}

export function auxiliaryFrameCuts(): Shape[] {
  const m = auxiliaryDatums.mounts[0];
  return [
    // Protect the rigid key while removing the old camera cheek from the TPU
    // foot and opening its full vertical entry. This tool can follow
    // union(frame, ...auxiliaryFrameAdditions()).
    subtract(box([9.9, 12.4, 6.6], [-222.4, -6.2, m.floor]), dKey(m.x, m.y, m.floor - 0.1, 3.3)),
    // Open only the fore strip that crosses the closed foot during a vertical
    // drop. The 2.6 mm fore land and 2.8 mm inboard side leg remain.
    box([1.6, 12.4, 14.9], [-222.4, -6.2, -14.7]),
    // The aft floor corners need a shallow local seat, not a primary rail cut.
    box([3, 26, 1.4], [-193.4, -13, -21.3]),
    // Tape passes below the rigid frame, leaving the entire source footprint
    // backed. Only the outboard transfer slots pierce the floor.
    ...[-212.5, -192.3].map((x) => box([0.8, 6.6, 3.2], [x, -6.5, -24.4])),
    ...[-12.15, 11.35].map((y) => box([6.6, 0.8, 3.2], [-134.3, y, -30.4])),
    ...auxiliaryDatums.mounts.map((mount) =>
      cylinder(1.7, 18, [mount.x, mount.y, mount.bottom - 1]),
    ),
    // Actual DIN 7991 source has a 0.2 mm Ø6 rim followed by a 1.5 mm 90° cone.
    // Keep that analytic seat; the Ø3.4 bore truncates its narrow end.
    at(
      {
        kind: 'revolve',
        segments: 64,
        profile: [
          [0, -24.4],
          [3, -24.4],
          [3, -24.1],
          [1.7, -22.8],
          [1.7, -17],
          [0, -17],
        ],
      },
      [m.x, m.y, 0],
    ),
  ];
}

export function auxiliaryPayload(): ConfiguredPiece[] {
  const selected: ConfiguredPiece[] = [
    purchased(
      gps,
      'nose-zx908',
      'zx908',
      auxiliaryDatums.tracker.position,
      auxiliaryDatums.tracker.rotation,
    ),
    purchased(
      finder,
      'nose-jhe42b',
      'jhe42b',
      auxiliaryDatums.finder.position,
      auxiliaryDatums.finder.rotation,
      'default',
    ),
  ];
  for (const m of auxiliaryDatums.mounts) {
    const preset = bolt.presets.find((p) => p.id === m.screw)!;
    const v = fastenerValues(preset.parameters);
    const washerBottom = m.floor + auxiliaryDatums.key.height;
    const headSeat = m.bottomEntry ? m.bottom + v.h : washerBottom + 0.8;
    const center = m.bottomEntry
      ? headSeat + (v.shaftLength - v.total / 2)
      : headSeat - (v.shaftLength - v.total / 2);
    selected.push(
      purchased(
        bolt,
        `${m.id}-screw`,
        m.screw,
        [m.x, m.y, center],
        m.bottomEntry ? [180, 0, 0] : [0, 0, 0],
        'default',
      ),
      purchased(
        washer,
        `${m.id}-washer`,
        'gvyntok-e3f364f222e0',
        [m.x, m.y, washerBottom + 0.4],
        [0, 0, 0],
        'default',
      ),
      purchased(
        nut,
        `${m.id}-nut`,
        'gvyntok-474adfbe1cd7',
        [m.x, m.y, m.bottomEntry ? washerBottom + 0.8 : m.bottom - 2.4],
        [0, 0, 0],
        'default',
      ),
    );
  }
  return selected;
}

/** Nominal clearance and protective floor seating; no invented TPU preload. */
export function auxiliaryContactSpecs() {
  return [];
}

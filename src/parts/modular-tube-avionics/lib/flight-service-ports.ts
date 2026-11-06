import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import {
  box,
  cylinder,
  prism,
  roundedRect,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { fastenerValues } from '../../../core/hardware/fasteners';
import type { PartDefinition } from '../../../core/types';
import bolt from '../../bolt-screw/part';
import nut from '../../hex-nut/part';
import { nikomA448027 } from '../../signal-connector/lib/nikom-a448027';
import signalConnector from '../../signal-connector/part';
import { usbExtenderInterface } from '../../usb-wireless-extender/lib/model';
import usb from '../../usb-wireless-extender/part';
import { coverDatums } from './lower-cover';
import { at, purchased } from './shared';

export const flightServicePortLibraries: PartDefinition[] = [usb, signalConnector, bolt, nut];

const bedBottom = coverDatums.lowerFrameContact;
const forePosition: Vec = [-40.3, 0, -14.5];
const foreRotation: Vec = [0, -90, 180];
const panelPosition: Vec = [37.3, 0, bedBottom - 1.4];
const panelRotation: Vec = [180, 0, 90];

export const flightServicePortDatums = {
  fore: {
    position: forePosition,
    rotation: foreRotation,
    bossRootX: -43.7,
    nutBearingX: -43.3,
    nutPocketStartX: -45.45,
    nutEntryOffsetX: -0.3,
    mouthZ: forePosition[2] + usbExtenderInterface.bounds.min[0],
    edgeStopZ: forePosition[2] + usbExtenderInterface.bounds.max[0] + 0.1,
    throat: { center: [-37.5, 4.2] as const, size: [7.2, 14] as const },
    mountingAxes: usbExtenderInterface.mountingAxes.map(
      ([x, y]) => [forePosition[0], forePosition[1] - y, forePosition[2] + x] as const,
    ),
  },
  aft: {
    position: panelPosition,
    rotation: panelRotation,
    land: { x: [32, 43.7] as const, width: 25, thickness: 4.5 },
    throat: { xOffset: -0.5, size: [5.6, 10.4] as const, radius: 0.8 },
  },
} as const;

/** Integral fore board bosses and the continuous aft field-drilling land. */
export function flightServicePortStock(): Shape[] {
  const { fore, aft } = flightServicePortDatums;
  return [
    ...fore.mountingAxes.flatMap(([x, y, z]) => [
      prism(
        [
          [fore.bossRootX, z - 3.5 - (x - fore.bossRootX)],
          [x, z - 3.5],
          [x, fore.edgeStopZ + 2.6],
          [fore.bossRootX, fore.edgeStopZ + 2.6],
        ],
        8,
        y - 4,
        'y',
      ),
      box([0.8, 4, 2.6], [x - 0.2, y - 2, fore.edgeStopZ]),
    ]),
    box(
      [aft.land.x[1] - aft.land.x[0], aft.land.width, aft.land.thickness],
      [aft.land.x[0], -aft.land.width / 2, bedBottom],
    ),
  ];
}

export function flightServicePortCuts(): Shape[] {
  const { fore, aft } = flightServicePortDatums;
  return [
    ...fore.mountingAxes.flatMap(([x, y, z]) => [
      cylinder(1.1, x - fore.nutPocketStartX + 0.2, [fore.nutPocketStartX - 0.1, y, z], 'x'),
      // The AF4 nut loads from the outside of the upright and pulls against
      // the closed boss face in X. Load it 0.3 mm forward to pass the adjacent
      // coupling column, then let the screw draw it onto the bearing face.
      box(
        [fore.nutBearingX - fore.nutPocketStartX, 7.15, 4.2],
        [fore.nutPocketStartX, y > 0 ? y - 2.45 : y - 4.7, z - 2.1],
      ),
    ]),
    at(roundedRect(...fore.throat.size, 0.8, bedBottom - 1, 4), [
      fore.throat.center[0],
      fore.throat.center[1],
      0,
    ]),
    // Layout reserve based on the illustrative receptacle envelope. Preserve
    // solid lands at both ends for field-drilling the measured flange.
    at(roundedRect(...aft.throat.size, aft.throat.radius, bedBottom - 1, aft.land.thickness + 2), [
      aft.position[0] + aft.throat.xOffset,
      aft.position[1],
      0,
    ]),
  ];
}

export function flightServicePortPayload(): ConfiguredPiece[] {
  const { fore, aft } = flightServicePortDatums;
  const screw = bolt.presets.find((preset) => preset.id === 'gvyntok-040-200-004')!;
  const values = fastenerValues(screw.parameters);
  const headOffset = (values.shaftLength - values.h) / 2;
  const panel = purchased(
    signalConnector,
    'flight-usb-c-panel',
    nikomA448027.id,
    aft.position,
    aft.rotation,
  );
  panel.component.notes =
    'NIKOM A448027 field-fit panel receptacle. Check the delivered flange, plug reach and rear lead clearance before drilling the two holes. Hole pitch, actual seating thickness, mating plug and electrical interface are unverified; no panel fastening hardware or harness is specified here.';
  return [
    purchased(usb, 'usb-wireless', 'speedybee-f405-wing-mini-usb', fore.position, fore.rotation),
    ...fore.mountingAxes.flatMap(([x, y, z], i) => [
      purchased(
        bolt,
        `usb-mount-screw-${i + 1}`,
        screw.id,
        [x + usbExtenderInterface.pcbThickness - headOffset, y, z],
        [0, 90, 0],
        'default',
      ),
      purchased(
        nut,
        `usb-mount-nut-${i + 1}`,
        'gvyntok-8478552310f0',
        [fore.nutBearingX, y, z],
        [0, -90, 0],
        'default',
      ),
    ]),
    panel,
  ];
}

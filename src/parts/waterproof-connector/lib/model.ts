import type { Parameters } from '../../../core/types';
import type { Piece } from '../../../core/assembly/boundary/assembly';
import {
  box,
  cylinder,
  prism,
  ring,
  subtract,
  union,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import { contactPositions, findModel, type ConnectorModel } from './catalog';

const colors = {
  shell: 0x30363d,
  insert: 0x252b30,
  blue: 0x3978dc,
  gold: 0xd7b55f,
  seal: 0x191b1d,
};

/** Source envelope dimensions stay separate from undimensioned internal profiles. */
export function housingProfile(model: ConnectorModel) {
  return model.series === 'SP16'
    ? {
        scale: 0.8,
        mountRadius: 8,
        collarRadius: 12.5,
        plugLength: 60,
        cableRadius: 4,
        insertRadius: 6,
        barrelFlat: 7.4,
        nutAF: 21,
        couplingRadius: 12.5,
        sealOuter: 10.8,
        sealInner: 8.2,
        panelOpening: 16.5,
        panelFlats: 15.3,
      }
    : {
        scale: 1,
        mountRadius: 10,
        collarRadius: 14.5,
        plugLength: 66,
        cableRadius: 6,
        insertRadius: 7.5,
        barrelFlat: 9.5,
        nutAF: 25,
        couplingRadius: 14.5,
        sealOuter: 12.8,
        sealInner: 10.2,
        panelOpening: 20.5,
        panelFlats: 19.5,
      };
}

const hex = (acrossFlats: number, z: number, height: number) =>
  prism(
    Array.from({ length: 6 }, (_, index) => {
      const angle = Math.PI / 6 + (index * Math.PI) / 3;
      return [
        (acrossFlats / Math.sqrt(3)) * Math.cos(angle),
        (acrossFlats / Math.sqrt(3)) * Math.sin(angle),
      ] as [number, number];
    }),
    height,
    z,
  );

/** Twelve shallow grip lobes are an illustrative moulded feature, not a thread. */
const grip = (outerRadius: number, innerRadius: number, z: number, height: number) =>
  subtract(
    prism(
      Array.from({ length: 96 }, (_, index) => {
        const angle = (index * Math.PI) / 48;
        const radius = index % 8 < 4 ? outerRadius : outerRadius - 0.55;
        return [radius * Math.cos(angle), radius * Math.sin(angle)] as [number, number];
      }),
      height,
      z,
    ),
    cylinder(innerRadius, height + 0.2, [0, 0, z - 0.1]),
  );

function holes(model: ConnectorModel, z: number, height: number, radius: number): Shape[] {
  return contactPositions(model.contacts, model.series).map(([x, y]) =>
    cylinder(radius, height, [x, y, z]),
  );
}

function plug(model: ConnectorModel, inspection: boolean): Piece[] {
  const pinRadius = model.contactDiameter / 2,
    d = housingProfile(model),
    s = d.scale;
  const shell = subtract(
    union(
      cylinder(11.2 * s, d.plugLength - 32, [0, 0, -d.plugLength + 11]),
      hex(21.5 * s, -33, 12),
      cylinder(9.5 * s, 7, [0, 0, -21]),
      cylinder(8.4 * s, 14, [0, 0, -14]),
    ),
    cylinder(d.cableRadius, d.plugLength - 25, [0, 0, -d.plugLength + 10.9]),
    cylinder(7.1 * s, 14.1, [0, 0, -14]),
    // Approximate key notch faces +Y; it is not a verified polarisation dimension.
    box([3 * s, 4 * s, 5.1], [-1.5 * s, 6.7 * s, -5]),
  );
  return [
    {
      label: 'Cable plug black shell and keyed shroud — approximate profile',
      shape: shell,
      color: colors.shell,
    },
    {
      label: 'Blue captive coupling nut — approximate grip; thread omitted',
      shape: grip(d.couplingRadius, 10.2 * s, -21, 16),
      color: colors.blue,
      z: inspection ? 12 : 0,
    },
    {
      label: 'Blue cable gland nut — approximate envelope; cable omitted',
      shape: grip(12.5 * s, d.cableRadius, -d.plugLength, 11),
      color: colors.blue,
      z: inspection ? -9 : 0,
    },
    {
      label: 'Recessed plug insert — approximate contact pitch',
      shape: subtract(cylinder(7.1 * s, 6, [0, 0, -14]), ...holes(model, -14.1, 6.2, pinRadius)),
      color: colors.insert,
    },
    {
      label: 'Plug mating seal — illustrative profile',
      shape: ring(9.3 * s, 8.4 * s, -12, 1),
      color: colors.seal,
    },
    ...contactPositions(model.contacts, model.series).map(([x, y], index) => ({
      label: `Male pin ${index + 1} — nominal diameter ${model.contactDiameter} mm; pitch approximate`,
      shape: cylinder(pinRadius, 11, [x, y, -14]),
      color: colors.gold,
    })),
  ];
}

function socket(model: ConnectorModel, panelThickness: number, inspection: boolean): Piece[] {
  const socketRadius = model.contactDiameter / 2 + 0.45,
    d = housingProfile(model),
    s = d.scale;
  const flats = [
    box([30, 10, 8.2], [-15, d.barrelFlat, -8.1]),
    box([30, 10, 8.2], [-15, -d.barrelFlat - 10, -8.1]),
  ];
  const sealGroove = ring(d.sealOuter, d.sealInner, 0, 0.5);
  const shell = subtract(
    union(
      subtract(cylinder(d.mountRadius, 8, [0, 0, -8]), ...flats),
      cylinder(d.collarRadius, 3, [0, 0, 0]),
      cylinder(d.mountRadius, 11, [0, 0, 3]),
    ),
    cylinder(d.insertRadius, 22.2, [0, 0, -8.1]),
    sealGroove,
    box([3 * s, 3 * s, 6], [-1.5 * s, 6.9 * s, 8.1]),
  );
  return [
    {
      label: 'Panel socket body — 22 mm source body length; axial subdivisions approximate',
      shape: shell,
      color: colors.shell,
    },
    {
      label: 'Socket insert — approximate contact pitch',
      shape: subtract(
        cylinder(d.insertRadius, 20, [0, 0, -8]),
        ...holes(model, -8.1, 20.2, socketRadius),
      ),
      color: colors.insert,
    },
    {
      label: 'Recessed panel seal — illustrative compressed band',
      shape: sealGroove,
      color: colors.seal,
      z: inspection ? -3 : 0,
    },
    {
      label: `Inner retaining nut — approximate ${d.nutAF} mm AF envelope`,
      shape: subtract(
        hex(d.nutAF, -panelThickness - 3.5, 3.5),
        cylinder(d.mountRadius + 0.15, 3.7, [0, 0, -panelThickness - 3.6]),
      ),
      color: colors.shell,
      z: inspection ? -9 : 0,
    },
    ...contactPositions(model.contacts, model.series).map(([x, y], index) => ({
      label: `Female socket ${index + 1} and solder cup — nominal mating diameter ${model.contactDiameter} mm; internal profile approximate`,
      shape: subtract(
        cylinder(socketRadius, 27.4, [x, y, -15]),
        cylinder(model.contactDiameter / 2 + 0.05, 27.6, [x, y, -15.1]),
        box([2 * socketRadius + 0.2, socketRadius + 0.1, 3], [x - socketRadius - 0.1, y, -15.1]),
      ),
      color: colors.gold,
    })),
  ];
}

/** Native Z-up. Socket flange rear seat is Z=0; +Z faces outside the enclosure. */
export function pieces(p: Parameters, state: string): Piece[] {
  const model = findModel(p.model);
  if (!model) throw new Error('Unknown SP connector model.');
  return model.housing === 'cable-plug'
    ? plug(model, state === 'exploded')
    : socket(model, Number(p.panelThickness), state === 'exploded');
}

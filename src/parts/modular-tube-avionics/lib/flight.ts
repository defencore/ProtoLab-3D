import type { Parameters, PartDefinition } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import {
  box,
  cylinder,
  prism,
  subtract,
  union,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import { grandadoPieces, grandadoSpec } from '../../catalog-enclosure/lib/grandado';
import grandado from '../../catalog-enclosure/part';
import { coverDatums, lowerCoverBlank, smoothUpperCover } from './lower-cover';
import { radioCoverMount } from './radio';
import wing from '../../flight-controller/part';
import lch from '../../lch7-controller/part';
import standoff from '../../pcb-standoff/part';
import bolt from '../../bolt-screw/part';
import nyloc from '../../nyloc-nut/part';
import nut from '../../hex-nut/part';
import washer from '../../washer/part';
import { fastenerValues } from '../../../core/hardware/fasteners';
import metalSleeve from '../../dremec-spacer-sleeve/part';
import {
  cassetteDatums,
  flightCassettePrinted,
  flightCassetteBoardHardware,
} from './flight-cassette';
import {
  flightServicePortCuts,
  flightServicePortLibraries,
  flightServicePortPayload,
  flightServicePortStock,
} from './flight-service-ports';
import { at, datums, endDiscs, intersect, purchased, printed, type PrintedItem } from './shared';

export const flightLibraries: PartDefinition[] = [
  grandado,
  wing,
  lch,
  standoff,
  bolt,
  nyloc,
  nut,
  washer,
  metalSleeve,
  ...flightServicePortLibraries,
];
export const flightDatums = {
  bodyTranslation: 26.7,
  bodyBottom: 9.2,
  upperBearing: coverDatums.upperBearing,
  lowerBearing: coverDatums.lowerBearing,
  couplingBottom: coverDatums.couplingBottom,
  wingZ: -6.5,
  wingY: 0,
  lchZ: -23.5,
  antenna: { body: [25, 13, 4], stem: 20, junction: [10, 10], arm: 25, span: 60 },
} as const;
const axes = grandadoSpec.screwCenters;
const bores = (z: number, h: number) => axes.map(([x, y]) => cylinder(1.7, h, [x, y, z]));

/** Side-loaded couplings and integral compression towers share the upper screw axes. */
export const flightCouplingMount = {
  couplerPreset: 'user-m3x10-af4-7-ac5-2',
  couplerClock: 30,
  socketAcrossFlats: 4.9,
  socketTop: -7.3,
  slotInboardDepth: 2.7,
  columnTop: -4,
  columnWidth: 14,
  columnCornerChamfer: 3.5,
  postDiameter: 9,
  bodyBearing: 9.2,
  earPillarWidth: 12,
  earNutBottom: 3.4,
  earNutBearing: 5.8,
  earPocketBottom: 2.8,
  earPocketWidth: 5.8,
  earBoreBottom: -0.5,
  earWasherThickness: 0.8,
} as const;

/** Aft-directed right-angle header/plug reserve retained from the board layout. */
export const wingAftConnectionReserve = {
  origin: [18.5, flightDatums.wingY - 13.2, -4] as [number, number, number],
  size: [25, 25.9, 11.2] as [number, number, number],
  islandMotion: 0.5,
} as const;

/** Outboard loading leaves the opposed anti-rotation flats and bearing faces intact. */
export function flightCouplingSlot(
  x: number,
  y: number,
  z: number = flightDatums.couplingBottom,
): Shape {
  const d = flightCouplingMount;
  const outboard = d.columnWidth / 2 + 0.1;
  const depth = outboard + d.slotInboardDepth;
  const y0 = y - (y > 0 ? d.slotInboardDepth : outboard);
  return box(
    [d.socketAcrossFlats, depth, d.socketTop - flightDatums.couplingBottom],
    [x - d.socketAcrossFlats / 2, y0, z],
  );
}

/** Grounded columns retain an inboard chamfer and carry integral Ø9 towers. */
function couplingColumns(): Shape[] {
  const d = flightCouplingMount;
  const half = d.columnWidth / 2;
  const bed = flightSupportDatums.frameBed;
  return axes.map(([x, y]) => {
    const angle = x > 0 ? (y > 0 ? 0 : 270) : y > 0 ? 90 : 180;
    const outline = at(
      prism(
        [
          [-half + d.columnCornerChamfer, -half],
          [half, -half],
          [half, half],
          [-half, half],
          [-half, -half + d.columnCornerChamfer],
        ],
        d.columnTop - flightSupportDatums.frameBed,
        flightSupportDatums.frameBed,
      ),
      [x, y, 0],
      [0, 0, angle],
    );
    const grounded = at(
      prism(
        [
          [-half, bed],
          [half - 1, bed],
          [half, bed + 1],
          [half, d.columnTop],
          [-half, d.columnTop],
        ],
        d.columnWidth,
        -half,
        'y',
      ),
      [x, y, 0],
      [0, 0, y > 0 ? 90 : -90],
    );
    return union(
      intersect(outline, grounded),
      cylinder(d.postDiameter / 2, d.bodyBearing - d.columnTop + 0.2, [x, y, d.columnTop - 0.2]),
    );
  });
}

/** Side-loaded nuts remain reachable before the Grandado ears are bolted down. */
export function flightEarMountCuts(): Shape[] {
  return grandadoSpec.earCenters.flatMap(([x, y]) => [
    cylinder(1.7, 10.3, [x, y, flightCouplingMount.earBoreBottom]),
    // Two straight opposed flats stop the AF5.5 nut; a rectangular side slot
    // can also be made in an already printed support without blind hex corners.
    box(
      [flightCouplingMount.earPocketWidth, 16, 3],
      [x - flightCouplingMount.earPocketWidth / 2, y - 3.4, flightCouplingMount.earPocketBottom],
    ),
  ]);
}

const flightSupportDatums = { frameBed: -29.9 } as const;

export const flightWireBores = {
  diameter: 3,
  axes: [-50.5, 50.5].map((x) => [x, -8.5] as const),
} as const;

export const flightCassetteMount = {
  supportZ: cassetteDatums.padBottom,
  sleeveLength: cassetteDatums.sleeveLength,
  sleeveDiameter: cassetteDatums.sleeveOuterDiameter,
  sleeveBore: cassetteDatums.sleeveBore,
  washerTop: cassetteDatums.padBottom + cassetteDatums.sleeveLength + 0.8,
  nutBearing: -23.8,
  nutSeatAcrossFlats: 5.8,
  nutClock: 30,
  screwPreset: 'gvyntok-040-190-007',
  washerPreset: 'gvyntok-e3f364f222e0',
  nutPreset: 'gvyntok-474adfbe1cd7',
} as const;

function cassetteSupports(): Shape[] {
  const z = flightSupportDatums.frameBed;
  return cassetteDatums.axes.map(([x, y]) =>
    union(
      box([12, 7.8, flightCassetteMount.supportZ - z], [x - 6, y > 0 ? 25.6 : -33.4, z]),
      // Keep the perimeter of the raised hex seat solid on the inboard side.
      box([12, 10.5, -23.5 - z], [x - 6, y > 0 ? 22.9 : -33.4, z]),
    ),
  );
}

function cassetteSupportCuts(): Shape[] {
  const z = flightSupportDatums.frameBed - 0.1;
  const d = flightCassetteMount;
  return cassetteDatums.axes.flatMap(([x, y]) => [
    cylinder(1.7, d.supportZ - z + 0.1, [x, y, z]),
    // The same straight hex loads the nut from below and prevents rotation.
    prism(
      Array.from({ length: 6 }, (_, i): [number, number] => {
        const angle = ((i + 0.5) * Math.PI) / 3 + (d.nutClock * Math.PI) / 180;
        const radius = d.nutSeatAcrossFlats / Math.sqrt(3);
        return [x + radius * Math.cos(angle), y + radius * Math.sin(angle)];
      }),
      d.nutBearing - z,
      z,
    ),
  ]);
}

function cassetteRetentionHardware(): ConfiguredPiece[] {
  const d = flightCassetteMount;
  const screw = bolt.presets.find((preset) => preset.id === d.screwPreset)!;
  const screwValues = fastenerValues(screw.parameters);
  const washerThickness = Number(
    washer.presets.find((preset) => preset.id === d.washerPreset)!.parameters.thickness,
  );
  const nutHeight = Number(
    nut.presets.find((preset) => preset.id === d.nutPreset)!.parameters.height,
  );
  return cassetteDatums.axes.flatMap(([x, y], i) => {
    const sleeveLabel = 'Aluminium compression sleeve · Ø5 / Ø3.4 × 6';
    const sleeve: ConfiguredPiece = {
      component: {
        id: `flight-cassette-sleeve-${i + 1}`,
        name: sleeveLabel,
        libraryId: metalSleeve.id,
        parameters: {
          ...metalSleeve.defaults,
          material: 'aluminium',
          outerDiameter: d.sleeveDiameter,
          bore: d.sleeveBore,
          length: d.sleeveLength,
        },
        state: 'default',
        quantity: 1,
        supply: 'purchased',
        placement: { translation: [x, y, d.supportZ], rotation: [0, 0, 0] },
        procurement: {
          name: 'Custom aluminium plain sleeve',
          designation: 'DREMEC DH aluminium · customer drawing Ø5 / Ø3.4 × 6 mm',
          manufacturer: 'DREMEC',
          source: 'https://dremec.ua/product/spacer-sleeves-alu/',
        },
        notes:
          'Use the specified sleeve or a measured equivalent. It limits fastener travel and keeps the PETG deck clear of the washer.',
      },
      label: sleeveLabel,
      color: 0xbfc5cc,
      preserveLibraryAppearance: true,
    };
    return [
      sleeve,
      purchased(
        washer,
        `flight-cassette-washer-${i + 1}`,
        d.washerPreset,
        [x, y, d.washerTop - washerThickness / 2],
        [0, 0, 0],
        'default',
      ),
      purchased(
        bolt,
        `flight-cassette-screw-${i + 1}`,
        d.screwPreset,
        [x, y, d.washerTop - screwValues.shaftLength + screwValues.total / 2],
        [0, 0, 0],
        'default',
      ),
      purchased(
        nut,
        `flight-cassette-nut-${i + 1}`,
        d.nutPreset,
        [x, y, d.nutBearing - nutHeight],
        [0, 0, d.nutClock],
        'default',
      ),
    ];
  });
}

export function flightPrinted(p: Parameters): PrintedItem[] {
  const lower = radioCoverMount(p, lowerCoverBlank(p));
  const wireBoreBottom = flightSupportDatums.frameBed - 0.1;
  // All main frame roots share one broad bed plane. The radio windows stay open.
  const bed = subtract(
    box([120, 60, 2.5], [-60, -30, flightSupportDatums.frameBed]),
    // Preserve the open underside for tool access and cable passage.
    box([46, 53.2, 3], [-23, -26.6, -30]),
    // Open extensions clear the T-antenna arms on the independently removable lid.
    box([66, 6, 3], [-33, -21.7, -30]),
  );
  // A 45-degree inboard foot gives the long open girders a full bed root.
  const rails = [-1, 1].map((side) =>
    at(
      prism(
        [
          [27.1, -29.9],
          [33.2, -29.9],
          [33.2, -19],
          [29.5, -19],
          [29.5, -27.5],
        ].map(([y, z]) => [side * y, z] as [number, number]),
        120,
        0,
      ),
      [-60, 0, 0],
      [90, 0, 90],
    ),
  );
  const ends = [-1, 1].map((side) => box([12, 60, 10.9], [side > 0 ? 48 : -60, -30, -29.9]));
  const pillarWidth = flightCouplingMount.earPillarWidth;
  const supports = grandadoSpec.earCenters.map(([x, y]) =>
    box([pillarWidth, 25, 39.1], [x - pillarWidth / 2, y - 12.5, -29.9]),
  );
  const columns = couplingColumns();
  const pylons = [-1, 1].flatMap((end) =>
    [-1, 1].map((side) => box([8, 12, 54.9], [end > 0 ? 52 : -60, side > 0 ? 20 : -32, -29.9])),
  );
  // Load forward-disc nuts first; the fitted frame closes their axial exits.
  const forwardNutCaps = [-1, 1].map((side) =>
    union(
      box([3, 8.2, 9], [-60, side > 0 ? 31.8 : -40, -4.5]),
      // Fully backed stop nose preserves the fore hex engagement before bolting.
      box([1.2, 2.4, 6], [-61, side > 0 ? 34.2 : -36.6, -3]),
    ),
  );
  const framePins = datums.keys.map(([y, z]) => box([4.2, 6, 6], [59.8, y - 3, z - 3]));
  const frameSockets = datums.keys.map(([y, z]) =>
    box(
      [4.4, 6 + Number(p.keyClearance), 6 + Number(p.keyClearance)],
      [-60.1, y - 3 - Number(p.keyClearance) / 2, z - 3 - Number(p.keyClearance) / 2],
    ),
  );
  const frame = subtract(
    union(
      bed,
      ...rails,
      ...ends,
      ...supports,
      ...columns,
      ...cassetteSupports(),
      ...pylons,
      ...forwardNutCaps,
      ...framePins,
      ...flightServicePortStock(),
    ),
    ...bores(-30, 44),
    ...frameSockets,
    ...flightEarMountCuts(),
    ...cassetteSupportCuts(),
    ...flightServicePortCuts(),
    ...flightWireBores.axes.map(([x, y]) =>
      cylinder(flightWireBores.diameter / 2, flightDatums.bodyBottom + 0.1 - wireBoreBottom, [
        x,
        y,
        wireBoreBottom,
      ]),
    ),
    // Leave the lower LCH connector zone clear for bench service.
    box([13, 7, 5], [-16, 29.3, -19.9]),
    ...axes.map(([x, y]) => flightCouplingSlot(x, y)),
  );
  return [
    ...endDiscs('flight', datums.flight.front, datums.flight.back, p),
    {
      id: 'flight-frame',
      name: 'PETG interlocking flight sandwich frame',
      shape: intersect(frame, cylinder(datums.radius, 200, [-80, 0, 0], 'x')),
      material: 'PETG',
      module: 'flight',
    },
    {
      id: 'grandado-through-cover',
      name: 'Smooth curved Grandado lid with gasket groove and internal screw seats',
      shape: smoothUpperCover(),
      printRotation: [90, 0, 0],
      material: 'PETG',
      module: 'flight',
    },
    {
      id: 'flight-lower-cover',
      name: 'Matching smooth curved lower radio cover',
      shape: lower,
      printRotation: [90, 0, 0],
      material: 'PETG',
      module: 'flight',
    },
    ...flightCassettePrinted(flightDatums),
  ];
}

export function drilledGrandado(): ConfiguredPiece {
  const source = grandadoPieces('body-only')[0].shape;
  const shape = subtract(at(source, [0, 0, flightDatums.bodyTranslation]), ...bores(8, 30));
  const item = printed({
    id: 'grandado-drilled-body',
    name: 'Grandado body · four drilled M3 clearance passages',
    shape,
    material: 'PETG',
    module: 'flight',
  });
  item.component.manufacturing = {
    material: 'Original Grandado molded body',
    blank: 'catalog-enclosure:grandado-83-58-35-clear',
    processes: ['drilling'],
    requirements: [
      'Remove the four original inserts; measure the delivered post stock before opening four Ø3.4 through bores. Do not reuse the original blind screw connection.',
      'This deliberate modification requires physical post-wall, drilling access and sealing verification.',
      'Purchased blank source: https://gbr.grandado.com/products/2pcs-83x58x35-mm-waterproof-clear-cover-plastic-electronic-cable-project-box-instrument-enclosure-case-white ; supplier designation Grandado 83 × 58 × 35 mm flanged enclosure. Original manufacturer unidentified.',
    ],
  };
  item.component.notes =
    'Purchased blank identity catalog-enclosure:grandado-83-58-35-clear; original model grandado-83-58-35-clear, body-only geometry, source frame translated Z26.7. Remove original inserts and drill four Ø3.4 through holes. One modified physical detail; blank provenance is retained without duplicating an installed enclosure occurrence.';
  return item;
}

export function flightPayload(_p: Parameters): ConfiguredPiece[] {
  const hardware = axes.map(([x, y], i) =>
    purchased(
      standoff,
      `m3-10-coupler-${i + 1}`,
      flightCouplingMount.couplerPreset,
      [x, y, flightDatums.couplingBottom],
      [0, 0, flightCouplingMount.couplerClock],
      'default',
    ),
  );
  return [
    drilledGrandado(),
    ...grandadoSpec.earCenters.flatMap(([x, y], i) => {
      const earTop = flightDatums.bodyTranslation + grandadoSpec.earTop;
      const underhead = earTop + flightCouplingMount.earWasherThickness;
      return [
        purchased(
          bolt,
          `grandado-ear-screw-${i + 1}`,
          'gvyntok-040-190-007',
          [x, y, underhead - (16 - 3) / 2],
          [0, 0, 0],
          'default',
        ),
        purchased(
          washer,
          `grandado-ear-washer-${i + 1}`,
          'gvyntok-e3f364f222e0',
          [x, y, earTop + flightCouplingMount.earWasherThickness / 2],
          [0, 0, 0],
          'default',
        ),
        purchased(
          nut,
          `grandado-ear-nut-${i + 1}`,
          'gvyntok-474adfbe1cd7',
          [x, y, flightCouplingMount.earNutBottom],
          [0, 0, 0],
          'default',
        ),
      ];
    }),
    purchased(
      wing,
      'wing-mini',
      'speedybee-f405-wing-mini',
      [0, flightDatums.wingY, flightDatums.wingZ],
      [0, 0, 180],
    ),
    purchased(lch, 'lch7', 'lch7-v3-2', [0, 0, flightDatums.lchZ], [0, 0, 90]),
    ...flightServicePortPayload(),
    ...flightCassetteBoardHardware(flightDatums),
    ...cassetteRetentionHardware(),
    ...hardware,
  ];
}

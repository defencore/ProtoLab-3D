import type { Parameters, PartDefinition } from '../../../core/types';
import type { AssemblyComponent } from '../../../core/product-types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import type { Vec } from '../../../core/assembly/boundary/shapes';
import electricalConnector from '../../electrical-connector/part';
import liIonPack from '../../li-ion-pack/part';
import purchasedComponent from '../../purchased-component/part';
import laboratoryTerminal from '../../laboratory-terminal/part';
import panelIndicator from '../../panel-indicator/part';
import waterproofConnector from '../../waterproof-connector/part';
import bolt from '../../bolt-screw/part';
import { casePanelCanonicalPoint, casePanelLayout } from './case-panel';

export const casePanelLibraries = [
  electricalConnector,
  liIonPack,
  purchasedComponent,
  laboratoryTerminal,
  panelIndicator,
  waterproofConnector,
];

const batterySource =
  'https://syla.com.ua/product/akumulyatorna-zbirka-li-ion-4s1p-21700-lishen-lr2170la-4000-mag-144v-35a-v-odyn-ryad/';
const xtSource =
  'https://www.china-amass.net/uploads/36.XT60E-M%EF%BC%88V04%EF%BC%89-SPEC-2025V0.pdf';
const xtScrewSource =
  'https://www.ettinger.de/en/product-datasheet/e7dd412396afa2367749a67e2eda66cd/create';

function occurrence(
  part: PartDefinition,
  id: string,
  label: string,
  parameters: Parameters,
  operatorPoint: Vec,
  procurement: NonNullable<AssemblyComponent['procurement']>,
  notes: string,
  color: number,
  rotation: Vec = [0, 0, 90],
): ConfiguredPiece {
  return {
    component: {
      id,
      name: label,
      libraryId: part.id,
      parameters,
      ...(part.id === liIonPack.id ? { presetId: 'syla-lr2170la-4s1p-xt60' } : {}),
      state: part.states?.[0]?.id ?? 'default',
      quantity: 1,
      supply: 'purchased',
      placement: { translation: casePanelCanonicalPoint(operatorPoint), rotation },
      procurement,
      notes,
    },
    label,
    color,
    preserveLibraryAppearance: true,
  };
}

/** Source-library parts retain their datums; unknown supplier details stay explicit envelopes. */
export function casePanelPurchased(p: Parameters): ConfiguredPiece[] {
  const d = casePanelLayout(p);
  const result: ConfiguredPiece[] = [];
  d.connectors.forEach(([x, y], index) =>
    result.push(
      occurrence(
        electricalConnector,
        `case-power-connector-${index + 1}`,
        `${d.batteryLabelTexts[index]} · AMASS XT60E-M panel connector`,
        { model: 'xt60e-m', detail: 'envelope' },
        [x, y, d.connectorSeatZ],
        { designation: 'XT60E-M.G.Y / 2025V0', manufacturer: 'AMASS', source: xtSource },
        `${d.batteryLabelTexts[index]} identifies the ${index === 0 ? 'front' : 'rear'} physical pack row; the label assigns no electrical circuit. AMASS XT60E-M drawing-based library with male pins, a 27.1 × 12.1 × 4 mm flange and 20.5 mm M2.5 fixing pitch. The 2025V0 overall 16.7 mm and flange-front-to-rear 13.7 mm dimensions establish the 3 mm forward nose: native flange Z0..4, mating mouth Z7 and rear terminals Z−9.7. The connector is inserted from below without changing its +Z mating direction or 90 degree in-plane orientation. Its flange front bears against the underside pocket ceiling at Z4.5, and the mouth is flush with the working face at Z7.5. A 3 mm-deep rear pocket leaves a 3 mm host web; local front Ø5.1 × 1.5 mm counterbores leave 1.5 mm beneath each flush button head. Four top-down M2.5 × 6 button screws enter the two connector-owned embedded M2.5 nuts per connector; no loose nuts are added. The cylindrical Ø4.8 × 2 mm rear-flush insert envelopes and their matching housing cavities are reconstructed because the drawing does not dimension the actual outer profile, depth or usable threads. Adopted nominal metal overlap is 2 mm with a 0.5 mm rear tip projection; confirm the delivered nuts before tightening. Nominal XT60-F 15.5 × 8.1 mm body clearance through the 15.7 × 8.3 mm opening is an access study, not a verified mating or tolerance guarantee. Each pack lead must carry compatible female XT60 sockets; confirm delivered polarity, termination, actual dimensions and solder-joint access. Fine polarity markings, threads, physical leads and completed enclosure ingress qualification are omitted.`,
        0xe5b934,
        [0, 0, 180],
      ),
    ),
  );
  const indicatorColours = ['red', 'yellow', 'green'] as const;
  d.indicators.forEach(([x, y], index) =>
    result.push(
      occurrence(
        panelIndicator,
        `case-indicator-${index + 1}`,
        `Lehao AD16-16C · ${indicatorColours[index]} indicator`,
        { model: 'lehao-ad16-16c', lensColour: indicatorColours[index] },
        [x, y, d.indicatorSeatZ],
        {
          designation: `AD16-16C / ${indicatorColours[index]} lens appearance / confirm supply voltage`,
          manufacturer: 'Lehao',
          source: 'https://www.jd.com/jiage/670d59f660d70a08559.html',
        },
        'Existing panel-indicator library configuration, retaining its separate housing, selected lens, retaining nut and two terminals. The provisional 19 mm head and 45 mm overall envelope have a 5 mm front projection and terminals 40 mm behind the source front datum. The front head seats on the working face; the generous local rear relief leaves the 2 mm host web required by the unchanged library nut. Keep that nut and its tool approach accessible from behind. Lehao model identity is retailer-listed, but these dimensions are assumptions pending the delivered sample. Yellow is an illustrative lens appearance without verified Lehao orderability. Confirm the actual head, nut, voltage execution, panel fit and rear-terminal clearance; no electrical or enclosure ingress rating is assigned.',
        0x3d454d,
      ),
    ),
  );
  d.sp20Connectors.forEach(([x, y], index) =>
    result.push(
      occurrence(
        waterproofConnector,
        `case-sp20-connector-${index + 1}`,
        `${d.sp20LabelTexts[index]} · SP20-4 panel socket · female contacts`,
        { model: 'sp20-4-panel-socket', panelThickness: d.sp20PanelThickness },
        [x, y, d.sp20SeatZ],
        {
          designation: 'SP20-4 panel socket / female contacts / half of kit 00000705',
          manufacturer: 'Unspecified',
          source:
            'https://klmaster.com/ua/catalog/germetichnyy-razem-sp20-4-pin-ip68-komplekt-705/',
        },
        'Existing waterproof-connector library SP20-4 panel socket with four female contacts, its recessed seal and inner retaining nut. The source flange rear seat is the placement datum and mating faces +Z; the modeled mounting flat faces operator +Y. The original 29 mm by 3 mm flange seats directly on the working front face at Z7.5. A diameter 35 mm rear relief, 2 mm deep, leaves the selected 4 mm host web from Z3.5 to Z7.5; the unchanged source nut occupies Z0..3.5. This stays within the library installation range and the modeled 8 mm rear barrel. The supplier does not dimension usable thread length, so actual nut engagement still requires the delivered sample. Keep the source nut, seal and full rear tool approach accessible; the front face remains planar. The supplier drawing identifies a 22 mm socket body, M20 × 1.5 thread and diameter 20.5 mm panel opening with one flat and 19.5 mm total height. Body subdivisions, contact pitch, solder cups, nut and seal geometry are approximate installation references. The supplier sells matched plug/socket kits; separate socket availability is unverified. The mating plug, protective cap, tether and wires are omitted and require their own access allowance. The supplier IP68 advertisement does not qualify the completed printed panel or case.',
        0x30363d,
      ),
    ),
  );
  d.testClips.forEach(([x, y], index) => {
    const colour = (['red', 'black'] as const)[index];
    result.push(
      occurrence(
        laboratoryTerminal,
        `case-test-clip-${colour}`,
        `Spring test clip · 55 mm downward contact · ${colour}`,
        { model: 'lever-clip-55-bottom', colour },
        [x, y, d.testClipSeatZ],
        {
          designation: `55 mm spring test clip with downward solder tab / ${colour} shell`,
          manufacturer: 'Unspecified',
          source: 'https://www.aliexpress.com/item/4001315701627.html',
        },
        'Source-library clip mounted with contacts toward operator +X (right), compression spring toward -X (left), and the solder tab extending below its mounting plane. The red/black choice changes only the insulating housing and lever; metal geometry and colours retain their source identities. A recessed common housing registers both clips against solid bearing faces and retains them with nylon ties; the source mounting holes remain unused. Base Z-7 keeps the modeled lever envelope below the closed SAC-01 cover in the installation study; this is a source-geometry clearance study, not a verified supplier travel limit. The nominal 55 × 18 mm base includes three side locating pegs and opposite blind sockets; adjacent 18 mm pitch clips interlock as in the source bank. The mounting holes and slot, tab section and 14 mm downward projection are reconstructed from supplied photographs: verify the ordered clip before final fabrication. No current or spring-force rating is assigned.',
        colour === 'red' ? 0xc6332e : 0x292c31,
        [0, 0, 0],
      ),
    );
  });
  d.batteries.forEach(([x, y], index) =>
    result.push(
      occurrence(
        liIonPack,
        `case-battery-pack-${index + 1}`,
        `${d.batteryLabelTexts[index]} · SYLA Lishen LR2170LA 4S1P 21700 pack`,
        { model: 'syla-lr2170la-4s1p-xt60' },
        [x, y, d.batteryBottom],
        {
          designation: 'asm-4s1p-stv-lishen-lr2170la / select XT60 termination',
          manufacturer: 'SYLA / Lishen cells',
          source: batterySource,
        },
        `${d.batteryLabelTexts[index]} is the ${index === 0 ? 'front' : 'rear'} physical row, without an assigned electrical circuit. Supplier pack envelope 88 × 24 × 74 mm, installed upright in a protected under-panel pocket for the measured BX-0151 case. Continuous 1.6 mm guide walls, a shared divider and closed 2.4 mm recessed seats keep loose debris in the pack bays. The 63 mm depth below the working faceplate leaves each pack 13.4 mm proud, below the protective toggle cover and closed-lid roof. Insert vertically from above along -Z; use a thin nonconductive pull ribbon to lift it along +Z. Route both lead exits toward their individual XT60E-M connector in the left column (-X). The panel has no adjacent cable slots; dress the flexible leads above the faceplate with the actual wrapped pack and its delivered termination. The source does not dimension cable length, bend radius or connector sex. Leads and a mating plug are omitted. Confirm actual wrapped dimensions, ribbon thickness, female XT60 termination and vertical extraction clearance on the purchased assembly.`,
        0x2e527a,
      ),
    ),
  );
  return result;
}

/** Source-bound adopted inserts belong to the purchased connector; hardware enters from the front. */
export function caseConnectorMounting(p: Parameters) {
  const d = casePanelLayout(p);
  return {
    coordinateSystem:
      'operator XYZ millimetres; connector inserted from below along +Z, screws from front along −Z',
    source: xtSource,
    screwSource: xtScrewSource,
    ownership:
      'Two embedded mounting nuts/inserts per purchased XT60E-M; no loose-nut occurrences.',
    limits:
      'AMASS specifies a 4 mm flange and a 3 mm forward nose (16.7−13.7). Insert outer diameter, depth and rear-flush position are reconstructed, not supplier-dimensioned. Smooth bores omit actual threads. Nominal adopted metal overlap is not a verified supplier engagement depth. ETTINGER001.53.221 defines the selected M2.5 × 6, Ø4.7 × 1.5 mm button head and T8 drive; the rendered six-lobe profile/depth is approximate.',
    flangePocket: {
      size: d.connectorRearPocketSize,
      bottomZ: d.panelBottom,
      ceilingZ: d.connectorFlangeSeatZ,
      depthMm: d.connectorFlangeSeatZ - d.panelBottom,
      nominalSideClearanceMm: 0.3,
      clearanceAtMaximumDrawingSizeMm: 0.15,
    },
    matingAccess: {
      source: 'https://www.china-amass.net/uploads/57.XT60-F-SPEC-2025V0.pdf',
      basis:
        'Nominal AMASS XT60-F outer body 15.5 × 8.1 mm passes the recommended 15.7 × 8.3 mm keyed opening; the body can enter the panel channel rather than stopping at the face. This checks access only, not reconstructed contact mating or tolerance extremes.',
      bodyWidthMm: 15.5,
      bodyHeightMm: 8.1,
      nominalClearancePerSideMm: 0.1,
      channelBottomZ: d.connectorFlangeSeatZ,
      channelTopZ: d.panelTop,
      mouthZ: d.connectorMatingZ,
    },
    inserts: d.connectors.flatMap(([x, y], index) =>
      [-1, 1].map((side, fastener) => ({
        id: `case-xt60-embedded-nut-${index + 1}-${fastener + 1}`,
        hostId: `case-power-connector-${index + 1}`,
        pieceLabel: `AMASS XT60E-M · embedded M2.5 mounting insert ${fastener + 1} · reconstructed envelope`,
        screwId: `case-xt60-screw-${index + 1}-${fastener + 1}`,
        axis: [x, y + side * 10.25] as const,
        insertionDirection: [0, 0, -1] as Vec,
        outerDiameterMm: 4.8,
        boreDiameterMm: 2.5,
        panelBoreDiameterMm: 3,
        minimumZ: d.connectorSeatZ,
        maximumZ: d.connectorSeatZ + 2,
        flangeRearZ: d.connectorSeatZ,
        flangeFrontZ: d.connectorFlangeSeatZ,
        matingMouthZ: d.connectorMatingZ,
        screwUnderheadZ: d.connectorHeadSeatZ,
        screwHeadTopZ: d.connectorHeadSeatZ + 1.5,
        screwTipZ: d.connectorHeadSeatZ - 6,
        screwLengthMm: 6,
        screwReachBelowFlangeFrontMm: d.connectorFlangeSeatZ - (d.connectorHeadSeatZ - 6),
        adoptedInsertOverlapMm: 2,
        screwProjectionPastInsertRearMm: d.connectorSeatZ - (d.connectorHeadSeatZ - 6),
        counterboreDiameterMm: 5.1,
        counterboreBottomZ: d.connectorHeadSeatZ,
        counterboreTopZ: d.panelTop,
        panelBearingWebMinimumZ: d.connectorFlangeSeatZ,
        panelBearingWebMaximumZ: d.connectorHeadSeatZ,
        panelBearingWebThicknessMm: d.connectorHeadSeatZ - d.connectorFlangeSeatZ,
        minimumTopDriverRadiusMm: 2.55,
        topDriverTravelMm: 15,
      })),
    ),
  };
}

/** Front-inserted button screws clamp the underside flange through the recessed head lands. */
export function caseConnectorHardware(p: Parameters): ConfiguredPiece[] {
  const d = casePanelLayout(p),
    length = 6,
    headHeight = 1.5;
  return d.connectors.flatMap(([x, y], index) =>
    [-1, 1].map((side, fastener) => {
      const at: Vec = [x, y + side * 10.25, d.connectorHeadSeatZ + (headHeight - length) / 2];
      const screw = occurrence(
        bolt,
        `case-xt60-screw-${index + 1}-${fastener + 1}`,
        'Button screw M2.5 × 6 · T8 · XT60E-M top-down fixing',
        {
          ...bolt.defaults,
          diameter: 2.5,
          shankDiameter: 2.5,
          length,
          head: 'button',
          headSize: 4.7,
          headHeight,
          drive: 'star',
          driveWidth: 2.2,
          driveDepth: 0.75,
          threadMode: 'envelope',
          threadSpan: 'full',
          pitch: 0.45,
          threadLength: length,
          tip: 'flat',
          tipLength: 0.2,
        },
        at,
        {
          designation:
            '001.53.221 / M2.5 × 6 button screw / head Ø4.7 × 1.5 mm / T8 / pitch 0.45 mm',
          manufacturer: 'ETTINGER',
          source: xtScrewSource,
        },
        'Insert from the working front along −Z. The Ø4.7 × 1.5 mm button head sits flush in a Ø5.1 × 1.5 mm counterbore: under-head Z6, top Z7.5, with 1.5 mm continuous panel bearing web down to the flange-front seat Z4.5. The 6 mm under-head shaft ends at Z0. It passes 4.5 mm below the flange front, crosses the complete adopted insert Z0.5..2.5 and projects 0.5 mm behind its rear face. These are separate axial quantities; the 2 mm adopted metal overlap is not a verified usable thread engagement. The connector owns the insert and its receiving cavity; no loose nut is needed. Match the actual nut depth and remove a longer screw if it bottoms or protrudes into wiring. ETTINGER specifies the head, length and T8 identity; the six-lobe recess profile and depth are approximate reference geometry. M2.5 hardware is separate from the user M3 stock.',
        0xa6afb8,
      );
      screw.component.supply = 'standard';
      return screw;
    }),
  );
}

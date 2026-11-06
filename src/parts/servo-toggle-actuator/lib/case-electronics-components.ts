import type { Parameters, PartDefinition } from '../../../core/types';
import { Euler, Vector3 } from 'three';
import type { AssemblyComponent } from '../../../core/product-types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import type { Vec } from '../../../core/assembly/boundary/shapes';
import busServoDriver from '../../bus-servo-driver/part';
import loraModule from '../../lora-module/part';
import adcModule from '../../adc-module/part';
import bec from '../../bec/part';
import powerFilter from '../../power-filter/part';
import pwmSwitch from '../../pwm-switch/part';
import { caseElectronicsLayout } from './case-electronics-layout';
import { hatData } from '../../../core/assembly/recovery/hat';
import connectorModels from '../../electrical-connector/lib/models.json';

export const caseElectronicsLibraries = [
  busServoDriver,
  loraModule,
  adcModule,
  bec,
  powerFilter,
  pwmSwitch,
];

type ModulePose = { at: Readonly<Vec>; rotation: Readonly<Vec> };
type Procurement = NonNullable<AssemblyComponent['procurement']>;

export interface ElectronicsAccessReserve {
  id: string;
  hostId: string;
  label: string;
  scope: 'installed' | 'detached-body';
  min: Vec;
  max: Vec;
  mouth: Vec;
  outward: Vec;
  basis: string;
  limits: string;
}

/** Packaging studies follow complete library poses; they do not add purchased cable geometry. */
export function caseElectronicsAccess(p: Parameters) {
  const m = caseElectronicsLayout(p),
    male = connectorModels.find((model) => model.id === 'xt60-m')!;
  const reserve = (
    id: string,
    hostId: string,
    label: string,
    scope: ElectronicsAccessReserve['scope'],
    pose: ModulePose,
    localMin: Vec,
    localMax: Vec,
    localMouth: Vec,
    localOutward: Vec,
    basis: string,
    limits: string,
  ): ElectronicsAccessReserve => {
    // Native component rotations apply X, then Y, then Z, matching this ZYX matrix.
    const rotation = new Euler(
      ...(pose.rotation.map((angle) => (angle * Math.PI) / 180) as Vec),
      'ZYX',
    );
    const point = (v: Vec): Vec =>
      new Vector3(...v)
        .applyEuler(rotation)
        .add(new Vector3(...pose.at))
        .toArray() as Vec;
    const corners = [localMin[0], localMax[0]].flatMap((x) =>
      [localMin[1], localMax[1]].flatMap((y) =>
        [localMin[2], localMax[2]].map((z) => point([x, y, z])),
      ),
    );
    return {
      id,
      hostId,
      label,
      scope,
      min: [0, 1, 2].map((axis) => Math.min(...corners.map((v) => v[axis]))) as Vec,
      max: [0, 1, 2].map((axis) => Math.max(...corners.map((v) => v[axis]))) as Vec,
      mouth: point(localMouth),
      outward: new Vector3(...localOutward).applyEuler(rotation).toArray() as Vec,
      basis,
      limits,
    };
  };
  const powerFace = hatData.bounds[0],
    usbFace = hatData.bounds[1],
    transverseAllowance = 1,
    powerHalfY = male.height / 2 + transverseAllowance,
    powerHalfZ = male.width / 2 + transverseAllowance,
    usbLength = 15,
    powerLeadLength = 15;
  const usbLimits =
    'Provisional compact USB body study only: 15 mm exposed length and 1 mm allowance around the modeled socket cross-section. No supplied cable has been measured. Insertion overlap, strain relief, cable bend, fingers and arbitrary USB cables are not qualified. Check the removed lower-body assembly on the bench; no cable is added to the assembly.';
  return {
    coordinateSystem: 'operator XYZ, millimetres',
    physicalCableOccurrences: 0,
    reserves: [
      reserve(
        'hat-xt60-m-plug-reserve',
        'case-servo-driver-hat',
        'HAT XT60-M full-length power-plug installation reserve',
        'installed',
        m.hat,
        [powerFace - male.length, -8.85 - powerHalfY, 3.7 - powerHalfZ],
        [powerFace, -8.85 + powerHalfY, 3.7 + powerHalfZ],
        [powerFace, -8.85, 3.7],
        [-1, 0, 0],
        `Existing AMASS xt60-m library overall ${male.width} × ${male.height} × ${male.length} mm, with the long cross-section dimension vertical in the imported HAT XT60PT-F2 socket and 1 mm transverse allowance. The complete male length is reserved outside the source socket mouth without claiming insertion overlap.`,
        'Male insertion depth, delivered plug revision, solder joints, heat-shrink, wire bend and strain relief are unverified. Reserve the actual harness beyond this box before fabrication. This study adds no plug, circuit assignment or procurement requirement.',
      ),
      reserve(
        'hat-xt60-m-lead-reserve',
        'case-servo-driver-hat',
        'HAT XT60-M provisional 15 mm straight lead approach',
        'installed',
        m.hat,
        [powerFace - male.length - powerLeadLength, -8.85 - powerHalfY, 3.7 - powerHalfZ],
        [powerFace - male.length, -8.85 + powerHalfY, 3.7 + powerHalfZ],
        [powerFace - male.length, -8.85, 3.7],
        [-1, 0, 0],
        'User-approved mechanical study extending 15 mm straight behind the complete male plug, using the same cross-section and 1 mm transverse allowance as the plug reserve. It follows the full HAT pose.',
        'This provisional straight approach does not qualify the actual soldered wires, conductor gauge, heat-shrink, strain relief, hand access or any cable bend. Check the delivered harness; no physical cable, wire path or electrical connection is added.',
      ),
      ...[
        [-1.904, 7.676],
        [10.746, 20.326],
      ].map(([xmin, xmax], index) =>
        reserve(
          `hat-usb-${index + 1}-compact-plug-study`,
          'case-servo-driver-hat',
          `HAT USB-C ${index + 1} compact-plug bench study`,
          'detached-body',
          m.hat,
          [xmin - 1, usbFace - usbLength, -1.91],
          [xmax + 1, usbFace, 4.25],
          [(xmin + xmax) / 2, usbFace, 1.17],
          [0, -1, 0],
          'Imported HAT USB-C shell bounds rounded to 0.001 mm; the native -Y socket faces and both source X positions follow the complete HAT pose.',
          usbLimits,
        ),
      ),
      reserve(
        'heltec-usb-compact-plug-study',
        'case-heltec-v4',
        'Heltec V4 USB-C compact-plug bench study',
        'detached-body',
        m.heltec,
        [-5.4, 26.6, 4.2],
        [5.4, 26.6 + usbLength, 9.18],
        [0, 26.6, 6.69],
        [0, 1, 0],
        'Existing Heltec V4 USB-C housing: native X±4.4, front Y26.6 and Z5.2..8.18 mm; 1 mm transverse allowance follows its full pose.',
        usbLimits,
      ),
    ],
  };
}

/** Routing intent only: no conductors, pin assignments or EMI qualification are inferred. */
export function caseElectronicsEmi(p: Parameters) {
  const m = caseElectronicsLayout(p),
    pwmRotation = new Euler(
      ...(m.pwm.rotation.map((angle) => (angle * Math.PI) / 180) as Vec),
      'ZYX',
    );
  const pwmEdge = (side: number) => ({
    mouth: new Vector3(side * 13, 0, 3)
      .applyEuler(pwmRotation)
      .add(new Vector3(...m.pwm.at))
      .toArray() as Vec,
    outward: new Vector3(side, 0, 0).applyEuler(pwmRotation).toArray() as Vec,
  });
  return {
    coordinateSystem: 'operator XYZ, millimetres',
    physicalWireOccurrences: 0,
    goal: 'Separate switching-power loops and their returns from the ADS1220 analogue entry and supply.',
    zones: {
      analogue: {
        hostIds: ['case-adc-cjmcu1220', 'case-lc-filter-2'],
        adcOrigin: m.adc.at,
        quietSupplyFilterOrigin: m.filters[1].at,
        connectorIds: ['case-sp20-connector-1', 'case-sp20-connector-2'],
      },
      switchingPower: {
        hostIds: ['case-buck-1', 'case-buck-2', 'case-pwm-mosfet'],
        converterOrigins: m.bucks.map((pose) => pose.at),
        pwmOrigin: m.pwm.at,
      },
      radio: { hostId: 'case-heltec-v4', origin: m.heltec.at },
    },
    pwmLeadApproach: {
      hostId: 'case-pwm-mosfet',
      edgeFaces: [-1, 1].map(pwmEdge),
      nativeExitCrossSection: [16, 6],
      limits:
        'User reports power wires on opposite edges and three PWM wires between the power wires on one of those edges. The reference assumes the opposite native ±X ends for orientation only. Preserve the complete two end approaches; exact pad positions, shared PWM edge, conductor gauges, solder-joint projection and bend radius are unmeasured, so no numerical free wire length or electrical pinout is qualified.',
    },
    requestedPowerPaths: [
      {
        role: 'Sensor or external 12 V supply',
        from: 'case-buck-1',
        settingV: 12,
        via: ['case-lc-filter-1'],
        to: 'SP20 supply contacts; contact numbers and downstream load are unassigned',
        limits:
          'The passive panel connector does not regulate or protect its load. Confirm the delivered converter setting, filter revision, load voltage and current, protection and return path before wiring.',
      },
      {
        role: 'Heltec logic supply',
        from: 'case-buck-2',
        settingV: 5,
        via: [],
        to: 'case-heltec-v4 / supported 5 V input',
        limits:
          'The user selected a 5 V converter output for this branch. Heltec specifies 4.7–6 V at USB or the 5 V pin, and prohibits feeding those two inputs simultaneously. A 12 V output must not feed Heltec.',
      },
      {
        role: 'Requested filtered ADS supply',
        from: 'case-heltec-v4 / selected 3.3 V output',
        settingV: 3.3,
        via: ['case-lc-filter-2'],
        to: 'case-adc-cjmcu1220 / delivered supply pads to be identified',
        limits:
          'An LC filter does not reduce voltage. ADS1220 chip AVDD and DVDD require 2.3–5.5 V, but this does not establish the unknown CJMCU board input wiring. Check the delivered filter at 3.3 V, voltage drop, available Heltec output current and noise during radio transmission. Ve additionally needs its enable control. No electrical circuit or GPIO assignment is supplied.',
      },
    ],
    routingRules: [
      'Keep converter and PWM current loops compact; route every power feed beside its own return and keep the switched load wiring in the power zone.',
      'Bring differential sensor conductors to the ADS analogue pads as short twisted pairs, with their excitation and reference returns planned separately from servo and PWM load returns.',
      'Keep analogue and switched-power harnesses in separate physical routes; avoid long parallel runs, runs beneath the ADC, and a shared narrow return conductor carrying both load current and ADC current.',
      'Put the filter quiet-side lead near its protected load, keep its unfiltered lead apart, and avoid placing its inductor immediately beside a converter inductor.',
      'Keep SPI short with a nearby return, away from analogue inputs and switching nodes. Direct soldered leads to the HAT require a separately selected GPIO assignment and firmware.',
      'Use shielded twisted pairs where the actual sensor installation needs them; select shield termination for the real instrument and case. Uncoated printed polymer dividers manage wires and provide no conductive EMI shield.',
    ],
    analogueHood: {
      construction:
        'Removable printed insulating hood with user-applied foil tape on its exterior only.',
      overlapLandMm: '8–10 mm mechanical target; not a shielding specification',
      bond: 'One accessible M3 bond-tab provision; actual reference conductor and connection are to be selected for the complete instrument.',
      installation:
        'Preserve the printed insulation between foil and all pads, pins and cables. Do not wrap conductive tape into the interior or cable entries. Use electrically continuous cover seams and a positive foil-to-metal connection at the bond tab; plastic, paint and ordinary tape adhesive do not establish electrical contact.',
      verification:
        'Verify the actual tape adhesive and continuity across every overlap, removable-cover seam and bond contact. Conductive adhesive is product-specific. A single-point provision does not establish a universal grounding scheme or control high-frequency seam impedance. Foil dimensions and material alone do not establish magnetic-field attenuation or shielding effectiveness.',
    },
    limits:
      'This is a mechanical zoning and harness-routing descriptor. Actual cables, connector pinout, signal conditioning, fuses, switching ratings, thermal design, shield bonds and electromagnetic performance are unverified. Physical separation and LC filters alone do not guarantee ADC accuracy or EMC compliance.',
    sources: [
      {
        url: 'https://www.ti.com/lit/ds/symlink/ads1220.pdf',
        sections: '6.3, 9.1.1, 9.3 and 9.4',
        basis:
          'ADC supply limits, SPI mode 1, local bypassing, analogue/digital placement and return paths.',
      },
      {
        url: sources.heltec,
        sections: '3.2 and 3.3',
        basis: 'Supported Heltec supply inputs and power outputs.',
      },
      {
        url: sources.hat,
        basis:
          'HAT input must match the servo rail; documented stock interfaces are UART, USB and Wi-Fi.',
      },
      {
        url: 'https://www.ti.com/document-viewer/lit/html/SSZTBF4',
        basis:
          'Minimise discontinuous-current loops and separate sensitive conductors from switching nodes.',
      },
      {
        url: 'https://www.analog.com/en/resources/app-notes/an-139.html',
        basis: 'Switching hot-loop area and separation of filter and converter inductors.',
      },
      {
        url: 'https://www.ti.com/lit/pdf/sloa052',
        sections: '9',
        basis:
          'Twisted and shielded transducer wiring in the documented low-frequency instrument example.',
      },
      {
        url: 'https://www.3m.com/3M/en_US/p/d/b00041319/',
        basis:
          '1115B is a specifically identified foil tape with conductive adhesive; the user tape is not identified as this product.',
      },
      {
        url: 'https://www.3m.com/mws/media/37384O/3m-emi-embossed-aluminum-shielding-tape-1267-data-sheet-78-8124-4708-0-b.pdf',
        basis:
          '1267 instead uses non-conductive adhesive with a special embossed contact mechanism; foil adhesive conductivity is not universal.',
      },
      {
        url: 'https://www.te.com/en/faqs/emi-shielding.html',
        basis:
          'Shield continuity, seams, grounding, frequency and complete-system construction affect shielding performance.',
      },
    ],
  };
}

const sources = {
  hat: 'https://www.waveshare.com/product/robotics/bus-servo-driver-hat-a.htm',
  heltec:
    'https://resource.heltec.cn/download/WiFi_LoRa_32_V4/datasheet/WiFi_LoRa_32_V4.3.1_Datasheet.pdf',
  adc: 'https://prom.ua/p2527653228-bitnyj-analogo-tsifrovoj.html',
  buck: 'https://prom.ua/p3103438088-ponizhayuschij-preobrazovatel-bec12s.html',
  filter: 'https://prom.ua/p2956989595-filtr-pitaniya-iflight.html',
};

/** Poses are final operator coordinates; the inherited assembly later rotates −90° in Z. */
function occurrence(
  part: PartDefinition,
  id: string,
  label: string,
  parameters: Parameters,
  { at: [x, y, z], rotation: [rx, ry, rz] }: ModulePose,
  procurement: Procurement,
  notes: string,
  color: number,
): ConfiguredPiece {
  return {
    component: {
      id,
      name: label,
      libraryId: part.id,
      parameters,
      state: 'assembled',
      quantity: 1,
      supply: 'purchased',
      placement: { translation: [-y, x, z], rotation: [rx, ry, rz + 90] },
      procurement,
      notes,
    },
    label,
    color,
    preserveLibraryAppearance: true,
  };
}

function libraryDevice(
  part: PartDefinition,
  model: string,
  id: string,
  label: string,
  pose: ModulePose,
  procurement: Procurement,
  notes: string,
  color: number,
): ConfiguredPiece {
  const piece = occurrence(part, id, label, { model }, pose, procurement, notes, color);
  piece.component.presetId = model;
  return piece;
}

function hat(pose: ModulePose): ConfiguredPiece {
  return occurrence(
    busServoDriver,
    'case-servo-driver-hat',
    'Waveshare Bus Servo Driver HAT (A) · 27577',
    { model: 'waveshare-hat-a' },
    pose,
    {
      designation: 'Bus Servo Driver HAT (A) / 27577',
      manufacturer: 'Waveshare',
      source: sources.hat,
    },
    'Exact existing bus-servo-driver library occurrence with the complete supplier STEP assembly, including its underside components. The component-side PCB face is native Z0; the board is 57 × 65 × 1.6 mm and its four diameter 3 mm mounting holes are at (±24.5, ±29) mm. Native total Z is −6.8 to +14.3512 mm. The lower-body supports must clear both component faces and reserve access to its fitted connectors, BOOT/reset controls and mating cables. The supplied 9–25 V input must match the selected servo supply; the onboard host-power buck is not a servo-rail regulator. Stock host control is documented through UART/USB and Wi-Fi. The requested soldered ADS1220 connection needs user-selected ESP32 GPIO and firmware; this mechanical assembly does not assign a pinout or claim built-in SPI acquisition support.',
    0x176f99,
  );
}

function heltec(pose: ModulePose): ConfiguredPiece {
  return occurrence(
    loraModule,
    'case-heltec-v4',
    'Heltec WiFi LoRa 32 V4 · V4.3.1 mechanical reference',
    { model: 'heltec-wifi-lora32-v4' },
    pose,
    {
      designation: 'WiFi LoRa 32 V4 / confirm delivered revision',
      manufacturer: 'Heltec',
      source: sources.heltec,
    },
    'Exact existing lora-module V4.3.1 configuration with the protected OLED and unpopulated header pads. The nominal module is 25.4 × 51.69 × 10.7 mm; the modeled USB shell extends to native Y26.6 mm. Native PCB bottom/top are Z3.6/5.2 mm, with the complete model at Z0..10.7 mm. Source STEP PCB bores are diameter 2.8 mm at X±7 and Y−20.0345/8.9655 mm; the datasheet separately labels 1.9 mm in the protective-frame fastener area. The edge cradle avoids assuming these are interchangeable mounting interfaces. Keep GPIO pads, both U.FL sockets, integrated antenna frame, USB-C and separate battery/solar/GNSS interfaces accessible. Flexible leads, mating plugs and installed headers are omitted. Check the delivered V4 revision and soldered connector arrangement before final fabrication; no firmware, assigned electrical circuit or RF performance is represented.',
    0x252c2c,
  );
}

function adc(pose: ModulePose): ConfiguredPiece {
  return libraryDevice(
    adcModule,
    'cjmcu-1220',
    'case-adc-cjmcu1220',
    'CJMCU-1220 · ADS1220 SPI board · provisional construction',
    pose,
    {
      designation: 'ADS1220 / CJMCU-1220 / seller code 102300-2',
      manufacturer: 'Unspecified',
      source: sources.adc,
    },
    'Library-owned packaging reference for the selected purple CJMCU-1220 board, not a verified supplier CAD model. The selected seller supplies no dimensional drawing. A direct board supplier gives approximately 21.5 × 20.5 mm; the adopted 22 × 21 mm PCB, 1.6 mm PCB thickness and central illustrative chip up to Z2.8 are provisional. Native Z0 is the assumed PCB underside. The independent 24 × 24 × 12 mm layout reserve allows soldered leads and connector access and is not filled with a solid header envelope. No screw holes or connector locations are invented. The selected photo shows two opposite eight-pad rows and loose headers; the low side-edge seats and independent ADC keeper on its replaceable M3 adapter assume those row approaches face native ±Y. Confirm that orientation and copper-free bearing lands on the delivered board. Loose headers and wires are omitted because the user will solder leads directly to the HAT. ADS1220 uses SPI mode 1 per TI; GPIO assignment, logic-level compatibility and custom firmware are outside this mechanical layout. Measure the delivered board, component heights, pad access and soldered harness before final fabrication.',
    0x713d91,
  );
}

function buck(pose: ModulePose, index: number): ConfiguredPiece {
  const outputV = index === 0 ? 12 : 5;
  return libraryDevice(
    bec,
    'bec12s-pro',
    `case-buck-${index + 1}`,
    `BEC12S-PRO · TPS54560 · ${outputV} V branch ${index + 1} · provisional construction`,
    pose,
    {
      designation: `BEC12S-PRO / TPS54X60 solder-pad board / select ${outputV} V output`,
      manufacturer: 'Unspecified',
      source: sources.buck,
    },
    `Library-owned representative PCB and component volume for the selected TPS54560 / TPS54X60 module. The photographed narrow black board with L50 inductor and end solder pads matches the 40 × 20 × 5.5 mm supplier family; those dimensions are not verified for the selected seller SKU. PCB thickness 1.6 mm, corner radius and central 26 × 14 mm component volume are assumptions; native Z0 is the assumed board underside and modeled total height is 5.5 mm. The separate 42 × 22 × 8 mm layout reserve leaves end solder pads and lead approach open. Its broad insulating backing wall has short underside bearing caps and a lower edge saddle; the assumed 0.3 mm clearance behind the PCB does not qualify unmeasured solder joints. No mounting holes, heatsink or mating connector is invented. The user-selected branch ${index + 1} setting is ${outputV} V${index === 0 ? ' for the filtered SP20 supply path' : ' for the supported Heltec 5 V input'}; verify the actual jumper selection before installation. This model does not establish continuous output current, thermal performance or the complete power circuit. Measure the actual PCB, underside joints, tallest components and harness before retaining its free edges.`,
    0x292c31,
  );
}

function filter(pose: ModulePose, index: number): ConfiguredPiece {
  return libraryDevice(
    powerFilter,
    'iflight-lc-filter-16x6',
    `case-lc-filter-${index + 1}`,
    `iFlight LC Filter · branch ${index + 1} · provisional construction`,
    pose,
    {
      designation: 'iFlight LC Filter / selected 16 × 6 × 3 mm seller version',
      manufacturer: 'iFlight',
      source: sources.filter,
    },
    'Library-owned representative PCB and component volume using the selected seller version envelope 16 × 6 × 3 mm. PCB thickness 1 mm, central component footprint and individual construction are unverified; native Z0 is the assumed board underside. The separate 20 × 7 × 4 mm reserve also accommodates the larger revision currently described by iFlight, without asserting the two versions share identical fit or electrical specifications. No mounting holes are documented or invented. Low insulating edge seats and a short keeper retain the adopted version while leaving both native ±X soldered-lead ends open; LC2 has its own small adapter and keeper, independent of the ADC. The connecting wires are omitted. Confirm the actual revision, copper-free bearing lands, insulation, solder joints and component height before final fabrication. Supplier filtering/current claims do not qualify the completed electronics or enclosure.',
    0x2d4685,
  );
}

function pwm(pose: ModulePose): ConfiguredPiece {
  return libraryDevice(
    pwmSwitch,
    'user-mosfet-26x16',
    'case-pwm-mosfet',
    'PWM MOSFET module · user 26 × 16 × 6 mm body reference',
    pose,
    {
      designation:
        'User-supplied PWM MOSFET module / exact manufacturer and execution unidentified',
      manufacturer: 'Unspecified',
      source:
        'User-provided body dimensions 26 × 16 × 6 mm and wire-exit description in this case-panel task; no supplier drawing or model number provided.',
    },
    'Library-owned occupied-body envelope using only the user-provided 26 × 16 × 6 mm dimensions. Native Z0 is one body face, not an asserted PCB or component datum; the 0.6 mm corner rounding is illustrative. This is not the unrelated 17 × 13 × 10 mm library PWM switch. The body stands vertically against the straight wall below the test-clip carrier, with a compact pressure-spreading keeper and two external ties, without invented screw holes. The user reports power wires on two opposite edges, with three PWM wires between power wires on one of those edges. Native ±X are assumed exit ends for the mechanical orientation only; the precise pad locations, shared signal edge and polarity are unverified. Preserve both complete end approaches for solder joints, insulation, signal leads and power-wire bends. Flexible wires are omitted. No MOSFET topology, switching polarity, load voltage/current, PWM input level, protection, heatsink or thermal performance is inferred. Measure the delivered body and actual harness before final fabrication or wiring.',
    0x4d5951,
  );
}

/** Eight physical purchased occurrences; flexible harnesses remain separate installation reserves. */
export function caseElectronicsPurchased(p: Parameters): ConfiguredPiece[] {
  const m = caseElectronicsLayout(p);
  return [
    hat(m.hat),
    heltec(m.heltec),
    adc(m.adc),
    ...m.bucks.map((pose, index) => buck(pose, index)),
    ...m.filters.map((pose, index) => filter(pose, index)),
    pwm(m.pwm),
  ];
}

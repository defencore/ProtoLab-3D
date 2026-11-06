import type { Parameters, PartDefinition } from '../../../core/types';
import type { AssemblyComponent, AssemblyDefinition } from '../../../core/product-types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import detail from '../../manufactured-detail/part';
import switches from '../../panel-switch/part';
import radio from '../../lora-module/part';
import bolt from '../../bolt-screw/part';
import nut from '../../hex-nut/part';
import locknut from '../../nyloc-nut/part';
import washer from '../../washer/part';
import rfPigtail from '../../rf-pigtail/part';
import { details, type Detail } from './details';
import {
  board,
  lidScrews,
  lidMount,
  batteryScrews,
  batteryBridge,
  batteryMount,
  layout,
  shell,
} from './layout';
import { B, rounded } from './shapes';
import { powerSwitchShape } from './power-button';
import { internalFpcEnvelope } from './antenna-seat';
import { grip } from './grip';
import { webButton, webPoint } from './web-button';

export const libraries = [detail, switches, radio, bolt, nut, locknut, washer, rfPigtail];
function custom(spec: Detail, process: 'printing' | 'cutting' = 'printing'): ConfiguredPiece {
  const fineBoundary = spec.id === 'lid' || spec.id === 'base';
  // Dense sewn surfaces need a topology-preserving Boolean kernel. Keep their
  // indexed boundary without the independent JSCAD mesh conformity pass.
  const component = detailComponent(spec.id, spec.label, spec.shape, {
    meshBackend: fineBoundary ? 'manifold' : 'jscad',
    meshConform: false,
    ...(fineBoundary
      ? {
          edgeTolerance: 1e-7,
          minimumTriangleArea: 1e-12,
          // The sewn exterior is already closed. Keeping its authored faces
          // avoids a costly coplanar refinement without changing the solid.
          nativeRefine: false,
        }
      : {}),
  });
  component.manufacturing = {
    material: spec.material,
    blank:
      process === 'printing'
        ? 'Print local solid with supports only where needed'
        : 'Cut soft sheet to the configured envelope',
    processes: [process],
    requirements: [
      'Fit to delivered components and qualify print/foam clearances before final assembly.',
    ],
  };
  return { component, label: spec.label, color: spec.color, requireSingleSolid: true };
}
function occurrence(
  part: PartDefinition,
  id: string,
  name: string,
  parameters: Parameters,
  translation: [number, number, number],
  rotation: [number, number, number],
  procurement: NonNullable<AssemblyComponent['procurement']>,
  supply: 'purchased' | 'standard' = 'purchased',
): ConfiguredPiece {
  return {
    component: {
      id,
      name,
      libraryId: part.id,
      parameters,
      state: part.states?.[0]?.id ?? 'default',
      quantity: 1,
      supply,
      placement: { translation, rotation },
      procurement,
    },
    label: name,
    color: 0xacb4bd,
    preserveLibraryAppearance: true,
  };
}
function screw(
  id: string,
  x: number,
  y: number,
  seat: number,
  diameter: number,
  length: number,
): ConfiguredPiece {
  const headHeight = diameter,
    headSize = diameter === 3 ? 5.5 : 3.8;
  return occurrence(
    bolt,
    id,
    `M${diameter} × ${length} socket screw`,
    {
      ...bolt.defaults,
      diameter,
      length,
      shankDiameter: diameter,
      head: 'socket-cap',
      headSize,
      headHeight,
      drive: 'hex',
      driveWidth: diameter === 3 ? 2.5 : 1.5,
      driveDepth: diameter === 3 ? 1.5 : 1,
      pitch: diameter === 3 ? 0.5 : 0.4,
      threadLength: length,
      tip: 'flat',
      tipLength: 0,
      tipDiameter: diameter,
    },
    [x, y, seat - (length - headHeight) / 2],
    [0, 0, 0],
    {
      designation: `M${diameter} × ${length} · ISO 4762`,
      manufacturer: 'Unspecified standard hardware',
      source: 'ISO 4762 nominal socket-head dimensions; select actual supplier',
    },
    'standard',
  );
}
function captiveNut(
  id: string,
  x: number,
  y: number,
  z: number,
  diameter: number,
): ConfiguredPiece {
  return occurrence(
    nut,
    id,
    `M${diameter} captive hex nut`,
    {
      ...nut.defaults,
      bore: diameter,
      acrossFlats: diameter === 3 ? 5.5 : 4,
      height: diameter === 3 ? 2.4 : 1.6,
      pitch: diameter === 3 ? 0.5 : 0.4,
    },
    [x, y, z],
    [0, 0, 0],
    {
      designation: `M${diameter} · ISO 4032`,
      manufacturer: 'Unspecified standard hardware',
      source: 'ISO 4032 nominal hex-nut dimensions; select actual supplier',
    },
    'standard',
  );
}

/** The metal clamp travels with the safety slider, clear of the pressing paddle. */
function safetyClamp(p: Parameters): ConfiguredPiece[] {
  if (p.bodyModel !== 'web-grip') return [];
  const c = webButton.clamp,
    travel = p.safetyPosition === 'unlocked' ? webButton.slider.unlockedTravel : 0,
    y = c.localY + webButton.slider.axis[1] * travel,
    rotation = webButton.frame.rotation;
  return [
    occurrence(
      bolt,
      'clamp-screw',
      'M3 × 10 low button-head safety clamp screw',
      {
        ...bolt.defaults,
        diameter: 3,
        length: c.screwLength,
        shankDiameter: 3,
        head: 'button',
        headSize: c.headDiameter,
        headHeight: c.headHeight,
        drive: 'hex',
        driveWidth: c.headHex,
        driveDepth: 0.69,
        pitch: 0.5,
        threadLength: c.screwLength,
        tip: 'flat',
        tipLength: 0,
        tipDiameter: 3,
      },
      webPoint(c.localX, y, c.headSeatW - (c.screwLength - c.headHeight) / 2),
      rotation,
      {
        designation: 'M3 × 10 · ISO 7380-1',
        manufacturer: 'Unspecified standard hardware',
        source: 'Existing M3 ISO 7380-1 library catalog; low head Ø5.7 × 1.65 mm, hex 2 mm',
      },
      'standard',
    ),
    occurrence(
      washer,
      'clamp-washer',
      'M3 flat safety clamp washer',
      {
        ...washer.defaults,
        bore: 3.2,
        outerDiameter: c.washerDiameter,
        thickness: c.washerThickness,
      },
      webPoint(c.localX, y, c.washerBackW + c.washerThickness / 2),
      rotation,
      {
        designation: 'M3 · DIN 125 · 3.2 × 7 × 0.5 mm',
        manufacturer: 'Unspecified standard hardware',
        source: 'Existing M3 DIN 125 library catalog',
      },
      'standard',
    ),
    occurrence(
      locknut,
      'clamp-nut',
      'M3 captive nylon-insert safety clamp nut',
      {
        ...locknut.defaults,
        bore: 3,
        acrossFlats: c.nutAcrossFlats,
        height: c.nutHeight,
        bodyHeight: 2.4,
        pitch: 0.5,
        threadAllowance: 0,
      },
      webPoint(c.localX, y, c.nutBackW + c.nutHeight),
      [180, rotation[1], rotation[2]],
      {
        designation: 'M3 · DIN 985 · AF 5.5 × 4 mm',
        manufacturer: 'Unspecified standard hardware',
        source: 'Existing M3 DIN 985 library catalog',
      },
      'standard',
    ),
  ];
}
export function configuredPieces(p: Parameters, state: string): ConfiguredPiece[] {
  const d = layout(p),
    printed = details(p, state === 'print-layout').map((spec) => custom(spec));
  if (state === 'base-only') return printed.filter((piece) => piece.component.id === 'base');
  if (state === 'lid-only') return printed.filter((piece) => piece.component.id === 'lid');
  if (state === 'print-layout')
    return printed.map((piece, i) => ({
      ...piece,
      component: {
        ...piece.component,
        placement:
          i === 1
            ? {
                translation: [
                  65 + piece.component.placement.translation[0],
                  -piece.component.placement.translation[1],
                  shell.height - piece.component.placement.translation[2],
                ],
                rotation: [180, 0, 0],
              }
            : piece.component.placement,
      },
      position:
        piece.component.id === 'battery-retainer'
          ? [50, -108, -batteryBridge.z]
          : piece.component.id === 'base' && p.bodyModel !== 'original'
            ? [0, 0, grip.soleDrop]
            : [0, 0, 0],
    }));
  const reference = custom({
    id: 'battery-reference',
    label: '102540 1S LiPo · measured envelope',
    shape: rounded(
      d.battery.width,
      d.battery.length,
      2,
      d.battery.z,
      d.battery.height,
      d.battery.x,
      d.battery.y,
    ),
    color: 0xbec3c9,
    material: 'User-measured 102540 battery envelope',
  });
  reference.component.supply = 'reference';
  delete reference.component.manufacturing;
  reference.component.notes =
    '102540 cell measured by the user at 43 × 25 × 10 mm. The adjustable reference stays excluded from physical exports and purchasing lists; capacity, protection, lead envelope, connector and polarity are not specified.';
  const foam = [
    custom(
      {
        id: 'battery-floor-pad',
        label: 'Battery double-sided adhesive',
        shape: rounded(
          d.battery.width - 2,
          d.battery.length - 4,
          1.5,
          shell.floor,
          d.battery.tapeThickness,
          d.battery.x,
          d.battery.y,
        ),
        color: 0x5d6269,
        material: 'Double-sided insulating adhesive / verify actual thickness',
      },
      'cutting',
    ),
    custom(
      {
        id: 'battery-bridge-pad',
        label: 'Battery bridge foam pad',
        shape: B(
          12,
          6,
          batteryBridge.z - d.battery.z - d.battery.height,
          d.battery.x,
          d.battery.y + d.battery.length / 2 - 4,
          d.battery.z + d.battery.height,
        ),
        color: 0x5d6269,
        material: 'Soft closed-cell insulating foam / fit without crushing pouch',
      },
      'cutting',
    ),
  ];
  const buttons = d.buttons.map((b) =>
    occurrence(
      switches,
      b.id,
      `${b.label} · ${b.finger} finger DS-225 momentary button`,
      {
        ...switches.defaults,
        model: 'daier-ds-225',
        capColour: b.capColour,
        position: b.position,
        panelThickness: shell.wall,
      },
      [b.x, b.y, b.z],
      b.rotation,
      {
        designation: 'DS-225',
        manufacturer: 'DAIER',
        source:
          'User-supplied rectangular black bezel photo and installation drawing; user-requested cap colour',
      },
    ),
  );
  const pcb = occurrence(
    radio,
    'heltec-board',
    'Heltec WiFi LoRa 32 V4',
    { model: 'heltec-wifi-lora32-v4' },
    [board.x, board.y, board.z],
    [0, 0, 0],
    {
      designation: 'WiFi LoRa 32 V4',
      manufacturer: 'Heltec',
      source:
        'https://resource.heltec.cn/download/WiFi_LoRa_32_V4/datasheet/WiFi_LoRa_32_V4.3.1_Datasheet.pdf',
    },
  );
  const power = custom({
    id: 'power-switch',
    label: 'User-owned tactile power switch · 12 × 12 × 4 mm · actuator Ø6 × 6 mm',
    shape: powerSwitchShape(p),
    color: 0x263039,
    material: 'User-owned momentary tactile switch',
  });
  power.component.supply = 'purchased';
  delete power.component.manufacturing;
  power.component.procurement = {
    designation: '12 × 12 × 4 mm tactile switch · Ø6 mm actuator projecting 6 mm',
    manufacturer: 'Unspecified / user-owned',
    source: 'User measurements; actuator projection explicitly confirmed as 6 mm above the body',
  };
  power.component.notes =
    'User-owned package dimensions. Supplier, terminal pattern, electrical rating and actual travel are unspecified. The 0.2 mm pressed pose is illustrative. Lead details are omitted; fit the delivered leads in the open side grooves.';
  const antennaPiece = d.antenna.external
    ? occurrence(
        rfPigtail,
        'antenna-pigtail',
        `${d.antenna.top ? 'Upper' : 'Lower'} SMA antenna mount · internal retaining hardware`,
        { ...rfPigtail.defaults, model: d.antenna.model, panelThickness: d.antenna.panelThickness },
        d.antenna.position,
        d.antenna.rotation,
        {
          designation: '095-902-545-100 · SMA female / AMC · 100 mm',
          manufacturer: 'Amphenol RF',
          source: 'https://www.amphenolrf.com/en-us/part/095-902-545-100/8896/',
        },
      )
    : custom({
        id: 'internal-fpc-reference',
        label: 'Unselected 928 MHz adhesive FPC · packaging reference',
        shape: internalFpcEnvelope(p),
        color: 0xb88a45,
        material: 'Unselected adhesive FPC antenna envelope',
      });
  if (!d.antenna.external) {
    antennaPiece.component.supply = 'reference';
    delete antennaPiece.component.manufacturing;
    antennaPiece.component.notes =
      'Illustrative 38 × 10 × 0.3 mm film with a local 2 mm feed envelope, adhered to the lid toward the power end. Actual 928 MHz antenna, feed and cable remain unselected. Excluded from physical exports and procurement; RF tuning and complete coax route are unverified.';
  }
  const hardware = [
    ...lidScrews.flatMap(([x, y], i) => [
      screw(`lid-screw-${i}`, x, y, lidMount.screwSeat, 2, lidMount.screwLength),
      captiveNut(`lid-nut-${i}`, x, y, lidMount.nutBottom, 2),
    ]),
    ...batteryScrews.flatMap(([x, y], i) => [
      screw(`battery-screw-${i}`, x, y, batteryMount.screwSeat, 2, batteryMount.screwLength),
      captiveNut(`battery-nut-${i}`, x, y, batteryMount.nutBottom, 2),
    ]),
    ...safetyClamp(p),
  ];
  let result = [...printed, ...foam, reference, ...buttons, power, pcb, antennaPiece, ...hardware];
  if (state === 'open')
    result = result.map((piece) =>
      piece.component.id === 'lid' || piece.component.id === 'internal-fpc-reference'
        ? { ...piece, position: [60, 0, 0] }
        : piece.component.id.startsWith('lid-screw-')
          ? { ...piece, position: [60, 0, 0] }
          : piece.component.id === 'clamp-screw' || piece.component.id === 'clamp-washer'
            ? {
                ...piece,
                position: webButton.frame.outward.map((v) => v * 20) as [number, number, number],
              }
            : piece,
    );
  if (state === 'exploded')
    result = result.map((piece, i) => ({
      ...piece,
      position:
        piece.component.id === 'web-plunger' ||
        piece.component.id === 'web-slider' ||
        piece.component.id.startsWith('clamp-')
          ? (webButton.frame.outward.map(
              (v) => v * (piece.component.id === 'web-plunger' ? 32 : 18),
            ) as [number, number, number])
          : [
              0,
              0,
              piece.component.id === 'lid' || piece.component.id === 'internal-fpc-reference'
                ? 70
                : piece.component.id === 'battery-retainer'
                  ? 35
                  : piece.component.id === 'heltec-board'
                    ? 22
                    : piece.component.id.startsWith('lid-screw-')
                      ? 80
                      : piece.component.id.startsWith('battery-screw-')
                        ? 40
                        : 0,
            ],
    }));
  return result;
}
export function composition(p: Parameters): AssemblyDefinition {
  return {
    components: configuredPieces(p, 'assembled')
      .filter((piece) => piece.component.supply !== 'reference')
      .map((piece) => piece.component),
    issues: [
      'The user measured the 102540 battery at 43 × 25 × 10 mm; verify adhesive thickness, protected lead envelope and the delivered Heltec V4 revision.',
      'Rectangular DS-225 bezel dimensions, front projection and inspection travel are illustrative; measure both switches before producing the final cutouts and guards.',
      p.antennaType === 'internal'
        ? 'Select the actual 928 MHz adhesive FPC antenna, verify its feed and coax fit and tune it in the assembled enclosure. The lid-mounted reference is a packaging envelope, omitted from physical exports and purchasing.'
        : 'Complete battery protection, insulation, connector polarity and wiring. Check the antenna band, flexible heat-shrink bend, remaining coax slack and strain relief on the delivered pigtail. Mechanical placement does not define a completed circuit.',
      'Check the geometric guard clearance with the delivered switches and qualify printed stiffness and ergonomic edges. No drop, ingress or accidental-actuation rating is assigned.',
    ],
  };
}

import { Euler, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../../../core/types';
import type { AssemblyComponent } from '../../../core/product-types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import bolt from '../../bolt-screw/part';
import nut from '../../hex-nut/part';
import washer from '../../washer/part';
import { layout } from './layout';
import { kinematics } from './drive';
import type { Vec } from '../../../core/assembly/boundary/shapes';

export const hardwareLibraries = [bolt, nut, washer];
function occurrence(
  part: PartDefinition,
  id: string,
  label: string,
  parameters: Parameters,
  translation: Vec,
  rotation: Vec,
): ConfiguredPiece {
  const component: AssemblyComponent = {
    id,
    name: label,
    libraryId: part.id,
    parameters,
    state: part.states?.[0]?.id ?? 'default',
    quantity: 1,
    supply: 'standard',
    placement: { translation, rotation },
    procurement: {
      designation: label,
      manufacturer: 'Select supplier',
      source: 'Nominal dimensional execution; select an available fastener and property class.',
    },
  };
  return { component, label, color: 0xa6afb8 };
}

/** Under-head point and +Z direction make a through-fastener's assembled length unambiguous. */
export function screw(
  id: string,
  d: number,
  length: number,
  underHead: Vec,
  rotation: Vec = [0, 0, 0],
) {
  const hh = d,
    hs = d === 1.6 ? 3 : d === 2 ? 3.8 : d === 3 ? 5.5 : 7;
  const offset = new Vector3(0, 0, (length - hh) / 2).applyEuler(
    new Euler(...(rotation.map((v) => (v * Math.PI) / 180) as Vec), 'ZYX'),
  );
  const translation = underHead.map((v, i) => v - offset.getComponent(i)) as Vec;
  const parameters = {
    ...bolt.defaults,
    diameter: d,
    shankDiameter: d,
    length,
    head: 'socket-cap',
    headSize: hs,
    headHeight: hh,
    drive: 'hex',
    driveWidth: d <= 2 ? 1.5 : d === 3 ? 2.5 : 3,
    driveDepth: d / 2,
    threadMode: 'envelope',
    threadSpan: 'full',
    pitch: d === 1.6 ? 0.35 : d === 2 ? 0.4 : d === 3 ? 0.5 : 0.7,
    threadLength: length,
    tip: 'flat',
    tipLength: 0.2,
  };
  return occurrence(bolt, id, `Socket screw M${d} × ${length}`, parameters, translation, rotation);
}
export function hexNut(
  id: string,
  d: number,
  af: number,
  height: number,
  bottom: Vec,
  rotation: Vec = [0, 0, 0],
) {
  return occurrence(
    nut,
    id,
    `Hexagon nut M${d}`,
    {
      ...nut.defaults,
      bore: d,
      acrossFlats: af,
      height,
      pitch: d === 1.6 ? 0.35 : d === 2 ? 0.4 : d === 3 ? 0.5 : 0.7,
      threadAllowance: 0,
    },
    bottom,
    rotation,
  );
}

export function hardware(p: Parameters): ConfiguredPiece[] {
  const m = layout(p),
    k = kinematics(p),
    result: ConfiguredPiece[] = [];
  const blindEnd = Math.min(m.contactZ - 3.5, m.deckTop + 13);
  const supportLength = Math.floor((blindEnd - 4.2 - 0.2) / 5) * 5;
  for (const x of m.guideEnds)
    for (const y of [-m.guideY, m.guideY]) {
      result.push(screw(`deck-tie-${x}-${y}`, 4, supportLength, [x, y, 4.2], [180, 0, 0]));
      // The head stops outside the block; its tip stops at the guide rod surface.
      result.push(screw(`guide-lock-${x}-${y}`, 3, 5, [x, y, m.contactZ + 8], [0, 0, 0]));
    }
  // Accessible bottom socket heads clamp the cage through top washers and thin nuts.
  const cageTop = m.servoZ + 35;
  const stockLength = Math.ceil((cageTop - 1) / 5) * 5;
  // Custom heights may require a fitted screw to clear the moving fork above the nut.
  const cageLength =
    4.2 + stockLength <= m.contactZ - 2.2 ? stockLength : Math.round((cageTop - 0.8) * 100) / 100;
  for (const x of [m.servoX - 16, m.servoX + 38])
    for (const y of [-18, 18]) {
      result.push(screw(`servo-tie-${x}-${y}`, 4, cageLength, [x, y, 4.2], [180, 0, 0]));
      result.push(
        occurrence(
          washer,
          `servo-washer-${x}-${y}`,
          'Flat washer M4 · Ø4.3 / Ø9 × 0.8',
          { bore: 4.3, outerDiameter: 9, thickness: 0.8 },
          [x, y, cageTop + 0.4],
          [0, 0, 0],
        ),
      );
      const cageNut = hexNut(`servo-nut-${x}-${y}`, 4, 7, 2.2, [x, y, cageTop + 0.8]);
      const designation = 'Thin hexagon nut M4 · DIN 439 / ISO 4035 · AF7 × 2.2';
      cageNut.label = designation;
      cageNut.component.name = designation;
      cageNut.component.procurement = {
        designation,
        manufacturer: 'Select supplier',
        source:
          'Nominal AF7 × 2.2 mm envelope: Würth DIN 439 M4 article 03114, https://eshop.wuerth.de/Hexagon-nut-low-profile-DIN-439-steel-04-plain-NUT-HEX-DIN439-B-04-WS7-M4/03114.sku/en/US/EUR/. Select the required fastener property class.',
      };
      result.push(cageNut);
    }
  const discZ = m.servoZ + 33.7,
    a = (k.servoAngle * Math.PI) / 180;
  const place = (x: number, y: number, z: number): Vec => [
    m.servoX + x * Math.cos(a) - y * Math.sin(a),
    x * Math.sin(a) + y * Math.cos(a),
    z,
  ];
  for (const [i, [x, y]] of [
    [7, 0],
    [0, 7],
    [-7, 0],
    [0, -7],
  ].entries()) {
    const crank = i === 1;
    result.push(
      screw(`disc-screw-${i}`, 1.6, crank ? 16 : 6, place(x, y, discZ + (crank ? 12 : 2))),
    );
    // Align an M1.6 nut flat radially: its inner face clears the supplier's radius 5.3 mm hub.
    // The nut top meets the original disc underside at local Z 31.2 mm; no source holes are altered.
    result.push(
      hexNut(`disc-nut-${i}`, 1.6, 3.2, 1.3, place(x, y, m.servoZ + 29.9), [
        0,
        0,
        k.servoAngle + i * 90,
      ]),
    );
  }
  for (const sign of [-1, 1])
    for (const y of [-5, 5]) {
      const cx = m.switchX + k.slide;
      const rotation: Vec = [0, sign * 90, 0];
      result.push(screw(`pad-screw-${sign}-${y}`, 2, 8, [cx + sign * 18, y, m.contactZ], rotation));
      result.push(
        hexNut(`pad-nut-${sign}-${y}`, 2, 4, 1.6, [cx + sign * 10, y, m.contactZ], rotation),
      );
    }
  return result;
}

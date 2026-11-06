import type { Parameters } from '../../../core/types';
import { Euler, Matrix4, Vector3 } from 'three';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import { cylinder, subtract, type Shape } from '../../../core/assembly/boundary/shapes';
import {
  actuatorPieces as singlePieces,
  actuatorLibraries as baseLibraries,
  actuatorFastenerPiece as fastenerPiece,
  configureActuatorPiece as configured,
  alignActuatorThreads,
} from '../../tr8-compact-actuator/part';
import {
  quadDrive, verticalNutCover, linkageOptions,
  narrowOutputPieces, dowelDatums, verticalNutFasteners,
} from './nut-linkage';
import { mechanismLayout, driveLayout } from './layout';
import dowelPin from '../../dowel-pin/part';
export const libraries = [...baseLibraries, dowelPin];
export { mechanismLayout };

function custom(id: string, label: string, shape: Shape, color: number): ConfiguredPiece {
  const component = detailComponent(id, label, shape);
  const turned = /shaft|spacer|screw/.test(id);
  const fork = id.endsWith('-crank');
  component.manufacturing = {
    material: turned || fork ? 'Steel; grade and fit per production drawing' : 'Aluminium alloy 6061-T6',
    blank: id === 'lead-screw' ? 'TR8×8(P2), 250 mm threaded stock' : id === 'output-shaft' ? 'Ø8 steel round bar; retain the integral closed inner head' : fork ? '3 mm steel sheet' : 'Stock sized to the detail drawing',
    processes: fork ? ['cutting', 'drilling', 'milling'] : turned ? ['turning', 'drilling'] : ['milling', 'drilling'],
    requirements: fork ? ['Cut the flat profile; finish the shaft bore and slot. Match-drill and ream the Ø2 transverse hole with the assembled shaft after setting sleeve and slide clearances.'] : ['Assign tolerances, surface finish and fits before manufacture.'],
  };
  return { component, label, color, requireSingleSolid: true };
}
function sleeve(id: string, label: string, start: number) {
  const z = mechanismLayout.screwZ;
  return custom(id, label, subtract(cylinder(3.8, .5, [start, 0, z], 'x'), cylinder(2.525, .7, [start - .1, 0, z], 'x')), 0xaeb5be);
}
/** One centred, longer-lever channel; all structural frame parts belong to the quad. */
export function mechanismPieces(p: Parameters, angle: number): ConfiguredPiece[] {
  const travel = mechanismLayout.radius * Math.tan(angle * Math.PI / 180);
  const phase = -360 * travel / 8;
  const axialRotation = new Euler().setFromRotationMatrix(new Matrix4().makeRotationY(Math.PI / 2)
    .multiply(new Matrix4().makeRotationZ(phase * Math.PI / 180)), 'ZYX');
  const rotation = [axialRotation.x, axialRotation.y, axialRotation.z].map((v) => v * 180 / Math.PI) as [number, number, number];
  const base = singlePieces({ ...p, outputAngle: angle });
  const kept = base.filter(({ component: c }) => c.id === 'gearmotor' || c.id === 'coupling' ||
    c.id.startsWith('screw-bearing-') || c.id.startsWith('output-bearing-') ||
    c.id.startsWith('screw-circlip-') || c.id === 'output-circlip-0' || c.id === 'output-circlip-1' ||
    c.id.startsWith('motor-front-M2-')).map((piece) => {
    const c = piece.component, translation = [...c.placement.translation] as [number, number, number];
    if (c.id === 'gearmotor' || c.id === 'coupling' || c.id.startsWith('motor-front-M2-')) translation[0] -= 1;
    if (c.id.startsWith('screw-bearing-') || c.id.startsWith('screw-circlip-')) translation[0] += translation[0] < 0 ? -1 : 1;
    if (c.id === 'gearmotor' || c.id === 'coupling' || c.id.startsWith('motor-front-M2-') ||
        c.id.startsWith('screw-bearing-') || c.id.startsWith('screw-circlip-')) translation[2] += mechanismLayout.screwZ - 10;
    if (c.id.startsWith('output-bearing-') || c.id.startsWith('output-circlip-')) {
      translation[0] += mechanismLayout.outputX;
      const side = translation[1] < 0 ? -1 : 1;
      translation[1] = side * (c.id.startsWith('output-bearing-') ? mechanismLayout.bearingCentres[1] : mechanismLayout.bearingCentres[1] + 3.7);
    }
    return { ...piece, component: { ...c,
      parameters: c.id === 'gearmotor' ? { ...c.parameters, outputAngle: ((phase + 180) % 360 + 360) % 360 - 180 } : c.parameters,
      placement: { ...c.placement, translation,
        rotation: c.id === 'coupling' || c.id.startsWith('screw-circlip-') ? rotation : c.placement.rotation } } };
  });
  const drive = quadDrive(travel);
  const nut = custom('lead-nut', 'TR8×8(P2) brass H-nut · clocked 90°', drive.nut, 0xc7a448);
  nut.component.supply = 'purchased'; delete nut.component.manufacturing;
  nut.component.procurement = { designation: 'TR8×8(P2) RH H-flange nut · 22×11×15', manufacturer: 'User-supplied nut drawing', source: 'references/tr8-h-nut/h-nut-drawing.png' };
  const result = [
    ...kept,
    custom('lead-screw', 'TR8×8(P2) screw · 52 mm finished · 28 mm working thread', drive.screw, 0x92a7b6), nut,
    custom('nut-yoke', 'Centred H-nut cover · 14.5 mm lever · integral Ø4 pins', verticalNutCover(travel, linkageOptions), 0xc7a448),
    ...narrowOutputPieces(angle).map((item) => custom(item.id, item.label, item.shape, item.color)),
    ...['fixed-outer', 'fixed-inner', 'floating-inner', 'floating-outer'].map((id, index) =>
      sleeve(id + '-spacer', id + ' screw thrust spacer · 5.05×7.6×0.5', driveLayout.spacerStarts[index])),
    ...verticalNutFasteners(travel).map(fastenerPiece),
  ];
  for (const item of dowelDatums(angle)) {
    const frame = new Matrix4().makeRotationFromEuler(new Euler(...item.rotation.map((v) => v * Math.PI / 180) as [number, number, number], 'ZYX'));
    const half = new Vector3(0, 0, -5).applyMatrix4(frame);
    const origin = item.center.map((v, i) => v + half.getComponent(i)) as [number, number, number];
    const pin = configured(dowelPin, item.id, 'Press-fit cross pin · ISO 8734 Ø2×10',
      { ...dowelPin.defaults, form: 'straight', diameter: 2, length: 10, chamfer: 0.1 },
      origin, item.rotation, 'assembled', 0x87919c);
    pin.component.supply = 'purchased'; delete pin.component.manufacturing;
    pin.component.procurement = { designation: 'ISO 8734 Ø2×10 m6 hardened steel dowel',
      manufacturer: 'FIBRO or dimensionally equivalent supplier',
      source: 'https://static.shop.fibro.com/assets/EN/document/doc_2351_1_english.pdf' };
    result.push(pin);
  }
  return alignActuatorThreads(result);
}

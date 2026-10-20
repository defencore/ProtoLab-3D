import type { Parameters, PartDefinition, Preset } from '../../../core/types';
import type { AssemblyComponent, AssemblyDefinition } from '../../../core/product-types';
import { detailComponent } from '../../../core/component-recipes';
import { box, cylinder, subtract, type Shape } from '../../../core/assembly/boundary/shapes';
import {
  componentDimensions,
  componentGeometry,
  componentPython,
  type ConfiguredPiece,
} from '../../../core/assembly/detail-instances';
import detail from '../../manufactured-detail/part';
import screw from '../../bolt-screw/part';
import nut from '../../hex-nut/part';
import washer from '../../washer/part';

export const libraries: PartDefinition[] = [detail, screw, nut, washer];
const stock = (part: PartDefinition, predicate: (preset: Preset) => boolean): Preset => {
  const row = part.presets.find(predicate);
  if (!row) throw new Error('No suitable catalog hardware configuration is available.');
  return row;
};
export function clampLayout(p: Parameters) {
  const diameter = Number(p.tubeDiameter) + Number(p.boreAllowance),
    wall = Number(p.wall),
    bolt = Number(p.bolt),
    halfHeight = diameter / 2 + wall,
    washerPreset = stock(
      washer,
      (m) =>
        m.catalog?.standard === 'DIN 125' &&
        Number(m.parameters.bore) > bolt &&
        Number(m.parameters.bore) < bolt + 0.5,
    ),
    nutPreset = stock(nut, (m) => m.catalog?.standard === 'DIN 934' && m.parameters.bore === bolt),
    washerThickness = Number(washerPreset.parameters.thickness),
    washerDiameter = Number(washerPreset.parameters.outerDiameter),
    nutHeight = Number(nutPreset.parameters.height),
    pitch = Number(nutPreset.parameters.pitch),
    minimumLength = 2 * halfHeight + 2 * washerThickness + nutHeight + 2 * pitch,
    screwPreset = [...screw.presets]
      .filter(
        (m) =>
          m.catalog?.standard === 'DIN 912' &&
          m.parameters.diameter === bolt &&
          Number(m.parameters.length) >= minimumLength,
      )
      .sort((a, b) => Number(a.parameters.length) - Number(b.parameters.length))[0];
  const width = Number(p.boltPitchY) + washerDiameter + 2 * wall;
  const boltCentres = [-1, 1].flatMap((x) =>
    [-1, 1].map((y): [number, number] => [
      (x * Number(p.boltPitchX)) / 2,
      (y * Number(p.boltPitchY)) / 2,
    ]),
  );
  return {
    diameter,
    halfHeight,
    width,
    wall,
    bolt,
    washerPreset,
    nutPreset,
    screwPreset,
    washerThickness,
    washerDiameter,
    nutHeight,
    pitch,
    minimumLength,
    boltCentres,
  };
}

export function clampHalf(p: Parameters, top: boolean): Shape {
  const v = clampLayout(p),
    length = Number(p.length),
    gap = Number(p.splitGap),
    z = top ? gap / 2 : -v.halfHeight;
  return subtract(
    box([length, v.width, v.halfHeight - gap / 2], [-length / 2, -v.width / 2, z]),
    {
      kind: 'cylinder',
      radius: v.diameter / 2,
      height: length + 2,
      origin: [-length / 2 - 1, 0, 0],
      axis: 'x',
      segments: 96,
    },
    ...v.boltCentres.map(([x, y]) =>
      cylinder(Number(p.boltClearance) / 2, 2 * v.halfHeight + 2, [x, y, -v.halfHeight - 1]),
    ),
  );
}
function purchased(
  part: PartDefinition,
  preset: Preset,
  id: string,
  name: string,
  xyz: [number, number, number],
): AssemblyComponent {
  return {
    id,
    name,
    libraryId: part.id,
    parameters: { ...preset.parameters },
    presetId: preset.id,
    state: 'default',
    quantity: 1,
    placement: { translation: xyz, rotation: [0, 0, 0] },
    supply: 'standard',
    procurement: {
      designation: preset.catalog!.designation,
      standard: preset.catalog!.standard,
      manufacturer: preset.catalog!.sourceName,
      source: preset.catalog!.sourceUrl,
    },
  };
}
export function clampComponents(p: Parameters): AssemblyComponent[] {
  const v = clampLayout(p);
  if (!v.screwPreset) throw new Error('No stock screw is long enough for this clamp.');
  const halves = [false, true].map((top) => {
    const item = detailComponent(
      top ? 'upper-half' : 'lower-half',
      top ? 'Upper bored clamp half' : 'Lower bored clamp half',
      clampHalf(p, top),
    );
    item.manufacturing = {
      material: 'Project-selected aluminium alloy or qualified engineering polymer',
      blank: `${p.length} x ${v.width.toFixed(2)} x ${(v.halfHeight - Number(p.splitGap) / 2).toFixed(2)} mm`,
      processes: ['milling', 'drilling'],
      requirements: [
        'Select milling or a qualified printing route in the project. Specify bore tolerance, bearing face flatness and actual material; inspect the fit on the measured tube.',
      ],
    };
    return item;
  });
  const length = Number(v.screwPreset.parameters.length),
    head = Number(v.screwPreset.parameters.headHeight),
    screwZ = v.halfHeight + v.washerThickness - (length - head) / 2;
  const threadOriginZ =
      v.halfHeight + v.washerThickness - length + Number(v.screwPreset.parameters.threadStart),
    nutBottomZ = -v.halfHeight - v.washerThickness - v.nutHeight,
    // Align the same helical thread frame at different axial origins in Full CAD.
    nutPhase = (((((nutBottomZ - threadOriginZ) / v.pitch) * 360) % 360) + 360) % 360;
  return [
    ...halves,
    ...v.boltCentres.flatMap<AssemblyComponent>(([x, y], index) => [
      purchased(screw, v.screwPreset, `bolt-${index + 1}`, `Clamp bolt ${index + 1}`, [
        x,
        y,
        screwZ,
      ]),
      purchased(
        washer,
        v.washerPreset,
        `upper-washer-${index + 1}`,
        `Upper bearing washer ${index + 1}`,
        [x, y, v.halfHeight + v.washerThickness / 2],
      ),
      purchased(
        washer,
        v.washerPreset,
        `lower-washer-${index + 1}`,
        `Lower bearing washer ${index + 1}`,
        [x, y, -v.halfHeight - v.washerThickness / 2],
      ),
      {
        ...purchased(nut, v.nutPreset, `nut-${index + 1}`, `Clamp nut ${index + 1}`, [
          x,
          y,
          -v.halfHeight - v.washerThickness - v.nutHeight,
        ]),
        placement: { translation: [x, y, nutBottomZ], rotation: [0, 0, nutPhase] },
      },
    ]),
  ];
}
export function composition(p: Parameters): AssemblyDefinition {
  return {
    components: clampComponents(p),
    issues: [
      'Clamp halves are authored fabrication definitions. Select actual material, manufacturing route, tolerances, proof load and inspection.',
      'The screws clamp the two halves only. For attachment through a vehicle plate, include its thickness in a separately checked fastener stack and select longer screws.',
      'Measure tube ovality and wall thickness. Qualify fit, residual split gap, torque, anti-rotation and local crushing; no load rating or flight approval is assigned.',
    ],
  };
}
export function pieces(p: Parameters, state: string): ConfiguredPiece[] {
  const all = clampComponents(p),
    v = clampLayout(p),
    selected = ['halves', 'print'].includes(state) ? all.slice(0, 2) : all;
  return selected.map((source, index) => {
    const item = {
      ...source,
      placement: {
        translation: [...source.placement.translation] as [number, number, number],
        rotation: [...source.placement.rotation] as [number, number, number],
      },
    };
    let position: [number, number, number] = [0, 0, 0];
    if (state === 'print') {
      // Rebuild each authored half in its flat outer-face-down fabrication pose.
      const shape: Shape = {
        kind: 'transform',
        child: clampHalf(p, index === 1),
        translation: [0, index * (v.width + 8), v.halfHeight],
        rotation: index === 1 ? [180, 0, 0] : [0, 0, 0],
      };
      const posed = detailComponent(item.id, item.name, shape);
      item.parameters = posed.parameters;
      item.placement = posed.placement;
    } else if (state === 'exploded')
      position = [
        0,
        0,
        index === 0
          ? -12
          : index === 1
            ? 12
            : item.id.startsWith('lower-') || item.id.startsWith('nut-')
              ? -24
              : 24,
      ];
    return {
      component: item,
      requireSingleSolid: true,
      label: item.name,
      color: index < 2 ? 0x457b85 : 0xb3bdc7,
      position,
    };
  });
}
export const geometry = (p: Parameters, state: string, nominal = false) =>
  componentGeometry(libraries, pieces(p, state), nominal);
export const python = (p: Parameters, state: string) =>
  componentPython(libraries, pieces(p, state));
export const dimensions = (p: Parameters, state: string) =>
  componentDimensions(libraries, pieces(p, state));

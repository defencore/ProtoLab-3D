import type { Parameters, PartDefinition } from '../../../core/types';
import type { AssemblyComponent, AssemblyDefinition } from '../../../core/product-types';
import { detailComponent } from '../../../core/component-recipes';
import { prism, type Shape } from '../../../core/assembly/boundary/shapes';
import {
  componentGeometry,
  componentPython,
  componentDimensions,
  type ConfiguredPiece,
} from '../../../core/assembly/detail-instances';
import detail from '../../manufactured-detail/part';

const libraries: PartDefinition[] = [detail];

/** One cross-section controls preview, fabrication identity and native straight-edge CAD. */
export function layout(p: Parameters) {
  const length = Number(p.length),
    width = Number(p.width),
    base = Number(p.baseThickness),
    height = Number(p.tongueHeight),
    neck = Number(p.tongueWidth),
    head = Number(p.headWidth),
    clearance = Number(p.clearance),
    slope = (head - neck) / (2 * height),
    flankOffset = clearance * Math.sqrt(1 + slope * slope),
    slotBottom = neck / 2 + slope * clearance + flankOffset,
    slotTop = slotBottom + slope * height;
  return {
    length,
    width,
    base,
    height,
    neck,
    head,
    clearance,
    slope,
    flankOffset,
    slotBottom,
    slotTop,
  };
}

export function shapes(p: Parameters): [Shape, Shape] {
  const d = layout(p),
    half = d.width / 2;
  const male = prism(
    [
      [-half, 0],
      [half, 0],
      [half, d.base],
      [d.neck / 2, d.base],
      [d.head / 2, d.base + d.height],
      [-d.head / 2, d.base + d.height],
      [-d.neck / 2, d.base],
      [-half, d.base],
    ],
    d.length,
    -d.length / 2,
    'y',
  );
  const female = prism(
    [
      [-half, 0],
      [-d.slotBottom, 0],
      [-d.slotTop, d.height],
      [d.slotTop, d.height],
      [d.slotBottom, 0],
      [half, 0],
      [half, d.height + d.base],
      [-half, d.height + d.base],
    ],
    d.length,
    -d.length / 2,
    'y',
  );
  return [male, female];
}

export function components(p: Parameters): AssemblyComponent[] {
  const d = layout(p);
  return shapes(p).map((shape, index) => {
    const component = detailComponent(
      index === 0 ? 'male' : 'female',
      index === 0 ? 'Male dovetail coupon' : 'Female dovetail receiver',
      shape,
      { preserveAuthoredFrame: true },
    );
    component.placement.translation = [0, 0, index === 0 ? 0 : d.base + d.clearance];
    component.manufacturing = {
      material: 'Project-selected printable polymer; qualify grade and process',
      blank: `${d.width} x ${d.length} x ${d.base + d.height} mm printed coupon`,
      processes: ['printing'],
      requirements: [
        'Use the flat outer base as build datum; inspect the mating profile and compensate the process using measured coupons.',
        'Check layer adhesion, fit, friction, creep and the actual project load before reuse.',
      ],
    };
    return component;
  });
}

export function composition(p: Parameters): AssemblyDefinition {
  return {
    components: components(p),
    issues: [
      'Authored fit coupons, without a qualified material, process tolerance or load rating.',
      'The flanks capture Z separation, while the open Y insertion direction remains free. Add a separately designed end retainer when required.',
    ],
  };
}

/** Display placements never rewrite the local recipes or canonical bill of materials. */
export function pieces(p: Parameters, state: string): ConfiguredPiece[] {
  const d = layout(p);
  return components(p).map((source, index) => {
    const component: AssemblyComponent = {
      ...source,
      placement: {
        translation: [...source.placement.translation],
        rotation: [...source.placement.rotation],
      },
    };
    if (index === 1 && state === 'exploded') component.placement.translation[1] = d.length + 8;
    if (index === 1 && state === 'print') {
      component.placement.translation = [0, d.length + 8, d.height + d.base];
      component.placement.rotation = [180, 0, 0];
    }
    return {
      component,
      label: component.name,
      color: index === 0 ? 0xe6a34a : 0x478c99,
      requireSingleSolid: true,
    };
  });
}

export const geometry = (p: Parameters, state: string, nominal = false) =>
  componentGeometry(libraries, pieces(p, state), nominal);
export const python = (p: Parameters, state: string) =>
  componentPython(libraries, pieces(p, state));
export const dimensions = (p: Parameters, state: string) =>
  componentDimensions(libraries, pieces(p, state));

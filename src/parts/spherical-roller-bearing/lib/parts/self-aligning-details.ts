import type { ParameterDefinition, Parameters } from '../../../../core/types';
import { annulusPython, ring } from '../../../../core/geometry';
import { radialGeometry, radialPython, radialVisualSizes } from './radial-catalog-utils';

export function boreTypeParameter(includeThirty = false): ParameterDefinition {
  return {
    key: 'boreType',
    label: 'Bore construction',
    group: 'Construction',
    type: 'select',
    options: [
      { value: 'straight', label: 'Cylindrical bore' },
      { value: 'taper12', label: 'K · tapered 1:12' },
      ...(includeThirty ? [{ value: 'taper30', label: 'K30 · tapered 1:30' }] : []),
    ],
    description:
      'Bore diameter is measured at the small end; taper is the change in diameter per axial length.',
  };
}

function sealDimensions(p: Parameters, state: string) {
  const v = radialVisualSizes(p, 'self-aligning');
  const seat = Math.hypot(v.pitch, v.width * 0.23) + v.radius + Math.min(v.gap, v.width) * 0.015;
  const clearance = v.gap * 0.005;
  return {
    outer:
      Math.sqrt(Math.max((v.bore + v.gap * 0.55) ** 2, seat * seat - (v.width * 0.49) ** 2)) -
      clearance,
    inner: v.bore + v.gap * 0.27 + clearance,
    thickness: v.width * 0.04,
    center: v.width * (0.47 + (state === 'exploded' ? 0.9 : 0)),
  };
}

export function selfAligningGeometry(p: Parameters, state: string) {
  const group = radialGeometry({ ...p, seals: 'open' }, state, 'self-aligning');
  if (p.seals === 'rubber') {
    const v = sealDimensions(p, state);
    for (const side of [-1, 1]) {
      const seal = ring(v.outer, v.inner, v.thickness, 0x292d31);
      seal.name = 'Contact seal envelope';
      seal.position.z = side * v.center;
      group.add(seal);
    }
  }
  return group;
}

export function selfAligningPython(p: Parameters, state: string) {
  const body = radialPython({ ...p, seals: 'open' }, state, 'self-aligning');
  if (p.seals !== 'rubber') return body;
  const v = sealDimensions(p, state);
  return `${body}\nseal_low = ${annulusPython(v.outer, v.inner, v.thickness, -v.center - v.thickness / 2)}\nseal_high = ${annulusPython(v.outer, v.inner, v.thickness, v.center - v.thickness / 2)}\nshape = Part.makeCompound(shape.childShapes() + [seal_low, seal_high])\ncomponent_labels.extend(["Rear seal", "Front seal"])\ncomponent_colors.extend([(0.15,0.18,0.22),(0.15,0.18,0.22)])`;
}

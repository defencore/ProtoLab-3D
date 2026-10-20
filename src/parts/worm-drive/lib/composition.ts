import type { Vector2 } from 'three';
import { detailComponent } from '../../../core/component-recipes';
import type { AssemblyDefinition } from '../../../core/product-types';
import type { Shape, Vec } from '../../../core/assembly/boundary/shapes';
import { involuteProfile, type GearLayer, type GearValues } from '../../../core/hardware/gears';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';

export type WormCut = Omit<Extract<Shape, { kind: 'helical-worm' }>, 'kind' | 'rings'>;

export function wormComposition(
  sections: readonly { z: number; points: Vector2[] }[],
  wheel: GearValues,
  layers: readonly GearLayer[],
  distance: number,
  cut: WormCut,
  angles: { worm: number; wheel: number } = { worm: 0, wheel: 0 },
): AssemblyDefinition {
  const profile = involuteProfile(wheel);
  const wheelProfile: Shape = {
    kind: 'curve-loft',
    segments: profile.segments,
    layers: [...layers],
    ...(wheel.bore > 0 ? { shaftBore: wheel.boreProfile } : {}),
  };
  const wormShape: Shape = {
    kind: 'transform',
    child: {
      kind: 'transform',
      translation: [0, 0, 0],
      rotation: [0, 0, angles.worm],
      child: {
        kind: 'helical-worm',
        rings: sections.map((section) => section.points.map(({ x, y }): Vec => [x, y, section.z])),
        ...cut,
      },
    },
    translation: [0, distance, 0],
    rotation: [0, 90, 0],
  };
  return {
    components: [
      detailComponent(
        'worm-wheel',
        'Worm wheel',
        {
          kind: 'transform',
          translation: [0, 0, 0],
          rotation: [0, 0, angles.wheel],
          child: wheelProfile,
        },
        { edgeTolerance: 1e-6 },
      ),
      detailComponent('worm', 'Helical worm', wormShape, { edgeTolerance: 1e-6 }),
    ],
    issues: [
      'The helical worm and sampled throated wheel define prototype shapes. Choose an actual manufactured gear pair or qualify a conjugate tooth form, cutter geometry, backlash and contact pattern before a loaded transmission is released.',
      'Assign materials, blanks, cutting or prototype printing routes and toleranced drawings. Shaft retention, bearings, housing and lubrication are separate engineering work absent from this pair.',
    ],
  };
}

export function wormPieces(
  composition: AssemblyDefinition,
  state: string,
  distance: number,
  tip: number,
): ConfiguredPiece[] {
  return composition.components
    .filter((component) =>
      state === 'worm'
        ? component.id === 'worm'
        : state === 'wheel'
          ? component.id === 'worm-wheel'
          : true,
    )
    .map((component) => ({
      component,
      requireSingleSolid: true,
      label: component.id === 'worm' ? 'Worm' : 'Worm wheel',
      color: component.id === 'worm' ? 0x85898e : 0xb99650,
      position:
        component.id === 'worm'
          ? [0, state === 'worm' ? -distance : state === 'exploded' ? tip * 2 : 0, 0]
          : [0, 0, 0],
    }));
}

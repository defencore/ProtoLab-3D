import modeling from '@jscad/modeling';
import { Matrix4, Euler, Vector3 } from 'three';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import { detailComponent } from '../../../core/component-recipes';
import type { AssemblyDefinition } from '../../../core/product-types';
import type { Parameters } from '../../../core/types';
import type { Shape, Vec } from '../../../core/assembly/boundary/shapes';
import { n } from '../../../core/geometry';
import { shaftBoreValues } from '../../../core/hardware/shaft-bore';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';

/** Store the authored closed CAD boundary, never a recovered preview triangle mesh. */
function boundary(solid: Geom3): Extract<Shape, { kind: 'boundary' }> {
  const points: Vec[] = [],
    indices = new Map<string, number>();
  const faces = modeling.geometries.geom3.toPolygons(solid).map((polygon) =>
    polygon.vertices.map((point) => {
      const key = point.join(',');
      let index = indices.get(key);
      if (index === undefined) {
        index = points.length;
        points.push([...point] as Vec);
        indices.set(key, index);
      }
      return index;
    }),
  );
  return { kind: 'boundary', points, faces };
}

export function bevelPieces(
  p: Parameters,
  solids: { pinion: Geom3; wheel: Geom3 },
  state: string,
): ConfiguredPiece[] {
  return (['pinion', 'wheel'] as const)
    .filter((side) =>
      state === 'pinion' ? side === 'pinion' : state === 'wheel' ? side === 'wheel' : true,
    )
    .map((side) => {
      const get = (key: string) => n(p, `${side}${key}`);
      const phase =
        side === 'pinion'
          ? n(p, 'rotation')
          : (-n(p, 'rotation') * n(p, 'pinionTeeth')) / n(p, 'wheelTeeth');
      const bore = shaftBoreValues(p, side);
      const holes: Shape[] = [
        { kind: 'shaft-bore', profile: bore, length: get('Overall') + 2, z: -1 },
      ];
      if (p.setScrews)
        holes.push({
          kind: 'transform',
          child: {
            kind: 'cylinder',
            radius: n(p, 'setScrewDiameter') / 2,
            height: get('Hub') / 2 + 2,
            origin: [0, -1, get('HubLength') / 2],
            axis: 'y',
            segments: 40,
          },
          rotation: [0, 0, 0],
          translation: [0, 0, 0],
        });
      const label = side === 'pinion' ? 'Pinion' : 'Wheel';
      const component = detailComponent(
        side,
        label,
        {
          ...boundary(solids[side]),
          nativeCuts: holes,
        },
        { edgeTolerance: 1e-6, minimumTriangleArea: 1e-10, nativeRefine: false },
      );
      const separate = state === 'pinion' || state === 'wheel';
      const angle = !separate && side === 'pinion' ? -Math.PI / 2 : 0;
      const distance = get('Mounting');
      const target: Vec = separate
        ? [0, 0, -get('Overall') / 2]
        : side === 'pinion'
          ? [distance, 0, 0]
          : [0, 0, -distance];
      const frame = new Matrix4()
        .makeRotationY(angle)
        .multiply(new Matrix4().makeRotationZ((phase * Math.PI) / 180));
      const rotation = new Euler().setFromRotationMatrix(frame, 'ZYX');
      component.placement = {
        rotation: [rotation.x, rotation.y, rotation.z].map((angle) =>
          Math.abs(angle) < 1e-12 ? 0 : (angle * 180) / Math.PI,
        ) as Vec,
        translation: new Vector3(...component.placement.translation)
          .applyMatrix4(frame)
          .add(new Vector3(...target))
          .toArray() as Vec,
      };
      const explode = state === 'exploded' ? n(p, 'module') * 12 : 0;
      return {
        component,
        label,
        color: side === 'pinion' ? 0x85898e : 0xb99650,
        position: side === 'pinion' ? [explode, 0, 0] : [0, 0, -explode],
        requireSingleSolid: true,
      };
    });
}

export function bevelComposition(
  p: Parameters,
  solids: { pinion: Geom3; wheel: Geom3 },
): AssemblyDefinition {
  return {
    components: bevelPieces(p, solids, 'assembled').map((piece) => piece.component),
    issues: [
      'Source tables describe separately sold gears and limited mounting dimensions. Select two complete supplier executions or qualify the custom tooth form and manufacturing drawings; this assembly is not one purchased SKU.',
      'Bore/keyway depth, radial holes and tooth flanks include editable assumptions. Specify fits, materials, heat treatment, tooth contact and accepted clearances.',
      'Select radial set screws, shaft retention, bearings and housing where required; holes alone do not define the missing hardware.',
    ],
  };
}

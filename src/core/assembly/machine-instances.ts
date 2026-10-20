import { Euler, Matrix4, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../types';
import type { AssemblyComponent } from '../product-types';
import type { Shape, Vec } from './boundary/shapes';
import { detailComponent } from '../component-recipes';
import { supplierComponent, supplierUnit } from '../supplier-components';
import {
  componentGeometry,
  componentPython,
  componentDimensions,
  type ConfiguredPiece,
} from './detail-instances';

export interface MachineFeature {
  kind: string;
  child?: MachineFeature;
  translation?: Vec;
  rotation?: Vec;
  parameters?: Parameters;
  state?: string;
}
export interface MachinePiece {
  shape: MachineFeature;
  label: string;
  color: number;
  procurement?: 'MAKE' | 'BUY' | 'REFERENCE';
  z?: number;
  angle?: number;
}
/** Library references remain physical library instances; custom features remain reusable local recipes. */
export function machineInstances(
  pieces: readonly MachinePiece[],
  nominal = false,
): ConfiguredPiece[] {
  return pieces.map((piece, index) => {
    let source = piece.shape;
    const matrix = new Matrix4();
    while (source.kind === 'transform') {
      if (!source.child || !source.rotation || !source.translation)
        throw new Error('Invalid machine component placement.');
      matrix.multiply(
        new Matrix4()
          .makeRotationFromEuler(
            new Euler(...(source.rotation.map((angle) => (angle * Math.PI) / 180) as Vec), 'ZYX'),
          )
          .setPosition(...source.translation),
      );
      source = source.child;
    }
    let component: AssemblyComponent;
    const direct = source.kind === 'library-guide' || source.kind === 'library-ball-screw';
    if (direct) {
      if (!source.parameters || !source.state)
        throw new Error('Invalid machine library reference.');
      const rotation = new Euler().setFromRotationMatrix(matrix, 'ZYX');
      component = {
        id: 'component-' + (index + 1),
        name: piece.label,
        libraryId: source.kind === 'library-guide' ? 'linear-guide' : 'ball-screw',
        parameters: { ...source.parameters },
        state: source.state,
        quantity: 1,
        supply: 'purchased',
        placement: {
          translation: new Vector3().setFromMatrixPosition(matrix).toArray() as Vec,
          rotation: [rotation.x, rotation.y, rotation.z].map(
            (angle) => (angle * 180) / Math.PI,
          ) as Vec,
        },
      };
    } else {
      const supplier = supplierUnit(piece.shape);
      if (supplier)
        component = supplierComponent(
          'component-' + (index + 1),
          { ...supplier, libraryId: undefined },
          [piece.shape as Shape],
        );
      else {
        const detail = detailComponent(
          'component-' + (index + 1),
          piece.label,
          piece.shape as Shape,
        );
        component =
          piece.procurement === 'BUY'
            ? { ...detail, libraryId: 'purchased-component', supply: 'purchased' }
            : detail;
      }
    }
    return { ...piece, component, ...(direct ? { preserveLibraryAppearance: true } : {}) };
  });
}
export function machineGeometry(
  libraries: readonly PartDefinition[],
  pieces: readonly MachinePiece[],
  nominal = false,
) {
  return componentGeometry(libraries, machineInstances(pieces, nominal), nominal);
}
export function machinePython(
  libraries: readonly PartDefinition[],
  pieces: readonly MachinePiece[],
) {
  return componentPython(libraries, machineInstances(pieces));
}
export function machineDimensions(
  libraries: readonly PartDefinition[],
  pieces: readonly MachinePiece[],
) {
  return componentDimensions(libraries, machineInstances(pieces));
}

import type { Shape } from './shapes';
import type { MachinePiece } from '../../../core/assembly/machine-instances';
import {
  machineGeometry,
  machinePython,
  machineDimensions,
} from '../../../core/assembly/machine-instances';
import detail from '../../manufactured-detail/part';
import purchased from '../../purchased-component/part';
import guide from '../../linear-guide/part';
const libraries = [detail, purchased, guide];
export interface Piece extends MachinePiece {
  shape: Shape;
}
export const geometry = (pieces: readonly Piece[], nominal = false) =>
  machineGeometry(libraries, pieces, nominal);
export const python = (pieces: readonly Piece[]) => machinePython(libraries, pieces);
export const dimensions = (pieces: readonly Piece[]) => machineDimensions(libraries, pieces);

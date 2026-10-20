import type { Parameters, PartDefinition } from '../../../core/types';
import type { Vec } from '../../../core/assembly/boundary/shapes';
import type { FrameHole } from '../../cnc-frame-part/part';
import type { MillingPiece, Motion } from './composition';

/** The same physical-library builders serve each separately reviewed machine subassembly. */
export interface MillingBuilders {
  add(
    id: string,
    part: PartDefinition,
    parameters: Parameters,
    state: string,
    translation: Vec,
    rotation?: Vec,
    motion?: Motion,
    section?: MillingPiece['section'],
    color?: number,
    presetId?: string,
  ): void;
  fabricated(
    id: string,
    role: string,
    size: Vec,
    at: Vec,
    holes?: FrameHole[],
    motion?: Motion,
    material?: string,
    extra?: Parameters,
    rotation?: Vec,
    section?: MillingPiece['section'],
  ): void;
  fastener(
    id: string,
    diameter: number,
    length: number,
    seat: Vec,
    normal: Vec,
    motion?: Motion,
    section?: MillingPiece['section'],
  ): void;
  washeredM8(
    id: string,
    length: number,
    seat: Vec,
    normal: Vec,
    motion?: Motion,
    section?: MillingPiece['section'],
  ): void;
}

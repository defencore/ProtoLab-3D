import { Euler, Matrix4, Vector3 } from 'three';
import type { Shape } from '../src/core/assembly/boundary/shapes';

export type StockAabb = [number, number, number, number, number, number];

const validBounds = (bounds: StockAabb): StockAabb | undefined =>
  bounds.every(Number.isFinite) ? bounds : undefined;

/**
 * Enclose every positive stock primitive, retaining separate proxies across unions.
 * Cuts only remove material. Unsupported positive geometry disables this broadphase
 * so its caller can retain the complete native bounding-box/intersection check.
 */
export function stockBounds(shape: Shape): StockAabb[] | undefined {
  switch (shape.kind) {
    case 'box': {
      if (shape.size.some((value) => !Number.isFinite(value) || value < 0)) return undefined;
      const bounds = validBounds([
        ...shape.origin,
        ...shape.origin.map((value, axis) => value + shape.size[axis]),
      ] as StockAabb);
      return bounds ? [bounds] : undefined;
    }
    case 'cylinder': {
      const radius = shape.radius + (shape.thread?.radialClearance ?? 0);
      if (
        !Number.isFinite(radius) ||
        radius < 0 ||
        !Number.isFinite(shape.height) ||
        shape.height < 0
      )
        return undefined;
      const axis = { x: 0, y: 1, z: 2 }[shape.axis];
      if (axis === undefined) return undefined;
      const lower = shape.origin.map((value, index) => value - (index === axis ? 0 : radius));
      const upper = shape.origin.map(
        (value, index) => value + (index === axis ? shape.height : radius),
      );
      const bounds = validBounds([...lower, ...upper] as StockAabb);
      return bounds ? [bounds] : undefined;
    }
    case 'subtract':
      return shape.children[0] ? stockBounds(shape.children[0]) : undefined;
    case 'union': {
      if (!shape.children.length) return undefined;
      const result: StockAabb[] = [];
      for (const child of shape.children) {
        const bounds = stockBounds(child);
        if (!bounds) return undefined;
        result.push(...bounds);
      }
      return result;
    }
    case 'transform': {
      const bounds = stockBounds(shape.child);
      const radians = shape.rotation.map((angle) => (angle * Math.PI) / 180);
      if (!bounds || ![...radians, ...shape.translation].every(Number.isFinite)) return undefined;
      const matrix = new Matrix4()
        .makeRotationFromEuler(new Euler(radians[0], radians[1], radians[2], 'ZYX'))
        .setPosition(...shape.translation);
      const result: StockAabb[] = [];
      for (const box of bounds) {
        const lower = [Infinity, Infinity, Infinity];
        const upper = [-Infinity, -Infinity, -Infinity];
        for (let corner = 0; corner < 8; corner++) {
          const point = new Vector3(
            box[corner & 1 ? 3 : 0],
            box[corner & 2 ? 4 : 1],
            box[corner & 4 ? 5 : 2],
          ).applyMatrix4(matrix);
          point.toArray().forEach((value, axis) => {
            lower[axis] = Math.min(lower[axis], value);
            upper[axis] = Math.max(upper[axis], value);
          });
        }
        const transformed = validBounds([...lower, ...upper] as StockAabb);
        if (!transformed) return undefined;
        result.push(transformed);
      }
      return result;
    }
    default:
      return undefined;
  }
}

import { prism, type Shape, type Vec } from '../../../core/assembly/boundary/shapes';
import { batteryBridge, batteryMount, batteryScrews, floorRootZ } from './layout';
import { hex, union } from './shapes';

export const batteryPost = {
  width: 10,
  depth: 10,
  inboardCornerRadius: 0.2,
  outboardCornerRadius: 2,
  rootRadius: 2,
  mouthWidth: 5.6,
  mouthTaperLength: 1,
  loadingTravel: 8,
};

/** Keep the mouth corners nearly square, avoiding thin horns beside the nut slot. */
function footprint(x: number, y: number, extra = 0): [number, number][] {
  const width = batteryPost.width + 2 * extra,
    depth = batteryPost.depth + extra,
    cy = y + extra / 2;
  return [0, 1, 2, 3].flatMap((corner) => {
    const right = corner === 0 || corner === 3,
      outboard = right === x > 0,
      radius =
        (outboard ? batteryPost.outboardCornerRadius : batteryPost.inboardCornerRadius) + extra,
      cx = x + (right ? 1 : -1) * (width / 2 - radius),
      centerY = cy + (corner < 2 ? 1 : -1) * (depth / 2 - radius);
    return Array.from({ length: 9 }, (_, i): [number, number] => {
      const angle = ((corner * 90 + (i * 90) / 8) * Math.PI) / 180;
      return [cx + radius * Math.cos(angle), centerY + radius * Math.sin(angle)];
    });
  });
}

/** Full-height towers and broad circular floor roots replace the split thin cylinders. */
export function batteryPostSupports(): Shape {
  return union(
    ...batteryScrews.map(([x, y]) => {
      const rings = Array.from({ length: 13 }, (_, i) => {
        const angle = (i * Math.PI) / 24,
          z = floorRootZ + batteryPost.rootRadius * (1 - Math.cos(angle)),
          extra = batteryPost.rootRadius * (1 - Math.sin(angle));
        // The front stays fixed at Y=28.5, clear of even the 50 mm cell.
        return footprint(x, y, extra).map(([u, v]): Vec => [u, v, z]);
      });
      // One sewn surface avoids overlapping coplanar root/tower skins.
      return {
        kind: 'loft',
        rings: [...rings, footprint(x, y).map(([u, v]): Vec => [u, v, batteryBridge.z])],
      } satisfies Shape;
    }),
  );
}

/** A clearance-fit side entrance opens into the hex; its shallow funnel avoids forcing the nut. */
export function batteryNutPocket(x: number, y: number): Shape {
  const sign = Math.sign(x),
    center = Math.abs(x),
    mouth = center - batteryPost.width / 2,
    inner = mouth + batteryPost.mouthTaperLength,
    start = center - batteryPost.loadingTravel,
    halfCore = batteryMount.nutPocketAcrossFlats / Math.sqrt(3),
    halfMouth = batteryPost.mouthWidth / 2,
    channel = prism(
      [
        [start, y - halfMouth],
        [mouth, y - halfMouth],
        [inner, y - halfCore],
        [center + 0.05, y - halfCore],
        [center + 0.05, y + halfCore],
        [inner, y + halfCore],
        [mouth, y + halfMouth],
        [start, y + halfMouth],
      ].map(([u, v]) => [sign * u, v]),
      batteryMount.nutPocketHeight,
      batteryMount.nutPocketBottom,
    );
  return union(
    hex(
      batteryMount.nutPocketAcrossFlats,
      batteryMount.nutPocketBottom,
      batteryMount.nutPocketHeight,
      x,
      y,
    ),
    channel,
  );
}

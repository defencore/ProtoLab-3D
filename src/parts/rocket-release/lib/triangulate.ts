import modeling from '@jscad/modeling';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import { solidUnionMesh } from '../../../core/solid-union';

/** Triangulate convex JSCAD faces before the SDK's shared-edge conformity pass.
 * The recovery assembly validates this path against closed meshes and native CAD;
 * avoiding the preceding generalize/T-junction pass saves repeated assembly work.
 */
export function recoverySolidMesh(solid: Geom3) {
  const { geom3, poly3 } = modeling.geometries;
  const triangles = geom3.toPolygons(solid).flatMap((polygon) => {
    const points = polygon.vertices;
    if (points.length === 3) return [polygon];
    if (points.length <= 4)
      return [
        poly3.create([points[0], points[1], points[2]]),
        poly3.create([points[0], points[2], points[3]]),
      ];
    const center = [0, 1, 2].map(
      (axis) => points.reduce((sum, point) => sum + point[axis], 0) / points.length,
    ) as [number, number, number];
    return points.map((point, i) => poly3.create([center, point, points[(i + 1) % points.length]]));
  });
  return solidUnionMesh(geom3.create(triangles), {
    alreadyTriangulated: true,
    preserveOrigin: true,
    // Merge numerical CSG slivers at 1e-5 mm before edge counting; otherwise a
    // countersink can emit triangles with coincident endpoints after Float32 storage.
    vertexTolerance: 1e-5,
  });
}

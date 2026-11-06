import {
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type BufferGeometry,
  type Group,
} from 'three';
import { componentGeometry, type ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { libraries } from './model';

const printedIds = new Set(['base', 'lid', 'battery-retainer', 'web-plunger', 'web-slider']);

/** Smooth a printed surface without letting dense CSG fans bias its vertex normals. */
export function printedCreasedNormals(
  geometry: BufferGeometry,
  preserveSoleTangency = false,
): BufferGeometry {
  const result = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = result.getAttribute('position');
  const faceNormals = new Float64Array(position.count);
  const cornerAngles = new Float64Array(position.count);
  const vertexKeys: string[] = [];
  const shared = new Map<string, number[]>();
  const soleFaces = new Set<number>();
  let soleZ = Infinity;
  if (preserveSoleTangency)
    for (let i = 0; i < position.count; i++) soleZ = Math.min(soleZ, position.getZ(i));
  const vertices = [new Vector3(), new Vector3(), new Vector3()];
  const first = new Vector3(),
    second = new Vector3(),
    cross = new Vector3();
  for (let i = 0; i < position.count; i += 3) {
    vertices.forEach((vertex, j) => vertex.fromBufferAttribute(position, i + j));
    first.subVectors(vertices[1], vertices[0]);
    second.subVectors(vertices[2], vertices[0]);
    cross.crossVectors(first, second).normalize();
    cross.toArray(faceNormals, i);
    if (cross.z < -1 + 1e-10 && vertices.every((vertex) => Math.abs(vertex.z - soleZ) < 1e-6))
      soleFaces.add(i);
    vertices.forEach((vertex, j) => {
      first.subVectors(vertices[(j + 1) % 3], vertex);
      second.subVectors(vertices[(j + 2) % 3], vertex);
      cornerAngles[i + j] = Math.atan2(
        cross.crossVectors(first, second).length(),
        first.dot(second),
      );
      // Match the precision of the conformed print mesh without joining nearby corners.
      const key = vertex
        .toArray()
        .map((value) => Math.round(value * 1e5))
        .join(',');
      vertexKeys[i + j] = key;
      const corners = shared.get(key);
      if (corners) corners.push(i + j);
      else shared.set(key, [i + j]);
    });
  }
  const normals = new Float32Array(position.count * 3);
  const face = new Vector3(),
    adjacent = new Vector3(),
    sum = new Vector3();
  const creaseDot = Math.cos(Math.PI / 6);
  // A tangent bottom round must meet its planar sole with the sole normal.
  // Otherwise small rim tilts interpolate across the large cap triangles.
  // The first resampled corner facets reach 7.93°; steeper bevels and the
  // existing 30° hard creases keep their original angle-weighted treatment.
  const tangentDot = Math.cos((8 * Math.PI) / 180);
  const soleTangents = new Set<string>();
  for (const [key, corners] of shared) {
    if (!corners.some((corner) => soleFaces.has(corner - (corner % 3)))) continue;
    if (
      corners.every((corner) => {
        const dot = -faceNormals[corner - (corner % 3) + 2];
        return dot <= creaseDot || dot >= tangentDot;
      })
    )
      soleTangents.add(key);
  }
  for (let i = 0; i < position.count; i += 3) {
    face.fromArray(faceNormals, i);
    for (let j = 0; j < 3; j++) {
      if (soleTangents.has(vertexKeys[i + j]) && -face.z >= tangentDot) {
        normals.set([0, 0, -1], (i + j) * 3);
        continue;
      }
      sum.set(0, 0, 0);
      for (const corner of shared.get(vertexKeys[i + j])!) {
        adjacent.fromArray(faceNormals, corner - (corner % 3));
        if (face.dot(adjacent) > creaseDot) sum.addScaledVector(adjacent, cornerAngles[corner]);
      }
      if (sum.lengthSq() > 1e-20) sum.normalize();
      else sum.copy(face);
      sum.toArray(normals, (i + j) * 3);
    }
  }
  result.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  return result;
}

/** Apply the enclosure's matte PETG finish to its printed preview occurrences. */
export function previewGeometry(pieces: readonly ConfiguredPiece[]): Group {
  const group = componentGeometry(libraries, pieces);
  pieces.forEach((piece, index) => {
    const component = piece.component;
    if (
      component.libraryId !== 'manufactured-detail' ||
      !printedIds.has(component.id) ||
      !component.manufacturing?.processes.includes('printing')
    )
      return;
    group.children[index].traverse((object) => {
      if (!(object instanceof Mesh)) return;
      // Preserve the well and guide edges while smoothing the curved PETG surfaces.
      const geometry = object.geometry;
      object.geometry = printedCreasedNormals(geometry, component.id === 'base');
      if (object.geometry !== geometry) geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        material.metalness = 0;
        material.roughness = 0.82;
      }
    });
  });
  return group;
}

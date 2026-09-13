import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ParameterDefinition, Parameters } from './types';

export const STEEL = 0x85898e;
export const DARK_STEEL = 0x4c5158;
export const ACCENT = 0x316ce8;
export type Color = number | string;

export function material(color: Color = STEEL): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.68, roughness: 0.28 });
}

export function cylinder(radius: number, height: number, color: Color = STEEL): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(radius, radius, height, 72);
  geometry.rotateX(Math.PI / 2);
  return new THREE.Mesh(geometry, material(color));
}

export function ring(
  outerRadius: number,
  innerRadius: number,
  height: number,
  color: Color = STEEL,
): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return extrude(shape, height, color);
}

export function extrude(shape: THREE.Shape, height: number, color: Color = STEEL): THREE.Mesh {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 64,
  });
  geometry.translate(0, 0, -height / 2);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material(color));
}

export function box(
  width: number,
  depth: number,
  height: number,
  color: Color = STEEL,
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(width, depth, height), material(color));
}

export function sphere(radius: number, color: Color = STEEL): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24), material(color));
}

export function helix(
  radius: number,
  wireRadius: number,
  height: number,
  turns: number,
  color: Color = STEEL,
  startAngle = 0,
): THREE.Mesh {
  class HelixCurve extends THREE.Curve<THREE.Vector3> {
    constructor() {
      super();
    }
    getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
      const angle = startAngle + t * turns * Math.PI * 2;
      return target.set(radius * Math.cos(angle), radius * Math.sin(angle), (t - 0.5) * height);
    }
  }
  const curve = new HelixCurve();
  const segmentCount = Math.max(80, Math.ceil(turns * 64));
  const tube = new THREE.TubeGeometry(curve, segmentCount, wireRadius, 12, false);
  const caps = [0, 1].map((end) => {
    const center = curve.getPoint(end);
    const normal = curve.getTangent(end).multiplyScalar(end === 0 ? -1 : 1);
    const positions = [center.x, center.y, center.z];
    const normals = [normal.x, normal.y, normal.z];
    const uvs = [0.5, 0.5];
    const source = tube.getAttribute('position');
    const start = end * segmentCount * 13;
    for (let i = 0; i <= 12; i++) {
      positions.push(source.getX(start + i), source.getY(start + i), source.getZ(start + i));
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(0, 0);
    }
    const indices: number[] = [];
    const a = new THREE.Vector3(),
      b = new THREE.Vector3();
    for (let i = 1; i <= 12; i++) {
      a.fromArray(positions, i * 3).sub(center);
      b.fromArray(positions, (i + 1) * 3).sub(center);
      if (a.cross(b).dot(normal) > 0) indices.push(0, i, i + 1);
      else indices.push(0, i + 1, i);
    }
    const cap = new THREE.BufferGeometry();
    cap.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    cap.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    cap.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    cap.setIndex(indices);
    return cap;
  });
  const geometry = mergeGeometries([tube, ...caps]);
  tube.dispose();
  caps.forEach((cap) => cap.dispose());
  return new THREE.Mesh(geometry, material(color));
}

export function n(parameters: Parameters, key: string): number {
  const value = Number(parameters[key]);
  if (!Number.isFinite(value)) throw new Error(`${key} must be a finite number.`);
  return value;
}

export function num(value: number): string {
  if (!Number.isFinite(value)) throw new Error('CAD parameters must be finite numbers.');
  return Number(value.toPrecision(12)).toString();
}

export function numberParameter(
  key: string,
  label: string,
  symbol: string,
  group: string,
  min: number,
  max: number,
  step = 0.1,
): ParameterDefinition {
  return { key, label, symbol, group, type: 'number', unit: 'mm', min, max, step };
}

export function compoundPython(expressions: string[]): string {
  return `shape = Part.makeCompound([\n    ${expressions.join(',\n    ')}\n])`;
}

export function annulusPython(
  outerRadius: number,
  innerRadius: number,
  height: number,
  z = -height / 2,
): string {
  return `Part.makeCylinder(${num(outerRadius)}, ${num(height)}, App.Vector(0, 0, ${num(z)})).cut(Part.makeCylinder(${num(innerRadius)}, ${num(height + 2)}, App.Vector(0, 0, ${num(z - 1)})))`;
}

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BoxGeometry,
  DoubleSide,
  EdgesGeometry,
  FrontSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import {
  disposeObject,
  releaseModelPresentation,
  type MaterialAppearance,
} from '../src/components/viewer/model-resources';

test('cached preview models retain their source appearance and avoid accumulating edge objects', () => {
  const geometry = new BoxGeometry();
  const material = new MeshStandardMaterial({ opacity: 0.8, transparent: true, side: FrontSide });
  const mesh = new Mesh(geometry, material);
  const sourceLine = new LineSegments(new EdgesGeometry(geometry), new LineBasicMaterial());
  mesh.add(sourceLine);
  const model = new Group().add(mesh);
  let releasedEdges = 0;
  let releasedEdgeMaterials = 0;
  for (let reuse = 0; reuse < 3; reuse++) {
    const original: MaterialAppearance = {
      material,
      opacity: material.opacity,
      transparent: material.transparent,
      depthWrite: material.depthWrite,
      side: material.side,
      wireframe: material.wireframe,
    };
    const edge = new LineSegments(new EdgesGeometry(geometry), new LineBasicMaterial());
    edge.geometry.addEventListener('dispose', () => releasedEdges++);
    edge.material.addEventListener('dispose', () => releasedEdgeMaterials++);
    mesh.add(edge);
    const presentation = {
      edges: [edge],
      appearances: [original],
      componentMeshes: [{ mesh, visible: mesh.visible }],
    };
    material.opacity = 0.23;
    material.transparent = true;
    material.depthWrite = false;
    material.side = DoubleSide;
    material.wireframe = true;
    mesh.visible = false;
    releaseModelPresentation(presentation);
    assert.deepEqual(
      mesh.children,
      [sourceLine],
      'authored lines remain; viewer edges are removed',
    );
    assert.equal(material.opacity, 0.8);
    assert.equal(material.transparent, true);
    assert.equal(material.depthWrite, true);
    assert.equal(material.side, FrontSide);
    assert.equal(material.wireframe, false);
    assert.equal(mesh.visible, true);
    assert.deepEqual(presentation, { edges: [], appearances: [], componentMeshes: [] });
    releaseModelPresentation(presentation);
  }
  assert.equal(releasedEdges, 3, 'each presentation is released once');
  assert.equal(releasedEdgeMaterials, 3);
  disposeObject(model);
});

test('shared model and edge geometries are disposed only once per lifetime', () => {
  const geometry = new BoxGeometry();
  const material = new MeshStandardMaterial();
  const edgeGeometry = new EdgesGeometry(geometry);
  const edgeMaterial = new LineBasicMaterial();
  const first = new Mesh(geometry, [material, material]);
  const second = new Mesh(geometry, material);
  const edges = [
    new LineSegments(edgeGeometry, edgeMaterial),
    new LineSegments(edgeGeometry, edgeMaterial),
  ];
  first.add(edges[0]);
  second.add(edges[1]);
  const model = new Group().add(first, second);
  const disposals = { geometry: 0, material: 0, edgeGeometry: 0, edgeMaterial: 0 };
  geometry.addEventListener('dispose', () => disposals.geometry++);
  material.addEventListener('dispose', () => disposals.material++);
  edgeGeometry.addEventListener('dispose', () => disposals.edgeGeometry++);
  edgeMaterial.addEventListener('dispose', () => disposals.edgeMaterial++);
  releaseModelPresentation({ edges, appearances: [], componentMeshes: [] });
  disposeObject(model);
  assert.deepEqual(disposals, { geometry: 1, material: 1, edgeGeometry: 1, edgeMaterial: 1 });
});

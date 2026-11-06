import { useEffect, useRef, useState } from 'react';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  Box3Helper,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  OrthographicCamera,
  PCFShadowMap,
  PlaneGeometry,
  PMREMGenerator,
  Raycaster,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Parameters, PartDefinition } from '../core/types';
import './viewer/viewer.css';
import { withGeometryMode, type GeometryMode } from '../core/geometry-mode';
import { modelComponentMetadata } from '../core/mesh-transfer';
import { ViewerCameraControls } from './viewer/camera-controls';
import {
  animatePresetCameraView,
  cameraViewUp,
  setPresetCameraView,
  type CameraView,
} from './viewer/camera-views';
import { capturePreviewImage, copyPreviewImage } from './viewer/preview-image';
import { PreviewGrid } from './viewer/preview-grid';
import {
  disposeObject,
  releaseModelPresentation,
  type MaterialAppearance,
} from './viewer/model-resources';
import NavigationCube, { type NavigationCubeHandle } from './viewer/NavigationCube';
import PreviewControls, {
  type DisplayMode,
  type PreviewBackgroundMode,
  type ImageCopyState,
} from './viewer/PreviewControls';

export type NavigationMode = 'orbit' | 'pan';

interface ModelViewerProps {
  preparedModel?: Group | null;
  preparedDimensions?: [number, number, number];
  pending?: boolean;
  loadError?: string;
  part: PartDefinition;
  parameters: Parameters;
  modelState: string;
  geometryMode: GeometryMode;
  onGeometryModeChange: (mode: GeometryMode) => void;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  navigationMode: NavigationMode;
  backgroundMode: PreviewBackgroundMode;
  onBackgroundModeChange: (mode: PreviewBackgroundMode) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showDimensions: boolean;
  onToggleDimensions: () => void;
  expanded: boolean;
  onToggleFullscreen: () => void;
  view: CameraView;
  fitToken: number;
  selectedComponentId?: string | null;
  hiddenComponentIds?: readonly string[];
  onSelectComponent?: (id: string | null) => void;
  onError?: (message: string) => void;
  onViewChange?: (view: CameraView) => void;
  onNavigationModeChange: (mode: NavigationMode) => void;
}

interface DimensionLabel {
  element: HTMLDivElement;
  position: Vector3;
  from: Vector3;
  to: Vector3;
  guide: LineSegments;
}

interface ViewerRuntime {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: OrthographicCamera;
  controls: ViewerCameraControls;
  stage: Group;
  grid: PreviewGrid;
  shadow: Mesh;
  keyLight: DirectionalLight;
  model: Group | null;
  edges: LineSegments[];
  appearances: MaterialAppearance[];
  componentMeshes: { mesh: Mesh; occurrenceId?: string; visible: boolean }[];
  selection: Box3Helper;
  dimensionGroup: Group;
  dimensionLabels: DimensionLabel[];
  labelLayer: HTMLDivElement;
  extent: number;
  target: Vector3;
  currentPart: string;
  dimensionsVisible: boolean;
  backgroundMode: 'dark' | 'light';
  width: number;
  height: number;
  requestRender: () => void;
  fit: (view?: CameraView, animated?: boolean) => void;
}

function objectVisible(object: Object3D): boolean {
  for (let current: Object3D | null = object; current; current = current.parent)
    if (!current.visible) return false;
  return true;
}

function updateComponents(
  runtime: ViewerRuntime,
  selectedId: string | null | undefined,
  hiddenIds: readonly string[] | undefined,
) {
  const hidden = new Set(hiddenIds);
  const bounds = runtime.selection.box.makeEmpty();
  runtime.model?.updateMatrixWorld(true);
  runtime.componentMeshes.forEach(({ mesh, occurrenceId, visible }) => {
    const nextVisible = visible && (!occurrenceId || !hidden.has(occurrenceId));
    if (mesh.visible !== nextVisible) {
      mesh.visible = nextVisible;
      runtime.renderer.shadowMap.needsUpdate = true;
    }
    if (!selectedId || occurrenceId !== selectedId || !objectVisible(mesh)) return;
    mesh.geometry.computeBoundingBox();
    if (mesh.geometry.boundingBox)
      bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
  });
  runtime.selection.visible = !bounds.isEmpty();
  if (runtime.selection.visible) bounds.expandByScalar(runtime.extent * 0.0015);
  runtime.requestRender();
}

function applyDisplayMode(runtime: ViewerRuntime, mode: DisplayMode) {
  runtime.appearances.forEach(({ material, ...original }) => {
    material.opacity = mode === 'xray' ? 0.23 : original.opacity;
    material.transparent = mode === 'xray' || original.transparent;
    material.depthWrite = mode === 'xray' ? false : original.depthWrite;
    material.side = mode === 'xray' ? DoubleSide : original.side;
    if ('wireframe' in material) material.wireframe = mode === 'wireframe' || original.wireframe;
    material.needsUpdate = true;
  });
  runtime.edges.forEach((edge) => {
    edge.visible = mode === 'solid';
  });
  runtime.shadow.visible = mode === 'solid';
  runtime.renderer.shadowMap.needsUpdate = true;
  runtime.requestRender();
}

function applyBackgroundMode(runtime: ViewerRuntime, mode: 'dark' | 'light') {
  runtime.backgroundMode = mode;
  (runtime.grid.material as Material).opacity = mode === 'light' ? 0.5 : 0.36;
  (runtime.selection.material as LineBasicMaterial).color.setHex(
    mode === 'light' ? 0x9b5a12 : 0xe4ad6b,
  );
  runtime.dimensionGroup.traverse((object) => {
    if (!(object instanceof LineSegments)) return;
    (object.material as LineBasicMaterial).color.setHex(mode === 'light' ? 0x536375 : 0x8997aa);
  });
  runtime.requestRender();
}

function updateDimensions(
  runtime: ViewerRuntime,
  bounds: Box3,
  dimensions: [number, number, number],
) {
  disposeObject(runtime.dimensionGroup);
  runtime.dimensionGroup.clear();
  runtime.dimensionLabels.forEach(({ element }) => element.remove());
  runtime.dimensionLabels = [];

  const { min, max } = bounds;
  const offset = runtime.extent * 0.14;
  const tick = runtime.extent * 0.018;
  const material = new LineBasicMaterial({
    color: runtime.backgroundMode === 'light' ? 0x536375 : 0x8997aa,
    transparent: true,
    opacity: 0.65,
    depthTest: false,
  });
  const dimension = (
    from: Vector3,
    to: Vector3,
    first: Vector3,
    last: Vector3,
    value: number,
    axis: string,
    tickDirection: Vector3,
  ) => {
    const guides: number[] = [];
    const segment = (a: Vector3, b: Vector3) => {
      guides.push(...a.toArray(), ...b.toArray());
    };
    segment(from, to);
    segment(
      first,
      from.clone().add(
        from
          .clone()
          .sub(first)
          .normalize()
          .multiplyScalar(tick * 2),
      ),
    );
    segment(
      last,
      to.clone().add(
        to
          .clone()
          .sub(last)
          .normalize()
          .multiplyScalar(tick * 2),
      ),
    );
    segment(from.clone().sub(tickDirection), from.clone().add(tickDirection));
    segment(to.clone().sub(tickDirection), to.clone().add(tickDirection));
    const element = document.createElement('div');
    element.className = 'model-viewer__dimension';
    element.textContent = `${Number(value.toFixed(2))} mm`;
    element.title = `${axis} dimension: ${Number(value.toFixed(2))} millimeters`;
    runtime.labelLayer.append(element);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(guides, 3));
    const guide = new LineSegments(geometry, material);
    guide.renderOrder = 5;
    runtime.dimensionGroup.add(guide);
    runtime.dimensionLabels.push({
      element,
      position: from.clone().lerp(to, 0.5),
      from,
      to,
      guide,
    });
  };

  dimension(
    new Vector3(min.x, min.y, max.z + offset),
    new Vector3(max.x, min.y, max.z + offset),
    new Vector3(min.x, min.y, max.z),
    new Vector3(max.x, min.y, max.z),
    dimensions[0],
    'Width',
    new Vector3(0, 0, tick),
  );
  dimension(
    new Vector3(max.x + offset, min.y, min.z),
    new Vector3(max.x + offset, min.y, max.z),
    new Vector3(max.x, min.y, min.z),
    new Vector3(max.x, min.y, max.z),
    dimensions[1],
    'Depth',
    new Vector3(tick, 0, 0),
  );
  dimension(
    new Vector3(min.x - offset, min.y, min.z),
    new Vector3(min.x - offset, max.y, min.z),
    new Vector3(min.x, min.y, min.z),
    new Vector3(min.x, max.y, min.z),
    dimensions[2],
    'Height',
    new Vector3(tick, 0, 0),
  );

  runtime.dimensionGroup.visible = runtime.dimensionsVisible;
}

function viewTransitionDuration() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350;
}

function setCameraView(
  runtime: ViewerRuntime,
  view: CameraView,
  fitToModel = false,
  animated = false,
) {
  const distance = fitToModel
    ? runtime.extent * 4
    : runtime.camera.position.distanceTo(runtime.controls.target);
  const target = fitToModel ? runtime.target : runtime.controls.target;
  if (animated)
    animatePresetCameraView(runtime.controls, view, distance, target, viewTransitionDuration());
  else setPresetCameraView(runtime.controls, view, distance, target);
  runtime.requestRender();
}

export default function ModelViewer({
  preparedModel,
  preparedDimensions,
  pending,
  loadError,
  part,
  parameters,
  modelState,
  geometryMode,
  onGeometryModeChange,
  displayMode,
  onDisplayModeChange,
  navigationMode,
  backgroundMode,
  onBackgroundModeChange,
  showGrid,
  onToggleGrid,
  showDimensions,
  onToggleDimensions,
  expanded,
  onToggleFullscreen,
  view,
  fitToken,
  selectedComponentId,
  hiddenComponentIds,
  onSelectComponent,
  onError,
  onViewChange,
  onNavigationModeChange,
}: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);
  const navigationCubeRef = useRef<NavigationCubeHandle>(null);
  const runtimeRef = useRef<ViewerRuntime | null>(null);
  const onErrorRef = useRef(onError);
  const currentViewRef = useRef(view);
  const handledViewRef = useRef(view);
  const displayModeRef = useRef(displayMode);
  const onNavigationModeChangeRef = useRef(onNavigationModeChange);
  const onSelectComponentRef = useRef(onSelectComponent);
  const selectedComponentIdRef = useRef(selectedComponentId);
  const hiddenComponentIdsRef = useRef(hiddenComponentIds);
  const [error, setError] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [imageCopyState, setImageCopyState] = useState<ImageCopyState>('idle');
  const [imageCopyMessage, setImageCopyMessage] = useState('');
  const copyingImageRef = useRef(false);
  onErrorRef.current = onError;
  currentViewRef.current = view;
  displayModeRef.current = displayMode;
  onNavigationModeChangeRef.current = onNavigationModeChange;
  onSelectComponentRef.current = onSelectComponent;
  selectedComponentIdRef.current = selectedComponentId;
  hiddenComponentIdsRef.current = hiddenComponentIds;

  useEffect(() => {
    if (imageCopyState !== 'copied' && imageCopyState !== 'error') return;
    const timeout = window.setTimeout(() => setImageCopyState('idle'), 4500);
    return () => window.clearTimeout(timeout);
  }, [imageCopyState]);

  useEffect(() => {
    const container = containerRef.current;
    const labelLayer = labelLayerRef.current;
    if (!container || !labelLayer) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      const message =
        'The 3D preview needs WebGL. Enable hardware acceleration or try another browser. You can still configure and export your part.';
      setError(message);
      onErrorRef.current?.(message);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    // Camera motion does not change the shadow cast by the fixed model and light.
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = 'model-viewer__canvas';
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.tabIndex = 0;
    container.prepend(renderer.domElement);

    const scene = new Scene();
    const camera = new OrthographicCamera(-50, 50, 50, -50, 0.01, 20000);
    camera.position.set(100, 90, 120);
    const controls = new ViewerCameraControls(camera, renderer.domElement);
    const stage = new Group();
    scene.add(stage);

    let environment: WebGLRenderTarget | undefined;
    const pmrem = new PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    try {
      environment = pmrem.fromScene(room, 0.04);
      scene.environment = environment.texture;
      scene.environmentIntensity = 0.7;
    } catch {
      // Direct lights keep the preview usable if environment rendering is unsupported.
      scene.environment = null;
    } finally {
      room.dispose();
      pmrem.dispose();
    }

    scene.add(new AmbientLight(0xc4cfdc, 0.45));
    scene.add(new HemisphereLight(0xe3edff, 0x34323a, 1.9));
    const keyLight = new DirectionalLight(0xf8f4ed, 4.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.bias = -0.0003;
    keyLight.shadow.normalBias = 0.1;
    keyLight.shadow.radius = 4;
    scene.add(keyLight, keyLight.target);
    const rimLight = new DirectionalLight(0xc0d3ff, 2.2);
    rimLight.position.set(-70, 30, -90);
    scene.add(rimLight);
    const warmLight = new DirectionalLight(0xffd2a7, 1.2);
    warmLight.position.set(60, 10, -20);
    scene.add(warmLight);

    const grid = new PreviewGrid();
    const gridMaterial = grid.material as Material;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.36;
    gridMaterial.depthWrite = false;
    scene.add(grid);
    const shadow = new Mesh(new PlaneGeometry(1, 1), new ShadowMaterial({ opacity: 0.24 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.receiveShadow = true;
    scene.add(shadow);
    const dimensionGroup = new Group();
    scene.add(dimensionGroup);
    const selection = new Box3Helper(new Box3(), 0xe4ad6b);
    const selectionMaterial = selection.material as LineBasicMaterial;
    selectionMaterial.transparent = true;
    selectionMaterial.opacity = 0.8;
    selectionMaterial.depthTest = false;
    selectionMaterial.depthWrite = false;
    selection.renderOrder = 4;
    selection.visible = false;
    scene.add(selection);

    let frame = 0;
    let disposed = false;
    const projected = new Vector3();
    const projectedFrom = new Vector3();
    const projectedTo = new Vector3();
    const runtime: ViewerRuntime = {
      renderer,
      scene,
      camera,
      controls,
      stage,
      grid,
      shadow,
      keyLight,
      model: null,
      edges: [],
      appearances: [],
      componentMeshes: [],
      selection,
      dimensionGroup,
      dimensionLabels: [],
      labelLayer,
      extent: 50,
      target: new Vector3(),
      currentPart: '',
      dimensionsVisible: false,
      backgroundMode: 'dark',
      width: 1,
      height: 1,
      requestRender: () => {
        if (disposed || frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (disposed) return;
          controls.update();
          camera.updateMatrixWorld();
          navigationCubeRef.current?.update(camera.quaternion);
          runtime.dimensionLabels.forEach(({ element, position, from, to, guide }) => {
            projected.copy(position).project(camera);
            projectedFrom.copy(from).project(camera);
            projectedTo.copy(to).project(camera);
            const projectedLength = Math.hypot(
              (projectedTo.x - projectedFrom.x) * runtime.width * 0.5,
              (projectedTo.y - projectedFrom.y) * runtime.height * 0.5,
            );
            const visible =
              runtime.dimensionsVisible &&
              projected.z > -1 &&
              projected.z < 1 &&
              projectedLength >= 16;
            guide.visible = visible;
            element.style.display = visible ? '' : 'none';
            element.style.left = `${(projected.x * 0.5 + 0.5) * runtime.width}px`;
            element.style.top = `${(-projected.y * 0.5 + 0.5) * runtime.height}px`;
          });
          renderer.render(scene, camera);
        });
      },
      fit: (cameraView, animated = false) => {
        const aspect = runtime.width / runtime.height;
        const halfHeight = runtime.extent * 0.74 * Math.max(1, 1 / aspect);
        camera.left = -halfHeight * aspect;
        camera.right = halfHeight * aspect;
        camera.top = halfHeight;
        camera.bottom = -halfHeight;
        camera.zoom = 1;
        camera.near = Math.max(0.001, runtime.extent * 0.001);
        camera.far = runtime.extent * 100;
        camera.updateProjectionMatrix();
        if (cameraView) setCameraView(runtime, cameraView, true, animated);
        else {
          controls.cancelMotion();
          const direction = camera.position.clone().sub(controls.target).normalize();
          controls.target.copy(runtime.target);
          camera.position.copy(runtime.target).addScaledVector(direction, runtime.extent * 4);
          controls.update();
        }
        runtime.requestRender();
      },
    };
    runtimeRef.current = runtime;
    controls.addEventListener('change', runtime.requestRender);
    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const previousAspect = runtime.width / runtime.height;
      runtime.width = width;
      runtime.height = height;
      renderer.setSize(width, height, false);
      controls.handleResize();
      // Preserve zoom and orbit while retaining the model when the viewport narrows.
      const aspect = width / height;
      const halfHeight = (camera.top * Math.max(1, 1 / aspect)) / Math.max(1, 1 / previousAspect);
      camera.left = (-halfHeight * width) / height;
      camera.right = (halfHeight * width) / height;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      if (previousAspect === 1 && !runtime.currentPart) runtime.fit(currentViewRef.current);
      camera.updateProjectionMatrix();
      runtime.requestRender();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setError(
        'The 3D preview was interrupted. Reload the page to restore it. Your part can still be configured and exported.',
      );
    };
    const handleDoubleClick = () => runtime.fit();
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    let clickStart: { id: number; x: number; y: number } | null = null;
    const activePointers = new Set<number>();
    const handlePointerDown = (event: PointerEvent) => {
      activePointers.add(event.pointerId);
      clickStart =
        event.button === 0 && activePointers.size === 1
          ? { id: event.pointerId, x: event.clientX, y: event.clientY }
          : null;
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (
        clickStart?.id === event.pointerId &&
        Math.hypot(event.clientX - clickStart.x, event.clientY - clickStart.y) > 4
      )
        clickStart = null;
    };
    const handlePointerCancel = (event: PointerEvent) => {
      activePointers.delete(event.pointerId);
      clickStart = null;
    };
    const handlePointerUp = (event: PointerEvent) => {
      const start = clickStart;
      clickStart = null;
      activePointers.delete(event.pointerId);
      if (
        !onSelectComponentRef.current ||
        start?.id !== event.pointerId ||
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4 ||
        !runtime.componentMeshes.some(({ occurrenceId }) => occurrenceId)
      )
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      if (Math.abs(pointer.x) > 1 || Math.abs(pointer.y) > 1) return;
      camera.updateMatrixWorld();
      raycaster.setFromCamera(pointer, camera);
      const surfaces = runtime.componentMeshes.filter(({ mesh }) => objectVisible(mesh));
      const hit = raycaster.intersectObjects(
        surfaces.map(({ mesh }) => mesh),
        false,
      )[0];
      const occurrenceId = hit && surfaces.find(({ mesh }) => mesh === hit.object)?.occurrenceId;
      onSelectComponentRef.current(occurrenceId ?? null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.toLowerCase() === 'p' || event.key.toLowerCase() === 'o') {
        event.preventDefault();
        onNavigationModeChangeRef.current(event.key.toLowerCase() === 'p' ? 'pan' : 'orbit');
      }
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        runtime.fit();
      }
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('dblclick', handleDoubleClick);
    renderer.domElement.addEventListener('keydown', handleKeyDown);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.removeEventListener('change', runtime.requestRender);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('dblclick', handleDoubleClick);
      renderer.domElement.removeEventListener('keydown', handleKeyDown);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointercancel', handlePointerCancel);
      runtime.dimensionLabels.forEach(({ element }) => element.remove());
      releaseModelPresentation(runtime);
      disposeObject(scene);
      keyLight.shadow.dispose();
      environment?.dispose();
      scene.environment = null;
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    setPreviewReady(false);
    setImageCopyState('idle');
    let model: Group | null = null;
    try {
      const issues = part.validate(parameters, modelState);
      if (issues.length) throw new Error(issues[0]);
      if (loadError) throw new Error(loadError);
      if (preparedModel === null) return;
      model =
        preparedModel ??
        withGeometryMode(geometryMode, () => part.buildGeometry(parameters, modelState));
      const displayRoot = new Group();
      // FreeCAD models stay in native Z-up coordinates. Only the preview rotates them.
      displayRoot.rotation.x = -Math.PI / 2;
      displayRoot.add(model);
      displayRoot.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(displayRoot, true);
      if (bounds.isEmpty()) throw new Error('This configuration produced an empty model.');
      const size = bounds.getSize(new Vector3());
      const extent = Math.max(size.x, size.y, size.z);
      if (!Number.isFinite(extent) || extent <= 0)
        throw new Error('The model dimensions must be positive and finite.');
      const center = bounds.getCenter(new Vector3());
      displayRoot.position.set(-center.x, -bounds.min.y, -center.z);
      displayRoot.updateMatrixWorld(true);
      const worldBounds = bounds.translate(displayRoot.position);

      releaseModelPresentation(runtime);
      if (runtime.model) {
        runtime.stage.remove(runtime.model);
        disposeObject(runtime.model);
      }
      runtime.model = displayRoot;
      runtime.stage.add(displayRoot);
      const materialSet = new Set<Material>();
      const meshes: Mesh[] = [];
      displayRoot.traverse((child) => {
        if (child instanceof Mesh) meshes.push(child);
      });
      runtime.componentMeshes = meshes.map((mesh) => ({
        mesh,
        occurrenceId: modelComponentMetadata(mesh).occurrenceId,
        visible: mesh.visible,
      }));
      const triangleCount = meshes.reduce(
        (n, m) => n + (m.geometry.index?.count ?? m.geometry.getAttribute('position').count) / 3,
        0,
      );
      const detailedEdges = triangleCount < 300000;
      const edgeGeometries = new Map<BufferGeometry, EdgesGeometry>();
      meshes.forEach((mesh) => {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => {
          if (materialSet.has(material)) return;
          materialSet.add(material);
          if (material instanceof MeshStandardMaterial) material.envMapIntensity = 1;
          runtime.appearances.push({
            material,
            opacity: material.opacity,
            transparent: material.transparent,
            depthWrite: material.depthWrite,
            side: material.side,
            wireframe: 'wireframe' in material ? Boolean(material.wireframe) : undefined,
          });
        });
        if (!detailedEdges) return;
        if (!edgeGeometries.has(mesh.geometry))
          edgeGeometries.set(mesh.geometry, new EdgesGeometry(mesh.geometry, 35));
        const edges = new LineSegments(
          edgeGeometries.get(mesh.geometry)!,
          new LineBasicMaterial({
            color: new Color(0x111820),
            transparent: true,
            opacity: 0.23,
            depthWrite: false,
          }),
        );
        mesh.add(edges);
        runtime.edges.push(edges);
      });

      const previousExtent = runtime.extent;
      runtime.controls.cancelMotion();
      runtime.extent = extent;
      const previousTarget = runtime.target.clone();
      runtime.target.copy(worldBounds.getCenter(new Vector3()));
      const targetDelta = runtime.target.clone().sub(previousTarget);
      runtime.controls.target.add(targetDelta);
      runtime.camera.position.add(targetDelta);
      runtime.grid.setExtent(extent);
      runtime.grid.position.y = -extent * 0.004;
      runtime.shadow.scale.set(extent * 5, extent * 5, 1);
      runtime.shadow.position.y = -extent * 0.006;
      runtime.keyLight.position.set(extent * 1.2, extent * 2, extent * 1.1);
      runtime.keyLight.target.position.copy(runtime.target);
      Object.assign(runtime.keyLight.shadow.camera, {
        left: -extent * 1.5,
        right: extent * 1.5,
        top: extent * 1.5,
        bottom: -extent * 1.5,
        near: extent * 0.01,
        far: extent * 6,
      });
      runtime.keyLight.shadow.camera.updateProjectionMatrix();
      runtime.keyLight.shadow.normalBias = extent * 0.001;
      updateDimensions(
        runtime,
        worldBounds,
        preparedDimensions ??
          withGeometryMode(geometryMode, () => part.dimensions(parameters, modelState)),
      );
      applyDisplayMode(runtime, displayModeRef.current);
      if (runtime.currentPart !== part.id) runtime.fit(currentViewRef.current);
      else if (extent / previousExtent > 1.6 || extent / previousExtent < 0.6) runtime.fit();
      runtime.currentPart = part.id;
      updateComponents(runtime, selectedComponentIdRef.current, hiddenComponentIdsRef.current);
      runtime.requestRender();
      setError(null);
      setPreviewReady(true);
      onErrorRef.current?.('');
    } catch (cause) {
      if (model && model.parent !== runtime.model) disposeObject(model);
      const message =
        cause instanceof Error
          ? cause.message
          : 'This model could not be generated. Check the parameters and try again.';
      setError(message);
      onErrorRef.current?.(message);
    }
  }, [part, parameters, modelState, geometryMode, preparedModel, loadError]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime) applyDisplayMode(runtime, displayMode);
  }, [displayMode]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime) updateComponents(runtime, selectedComponentId, hiddenComponentIds);
  }, [selectedComponentId, hiddenComponentIds]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.controls.setNavigationMode(navigationMode);
    runtime.renderer.domElement.setAttribute(
      'aria-label',
      `Interactive 3D part preview. Drag to ${navigationMode === 'pan' ? 'pan' : 'rotate'}, scroll to zoom, and right-drag to pan. P: pan, O: orbit, F: fit.`,
    );
  }, [navigationMode]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime) applyBackgroundMode(runtime, backgroundMode);
  }, [backgroundMode]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.grid.visible = showGrid;
    runtime.requestRender();
  }, [showGrid]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.dimensionsVisible = showDimensions;
    runtime.dimensionGroup.visible = showDimensions;
    runtime.requestRender();
  }, [showDimensions]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime && handledViewRef.current !== view) {
      handledViewRef.current = view;
      setCameraView(runtime, view, false, true);
    }
  }, [view]);

  useEffect(() => {
    runtimeRef.current?.fit();
  }, [fitToken]);

  const chooseAxisView = (nextView: CameraView) => {
    const runtime = runtimeRef.current;
    handledViewRef.current = nextView;
    if (runtime) setCameraView(runtime, nextView, false, true);
    onViewChange?.(nextView);
  };

  const chooseDirection = (direction: Vector3) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.controls.animateToDirection(
      direction,
      cameraViewUp(direction, runtime.camera.quaternion),
      runtime.camera.position.distanceTo(runtime.controls.target),
      runtime.controls.target,
      viewTransitionDuration(),
    );
    runtime.requestRender();
  };

  const homeView = () => {
    handledViewRef.current = 'isometric';
    runtimeRef.current?.fit('isometric', true);
    onViewChange?.('isometric');
  };

  const copyImage = async () => {
    const runtime = runtimeRef.current;
    if (!runtime?.model || !previewReady || pending || error || copyingImageRef.current) return;
    const model = runtime.model;
    copyingImageRef.current = true;
    setImageCopyState('copying');
    setImageCopyMessage('Copying preview image…');
    try {
      await copyPreviewImage(() => {
        if (runtimeRef.current !== runtime || runtime.model !== model)
          throw new Error('The preview changed. Copy the image again.');
        return capturePreviewImage(runtime.renderer, runtime.scene, runtime.camera, {
          width: runtime.width,
          height: runtime.height,
          backgroundMode: runtime.backgroundMode,
          labels: runtime.dimensionsVisible
            ? runtime.dimensionLabels
                .filter(({ guide }) => guide.visible)
                .map(({ element, position }) => ({ text: element.textContent ?? '', position }))
            : [],
        });
      });
      if (runtimeRef.current === runtime && runtime.model === model) {
        setImageCopyState('copied');
        setImageCopyMessage('Preview image copied to clipboard.');
      }
    } catch (cause) {
      if (runtimeRef.current === runtime && runtime.model === model) {
        setImageCopyState('error');
        setImageCopyMessage(
          cause instanceof Error ? cause.message : 'The image could not be copied.',
        );
      }
    } finally {
      copyingImageRef.current = false;
    }
  };

  return (
    <div
      className={`model-viewer model-viewer--${navigationMode} model-viewer--${backgroundMode}`}
      ref={containerRef}
      aria-label={`${part.name} 3D workspace`}
    >
      <div className="model-viewer__labels" ref={labelLayerRef} aria-hidden="true" />
      {imageCopyState !== 'idle' && (
        <div className="model-viewer__capture-status" role="status" aria-live="polite">
          {imageCopyMessage}
        </div>
      )}
      {pending && (
        <div className="model-viewer__error" role="status">
          <strong>Building model…</strong>
          <p>You can continue changing the configuration.</p>
        </div>
      )}
      {!pending && error && (
        <div className="model-viewer__error" role="status">
          <span className="model-viewer__error-icon" aria-hidden="true">
            !
          </span>
          <strong>Preview unavailable</strong>
          <p>{error}</p>
        </div>
      )}
      <PreviewControls
        cube={
          <NavigationCube
            ref={navigationCubeRef}
            onSelectView={chooseAxisView}
            onSelectDirection={chooseDirection}
          />
        }
        displayMode={displayMode}
        geometryMode={geometryMode}
        onGeometryModeChange={onGeometryModeChange}
        onDisplayModeChange={onDisplayModeChange}
        navigationMode={navigationMode}
        onNavigationModeChange={onNavigationModeChange}
        backgroundMode={backgroundMode}
        onBackgroundModeChange={onBackgroundModeChange}
        showGrid={showGrid}
        onToggleGrid={onToggleGrid}
        showDimensions={showDimensions}
        onToggleDimensions={onToggleDimensions}
        expanded={expanded}
        onToggleFullscreen={onToggleFullscreen}
        onHome={homeView}
        onInvert={() => runtimeRef.current?.controls.invertView(viewTransitionDuration())}
        onFit={() => runtimeRef.current?.fit()}
        imageCopyState={imageCopyState}
        imageCopyDisabled={!previewReady || Boolean(pending || error || loadError)}
        onCopyImage={() => void copyImage()}
      />
    </div>
  );
}

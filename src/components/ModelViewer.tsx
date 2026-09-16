import { useEffect, useRef, useState } from 'react';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  GridHelper,
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
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Parameters, PartDefinition } from '../core/types';
import './viewer/viewer.css';

type CameraView = 'isometric' | 'front' | 'top' | 'right';
type DisplayMode = 'solid' | 'wireframe' | 'xray';

interface ModelViewerProps {
  part: PartDefinition;
  parameters: Parameters;
  modelState: string;
  displayMode: DisplayMode;
  showGrid: boolean;
  showDimensions: boolean;
  view: CameraView;
  fitToken: number;
  onError?: (message: string) => void;
  onViewChange?: (view: CameraView) => void;
}

interface MaterialAppearance {
  material: Material;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
  side: Material['side'];
  wireframe?: boolean;
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
  controls: OrbitControls;
  stage: Group;
  grid: GridHelper;
  shadow: Mesh;
  keyLight: DirectionalLight;
  model: Group | null;
  edges: LineSegments[];
  appearances: MaterialAppearance[];
  dimensionGroup: Group;
  dimensionLabels: DimensionLabel[];
  labelLayer: HTMLDivElement;
  extent: number;
  target: Vector3;
  currentPart: string;
  dimensionsVisible: boolean;
  width: number;
  height: number;
  requestRender: () => void;
  fit: (view?: CameraView) => void;
}

function disposeObject(object: Object3D) {
  const materials = new Set<Material>();
  object.traverse((child) => {
    if (child instanceof Mesh || child instanceof LineSegments) {
      child.geometry.dispose();
      const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
      childMaterials.forEach((material) => materials.add(material));
    }
  });
  materials.forEach((material) => material.dispose());
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
    color: 0x8997aa,
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

function setCameraView(runtime: ViewerRuntime, view: CameraView) {
  const direction = {
    isometric: new Vector3(1.2, 1.7, 1.45),
    front: new Vector3(0, 0, 1),
    top: new Vector3(0, 1, 0),
    right: new Vector3(1, 0, 0),
  }[view].normalize();
  // Consume pending orbit inertia before applying an exact orthographic view.
  const damping = runtime.controls.enableDamping;
  runtime.controls.enableDamping = false;
  runtime.controls.update();
  runtime.controls.enableDamping = damping;
  // OrbitControls caches its up-axis transform when constructed.
  runtime.camera.up.set(0, 1, 0);
  runtime.camera.position.copy(runtime.target).addScaledVector(direction, runtime.extent * 4);
  runtime.controls.target.copy(runtime.target);
  runtime.controls.update();
  runtime.requestRender();
}

export default function ModelViewer({
  part,
  parameters,
  modelState,
  displayMode,
  showGrid,
  showDimensions,
  view,
  fitToken,
  onError,
  onViewChange,
}: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<ViewerRuntime | null>(null);
  const onErrorRef = useRef(onError);
  const currentViewRef = useRef(view);
  const displayModeRef = useRef(displayMode);
  const [error, setError] = useState<string | null>(null);
  onErrorRef.current = onError;
  currentViewRef.current = view;
  displayModeRef.current = displayMode;

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
    renderer.shadowMap.type = PCFShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = 'model-viewer__canvas';
    renderer.domElement.setAttribute(
      'aria-label',
      'Interactive 3D part preview. Drag to rotate, scroll to zoom, and right-drag to pan.',
    );
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.tabIndex = 0;
    container.prepend(renderer.domElement);

    const scene = new Scene();
    const camera = new OrthographicCamera(-50, 50, 50, -50, 0.01, 20000);
    camera.position.set(100, 90, 120);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 0.8;
    controls.minZoom = 0.25;
    controls.maxZoom = 15;
    controls.screenSpacePanning = true;
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

    const grid = new GridHelper(1, 40, 0x4c5665, 0x343d4b);
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
      dimensionGroup,
      dimensionLabels: [],
      labelLayer,
      extent: 50,
      target: new Vector3(),
      currentPart: '',
      dimensionsVisible: false,
      width: 1,
      height: 1,
      requestRender: () => {
        if (disposed || frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (disposed) return;
          controls.update();
          camera.updateMatrixWorld();
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
      fit: (cameraView) => {
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
        if (cameraView) setCameraView(runtime, cameraView);
        else {
          const damping = controls.enableDamping;
          controls.enableDamping = false;
          controls.update();
          controls.enableDamping = damping;
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        runtime.fit();
      }
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('dblclick', handleDoubleClick);
    renderer.domElement.addEventListener('keydown', handleKeyDown);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.removeEventListener('change', runtime.requestRender);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('dblclick', handleDoubleClick);
      renderer.domElement.removeEventListener('keydown', handleKeyDown);
      runtime.dimensionLabels.forEach(({ element }) => element.remove());
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
    let model: Group | null = null;
    try {
      const issues = part.validate(parameters, modelState);
      if (issues.length) throw new Error(issues[0]);
      model = part.buildGeometry(parameters, modelState);
      const displayRoot = new Group();
      // FreeCAD models stay in native Z-up coordinates. Only the preview rotates them.
      displayRoot.rotation.x = -Math.PI / 2;
      displayRoot.add(model);
      displayRoot.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(displayRoot);
      if (bounds.isEmpty()) throw new Error('This configuration produced an empty model.');
      const size = bounds.getSize(new Vector3());
      const extent = Math.max(size.x, size.y, size.z);
      if (!Number.isFinite(extent) || extent <= 0)
        throw new Error('The model dimensions must be positive and finite.');
      const center = bounds.getCenter(new Vector3());
      displayRoot.position.set(-center.x, -bounds.min.y, -center.z);
      displayRoot.updateMatrixWorld(true);
      const worldBounds = new Box3().setFromObject(displayRoot);

      if (runtime.model) {
        runtime.stage.remove(runtime.model);
        disposeObject(runtime.model);
      }
      runtime.model = displayRoot;
      runtime.stage.add(displayRoot);
      runtime.edges = [];
      runtime.appearances = [];
      const materialSet = new Set<Material>();
      const meshes: Mesh[] = [];
      displayRoot.traverse((child) => {
        if (child instanceof Mesh) meshes.push(child);
      });
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
      runtime.extent = extent;
      const previousTarget = runtime.target.clone();
      runtime.target.copy(worldBounds.getCenter(new Vector3()));
      const targetDelta = runtime.target.clone().sub(previousTarget);
      runtime.controls.target.add(targetDelta);
      runtime.camera.position.add(targetDelta);
      runtime.grid.scale.setScalar(extent * 5);
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
      updateDimensions(runtime, worldBounds, part.dimensions(parameters, modelState));
      applyDisplayMode(runtime, displayModeRef.current);
      if (runtime.currentPart !== part.id) runtime.fit(currentViewRef.current);
      else if (extent / previousExtent > 1.6 || extent / previousExtent < 0.6) runtime.fit();
      runtime.currentPart = part.id;
      runtime.requestRender();
      setError(null);
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
  }, [part, parameters, modelState]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime) applyDisplayMode(runtime, displayMode);
  }, [displayMode]);

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
    if (runtime) setCameraView(runtime, view);
  }, [view]);

  useEffect(() => {
    runtimeRef.current?.fit();
  }, [fitToken]);

  const chooseAxisView = (nextView: CameraView) => {
    runtimeRef.current?.fit(nextView);
    onViewChange?.(nextView);
  };

  return (
    <div className="model-viewer" ref={containerRef} aria-label={`${part.name} 3D workspace`}>
      <div className="model-viewer__labels" ref={labelLayerRef} aria-hidden="true" />
      {error && (
        <div className="model-viewer__error" role="status">
          <span className="model-viewer__error-icon" aria-hidden="true">
            !
          </span>
          <strong>Preview unavailable</strong>
          <p>{error}</p>
        </div>
      )}
      <div className="model-viewer__axes" aria-label="Quick camera views">
        <svg viewBox="0 0 88 86" aria-hidden="true">
          <path d="M43 48 L43 15" className="model-viewer__axis-line model-viewer__axis-line--z" />
          <path d="M43 48 L73 65" className="model-viewer__axis-line model-viewer__axis-line--x" />
          <path d="M43 48 L14 65" className="model-viewer__axis-line model-viewer__axis-line--y" />
          <circle cx="43" cy="48" r="3" fill="#838b99" />
        </svg>
        <button
          className="model-viewer__axis model-viewer__axis--x"
          title="Right view (X axis)"
          aria-label="View along X axis"
          onClick={() => chooseAxisView('right')}
        >
          X
        </button>
        <button
          className="model-viewer__axis model-viewer__axis--y"
          title="Front view (Y axis)"
          aria-label="View along Y axis"
          onClick={() => chooseAxisView('front')}
        >
          Y
        </button>
        <button
          className="model-viewer__axis model-viewer__axis--z"
          title="Top view (Z axis)"
          aria-label="View along Z axis"
          onClick={() => chooseAxisView('top')}
        >
          Z
        </button>
      </div>
    </div>
  );
}

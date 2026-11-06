import { Matrix4, MOUSE, OrthographicCamera, Quaternion, Vector2, Vector3 } from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';

export type CameraNavigationMode = 'orbit' | 'pan';

const NONE = -1;
const ROTATE = 3;
const PAN = 2;
const ZOOM_PAN = 4;
const MIN_PINCH_DISTANCE = 1e-6;

interface CameraTransition {
  started: number;
  duration: number;
  fromOrientation: Quaternion;
  toOrientation: Quaternion;
  fromTarget: Vector3;
  toTarget: Vector3;
  fromDistance: number;
  toDistance: number;
  fromUpParallel: number;
  toUpParallel: number;
  fromUpPerpendicular: number;
  toUpPerpendicular: number;
  toDirection: Vector3;
  toUp: Vector3;
}

/** Free rotation with demand rendering and the viewer's mouse/touch pan modes. */
export class ViewerCameraControls extends TrackballControls {
  readonly camera: OrthographicCamera;
  private navigationMode: CameraNavigationMode = 'orbit';
  private transition?: CameraTransition;
  // TrackballControls exposes these runtime fields but omits them from its typings.
  declare state: number;
  declare keyState: number;
  declare _lastAngle: number;
  declare _movePrev: Vector2;
  declare _moveCurr: Vector2;
  declare _zoomStart: Vector2;
  declare _zoomEnd: Vector2;
  declare _panStart: Vector2;
  declare _panEnd: Vector2;
  declare _touchZoomDistanceStart: number;
  declare _touchZoomDistanceEnd: number;
  declare _pointers: PointerEvent[];
  declare _pointerPositions: Record<number, Vector2>;
  declare _onTouchStart: (event: PointerEvent) => void;
  declare _onTouchMove: (event: PointerEvent) => void;
  declare _onTouchEnd: (event: PointerEvent) => void;
  declare _onPointerCancel: (event: PointerEvent) => void;
  declare _onPointerMove: (event: PointerEvent) => void;
  declare _onPointerUp: (event: PointerEvent) => void;
  declare _onMouseDown: (event: PointerEvent) => void;
  declare _trackPointer: (event: PointerEvent) => void;
  declare _getMouseOnScreen: (x: number, y: number) => Vector2;
  declare _getMouseOnCircle: (x: number, y: number) => Vector2;

  // Stock wheel input queues its zoom before emitting start, so interrupt only
  // the programmatic transition here and preserve the newly recorded gesture.
  private readonly interruptTransition = () => {
    this.transition = undefined;
  };

  private readonly requestInputFrame = () => {
    if (this.enabled) this.dispatchEvent({ type: 'change' });
  };

  private readonly requestPointerFrame = () => {
    if (this._pointers.length) this.requestInputFrame();
  };

  constructor(camera: OrthographicCamera, element: HTMLElement | null = null) {
    super(camera, element);
    this.camera = camera;
    // Precise CAD manipulation stops with the pointer instead of accumulating spin.
    this.staticMoving = true;
    this.dynamicDampingFactor = 0.12;
    this.rotateSpeed = 1.5;
    this.zoomSpeed = 0.8;
    this.panSpeed = 1;
    this.minZoom = 0.25;
    this.maxZoom = 15;
    this.keys = ['', '', ''];
    this.mouseButtons.RIGHT = MOUSE.PAN;

    const startMouse = this._onMouseDown;
    this._onMouseDown = (event) => {
      this.cancelMotion();
      const action = this.mouseButtons.LEFT;
      if (event.button === 0 && (event.shiftKey || event.ctrlKey || event.metaKey))
        this.mouseButtons.LEFT = MOUSE.PAN;
      startMouse(event);
      this.mouseButtons.LEFT = action;
    };
    this._onTouchStart = (event) => {
      this.cancelMotion();
      this._trackPointer(event);
      this.startTouchGesture(this._pointers);
      this.dispatchEvent({ type: 'start' });
    };
    this._onTouchMove = (event) => {
      this._trackPointer(event);
      if (this._pointers.length === 1) {
        if (this.navigationMode === 'pan')
          this._panEnd.copy(this._getMouseOnScreen(event.pageX, event.pageY));
        else {
          this._movePrev.copy(this._moveCurr);
          this._moveCurr.copy(this._getMouseOnCircle(event.pageX, event.pageY));
        }
      } else if (this._pointers.length > 1) {
        const first = this._pointerPositions[this._pointers[0].pointerId];
        const second = this._pointerPositions[this._pointers[1].pointerId];
        this._touchZoomDistanceEnd = Math.max(MIN_PINCH_DISTANCE, first.distanceTo(second));
        this._panEnd.copy(
          this._getMouseOnScreen((first.x + second.x) / 2, (first.y + second.y) / 2),
        );
      }
    };
    this._onTouchEnd = (event) => {
      // Pointer-up can arrive before the next animation frame.
      this.update();
      this.cancelMotion();
      const remaining = this._pointers.filter((pointer) => pointer.pointerId !== event.pointerId);
      this.startTouchGesture(remaining);
      this.dispatchEvent({ type: 'end' });
    };

    const cancelPointer = this._onPointerCancel;
    this._onPointerCancel = (event) => {
      if (event.pointerType === 'touch') {
        this.cancelMotion();
        this._onTouchEnd(event);
      } else {
        this.cancelMotion();
        this.state = NONE;
        this.dispatchEvent({ type: 'end' });
      }
      cancelPointer(event);
      if (!this._pointers.length) {
        element?.ownerDocument.removeEventListener('pointermove', this._onPointerMove);
        element?.ownerDocument.removeEventListener('pointerup', this._onPointerUp);
      }
    };
    element?.removeEventListener('pointercancel', cancelPointer);
    element?.addEventListener('pointercancel', this._onPointerCancel);

    // TrackballControls normally relies on a continuous render loop. Wake the
    // viewer after its own pointer handlers have recorded input instead.
    element?.ownerDocument.addEventListener('pointermove', this.requestPointerFrame);
    this.addEventListener('start', this.interruptTransition);
    this.addEventListener('start', this.requestInputFrame);
    this.addEventListener('end', this.requestInputFrame);
  }

  /** Advance an orbit transition within the viewer's existing demand-render frame. */
  override update(now = performance.now()) {
    // TrackballControls calls this override from super(), before camera/fields exist.
    const transition = this.transition;
    if (!transition) {
      super.update();
      return;
    }
    const progress = Math.min(1, Math.max(0, (now - transition.started) / transition.duration));
    const fraction = progress * progress * (3 - 2 * progress);
    const orientation = transition.fromOrientation
      .clone()
      .slerp(transition.toOrientation, fraction);
    const direction = new Vector3(0, 0, 1).applyQuaternion(orientation);
    const distance =
      transition.fromDistance + (transition.toDistance - transition.fromDistance) * fraction;
    this.target.lerpVectors(transition.fromTarget, transition.toTarget, fraction);
    this.camera.position.copy(this.target).addScaledVector(direction, distance);
    // Trackball's raw up may contain a component along the eye direction. Keep
    // that component while the quaternion supplies a stable screen-up at poles.
    this.camera.up
      .set(0, 1, 0)
      .applyQuaternion(orientation)
      .multiplyScalar(
        transition.fromUpPerpendicular +
          (transition.toUpPerpendicular - transition.fromUpPerpendicular) * fraction,
      )
      .addScaledVector(
        direction,
        transition.fromUpParallel +
          (transition.toUpParallel - transition.fromUpParallel) * fraction,
      );
    if (progress === 1) {
      this.target.copy(transition.toTarget);
      this.camera.position
        .copy(transition.toTarget)
        .addScaledVector(transition.toDirection, transition.toDistance);
      this.camera.up.copy(transition.toUp);
      this.transition = undefined;
    }
    super.update();
    // A pure roll does not change position/zoom, which stock Trackball ignores.
    // This also schedules the next demand frame until the transition completes.
    this.dispatchEvent({ type: 'change' });
  }

  /** Retarget from the currently displayed pose without crossing the orbit center. */
  animateToDirection(
    direction: Vector3,
    up: Vector3,
    distance = this.camera.position.distanceTo(this.target),
    target = this.target,
    duration = 350,
  ) {
    const toDirection = direction.clone().normalize();
    const toUp = up.clone();
    const toTarget = target.clone();
    if (
      ![
        ...toDirection.toArray(),
        ...toUp.toArray(),
        ...toTarget.toArray(),
        distance,
        duration,
      ].every(Number.isFinite) ||
      !toDirection.lengthSq() ||
      !toUp.lengthSq() ||
      distance <= 0 ||
      duration < 0
    )
      throw new Error(
        'Camera transitions need finite directions, a positive distance and a nonnegative duration.',
      );
    if (!duration) {
      setCameraDirection(this, toDirection, toUp, distance, toTarget);
      return;
    }
    const fromTarget = this.target.clone();
    const fromDirection = this.camera.position.clone().sub(fromTarget).normalize();
    const fromUpParallel = this.camera.up.dot(fromDirection);
    const toUpParallel = toUp.dot(toDirection);
    this.cancelMotion();
    this.transition = {
      started: performance.now(),
      duration,
      fromOrientation: new Quaternion().setFromRotationMatrix(
        new Matrix4().lookAt(this.camera.position, fromTarget, this.camera.up),
      ),
      toOrientation: new Quaternion().setFromRotationMatrix(
        new Matrix4().lookAt(toDirection, new Vector3(), toUp),
      ),
      fromTarget,
      toTarget,
      fromDistance: this.camera.position.distanceTo(fromTarget),
      toDistance: distance,
      fromUpParallel,
      toUpParallel,
      fromUpPerpendicular: this.camera.up
        .clone()
        .addScaledVector(fromDirection, -fromUpParallel)
        .length(),
      toUpPerpendicular: toUp.clone().addScaledVector(toDirection, -toUpParallel).length(),
      toDirection,
      toUp,
    };
    this.dispatchEvent({ type: 'change' });
  }

  // Trackball's stock pan scales with camera distance even for orthographic
  // projection. Use the visible frustum so pan stays consistent at every size.
  _panCamera() {
    const delta = new Vector2().subVectors(this._panEnd, this._panStart);
    if (!delta.lengthSq()) return;
    const camera = this.object as OrthographicCamera;
    const eye = new Vector3().subVectors(camera.position, this.target);
    const sideways = eye.clone().cross(camera.up).normalize();
    const pan = sideways
      .clone()
      .multiplyScalar(((delta.x * (camera.right - camera.left)) / camera.zoom) * this.panSpeed);
    pan.addScaledVector(
      sideways.cross(eye).normalize(),
      ((delta.y * (camera.top - camera.bottom)) / camera.zoom) * this.panSpeed,
    );
    pan.multiplyScalar(this.staticMoving ? 1 : this.dynamicDampingFactor);
    camera.position.add(pan);
    this.target.add(pan);
    if (this.staticMoving) this._panStart.copy(this._panEnd);
    else this._panStart.lerp(this._panEnd, this.dynamicDampingFactor);
  }

  private startTouchGesture(pointers: PointerEvent[]) {
    if (!pointers.length) {
      this.state = NONE;
      return;
    }
    const first = this._pointerPositions[pointers[0].pointerId];
    if (pointers.length === 1) this.startSingleTouch(first.x, first.y);
    else {
      const second = this._pointerPositions[pointers[1].pointerId];
      this.state = ZOOM_PAN;
      this._touchZoomDistanceStart = this._touchZoomDistanceEnd = Math.max(
        MIN_PINCH_DISTANCE,
        first.distanceTo(second),
      );
      this._panStart.copy(
        this._getMouseOnScreen((first.x + second.x) / 2, (first.y + second.y) / 2),
      );
      this._panEnd.copy(this._panStart);
    }
  }

  private startSingleTouch(x: number, y: number) {
    if (this.navigationMode === 'pan') {
      this.state = PAN;
      this._panStart.copy(this._getMouseOnScreen(x, y));
      this._panEnd.copy(this._panStart);
    } else {
      this.state = ROTATE;
      this._moveCurr.copy(this._getMouseOnCircle(x, y));
      this._movePrev.copy(this._moveCurr);
    }
  }

  setNavigationMode(mode: CameraNavigationMode) {
    this.cancelMotion();
    this.navigationMode = mode;
    this.mouseButtons.LEFT = mode === 'pan' ? MOUSE.PAN : MOUSE.ROTATE;
    if (this._pointers.length === 1 && this._pointers[0].pointerType === 'touch') {
      const position = this._pointerPositions[this._pointers[0].pointerId];
      this.startSingleTouch(position.x, position.y);
    }
  }

  /** Discard transitions/inertia without moving the visible camera, target, or zoom. */
  cancelMotion() {
    this.transition = undefined;
    this._lastAngle = 0;
    this._movePrev.copy(this._moveCurr);
    this._zoomStart.copy(this._zoomEnd);
    this._panStart.copy(this._panEnd);
    this._touchZoomDistanceStart = this._touchZoomDistanceEnd;
  }

  /** Look from the opposite side of the current target, retaining screen-up. */
  invertView(duration = 0) {
    this.animateToDirection(
      this.camera.position.clone().sub(this.target).negate(),
      this.camera.up,
      undefined,
      undefined,
      duration,
    );
  }

  override dispose() {
    this.cancelMotion();
    this.removeEventListener('start', this.interruptTransition);
    this.domElement?.ownerDocument.removeEventListener('pointermove', this.requestPointerFrame);
    this.removeEventListener('start', this.requestInputFrame);
    this.removeEventListener('end', this.requestInputFrame);
    super.dispose();
  }
}

/** Apply an exact view without stale drag or zoom inertia altering it. */
export function setCameraDirection(
  controls: ViewerCameraControls,
  direction: Vector3,
  up: Vector3,
  distance: number,
  target = controls.target,
) {
  controls.cancelMotion();
  controls.target.copy(target);
  controls.camera.up.copy(up);
  controls.camera.position.copy(target).addScaledVector(direction.clone().normalize(), distance);
  controls.update();
  controls.dispatchEvent({ type: 'change' });
}

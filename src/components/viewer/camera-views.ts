import { Matrix4, Quaternion, Vector3 } from 'three';
import { setCameraDirection, type ViewerCameraControls } from './camera-controls';

export const cameraViews = [
  { value: 'isometric', label: 'Isometric', direction: [1.2, 1.7, 1.45], up: [0, 1, 0] },
  { value: 'front', label: 'Front', direction: [0, 0, 1], up: [0, 1, 0] },
  { value: 'back', label: 'Back', direction: [0, 0, -1], up: [0, 1, 0] },
  { value: 'left', label: 'Left', direction: [-1, 0, 0], up: [0, 1, 0] },
  { value: 'right', label: 'Right', direction: [1, 0, 0], up: [0, 1, 0] },
  { value: 'top', label: 'Top', direction: [0, 1, 0], up: [0, 0, -1] },
  { value: 'bottom', label: 'Bottom', direction: [0, -1, 0], up: [0, 0, 1] },
] as const;

export type CameraView = (typeof cameraViews)[number]['value'];

/** Preserve the visible roll when snapping a cube face, edge or corner. */
export function cameraViewUp(
  direction: Vector3,
  currentOrientation: Quaternion,
  canonicalUp?: Vector3,
): Vector3 {
  const normal = direction.clone().normalize();
  const screenUp = new Vector3(0, 1, 0).applyQuaternion(currentOrientation);
  if (!canonicalUp) {
    const eye = new Vector3(0, 0, 1).applyQuaternion(currentOrientation);
    const axis = new Vector3().crossVectors(eye, normal);
    const sine = axis.length();
    const cosine = eye.dot(normal);
    const swing = new Quaternion();
    if (sine > 1e-12) swing.setFromAxisAngle(axis.divideScalar(sine), Math.atan2(sine, cosine));
    else if (cosine < 0) swing.setFromAxisAngle(screenUp, Math.PI);
    return screenUp.applyQuaternion(swing).normalize();
  }

  let nearestUp = canonicalUp.clone();
  let nearestScore = -Infinity;
  let nearestAlignment = -Infinity;
  for (let quarter = 0; quarter < 4; quarter++) {
    const up = canonicalUp.clone().applyAxisAngle(normal, (quarter * Math.PI) / 2);
    const orientation = new Quaternion().setFromRotationMatrix(
      new Matrix4().lookAt(normal, new Vector3(), up),
    );
    const score = Math.abs(currentOrientation.dot(orientation));
    const alignment = new Vector3(0, 1, 0).applyQuaternion(orientation).dot(screenUp);
    // Opposite faces have equal rotation angles for all four rolls. Keep the
    // current screen-up in that tie instead of resetting an inverted view.
    if (
      score > nearestScore + 1e-10 ||
      (Math.abs(score - nearestScore) <= 1e-10 && alignment > nearestAlignment + 1e-10)
    ) {
      nearestScore = score;
      nearestAlignment = alignment;
      nearestUp = up;
    }
  }
  return nearestUp;
}

export function setPresetCameraView(
  controls: ViewerCameraControls,
  view: CameraView,
  distance: number,
  target = controls.target,
) {
  const preset = cameraViews.find((candidate) => candidate.value === view)!;
  setCameraDirection(
    controls,
    new Vector3(...preset.direction),
    new Vector3(...preset.up),
    distance,
    target,
  );
}

/** Cube faces retain the nearest roll; Home and initial fitting remain canonical. */
export function animatePresetCameraView(
  controls: ViewerCameraControls,
  view: CameraView,
  distance = controls.camera.position.distanceTo(controls.target),
  target = controls.target,
  duration = 350,
) {
  const preset = cameraViews.find((candidate) => candidate.value === view)!;
  const direction = new Vector3(...preset.direction);
  const canonicalUp = new Vector3(...preset.up);
  controls.animateToDirection(
    direction,
    view === 'isometric'
      ? canonicalUp
      : cameraViewUp(direction, controls.camera.quaternion, canonicalUp),
    distance,
    target,
    duration,
  );
}

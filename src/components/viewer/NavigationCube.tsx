import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { cameraViews, type CameraView } from './camera-views';
import {
  navigationCubeRegions,
  projectNavigationCube,
  type NavigationCubeRegion,
} from './navigation-cube-geometry';

export interface NavigationCubeHandle {
  update(cameraQuaternion: Quaternion): void;
}

interface NavigationCubeProps {
  onSelectDirection(direction: Vector3): void;
  onSelectView(view: CameraView): void;
}

function initialOrientation() {
  const view = cameraViews[0];
  return new Quaternion().setFromRotationMatrix(
    new Matrix4().lookAt(new Vector3(...view.direction), new Vector3(), new Vector3(...view.up)),
  );
}

const NavigationCube = forwardRef<NavigationCubeHandle, NavigationCubeProps>(
  function NavigationCube({ onSelectDirection, onSelectView }, ref) {
    const groups = useRef(new Map<string, SVGGElement>());
    const orientation = useRef(initialOrientation());

    const update = useCallback((cameraQuaternion: Quaternion) => {
      orientation.current.copy(cameraQuaternion);
      const projected = projectNavigationCube(cameraQuaternion);
      const visible = new Set(projected.map(({ region }) => region.id));
      const towardCamera = new Vector3(0, 0, 1).applyQuaternion(cameraQuaternion);
      groups.current.forEach((group, id) => {
        const show = visible.has(id);
        const region = navigationCubeRegions.find((candidate) => candidate.id === id)!;
        const active = region.direction.dot(towardCamera) > 1 - 1e-5;
        group.style.display = show ? '' : 'none';
        group.classList.toggle('is-active', active);
        group.setAttribute('tabindex', show ? '0' : '-1');
        group.setAttribute('aria-hidden', String(!show));
        group.setAttribute('aria-pressed', String(active));
      });
      for (const { region, points, labelTransform } of projected) {
        const group = groups.current.get(region.id);
        if (!group) continue;
        group
          .querySelector('polygon')!
          .setAttribute(
            'points',
            points.map((point) => point.map((value) => value.toFixed(3)).join(',')).join(' '),
          );
        if (labelTransform)
          group
            .querySelector('text')!
            .setAttribute('transform', `matrix(${labelTransform.join(' ')})`);
        // Keep SVG painter order consistent after any orbit, including upside-down views.
        group.parentElement?.appendChild(group);
      }
    }, []);

    useImperativeHandle(ref, () => ({ update }), [update]);
    useEffect(() => update(orientation.current), [update]);

    const select = (region: NavigationCubeRegion) => {
      if (region.view) onSelectView(region.view);
      else onSelectDirection(region.direction.clone());
    };

    return (
      <div className="navigation-cube" role="group" aria-label="View orientation">
        <svg
          className="navigation-cube__viewport"
          viewBox="0 0 120 120"
          role="group"
          aria-label="Navigation cube. Choose a face, edge, or corner."
          onPointerDown={(event) => event.stopPropagation()}
        >
          {navigationCubeRegions.map((region) => (
            <g
              className={`navigation-cube__region navigation-cube__region--${region.kind}`}
              key={region.id}
              data-view={region.id}
              ref={(element) => {
                if (element) groups.current.set(region.id, element);
                else groups.current.delete(region.id);
              }}
              role="button"
              aria-label={`${region.label} view`}
              tabIndex={-1}
              onClick={() => select(region)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                event.stopPropagation();
                select(region);
              }}
            >
              <title>{`${region.label} view`}</title>
              <polygon />
              {region.kind === 'face' && (
                <text
                  className="navigation-cube__label"
                  textAnchor="middle"
                  dominantBaseline="central"
                  aria-hidden="true"
                >
                  {region.label.toUpperCase()}
                </text>
              )}
            </g>
          ))}
        </svg>
        <div className="navigation-cube__keyboard-views" aria-label="All cube faces">
          {cameraViews
            .filter((view) => view.value !== 'isometric')
            .map((view) => (
              <button type="button" key={view.value} onClick={() => onSelectView(view.value)}>
                {view.label} view
              </button>
            ))}
        </div>
      </div>
    );
  },
);

export default NavigationCube;

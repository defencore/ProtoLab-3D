import { useId } from 'react';
import type { GeometryMode } from '../core/geometry-mode';

export default function GeometryModeSwitch({
  value,
  onChange,
  compact = false,
}: {
  value: GeometryMode;
  onChange: (mode: GeometryMode) => void;
  compact?: boolean;
}) {
  const descriptionId = useId();
  return (
    <div className={`geometry-mode-control${compact ? ' geometry-mode-control--compact' : ''}`}>
      <div
        className="geometry-mode-switch"
        role="group"
        aria-label="Thread detail"
        aria-describedby={descriptionId}
      >
        <button type="button" aria-pressed={value === 'simple'} onClick={() => onChange('simple')}>
          <strong>Simple</strong>
          <span>Without threads</span>
        </button>
        <button type="button" aria-pressed={value === 'full'} onClick={() => onChange('full')}>
          <strong>Full</strong>
          <span>With threads</span>
        </button>
      </div>
      <p id={descriptionId}>
        {value === 'simple'
          ? 'Faster preview and lighter FreeCAD geometry for TechDraw. Thread callouts are retained.'
          : 'Thread detail in the preview and helical threads in FreeCAD. Large assemblies take longer.'}
      </p>
    </div>
  );
}

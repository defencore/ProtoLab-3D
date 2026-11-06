import type { ReactNode } from 'react';
import type { GeometryMode } from '../../core/geometry-mode';
import {
  ArrowLeftRight,
  Box,
  Check,
  ClipboardCopy,
  Expand,
  Grid2X2,
  Home,
  Layers3,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Move,
  Rotate3D,
  Ruler,
  Scan,
  Sun,
} from 'lucide-react';
import './preview-controls.css';

export type DisplayMode = 'solid' | 'wireframe' | 'xray';
export type PreviewBackgroundMode = 'dark' | 'light';
export type ImageCopyState = 'idle' | 'copying' | 'copied' | 'error';

export interface PreviewControlsProps {
  cube: ReactNode;
  geometryMode: GeometryMode;
  onGeometryModeChange(mode: GeometryMode): void;
  displayMode: DisplayMode;
  onDisplayModeChange(mode: DisplayMode): void;
  navigationMode: 'orbit' | 'pan';
  onNavigationModeChange(mode: 'orbit' | 'pan'): void;
  backgroundMode: PreviewBackgroundMode;
  onBackgroundModeChange(mode: PreviewBackgroundMode): void;
  showGrid: boolean;
  onToggleGrid(): void;
  showDimensions: boolean;
  onToggleDimensions(): void;
  expanded: boolean;
  onToggleFullscreen(): void;
  onHome(): void;
  onInvert(): void;
  onFit(): void;
  imageCopyState: ImageCopyState;
  imageCopyDisabled: boolean;
  onCopyImage(): void;
}

interface ControlButtonProps {
  name: string;
  position: string;
  children: ReactNode;
  onClick(): void;
  title?: string;
  pressed?: boolean;
  expanded?: boolean;
  className?: string;
  disabled?: boolean;
}

function ControlButton({
  name,
  position,
  children,
  onClick,
  title = name,
  pressed,
  expanded,
  className = '',
  disabled,
}: ControlButtonProps) {
  return (
    <button
      type="button"
      className={`preview-controls__button preview-controls__button--${position} ${className}`.trim()}
      title={title}
      aria-label={name}
      aria-pressed={pressed}
      aria-expanded={expanded}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default function PreviewControls({
  cube,
  geometryMode,
  onGeometryModeChange,
  displayMode,
  onDisplayModeChange,
  navigationMode,
  onNavigationModeChange,
  backgroundMode,
  onBackgroundModeChange,
  showGrid,
  onToggleGrid,
  showDimensions,
  onToggleDimensions,
  expanded,
  onToggleFullscreen,
  onHome,
  onInvert,
  onFit,
  imageCopyState,
  imageCopyDisabled,
  onCopyImage,
}: PreviewControlsProps) {
  return (
    <div
      className={`preview-controls${backgroundMode === 'light' ? ' preview-controls--light' : ''}`}
      role="group"
      aria-label="Preview controls"
    >
      <div className="preview-controls__cube">{cube}</div>
      <ControlButton name="Home view (isometric)" position="home" onClick={onHome}>
        <Home size={16} aria-hidden="true" />
      </ControlButton>
      <ControlButton
        name="Copy preview image"
        title={imageCopyState === 'copied' ? 'Image copied' : 'Copy image (2560 px PNG)'}
        position="copy-image"
        disabled={imageCopyDisabled || imageCopyState === 'copying'}
        onClick={onCopyImage}
      >
        {imageCopyState === 'copying' ? (
          <LoaderCircle size={16} aria-hidden="true" className="preview-controls__spinner" />
        ) : imageCopyState === 'copied' ? (
          <Check size={16} aria-hidden="true" />
        ) : (
          <ClipboardCopy size={16} aria-hidden="true" />
        )}
      </ControlButton>
      <ControlButton
        name={expanded ? 'Exit full screen preview' : 'Full screen preview'}
        title={expanded ? 'Exit full screen (Esc)' : 'Full screen preview'}
        position="fullscreen"
        className="preview-fullscreen-toggle"
        expanded={expanded}
        onClick={onToggleFullscreen}
      >
        {expanded ? (
          <Minimize2 size={16} aria-hidden="true" />
        ) : (
          <Maximize2 size={16} aria-hidden="true" />
        )}
      </ControlButton>
      <ControlButton
        name="Orbit mode"
        title="Orbit: drag to rotate (O)"
        position="orbit"
        pressed={navigationMode === 'orbit'}
        onClick={() => onNavigationModeChange('orbit')}
      >
        <Rotate3D size={16} aria-hidden="true" />
      </ControlButton>
      <ControlButton
        name="Pan mode"
        title="Pan: drag to move (P)"
        position="pan"
        pressed={navigationMode === 'pan'}
        onClick={() => onNavigationModeChange('pan')}
      >
        <Move size={16} aria-hidden="true" />
      </ControlButton>
      <ControlButton name="Fit model to view" position="fit" onClick={onFit}>
        <Expand size={16} aria-hidden="true" />
      </ControlButton>
      <ControlButton
        name="Toggle grid"
        title="Toggle grid (10 × 10 mm)"
        position="grid"
        pressed={showGrid}
        onClick={onToggleGrid}
      >
        <Grid2X2 size={16} aria-hidden="true" />
      </ControlButton>
      <ControlButton
        name="Toggle dimensions"
        position="dimensions"
        pressed={showDimensions}
        onClick={onToggleDimensions}
      >
        <Ruler size={16} aria-hidden="true" />
      </ControlButton>
      <ControlButton
        name="Light background"
        title={backgroundMode === 'light' ? 'Use dark background' : 'Use light background'}
        position="background"
        pressed={backgroundMode === 'light'}
        onClick={() => onBackgroundModeChange(backgroundMode === 'light' ? 'dark' : 'light')}
      >
        <Sun size={16} aria-hidden="true" />
      </ControlButton>
      <ControlButton
        name="Full detail"
        title={geometryMode === 'full' ? 'Use simple detail' : 'Use full detail'}
        position="detail"
        pressed={geometryMode === 'full'}
        onClick={() => onGeometryModeChange(geometryMode === 'full' ? 'simple' : 'full')}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M8 3h8v4H8zM9 7v14h6V7M8 11l8-2M8 15l8-2M8 19l8-2" />
        </svg>
      </ControlButton>
      <div className="preview-controls__display" role="group" aria-label="Display mode">
        <ControlButton
          name="Solid shading"
          position="solid"
          pressed={displayMode === 'solid'}
          onClick={() => onDisplayModeChange('solid')}
        >
          <Box size={16} aria-hidden="true" />
        </ControlButton>
        <ControlButton
          name="Wireframe"
          position="wireframe"
          pressed={displayMode === 'wireframe'}
          onClick={() => onDisplayModeChange('wireframe')}
        >
          <Layers3 size={16} aria-hidden="true" />
        </ControlButton>
        <ControlButton
          name="X-ray"
          position="xray"
          pressed={displayMode === 'xray'}
          onClick={() => onDisplayModeChange('xray')}
        >
          <Scan size={16} aria-hidden="true" />
        </ControlButton>
      </div>
      <ControlButton
        name="View from opposite side"
        title="Opposite view (180°). Click again to return."
        position="invert"
        onClick={onInvert}
      >
        <ArrowLeftRight size={16} aria-hidden="true" />
      </ControlButton>
    </div>
  );
}

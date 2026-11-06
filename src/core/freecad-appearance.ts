/** Explicit RGB or RGBA materials, shared by standalone and project CAD exports. */
export const freecadAppearancePython = `def _protolab_color_rgba(color):
    import math
    if not isinstance(color, (list, tuple)) or len(color) not in (3, 4):
        raise ValueError("Each component color must be RGB or RGBA.")
    if any(isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 1 for value in color):
        raise ValueError("Component color channels and opacity must be finite numbers between 0 and 1.")
    return tuple(color) if len(color) == 4 else tuple(color) + (1.0,)

def _protolab_apply_color(view, color):
    rgba = _protolab_color_rgba(color)
    material = App.Material()
    material.DiffuseColor = rgba
    material.Transparency = 1.0 - rgba[3]
    # Replace inherited per-face materials as well as the object's base color.
    view.ShapeAppearance = [material]
    # Dense polygon edges can hide the surface color in FreeCAD's Flat Lines mode.
    view.DisplayMode = "Shaded"
`;
import { STEEL } from './geometry';

/** The same default surface color used by the browser's geometric primitives. */
export const defaultFreecadColor = `(${[16, 8, 0].map((shift) => ((STEEL >> shift) & 255) / 255).join(',')})`;

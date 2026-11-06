import { GridHelper, type Material } from 'three';

export const PREVIEW_GRID_SPACING_MM = 10;
const MAX_GRID_SIZE_MM = 100_000;

function gridSize(extent: number) {
  // An even number of cells keeps the center lines at the origin.
  const pair = PREVIEW_GRID_SPACING_MM * 2;
  // Bound coverage for very large custom geometry without coarsening its cells.
  return Math.min(MAX_GRID_SIZE_MM, Math.max(100, Math.ceil((extent * 5) / pair) * pair));
}

/** Model size changes the coverage, while every cell remains 10 × 10 mm. */
export class PreviewGrid extends GridHelper {
  private sizeMm: number;

  constructor(extent = 50) {
    const size = gridSize(extent);
    super(size, size / PREVIEW_GRID_SPACING_MM, 0x4c5665, 0x343d4b);
    this.sizeMm = size;
  }

  setExtent(extent: number) {
    const size = gridSize(extent);
    if (size === this.sizeMm) return;
    const replacement = new GridHelper(size, size / PREVIEW_GRID_SPACING_MM, 0x4c5665, 0x343d4b);
    this.geometry.dispose();
    this.geometry = replacement.geometry;
    (replacement.material as Material).dispose();
    this.sizeMm = size;
  }
}

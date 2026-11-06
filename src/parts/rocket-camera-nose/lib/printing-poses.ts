type Vec = [number, number, number];

/** Fabrication poses are part-specific and do not change installed component datums. */
export const printingRotations: Record<string, Vec> = {
  'nose-shell': [0, 0, 0],
  'window-retainer': [0, 0, 0],
  'window-front-seat': [0, 0, 0],
  'window-load-seat': [0, 0, 0],
  'window-front-gasket': [0, 0, 0],
  'window-rear-gasket': [0, 0, 0],
  'load-frame': [0, 0, 0],
  'rear-cap': [0, 0, 0],
  'pi-cradle': [180, 0, 0],
  'ups-cradle': [180, 0, 0],
  'ups-cell-cover': [0, 90, 0],
  'camera-pocket': [180, 0, 0],
  'rear-cable-grommet': [180, 0, 0],
  'aux-bed': [0, -90, 0],
  'aux-clamp': [0, 0, 0],
  'carrier-pi-frame': [0, 90, 0],
  'carrier-ups-frame': [0, 90, 0],
  'carrier-combined-frame': [0, 90, 0],
};

export interface Din915Range {
  min: number;
  max: number;
}

/** Dimensions in millimetres, transcribed from the user-supplied DIN 915 table. */
export interface Din915Row {
  diameter: number;
  pitch: number;
  pointDiameter: Din915Range;
  socketNominal: number;
  socketActual: Din915Range;
  socketDepthMin: number;
  pointLength: Din915Range;
}

export const din915ReferenceFiles = {
  dimensions: 'references/din915-dimensions.png',
  photo: 'references/din915-dog-point.png',
};

// Preserve the printed "metric", "max" and "min" socket columns independently.
// The nominal value is outside the stated interval in several rows. In particular,
// M2.5 prints nominal 1.3 above the maximum 1.295; this source inconsistency is
// retained, not silently corrected or treated as a verified socket fit.
export const din915Rows: readonly Din915Row[] = [
  {
    diameter: 2,
    pitch: 0.4,
    pointDiameter: { min: 0.75, max: 1 },
    socketNominal: 0.9,
    socketActual: { min: 0.889, max: 0.902 },
    socketDepthMin: 0.8,
    pointLength: { min: 1, max: 1.25 },
  },
  {
    diameter: 2.5,
    pitch: 0.45,
    pointDiameter: { min: 1.25, max: 1.5 },
    socketNominal: 1.3,
    socketActual: { min: 1.27, max: 1.295 },
    socketDepthMin: 1.2,
    pointLength: { min: 1.25, max: 1.5 },
  },
  {
    diameter: 3,
    pitch: 0.5,
    pointDiameter: { min: 1.75, max: 2 },
    socketNominal: 1.5,
    socketActual: { min: 1.52, max: 1.545 },
    socketDepthMin: 1.2,
    pointLength: { min: 1.5, max: 1.75 },
  },
  {
    diameter: 4,
    pitch: 0.7,
    pointDiameter: { min: 2.25, max: 2.5 },
    socketNominal: 2,
    socketActual: { min: 2.02, max: 2.045 },
    socketDepthMin: 1.5,
    pointLength: { min: 2, max: 2.25 },
  },
  {
    diameter: 5,
    pitch: 0.8,
    pointDiameter: { min: 3.2, max: 3.5 },
    socketNominal: 2.5,
    socketActual: { min: 2.52, max: 2.56 },
    socketDepthMin: 2,
    pointLength: { min: 2.5, max: 2.75 },
  },
  {
    diameter: 6,
    pitch: 1,
    pointDiameter: { min: 3.7, max: 4 },
    socketNominal: 3,
    socketActual: { min: 3.02, max: 3.06 },
    socketDepthMin: 2,
    pointLength: { min: 3, max: 3.25 },
  },
  {
    diameter: 8,
    pitch: 1.25,
    pointDiameter: { min: 5.2, max: 5.5 },
    socketNominal: 4,
    socketActual: { min: 4.02, max: 4.095 },
    socketDepthMin: 3,
    pointLength: { min: 4, max: 4.3 },
  },
  {
    diameter: 10,
    pitch: 1.5,
    pointDiameter: { min: 6.64, max: 7 },
    socketNominal: 5,
    socketActual: { min: 5.02, max: 5.095 },
    socketDepthMin: 4,
    pointLength: { min: 5, max: 5.3 },
  },
  {
    diameter: 12,
    pitch: 1.75,
    pointDiameter: { min: 8.14, max: 8.5 },
    socketNominal: 6,
    socketActual: { min: 6.02, max: 6.095 },
    socketDepthMin: 4.8,
    pointLength: { min: 6, max: 6.3 },
  },
  {
    diameter: 14,
    pitch: 2,
    pointDiameter: { min: 9.64, max: 10 },
    socketNominal: 6,
    socketActual: { min: 6.02, max: 6.095 },
    socketDepthMin: 5.6,
    pointLength: { min: 7, max: 7.36 },
  },
  {
    diameter: 16,
    pitch: 2,
    pointDiameter: { min: 11.57, max: 12 },
    socketNominal: 8,
    socketActual: { min: 8.025, max: 8.115 },
    socketDepthMin: 6.4,
    pointLength: { min: 8, max: 8.36 },
  },
];

/** Uniform Euler–Bernoulli strip model. Units N/mm; guide/joint compliance is excluded. */
export function beamLoadComplianceMm(
  forceN: number,
  elasticRigidityNmm2: number,
  supports: readonly { positionMm: number; restrainRotation: boolean }[],
  loads: readonly { positionMm: number; forceFactor: number }[],
) {
  if (!Number.isFinite(forceN) || forceN < 0 || !Number.isFinite(elasticRigidityNmm2) || elasticRigidityNmm2 <= 0)
    throw new Error('Use a finite nonnegative load and positive elastic rigidity.');
  if (!supports.length || !loads.length || [...supports, ...loads].some((point) => !Number.isFinite(point.positionMm)) || loads.some((point) => !Number.isFinite(point.forceFactor)))
    throw new Error('Beam supports and load positions/factors must be finite.');
  const positions = [...new Set([...supports, ...loads].map((point) => point.positionMm))].sort((a, b) => a - b);
  if (positions.length < 2 || positions.length > 20)
    throw new Error('Use between two and twenty distinct strip stations.');
  const count = positions.length * 2;
  const matrix = Array.from({ length: count }, () => Array(count).fill(0) as number[]);
  const rhs = Array(count).fill(0) as number[];
  for (let element = 0; element < positions.length - 1; element++) {
    const length = positions[element + 1] - positions[element];
    if (length < 0.001) throw new Error('Strip stations must be at least0.001 mm apart.');
    const local = [
      [12, 6 * length, -12, 6 * length],
      [6 * length, 4 * length ** 2, -6 * length, 2 * length ** 2],
      [-12, -6 * length, 12, -6 * length],
      [6 * length, 2 * length ** 2, -6 * length, 4 * length ** 2],
    ];
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 4; col++)
        matrix[2 * element + row][2 * element + col] += local[row][col] / length ** 3;
  }
  for (const point of loads) rhs[2 * positions.indexOf(point.positionMm)] += point.forceFactor;
  const restrained = new Set<number>();
  for (const point of supports) {
    const node = 2 * positions.indexOf(point.positionMm);
    restrained.add(node);
    if (point.restrainRotation) restrained.add(node + 1);
  }
  const free = Array.from({ length: count }, (_, index) => index).filter((index) => !restrained.has(index));
  const reduced = free.map((row) => [...free.map((col) => matrix[row][col]), rhs[row]]);
  // Partial-pivot elimination. No regularization: an unrestrained model must fail clearly.
  for (let col = 0; col < free.length; col++) {
    let pivot = col;
    for (let row = col + 1; row < free.length; row++)
      if (Math.abs(reduced[row][col]) > Math.abs(reduced[pivot][col])) pivot = row;
    if (Math.abs(reduced[pivot][col]) < 1e-16) throw new Error('The strip model is singular or insufficiently restrained.');
    [reduced[col], reduced[pivot]] = [reduced[pivot], reduced[col]];
    for (let row = col + 1; row < free.length; row++) {
      const factor = reduced[row][col] / reduced[col][col];
      for (let entry = col; entry <= free.length; entry++) reduced[row][entry] -= factor * reduced[col][entry];
    }
  }
  const solved = Array(free.length).fill(0) as number[];
  for (let row = free.length - 1; row >= 0; row--) {
    const remaining = reduced[row][free.length] - solved.reduce((sum, value, col) => sum + (col > row ? reduced[row][col] * value : 0), 0);
    solved[row] = remaining / reduced[row][row];
  }
  const virtualWork = free.reduce((sum, index, row) => sum + rhs[index] * solved[row], 0);
  const displacementMm = forceN * virtualWork / elasticRigidityNmm2;
  if (!Number.isFinite(displacementMm) || displacementMm < -1e-12)
    throw new Error('The strip solve did not produce a finite nonnegative compliance.');
  return Math.max(0, displacementMm);
}

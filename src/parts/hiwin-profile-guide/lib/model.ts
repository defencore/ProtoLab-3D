import type { Parameters } from '../../../core/types';
import { box, cylinder, subtract, type Shape } from '../../../core/assembly/boundary/shapes';
import type { Piece } from '../../../core/assembly/boundary/assembly';
import models from './models.json';
export { models };
export function guideModel(p: Parameters) {
  const model = models.find((m) => m.id === p.model);
  if (!model) throw new Error('Select a supported HIWIN guide model.');
  return model;
}
export function guideLayout(p: Parameters) {
  const m = guideModel(p),
    length = Number(p.length),
    count = Number(p.blockCount),
    spacing = Number(p.blockSpacing);
  const holes = Math.max(1, Math.floor((length - m.counterbore - 2) / m.railPitch) + 1);
  const edge = (length - (holes - 1) * m.railPitch) / 2;
  const span = m.blockLength + (count - 1) * spacing;
  const center = (Number(p.position) / 100 - 0.5) * (length - span - 2);
  return { m, length, count, spacing, holes, edge, span, center };
}
export function railHoles(p: Parameters): [number, number, number][] {
  const v = guideLayout(p);
  return Array.from(
    { length: v.holes },
    (_, i) => -v.length / 2 + v.edge + i * v.m.railPitch,
  ).flatMap((x) =>
    (v.m.railRows === 2 ? [-v.m.railRowPitch / 2, v.m.railRowPitch / 2] : [0]).map(
      (y) => [x, y, 0] as [number, number, number],
    ),
  );
}
export function carriageHoles(p: Parameters, x = 0): [number, number, number][] {
  const m = guideModel(p);
  return [-1, 1].flatMap((sx) =>
    [-1, 1].map(
      (sy) => [x + (sx * m.pitchX) / 2, (sy * m.pitchY) / 2, m.height] as [number, number, number],
    ),
  );
}
export function guidePieces(p: Parameters, state: string): Piece[] {
  const v = guideLayout(p),
    m = v.m,
    result: Piece[] = [];
  if (state !== 'carriage') {
    const tools = railHoles(p).flatMap(([x, y]) => [
      cylinder(m.railHole / 2, m.railHeight + 2, [x, y, -1]),
      cylinder(m.counterbore / 2, m.counterDepth + 1, [x, y, m.railHeight - m.counterDepth]),
    ]);
    // Raceway radii are undimensioned in the mounting drawing and remain illustrative.
    const radius = Math.min(m.railHeight * 0.07, m.railWidth * 0.06);
    for (const side of [-1, 1])
      for (const z of m.series.startsWith('HG')
        ? [m.railHeight * 0.42, m.railHeight * 0.72]
        : [m.railHeight * 0.62])
        tools.push(
          cylinder(radius, v.length + 2, [-v.length / 2 - 1, (side * m.railWidth) / 2, z], 'x'),
        );
    result.push({
      label: `${m.series.startsWith('HG') ? 'HGR' : m.series}${m.size} rail / ${v.length} mm`,
      color: 0xa4abb2,
      shape: subtract(
        box([v.length, m.railWidth, m.railHeight], [-v.length / 2, -m.railWidth / 2, 0]),
        ...tools,
      ),
    });
  }
  if (state === 'rail') return result;
  const count = state === 'carriage' ? 1 : v.count;
  for (let i = 0; i < count; i++) {
    const x = state === 'carriage' ? 0 : v.center + (i - (count - 1) / 2) * v.spacing;
    const channel = box(
      [m.blockLength + 2, m.railWidth + 0.3, m.railHeight + 1.15],
      [x - m.blockLength / 2 - 1, -m.railWidth / 2 - 0.15, -1],
    );
    const cut = [channel];
    if (m.flangeThickness) {
      // The dimensioned wing thickness is retained; the undimensioned centre-body contour is illustrative.
      const core = { 15: 34, 20: 44, 25: 48, 30: 60 }[m.size as 15 | 20 | 25 | 30];
      for (const side of [-1, 1])
        cut.push(
          box(
            [m.blockLength + 2, (m.width - core) / 2 + 1, m.height - m.flangeThickness + 1],
            [x - m.blockLength / 2 - 1, side < 0 ? -m.width / 2 - 1 : core / 2, -1],
          ),
        );
    }
    const pitch =
      m.thread === 2
        ? 0.4
        : m.thread === 3
          ? 0.5
          : m.thread === 4
            ? 0.7
            : m.thread === 5
              ? 0.8
              : m.thread === 6
                ? 1
                : m.thread === 8
                  ? 1.25
                  : 1.5;
    const holes: Shape[] = carriageHoles(p, x).map(([hx, hy, z]) => ({
      kind: 'cylinder',
      radius: m.thread / 2,
      height: m.threadDepth + 1,
      origin: [hx, hy, z - m.threadDepth],
      axis: 'z',
      thread: { pitch, internal: true, designation: `M${m.thread}` },
    }));
    result.push({
      label: `${m.code} carriage ${i + 1} / steel body`,
      color: 0xa8adb2,
      shape: subtract(
        box(
          [m.bodyLength, m.width, m.height - m.bottom],
          [x - m.bodyLength / 2, -m.width / 2, m.bottom],
        ),
        ...cut,
        ...holes,
      ),
    });
    const cover = (m.blockLength - m.bodyLength) / 2;
    for (const side of [-1, 1])
      result.push({
        label: `${m.code} carriage ${i + 1} / ${side < 0 ? 'left' : 'right'} end cover`,
        color: m.series.startsWith('HG') ? 0x248865 : 0x903734,
        shape: subtract(
          box(
            [cover, m.width, m.height - m.bottom],
            [x + (side < 0 ? -m.blockLength / 2 : m.bodyLength / 2), -m.width / 2, m.bottom],
          ),
          ...cut,
        ),
      });
  }
  return result;
}
export function validateGuide(p: Parameters): string[] {
  if (!models.some((m) => m.id === p.model)) return ['Select a supported HIWIN guide model.'];
  const v = guideLayout(p),
    errors: string[] = [];
  if (!Number.isInteger(v.count) || v.count < 1 || v.count > 4)
    errors.push('Choose one to four carriages.');
  if (v.length < v.span + 2)
    errors.push('Rail length must contain all carriages with at least 1 mm at each end.');
  if (v.count > 1 && v.spacing < v.m.blockLength + 1)
    errors.push('Carriage spacing must leave at least 1 mm between adjacent end covers.');
  return errors;
}

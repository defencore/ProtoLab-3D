/** Sampled involute reference profiles. No cutter fillet or strength calculation.
 * Pitch diameters follow m*z; standard pressure angle 20 degrees.
 */
export function profile(module: number, count: number, internal = false): [number, number][] {
  const R = (module * count) / 2,
    base = R * Math.cos(Math.PI / 9);
  const inv = (r: number) => {
    const a = Math.acos(Math.min(1, base / r));
    return Math.tan(a) - a;
  };
  const low = R - (internal ? 1 : 1.25) * module,
    high = R + (internal ? 1.25 : 1) * module;
  const half = (r: number) =>
    Math.PI / (2 * count) + inv(R) - inv(r) + ((internal ? 1 : -1) * 0.06 * module) / R;
  const points: [number, number][] = [];
  const put = (r: number, a: number) => points.push([r * Math.cos(a), r * Math.sin(a)]);
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count;
    put(low, a - Math.PI / count);
    for (let j = 0; j <= 5; j++) {
      const r = low + ((high - low) * j) / 5;
      put(r, a - half(r));
    }
    put(high, a);
    for (let j = 5; j >= 0; j--) {
      const r = low + ((high - low) * j) / 5;
      put(r, a + half(r));
    }
  }
  return points;
}

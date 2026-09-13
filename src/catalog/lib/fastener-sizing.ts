import { n } from '../../core/geometry';
import type { Parameters } from '../../core/types';

// Offline adapter reference calculations are independent of editable part packages.
export const MAX_THREAD_TURNS = 80;
const THREAD_DEPTH = (17 * Math.sqrt(3)) / 48;

export function fastenerValues(p: Parameters, headless = false) {
  const h = headless ? 0 : n(p, 'headHeight');
  const countersunk = !headless && ['countersunk', 'countersunk-square'].includes(String(p.head));
  const shaftLength = n(p, 'length') - (countersunk ? h : 0);
  const squareNeck =
    !headless && ['carriage', 'countersunk-square', 'elevator'].includes(String(p.head));
  const neckHeight = squareNeck ? n(p, 'neckHeight') : 0;
  const r = n(p, 'diameter') / 2;
  const smoothR = n(p, 'shankDiameter') / 2;
  const pitch = n(p, 'pitch');
  const modeled = p.threadMode === 'modeled';
  const threaded = p.threadMode !== 'none';
  const start = p.threadSpan === 'full' ? 0 : n(p, 'threadStart');
  const threadLength = p.threadSpan === 'full' ? shaftLength - neckHeight : n(p, 'threadLength');
  const end = start + threadLength;
  const rootR = modeled ? r - THREAD_DEPTH * pitch : r;
  const total = shaftLength + h;
  const bodyR = threaded && p.threadSpan === 'full' ? r : smoothR;
  return {
    h,
    countersunk,
    squareNeck,
    neckHeight,
    shaftLength,
    r,
    smoothR,
    pitch,
    modeled,
    threaded,
    start,
    end,
    threadLength,
    rootR,
    total,
    bodyR,
  };
}

/** ISO metric coarse pitches used to complete offline supplier rows. */
const COARSE_PITCH: [number, number][] = [
  [1, 0.25],
  [1.2, 0.25],
  [1.4, 0.3],
  [1.6, 0.35],
  [1.8, 0.35],
  [2, 0.4],
  [2.5, 0.45],
  [3, 0.5],
  [3.5, 0.6],
  [4, 0.7],
  [5, 0.8],
  [6, 1],
  [7, 1],
  [8, 1.25],
  [10, 1.5],
  [12, 1.75],
  [14, 2],
  [16, 2],
  [18, 2.5],
  [20, 2.5],
  [22, 2.5],
  [24, 3],
  [27, 3],
  [30, 3.5],
  [33, 3.5],
  [36, 4],
  [39, 4],
  [42, 4.5],
  [45, 4.5],
  [48, 5],
  [52, 5],
  [56, 5.5],
  [60, 5.5],
  [64, 6],
  [68, 6],
  [72, 6],
  [76, 6],
  [80, 6],
  [85, 6],
  [90, 6],
  [95, 6],
  [100, 6],
  [110, 6],
  [120, 6],
  [130, 6],
  [140, 6],
  [150, 6],
  [160, 6],
];

export function nutCoarsePitch(diameter: number): number {
  return (COARSE_PITCH.find(([d]) => d >= diameter) ?? COARSE_PITCH.at(-1)!)[1];
}

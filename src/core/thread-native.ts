import { currentGeometryMode } from './geometry-mode';

/** A closed, trimmed parametric thread tool. Consumers cut it for female threads or fuse it for male threads. */
export interface NativeThread {
  diameter: number;
  pitch: number;
  length: number;
  internal?: boolean;
  left?: boolean;
  clearance?: number;
  rounded?: boolean;
}

/** Radial depth of the authored native profile, shared with configuration validation. */
export function nativeThreadDepth(pitch: number, internal = false, rounded = false): number {
  return rounded ? 0.1 * pitch : pitch * Math.sqrt(3) * (internal ? 5 / 16 : 17 / 48);
}

/** Reuse exact integer-turn periods, then join adjacent solids without distant face comparisons. */
export function periodicThreadPython(): string {
  if (currentGeometryMode() === 'simple') return '';
  return `def _protolab_thread_periods(build, p, h):
    if h <= 128*p:
        return build(h)
    period = 128*p
    count = int(math.floor(h/period))
    base = build(period)
    segments = []
    for index in range(count):
        segment = base.copy()
        segment.translate(App.Vector(0,0,index*period))
        segments.append(segment)
    remainder = h-count*period
    if remainder > 1e-9:
        segment = build(remainder)
        segment.translate(App.Vector(0,0,count*period))
        segments.append(segment)
    while len(segments) > 1:
        segments = [segments[index].fuse(segments[index+1]) if index+1 < len(segments)
                    else segments[index] for index in range(0,len(segments),2)]
    result = segments[0]
    if result.isNull() or not result.isValid() or not result.isClosed() or len(result.Solids) != 1 or result.Volume <= 0:
        raise ValueError("Periodic thread segments must form one valid closed solid.")
    return result
`;
}

/** Kept local in each standalone generator so nested library exec scopes need no ambient helpers. */
export function nativeThreadPython(): string {
  if (currentGeometryMode() === 'simple') return '';
  return `${periodicThreadPython()}
_protolab_thread_cache = {}
def _protolab_thread(d, p, h, internal=False, left=False, clearance=0, rounded=False):
    key = (d, p, h, internal, left, clearance, rounded)
    if key in _protolab_thread_cache:
        return _protolab_thread_cache[key].copy()
    if p <= 0 or h <= 0:
        raise ValueError("Thread dimensions must be positive.")
    # Female tools retain a continuous sweep for subsequent cuts into pilot bores.
    if not internal and h > 128*p:
        result = _protolab_thread_periods(lambda length: _protolab_thread(d,p,length,internal,left,clearance,rounded),p,h)
        _protolab_thread_cache[key] = result.copy()
        return result
    major = d / 2 + clearance
    depth = 0.1*p if rounded else p * math.sqrt(3) * (5 / 16 if internal else 17 / 48)
    root = major - depth
    if root <= 0 or p <= 0 or h <= 0:
        raise ValueError("Thread dimensions leave no positive core.")
    crest = p / 8
    base = crest + 2 * depth / math.sqrt(3)
    half_root = (p - base) / 2
    overlap = 0.08 * p
    half_outer = (p - crest) / 2 + overlap / math.sqrt(3)
    points = [App.Vector(root,0,-half_root), App.Vector(major+overlap,0,-half_outer), App.Vector(major+overlap,0,half_outer), App.Vector(root,0,half_root)]
    profile = Part.Wire(Part.makePolygon(points + [points[0]]).Edges)
    # Male and female profiles share the nominal outer-radius sweep frame,
    # independent of root depth or an explicitly configured radial allowance.
    track = d / 2
    if rounded:
        track = major + 0.06*p
        profile = Part.Wire([Part.makeCircle(0.16*p,App.Vector(track,0,0),App.Vector(0,1,p/(2*math.pi*track)))])
    path = Part.Wire(Part.makeLongHelix(p, h + 2*p, track, 0, left).Edges)
    groove = path.makePipeShell([profile], True, True)
    if groove.Volume < 0:
        groove.reverse()
    groove.translate(App.Vector(0,0,-p/2))
    result = Part.makeCylinder(major,h).cut(groove)
    if result.isNull() or not result.isValid() or not result.isClosed() or len(result.Solids) != 1 or result.Volume <= 0:
        raise ValueError("The helical thread must be one valid closed solid.")
    _protolab_thread_cache[key] = result.copy()
    return result
`;
}

export function nativeThreadExpression(thread: NativeThread): string {
  const {
    diameter,
    pitch,
    length,
    internal = false,
    left = false,
    clearance = 0,
    rounded = false,
  } = thread;
  const radius = diameter / 2 + clearance;
  return currentGeometryMode() === 'full'
    ? `_protolab_thread(${diameter},${pitch},${length},${internal ? 'True' : 'False'},${left ? 'True' : 'False'},${clearance},${rounded ? 'True' : 'False'})`
    : `Part.makeCylinder(${radius},${length})`;
}

/** Remove only the thread's annular grooves, retaining the original tip and head transition. */
export function externalThreadPython(thread: NativeThread): string {
  if (currentGeometryMode() === 'simple') return '';
  return `${nativeThreadPython()}\n_thread_body = ${nativeThreadExpression(thread)}\n_thread_grooves = Part.makeCylinder(${thread.diameter / 2 + 0.01},${thread.length}).cut(_thread_body)\nshape = shape.cut(_thread_grooves)`;
}

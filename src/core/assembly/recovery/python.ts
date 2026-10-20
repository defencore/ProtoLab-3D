import { threadMetadataPython } from '../../thread-callouts';
import { threadFeatures } from './thread-features';
import type { Shape } from './shapes';
import { pythonShape } from './shapes';
import { threadPython } from './thread';
import { springPython } from './spring';

export function recoveryDetailPython(shape: Shape): string {
  return [
    ...threadPython(),
    ...springPython,
    '_release_fastener_cache={}',
    'def _release_fastener(code,offset):',
    '    if code not in _release_fastener_cache:',
    '        scope={"Part":Part,"App":App,"math":math}',
    '        exec(code,scope)',
    '        s=scope["shape"]',
    '        s.translate(App.Vector(0,0,offset))',
    '        _release_fastener_cache[code]=s',
    '    return _release_fastener_cache[code].copy()',
    'def _release_rotate(shape,angle,axis):',
    '    shape.rotate(App.Vector(0,0,0),App.Vector(1,0,0) if axis=="x" else App.Vector(0,1,0),angle)',
    '    return shape',
    'def _release_place(shape,angle,offset):',
    '    shape.rotate(App.Vector(0,0,0),App.Vector(0,0,1),angle)',
    '    shape.translate(App.Vector(*offset))',
    '    return shape',
    `shape=${pythonShape(shape)}`,
    threadMetadataPython(threadFeatures(shape)),
  ].join('\n');
}

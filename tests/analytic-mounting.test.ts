import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import springPin from '../src/parts/spring-pin/part';
import adapter from '../src/parts/adapter-sleeve/part';
import linear from '../src/parts/linear-bearing/part';
import square from '../src/parts/flanged-linear-bearing/part';
import round from '../src/parts/round-flange-linear-bearing/part';

test(
  'native analytic mounting geometry retains pin slits, tapers and bushing return channels',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const cases = [springPin, adapter, linear, square, round].flatMap((part) =>
      (part.states?.map((state) => state.id) ?? ['default']).map((state) => ({
        id: part.id,
        state,
        parameters: part.defaults,
        source: part.python(part.defaults, state),
      })),
    );
    const code = `import sys,json,math
sys.path.insert(0,${JSON.stringify(process.env.FREECAD_LIB ?? '/Applications/FreeCAD.app/Contents/Resources/lib')})
import FreeCAD as App, Part
cases=json.loads(${JSON.stringify(JSON.stringify(cases))})
for case in cases:
    p=case['parameters']; scope={'App':App,'Part':Part,'math':math}
    exec(case['source'],scope)
    shape=scope['shape']
    assert shape.isValid() and shape.isClosed() and shape.Volume>0,case['id']
    if case['id']=='spring-pin':
        r=(p['diameter']+(p['oversize'] if case['state']=='free' else 0))/2
        assert len(shape.Solids)==1 and len(shape.Faces)<=12
        assert shape.isInside(App.Vector(-(r-p['wall']/2),0,0),1e-7,True)
        assert not shape.isInside(App.Vector(r-p['wall']/2,0,0),1e-7,True), 'Slit must remain open'
        assert not shape.isInside(App.Vector(),1e-7,True), 'Hollow bore must remain open'
        assert not shape.isInside(App.Vector(-(r-p['wall']*.1),0,p['length']/2-p['chamfer']*.1),1e-7,True), 'End chamfer disappeared'
        assert sum(type(face.Surface).__name__=='Cone' for face in shape.Faces)==2
    elif case['id']=='adapter-sleeve':
        assert len(shape.Solids)==2 and len(shape.Faces)<=40
        sleeve,nut=shape.childShapes()
        assert any(type(face.Surface).__name__=='Cone' for face in sleeve.Faces)
        assert any(type(edge.Curve).__name__=='Circle' for edge in nut.Edges), 'Nut arcs must be circles'
        assert not sleeve.isInside(App.Vector((p['bore']+p['seatDiameter'])/4,0,0),1e-7,True), 'Sleeve split must remain open'
    else:
        cage=scope['components'][1]
        assert len(cage.Solids)==1 and len(cage.Faces)<=4*p['circuits']+10
        assert any(type(face.Surface).__name__=='Cylinder' for face in cage.Faces)
        r=p['bore']/2; R=p['outer']/2
        ball=min(r*.12,(R-r)*.16,p['width']*.025)
        if case['state']=='assembled':
            assert not cage.isInside(App.Vector(r+3.5*ball,0,0),1e-7,True), 'Return channel blocked'
            assert cage.isInside(App.Vector(r+4.81*ball,0,0),1e-7,True), 'Outer return-channel wall disappeared'
        else:
            assert cage.optimalBoundingBox(False,False).XMax<=1e-7, 'Cutaway plane moved'
    assert len(scope['component_colors'])==(len(scope['components']) if 'components' in scope else len(shape.childShapes()) if shape.ShapeType=='Compound' else 1)
print('PASS analytic mounting geometry')
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 60000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PASS analytic mounting geometry/);
  },
);

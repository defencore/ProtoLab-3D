import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Euler, Matrix4, Vector3 } from 'three';
import { withGeometryMode } from '../src/core/geometry-mode';
import type { Shape } from '../src/core/assembly/boundary/shapes';
import old64, { cncPieces, cncFramePieces, cncLayout, type CncVariant } from '../src/parts/tr8-quad-cnc-actuator/part';
import old56 from '../src/parts/tr8-quad-staggered-actuator/part';
import guided64, { guidedPieces, guidedFramePieces, guideShape, centralGuideFaces, centralGuideLayout } from '../src/parts/tr8-quad-guided-actuator/part';
import guided56 from '../src/parts/tr8-quad-guided-staggered-actuator/part';
import before from './fixtures/tr8-cnc-original-geometry-sha256.json';
import { nativeSourcesBeforeIdentity } from './helpers/study-source-baselines';

const close = (a:number,b:number,tolerance=1e-8) => assert.ok(Math.abs(a-b)<tolerance, `${a} != ${b}`);
const hash = (value:string) => createHash('sha256').update(value).digest('hex');
const mixed = { angleA:-20, angleB:20, angleC:-20, angleD:20 };
const numeric=(value:number)=>Number(value.toFixed(8));
function worldRecipe(shape:Shape,frame=new Matrix4()):unknown {
  if(shape.kind==='transform') {
    const local=new Matrix4().makeRotationFromEuler(new Euler(...shape.rotation.map(v=>v*Math.PI/180) as [number,number,number],'ZYX')).setPosition(...shape.translation);
    return worldRecipe(shape.child,frame.clone().multiply(local));
  }
  if('children' in shape)return{kind:shape.kind,children:shape.children.map(child=>worldRecipe(child,frame))};
  const point=(p:number[])=>new Vector3(...p as [number,number,number]).applyMatrix4(frame).toArray().map(numeric);
  if(shape.kind==='cylinder')return{...shape,origin:point(shape.origin),frame:frame.elements.slice(0,12).map(numeric)};
  if(shape.kind==='box')return{kind:shape.kind,corners:[0,1].flatMap(a=>[0,1].flatMap(b=>[0,1].map(c=>point([a,b,c].map((v,i)=>shape.origin[i]+v*shape.size[i])))))};
  throw new Error('Unexpected integral-frame feature '+shape.kind);
}
const worldFrame=(placement:{translation:[number,number,number];rotation:[number,number,number]})=>new Matrix4().makeRotationFromEuler(new Euler(...placement.rotation.map(v=>v*Math.PI/180) as [number,number,number],'ZYX')).setPosition(...placement.translation);

test('existing CNC products keep all eight source and occurrence baselines', () => {
  assert.equal(before.length,8);
  assert.notEqual(old64.defaults, old56.defaults);
  assert.notEqual(old64.parameters, old56.parameters);
  const sources = before.map((row) => withGeometryMode(row.mode as 'simple'|'full',()=> {
    const variant=row.variant as CncVariant, part=variant==='coplanar-64'?old64:old56;
    close(cncLayout(variant).diameter,variant==='coplanar-64'?64:56);
    assert.deepEqual(part.identityParameters!(row.parameters), {...row.parameters, angleA:0, angleB:0, angleC:0, angleD:0});
    const source = part.python(row.parameters,'assembled');
    assert.equal(hash(JSON.stringify(cncPieces(row.parameters,'assembled',variant))),row.piecesSha256);
    return source;
  }));
  const physicalSources = nativeSourcesBeforeIdentity(sources);
  for (const [index, row] of before.entries())
    assert.equal(hash(physicalSources[index]), row.sourceSha256);
});

for (const [variant,part,original] of [
  ['coplanar-64',guided64,old64],['staggered-56',guided56,old56],
] as const) {
  test(`${variant}: central guide changes only the existing middle solid`,()=> {
    assert.notEqual(part.id,original.id);
    for (const angles of [{angleA:0,angleB:0,angleC:0,angleD:0},mixed]) {
      const parameters={...part.defaults,...angles};
      const old=cncPieces(parameters,'assembled',variant), now=guidedPieces(parameters,'assembled',variant);
      assert.equal(old.length,123); assert.equal(now.length,old.length);
      const unchanged=now.filter(p=>p.component.id!=='cnc-middle-body');
      assert.deepEqual(unchanged,old.filter(p=>p.component.id!=='cnc-middle-body'));
      assert.equal(unchanged.filter(p=>/^[abcd]-/.test(p.component.id)).length,112);
      const oldBody=old.find(p=>p.component.id==='cnc-middle-body')!, newBody=now.find(p=>p.component.id==='cnc-middle-body')!;
      const recipe=JSON.parse(String(newBody.component.parameters.recipe));
      assert.equal(recipe.kind,'union');
      const physical=worldRecipe(recipe,worldFrame(newBody.component.placement)) as {kind:string;children:unknown[]};
      assert.deepEqual(physical.children,[worldRecipe(JSON.parse(String(oldBody.component.parameters.recipe)),worldFrame(oldBody.component.placement)),worldRecipe(guideShape(cncLayout(variant)))]);
      assert.equal(newBody.color,oldBody.color);
    }
    assert.equal(guidedFramePieces(cncLayout(variant)).length,cncFramePieces(cncLayout(variant)).length);
    assert.deepEqual(guidedPieces(part.defaults,'negative-limit',variant).filter(p=>!p.component.id.startsWith('a-')),
      guidedPieces({...part.defaults,angleA:-20,angleB:-20,angleC:-20,angleD:-20},'assembled',variant).filter(p=>!p.component.id.startsWith('a-')));
  });

  test(`${variant}: four stationary guide faces cover complete carrier pads through the continuous stroke`,()=> {
    const layout=cncLayout(variant), spec=centralGuideLayout(layout), faces=centralGuideFaces(layout);
    assert.equal(faces.length,4);
    for (const [index,face] of faces.entries()) {
      assert.equal(face.channel,index); close(face.clock,layout.clock+index*90);
      close(Math.hypot(face.origin[1],face.origin[2]),layout.outputRadial);
      close(-6.5-face.localFaceY,.05);
      assert.ok(face.xSpan[0]<face.padXEnvelope[0]);
      assert.ok(face.xSpan[1]>face.padXEnvelope[1]);
      assert.ok(face.localZSpan[0]<face.padZSpan[0]);
      assert.ok(face.localZSpan[1]>face.padZSpan[1]);
      close(face.padZSpan[1]-face.padZSpan[0],8);
      assert.ok(face.xSpan[0]>layout.middleBase[0] && face.xSpan[0]<layout.middleBase[1]);
      assert.ok(face.xSpan[1]<layout.endPlateX);
      assert.ok(face.finThickness>0 && spec.coreHalfWidth>face.finThickness);
    }
    assert.deepEqual(guidedFramePieces(layout),guidedPieces({...part.defaults,...mixed},'assembled',variant).filter(p=>! /^[abcd]-/.test(p.component.id)));
  });

  test(`${variant}: original laser contours and hardware remain unchanged`,()=> {
    const old=original.fabricationFiles!(original.defaults), files=part.fabricationFiles!(part.defaults);
    for (const id of ['motor-disc-dxf','motor-disc-svg','end-disc-dxf','end-disc-svg','fork-dxf','fork-svg']) {
      assert.equal(files.find(f=>f.id===id)!.content,old.find(f=>f.id===id)!.content,id);
    }
    const machining=JSON.parse(files.find(f=>f.id==='machining')!.content);
    assert.equal(machining.centralNutGuide.integralToMiddleBody,true);
    assert.equal(machining.centralNutGuide.additionalFasteners,0);
    assert.ok(!('nominalFirstRollContactDegrees' in machining.linkage));
    assert.equal(new Set(files.map(f=>f.name)).size,files.length);
    assert.ok(files.every(f=>f.name.includes('-guided-')));
    for(const preset of part.presets) {
      assert.ok(preset.id.startsWith(part.id+'-'));
      assert.deepEqual(part.validate(preset.parameters,'assembled'),[]);
    }
    assert.deepEqual(part.composition!({...part.defaults,...mixed}),part.composition!(part.defaults));
  });
}

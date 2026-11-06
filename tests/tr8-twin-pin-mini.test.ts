import assert from 'node:assert/strict';
import test from 'node:test';
import {withGeometryMode} from '../src/core/geometry-mode';
import part,{pieces,channelPieces,framePieces,frameProfiles,layout,compact,diameterLimit,cuttingProfiles,columnLines} from '../src/parts/tr8-quad-twin-pin-mini-actuator/part';
import original,{channelPieces as previousChannel,framePieces as previousFrame,frameProfiles as previousProfiles} from '../src/parts/tr8-quad-twin-pin-actuator/part';

const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const moved=new Set(['output-bearing-1','output-spacer','output-circlip-1']);
const replaced=new Set(['output-shaft','output-long-spacer']);
test('Ø54 changes only the outward bearing stack in each accepted drive',()=>{
  for(const mode of ['simple','full'] as const)for(const angle of [-20,0,20])withGeometryMode(mode,()=>{
    const old=previousChannel(original.defaults,angle),now=channelPieces(part.defaults,angle);
    assert.equal(now.length,old.length);
    for(const piece of now) {
      const prior=old.find(p=>p.component.id===piece.component.id)!;assert.ok(prior);
      if(replaced.has(piece.component.id))continue;
      if(!moved.has(piece.component.id)) {assert.deepEqual(piece,prior);continue;}
      assert.deepEqual(piece.component.parameters,prior.component.parameters);
      assert.deepEqual(piece.component.placement.rotation,prior.component.placement.rotation);
      close(piece.component.placement.translation[1],prior.component.placement.translation[1]-5);
      close(piece.component.placement.translation[0],prior.component.placement.translation[0]);
      close(piece.component.placement.translation[2],prior.component.placement.translation[2]);
    }
  });
});
test('three smaller discs retain all fifteen sheet blanks and unchanged crank/outer-cheek profiles',()=>{
  const profiles=cuttingProfiles();assert.equal(profiles.length,6);assert.equal(profiles.reduce((sum,p)=>sum+p.quantity,0),15);
  assert.deepEqual([...new Set(profiles.map(p=>p.thickness))].sort(),[2,3]);
  for(const id of ['output-bearing-cheek'])assert.deepEqual(frameProfiles().find(p=>p.id===id),previousProfiles().find(p=>p.id===id));
  const discs=profiles.filter(p=>p.id.endsWith('-disc'));assert.equal(discs.length,3);
  for(const disc of discs)close(disc.circles[0].radius,27);
  assert.equal(framePieces().length,27);
  assert.equal(framePieces().filter(p=>p.component.id.includes('central-slot-guide')).length,4);
});
test('column and guide mounts match the compact frame without changing bought hardware',()=>{
  const frame=framePieces(),old=previousFrame();
  for(const piece of frame.filter(p=>p.component.libraryId==='pcb-standoff'||p.component.libraryId==='bolt-screw')) {
    const prior=old.find(p=>p.component.id===piece.component.id)!;
    assert.deepEqual(piece.component.parameters,prior.component.parameters);
    piece.component.placement.rotation.forEach((v,i)=>close(v,prior.component.placement.rotation[i]));
  }
  for(const [y,z] of columnLines())close(Math.hypot(y,z),23.5);
  assert.equal(frame.filter(p=>p.component.id.includes('central-slot-guide')).length,4);
});
test('54 mm is the smallest whole diameter containing the unchanged crank',()=>{
  const limit=diameterLimit();assert.ok(limit.minimumDiameter>53&&limit.minimumDiameter<54);
  close(Math.ceil(limit.minimumDiameter),54);assert.ok(limit.nominalRadialMargin>0.2);
  close(layout.outputTail-compact.shaftEnd,29.95);close(compact.sleeveTo-compact.sleeveFrom,.95);
  close(layout.outputBearingCentres[1]-layout.outputBearingCentres[0],17.7);
  assert.ok(layout.outputTail-6.2>layout.outputClip+.4+1);
});
test('new independent configurations validate and have the smaller bounding size',()=>{
  assert.equal(part.presets.length,16);
  for(const preset of part.presets)assert.deepEqual(part.validate(preset.parameters,'assembled'),[]);
  assert.deepEqual(part.dimensions(part.defaults,'assembled').map(v=>Math.round(v*1000)/1000),[131,54,54]);
  assert.deepEqual(original.dimensions(original.defaults,'assembled').map(v=>Math.round(v*1000)/1000),[131,64,64]);
  const before=pieces(part.defaults),after=pieces({...part.defaults,angleB:-17});
  assert.equal(before.length,115);assert.deepEqual(before.filter(p=>!p.component.id.startsWith('b-')),after.filter(p=>!p.component.id.startsWith('b-')));
});
test('disc construction keeps a solid option and only adds four isolated lightening holes',()=>{
  for(const role of ['motor','fixed','end']) {
    const solid=frameProfiles(true,'solid').find(p=>p.id===role+'-disc')!;
    const light=frameProfiles(true,'lightened').find(p=>p.id===role+'-disc')!;
    assert.deepEqual(light.circles.slice(0,-4),solid.circles);
    assert.deepEqual(light.loops,solid.loops);assert.equal(light.circles.length,solid.circles.length+4);
  }
  assert.deepEqual(part.validate({...part.defaults,discPattern:'solid'},'assembled'),[]);
  assert.ok(part.validate({...part.defaults,discPattern:'unknown'},'assembled').length);
});
test('Ø54 fabrication exports carry current discs, short shafts and sleeves',()=>{
  const files=part.fabricationFiles!(part.defaults);assert.equal(new Set(files.map(f=>f.name)).size,files.length);
  assert.ok(files.every(f=>f.name.startsWith('TR8-twin-pin-54-')));
  const schedule=JSON.parse(files.find(f=>f.id==='machining')!.content);
  assert.equal(schedule.discDiameter,54);close(schedule.shaft.finishedLength,29.95);close(schedule.shortSleeve.length,.95);
  close(schedule.shaft.bearingSpan,17.7);close(schedule.shaft.grooveCentre,14.4);
  const manifest=JSON.parse(files.find(f=>f.id==='cut-manifest')!.content);assert.equal(manifest.physicalBlanks,15);
});

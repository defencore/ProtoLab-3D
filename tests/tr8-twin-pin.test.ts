import assert from 'node:assert/strict';
import test from 'node:test';
import {withGeometryMode} from '../src/core/geometry-mode';
import part,{pieces,channelPieces,framePieces,frameProfiles,guideSlot,twinPin,layout,nutBore,cuttingProfiles,threadLayout} from '../src/parts/tr8-quad-twin-pin-actuator/part';
import {tr8NutShape} from '../src/parts/tr8-compact-actuator/part';
import {nutTravel} from '../src/parts/tr8-quad-cnc-actuator/part';

const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('one custom nut and one monolithic crank replace each H-nut/carrier stack',()=>{
  for(const angle of [-20,0,20]) {
    const local=channelPieces(part.defaults,angle),ids=local.map(p=>p.component.id);
    assert.equal(ids.filter(id=>id==='lead-nut').length,1);
    assert.equal(ids.filter(id=>id==='output-crank').length,1);
    for(const omitted of ['nut-yoke','nut-flange-negative','nut-flange-positive','output-bearing-0','output-inner-spacer','output-inter-spacer'])assert.ok(!ids.includes(omitted));
    const nut=local.find(p=>p.component.id==='lead-nut')!.component;
    assert.equal(nut.supply,'manufactured');assert.ok(!nut.procurement);
    assert.ok(nut.manufacturing?.requirements.some(r=>r.includes('BOTH integral')));
    assert.equal(local.filter(p=>p.component.libraryId==='flanged-ball-bearing'&&p.component.id.startsWith('output-')).length,2);
  }
});
test('laser guides and supports are fifteen flat blanks, all3 mm, with no CNC spine',()=>{
  assert.equal(framePieces().length,27);
  assert.equal(framePieces().filter(p=>p.component.id.includes('central-slot-guide')).length,4);
  assert.equal(framePieces().filter(p=>p.component.id.endsWith('-outer-cheek')).length,4);
  assert.ok(framePieces().every(p=>!p.component.id.includes('central-nut-guide')));
  const profiles=cuttingProfiles();assert.equal(profiles.length,6);
  assert.equal(profiles.reduce((sum,p)=>sum+p.quantity,0),15);
  assert.ok(profiles.every(p=>p.thickness===3));
  assert.equal(frameProfiles().find(p=>p.id==='central-slot-guide')!.quantity,4);
});
test('the custom nut keeps the audited four-start tool and exactly8 mm thread metadata',()=>{
  assert.equal(threadLayout.nutThreadLength,8);
  for(const mode of ['simple','full'] as const)for(const center of [-nutTravel(layout,20),0,nutTravel(layout,20)])withGeometryMode(mode,()=>{
    const old=tr8NutShape({flangeFaceX:center-6,neutralFlangeFaceX:-6,screwAxisZ:10,longAxis:'z'});
    assert.equal(old.kind,'subtract');if(old.kind==='subtract')assert.deepEqual(nutBore(center),old.children[1]);
  });
});
test('the two follower paths cover the complete coupled angle interval',()=>{
  const travel=nutTravel(layout,20);close(guideSlot.half,travel+.05);
  close(10-twinPin.nutRadius-3,.5);assert.ok(13-travel-twinPin.nutLength/2>5.36);
  for(const angle of [-20,-13.2,0,8.7,20]) {
    const a=angle*Math.PI/180,x=nutTravel(layout,angle);
    close(Math.cos(a)*x-Math.sin(a)*10,0);
    const radius=Math.sin(a)*x+Math.cos(a)*10;
    assert.ok(radius>=10&&radius<=10/Math.cos(Math.PI/9)+1e-10);
    assert.ok(Math.abs(x)<guideSlot.half);
  }
});
test('independent channels, defaults and complete new presets validate',()=>{
  assert.equal(part.presets.length,8);
  for(const preset of part.presets)assert.deepEqual(part.validate(preset.parameters,'assembled'),[]);
  const neutral=pieces(part.defaults),mixed=pieces({...part.defaults,angleC:19});
  assert.equal(neutral.length,115);
  assert.deepEqual(mixed.filter(p=>!p.component.id.startsWith('c-')),neutral.filter(p=>!p.component.id.startsWith('c-')));
  assert.deepEqual(part.dimensions(part.defaults,'assembled').map(v=>Math.round(v*1000)/1000),[131,64,64]);
  assert.ok(part.validate({...part.defaults,angleB:20.1},'assembled').length);
});
test('public fabrication files match the current one-piece route',()=>{
  const files=part.fabricationFiles!(part.defaults);
  assert.equal(new Set(files.map(f=>f.name)).size,files.length);
  const manifest=JSON.parse(files.find(f=>f.id==='cut-manifest')!.content);
  assert.equal(manifest.onePieceNuts,4);assert.equal(manifest.onePieceCranks,4);assert.equal(manifest.physicalBlanks,15);
  const schedule=JSON.parse(files.find(f=>f.id==='machining')!.content);
  close(schedule.shaft.bearingSpan,22.7);assert.equal(schedule.guide.innerBearing,'SMB MF63 2Z 3x6x2.5; flange7.2x0.6');
});

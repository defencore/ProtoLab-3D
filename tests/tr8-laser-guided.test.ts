import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Vector3 } from 'three';
import part, { laserPieces, laserChannelPieces, laserFramePieces, centralGuidePiece, centralGuideShape, layout } from '../src/parts/tr8-quad-laser-guided-actuator/part';
import { framePieces, laserProfiles, bearingCheeks, receiverSlots, columnStages, discStations } from '../src/parts/tr8-quad-laser-guided-actuator/lib/frame';
import { crankPieces, crankProfiles, laminatedCrank } from '../src/parts/tr8-quad-laser-guided-actuator/lib/crank';
import { channelPieces as originalChannel, cncLayout } from '../src/parts/tr8-quad-cnc-actuator/part';
import { actuatorMatingThreads, actuatorExternalThreads } from '../src/parts/tr8-compact-actuator/lib/mating';
import standoff from '../src/parts/pcb-standoff/part';
import preserved from './fixtures/tr8-sfk-before-laser-source-sha256.json';
import { preservedStudySource } from './helpers/study-source-baselines';

const close = (a:number,b:number,tolerance=1e-8) => assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const digest = (value:Buffer) => createHash('sha256').update(value).digest('hex');
const mixed = { angleA:-20,angleB:20,angleC:-20,angleD:20 };

test('all pre-existing TR8 and SFK source packages remain unchanged',()=>{
  assert.equal(Object.keys(preserved).length,10);
  for(const [family,files] of Object.entries(preserved))for(const [file,checksum] of Object.entries(files)) {
    const actual=readFileSync(new URL(`../src/parts/${family}/${file}`,import.meta.url));
    assert.equal(digest(preservedStudySource(family+'/'+file, actual)),checksum,family+'/'+file);
  }
});

test('laser frame retains the compact drive datums and three accurately spaced 3 mm discs',()=>{
  assert.equal(part.id,'tr8-quad-laser-guided-actuator');
  assert.deepEqual(discStations,[-51,-18,15]);
  assert.deepEqual(layout.middleBase,[-18,-15]);
  for(const key of ['diameter','screwPitchRadius','lever','outputRadial','motorFront','couplingCentre','endPlateX'] as const)
    close(layout[key],cncLayout('coplanar-64')[key]);
  close(layout.screwPitchRadius,layout.diameter/4);
  assert.equal(framePieces().length,27);
  assert.equal(laserFramePieces().length,28);
  assert.ok(laserFramePieces().some(p=>p.component.id===centralGuidePiece().component.id));
  const sheets=laserProfiles();
  assert.equal(sheets.length,4);
  assert.deepEqual(sheets.map(p=>[p.id,p.thickness,p.quantity]),[
    ['motor-disc',3,1],['fixed-disc',3,1],['end-disc',3,1],['output-bearing-cheek',3,8],
  ]);
  assert.ok(centralGuideShape());
});

test('eight standard catalog standoffs form two 30 mm stacks without extra shims',()=>{
  const frame=framePieces(), columns=frame.filter(p=>p.component.libraryId==='pcb-standoff');
  assert.equal(columns.length,8);
  assert.equal(frame.filter(p=>p.component.libraryId==='bolt-screw').length,8);
  assert.deepEqual(columnStages.map(s=>s.preset),['dremec-115x30','dremec-215x30']);
  assert.deepEqual(discStations.slice(1).map((x,i)=>x-discStations[i]-3),[30,30]);
  for(const {component:c} of columns) {
    const preset=standoff.presets.find(p=>p.id===c.presetId);
    assert.ok(preset);
    assert.deepEqual(c.parameters,{...standoff.defaults,...preset.parameters});
    assert.equal(c.parameters.bodyLength,30);
    assert.equal(c.parameters.femaleDepthA,10);
  }
  const females=actuatorMatingThreads(frame), males=actuatorExternalThreads(frame);
  assert.equal(males.length,12);
  for(const male of males) {
    const axis=new Vector3(...male.axis), origin=new Vector3(...male.origin);
    const overlaps=females.flatMap(f=>{
      if(f.componentId===male.componentId||f.diameter!==male.diameter||f.pitch!==male.pitch)return[];
      const fa=new Vector3(...f.axis), direction=axis.dot(fa);
      if(Math.abs(Math.abs(direction)-1)>1e-8)return[];
      const delta=origin.clone().sub(new Vector3(...f.origin)), start=delta.dot(fa);
      if(delta.addScaledVector(fa,-start).length()>1e-7)return[];
      const end=start+direction*male.length;
      return[Math.min(Math.max(start,end),f.length)-Math.max(Math.min(start,end),0)];
    });
    close(Math.max(...overlaps),5);
  }
});

test('all bearing supports have centred tabs seated inside the two laser receiver discs',()=>{
  const cheeks=bearingCheeks(), slots=receiverSlots();
  assert.equal(cheeks.length,8);assert.equal(slots.length,16);
  [...new Set(cheeks.map(c=>c.lowY))].sort((a,b)=>a-b).forEach((value,i)=>close(value,[11.1,14.9][i]));
  for(const cheek of cheeks) {
    const own=slots.filter(s=>s.unit===cheek.unit&&s.outer===cheek.outer);
    assert.equal(own.length,2);
    for(const slot of own) {
      close(slot.width,3.1);close(slot.height,3.1);
      close(slot.tabSpanX[1]-slot.tabSpanX[0],2.7);
      assert.ok(slot.tabSpanX[0]>=slot.receiverSpanX[0]);
      assert.ok(slot.tabSpanX[1]<=slot.receiverSpanX[1]);
      const phi=(layout.clock+90*slot.unit)*Math.PI/180;
      const radial=[Math.cos(phi),Math.sin(phi)], tangent=[-Math.sin(phi),Math.cos(phi)];
      close(slot.center[0]*tangent[0]+slot.center[1]*tangent[1],0);
      close(slot.center[0]*radial[0]+slot.center[1]*radial[1],layout.outputRadial+cheek.lowY+1.5);
    }
  }
});

for(const construction of ['laminated','solid'] as const)test(`${construction}: only output cranks change while all original drive interfaces remain`,()=>{
  const parameters={...part.defaults,...mixed,crankConstruction:construction};
  for(const angle of [-20,0,20]) {
    const old=originalChannel(parameters,angle,cncLayout('coplanar-64'));
    const current=laserChannelPieces(parameters,angle);
    const expected=old.filter(p=>p.component.id!=='output-rear-crank');
    assert.deepEqual(current.filter(p=>!p.component.id.startsWith('output-crank-')&&p.component.id!=='output-rear-crank'),expected);
    assert.equal(current.length,construction==='laminated'?31:28);
  }
  const pieces=laserPieces(parameters);
  assert.equal(pieces.length,construction==='laminated'?152:140);
  assert.equal(new Set(pieces.map(p=>p.component.id)).size,pieces.length);
  const onlyB=laserPieces({...parameters,angleB:7});
  assert.deepEqual(onlyB.filter(p=>!p.component.id.startsWith('b-')),pieces.filter(p=>!p.component.id.startsWith('b-')));
  assert.deepEqual(part.composition!(parameters),part.composition!({...parameters,angleA:17,angleC:12}));
  assert.deepEqual(part.validate(parameters,'assembled'),[]);
});

test('laminated cranks expose actual four laser parts and preserve the original 3 mm thickness',()=>{
  const profiles=crankProfiles(layout), pieces=crankPieces(layout,0);
  assert.equal(pieces.length,4);
  assert.deepEqual(profiles.map(p=>[p.id,p.thickness,p.quantity]),[
    ['crank-cover',.5,8],['crank-upper-web',2,4],['crank-lower-web',2,4],
  ]);
  assert.ok(laminatedCrank);
  assert.ok(pieces.every(p=>p.component.supply==='manufactured'));
  assert.ok(pieces.every(p=>p.component.manufacturing?.processes.includes('cutting')));
});

test('eight complete presets expose both crank constructions and reject invalid commands',()=>{
  assert.equal(part.presets.length,8);
  assert.equal(new Set(part.presets.map(p=>p.id)).size,8);
  assert.deepEqual([...new Set(part.presets.map(p=>p.parameters.crankConstruction))].sort(),['laminated','solid']);
  for(const preset of part.presets)assert.deepEqual(part.validate(preset.parameters,'assembled'),[]);
  assert.ok(part.validate({...part.defaults,angleA:20.01},'assembled').length);
  assert.ok(part.validate({...part.defaults,crankConstruction:'unknown'},'assembled').length);
});

test('fabrication selections keep distinct files, stock counts and assembly instructions',()=>{
  const names=new Set<string>();
  for(const construction of ['laminated','solid']) {
    const files=part.fabricationFiles!({...part.defaults,crankConstruction:construction});
    assert.equal(new Set(files.map(file=>file.name)).size,files.length);
    assert.equal(new Set(files.map(file=>file.id)).size,files.length);
    const manifest=JSON.parse(files.find(file=>file.id==='cut-manifest')!.content);
    assert.equal(manifest.mainDiscs,3);assert.equal(manifest.bearingCheeks,8);
    assert.equal(manifest.separateMilledGuides,1);
    assert.equal(manifest.physicalLaserBlanks,construction==='laminated'?27:15);
    assert.deepEqual(manifest.stockThicknesses,construction==='laminated'?[.5,2,3]:[3]);
    assert.ok(files.find(file=>file.id==='assembly')!.content.includes(construction==='laminated'?'weld':'Match-drill'));
    for(const file of files) {assert.ok(!names.has(file.name),'Selections overwrite '+file.name);names.add(file.name);}
  }
});

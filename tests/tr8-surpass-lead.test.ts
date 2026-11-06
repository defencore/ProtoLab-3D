import assert from 'node:assert/strict';
import test from 'node:test';
import type {Shape} from '../src/core/assembly/boundary/shapes';
import {withGeometryMode} from '../src/core/geometry-mode';
import part,{channelPieces,pieces,driveMotion,selectedDrive,threadLayout} from '../src/parts/tr8-quad-surpass-actuator/part';
import {driveThreadCallout} from '../src/parts/tr8-compact-actuator/part';

const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const single={...part.defaults,screwModel:'tr8x2-p2'};
function helices(shape:Shape):Extract<Shape,{kind:'helical-worm'}>[] {
  if(shape.kind==='helical-worm')return[shape];
  if('child' in shape)return helices(shape.child);
  if('children' in shape)return shape.children.flatMap(helices);
  return[];
}
test('Surpass offers matched single- and four-start screws for both disc patterns',()=>{
  assert.equal(part.defaults.screwModel,'tr8x8-p2');
  assert.deepEqual(part.parameters.find(p=>p.key==='screwModel')!.options!.map(o=>o.value),['tr8x8-p2','tr8x2-p2']);
  assert.equal(part.presets.length,4);
  assert.equal(new Set(part.presets.map(p=>p.parameters.screwModel+'/'+p.parameters.discPattern)).size,4);
  for(const preset of part.presets)assert.deepEqual(part.validate(preset.parameters,'assembled'),[]);
  assert.ok(part.validate({...single,screwModel:'tr8x4-p2'},'assembled').length);
  assert.throws(()=>selectedDrive({...single,screwModel:'tr8x4-p2'}));
});
test('lead selection changes only four screws and their matching nuts, retaining the installed envelopes',()=>{
  for(const mode of ['simple','full'] as const)for(const angle of [-20,0,20])withGeometryMode(mode,()=>{
    const common={angleA:angle,angleB:angle,angleC:angle,angleD:angle};
    const old=pieces({...part.defaults,...common}),now=pieces({...single,...common});
    assert.equal(now.length,115);
    for(const piece of now) {
      const id=piece.component.id;
      if(!id.endsWith('lead-screw')&&!id.endsWith('lead-nut'))
        assert.deepEqual(piece,old.find(p=>p.component.id===id));
    }
  });
  assert.deepEqual(part.dimensions(single,'assembled'),part.dimensions(part.defaults,'assembled'));
});
test('actual male and female helices have the selected starts, lead and installed phase',()=>{
  for(const p of [part.defaults,single])withGeometryMode('full',()=>{
    const drive=selectedDrive(p);
    for(const angle of [-20,0,20]) {
      const channel=channelPieces(p,angle);
      for(const id of ['lead-screw','lead-nut']) {
        const shape=channel.find(c=>c.component.id===id)!.component.parameters.recipe;
        // Manufactured-detail shapes are encoded in their public parameters.
        const rows=helices(JSON.parse(String(shape)) as Shape);
        assert.equal(rows.length,1);
        const h=rows[0];assert.equal(h.lead,drive.lead);assert.equal(h.starts,drive.starts);
        assert.equal(h.lead/h.starts,2);
        if(id==='lead-screw')near(h.phase,driveMotion(p,angle).motorRotation*Math.PI/180);
        else near(h.phase,0);
      }
    }
  });
});
test('kinematics and instantaneous torque multiplication scale with inverse lead',()=>{
  for(const angle of [-20,-10,0,10,20]) {
    const a=driveMotion(part.defaults,angle),b=driveMotion(single,angle);
    near(a.nutTravel,b.nutTravel);near(b.motorRotation,4*a.motorRotation);near(b.idealTorqueRatio,4*a.idealTorqueRatio);
    const delta=1e-5,rad=delta*Math.PI/180;
    const slope=Math.abs((driveMotion(single,angle+delta).motorRotation-driveMotion(single,angle-delta).motorRotation)*Math.PI/180/(2*rad));
    assert.ok(Math.abs(slope-b.idealTorqueRatio)<1e-7);
  }
  near(driveMotion(single,0).idealTorqueRatio,10*Math.PI);
  near(Math.abs(2*driveMotion(single,20).motorRotation),1310.2928433583284);
});
test('machining, BOM, native details, callouts and motion files all describe the selected lead',()=>{
  const laserFiles=new Map<string,string>();
  for(const p of [part.defaults,single]) {
    const drive=selectedDrive(p);
    for(const mode of ['simple','full'] as const)withGeometryMode(mode,()=>{
      const files=part.fabricationFiles!(p),schedule=JSON.parse(files.find(f=>f.id==='machining')!.content);
      assert.equal(new Set(files.map(f=>f.name)).size,files.length);
      for(const thread of [schedule.screw,schedule.nut.thread]) {
        assert.equal(thread.lead,drive.lead);assert.equal(thread.starts,drive.starts);assert.equal(thread.pitch,2);
      }
      assert.ok(schedule.nut.manufacturing.requirements.some((r:string)=>r.includes('Tr8x'+drive.lead)));
      near(schedule.motion.motorSweepDegrees,Math.abs(2*driveMotion(p,20).motorRotation));
      for(const id of ['nut-native','screw-native']) {
        const content=files.find(f=>f.id===id)!.content;
        assert.ok(content.includes('Tr8x'+drive.lead+'(P2) RH'));
        assert.ok(!content.includes('Tr8x'+(drive.lead===2?8:2)+'(P2) RH'));
      }
      for(const row of files.find(f=>f.id==='motion')!.content.trim().split('\n').slice(1)) {
        const [angle,x,rotation,ratio]=row.split(',').map(Number),m=driveMotion(p,angle);
        near(x,m.nutTravel);near(rotation,m.motorRotation);near(ratio,m.idealTorqueRatio);
      }
      const bom=files.find(f=>f.id==='bom')!.content;
      assert.equal(bom.split('\n').filter(r=>r.includes('Steel TR8×'+drive.lead+'(P2) stock')).length,4);
      for(const file of files.filter(f=>/-(dxf|svg)$/.test(f.id))) {
        if(drive.lead===8)laserFiles.set(file.id,file.content);
        else assert.equal(file.content,laserFiles.get(file.id));
      }
      const callout=driveThreadCallout(false,-13,13,10,threadLayout(p).threadLead);
      assert.equal(callout.lead,drive.lead);assert.equal(callout.starts,drive.starts);
      assert.equal(callout.representation,mode==='full'?'machined-helix':'nominal-cylinder');
    });
  }
});

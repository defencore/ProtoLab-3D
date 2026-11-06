import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {Euler,Vector3} from 'three';
import {withGeometryMode} from '../src/core/geometry-mode';
import part,{pieces,channelPieces,framePieces,frameProfiles,mountingPoints,motorFit,layout,columnLines,guideSocketPoints} from '../src/parts/tr8-quad-surpass-actuator/part';
import old,{channelPieces as oldChannel,cuttingProfiles as oldProfiles} from '../src/parts/tr8-quad-twin-pin-mini-actuator/part';
import motor,{motorDimensions,mountHoles} from '../src/parts/surpass-2845/part';
import solidDiscHashes from './fixtures/tr8-surpass-solid-disc-sha256.json';
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('fixed2845 motor follows the branded drawing and declares its reconstruction scope',()=>{
  assert.deepEqual(motor.dimensions(motor.defaults,'assembled'),[28,28,62]);
  assert.deepEqual(motor.validate(motor.defaults,'assembled'),[]);
  assert.deepEqual(mountHoles,[[-8,0],[8,0],[0,-9.5],[0,9.5]]);
  assert.equal(motorDimensions.shaft,3.175);assert.equal(motorDimensions.length,47);
  assert.equal(motor.presets[0].catalog!.geometryEvidence!.kind,'source-dimensions');
  assert.ok(!motor.python(motor.defaults,'assembled').includes('MeshPart'));
});
test('each channel retains the approved linkage and changes only motor, mounts and coupling',()=>{
  for(const mode of ['simple','full'] as const)for(const angle of [-20,0,20])withGeometryMode(mode,()=>{
    const now=channelPieces(part.defaults,angle),prior=oldChannel(old.defaults,angle);
    assert.equal(now.length,prior.length);
    for(const piece of now.filter(p=>p.component.id!=='coupling'&&!p.component.id.startsWith('motor')))
      assert.deepEqual(piece,prior.find(p=>p.component.id===piece.component.id));
    const coupling=now.find(p=>p.component.id==='coupling')!.component;
    assert.equal(coupling.parameters.boreA,3.175);assert.equal(coupling.parameters.boreB,4);
    assert.equal(coupling.parameters.boreOption,'other');assert.equal(coupling.presetId,undefined);
    near(coupling.placement.translation[0],-32.4);
  });
});
test('motor mounts match the16 mm opposed pair in the installed motor frame',()=>{
  const rows=channelPieces(part.defaults,0),m=rows.find(p=>p.component.id==='motor')!.component;
  const e=new Euler(...m.placement.rotation.map(a=>a*Math.PI/180) as [number,number,number],'ZYX');
  const points=mountingPoints();
  [-1,1].forEach((sign,i)=>{
    const p=new Vector3(sign*8,0,0).applyEuler(e).add(new Vector3(...m.placement.translation));
    near(p.x,-51);near(p.y,points[i][0]);near(p.z,points[i][1]);
  });
  assert.equal(motorFit.threadEngagement,2);
  near(Math.min(-36,layout.couplingCentre-4)-(layout.couplingCentre-11),motorFit.motorShaftEngagement);
  near(Math.min(-21,layout.couplingCentre+11)-Math.max(-29,layout.couplingCentre+4),motorFit.screwShaftEngagement);
  near(-21-(layout.couplingCentre+11),motorFit.shoulderClearance);
  assert.ok(Math.SQRT2*layout.screwPitchRadius-28>.99);
  assert.deepEqual(channelPieces(part.defaults,-20).filter(p=>p.component.id.startsWith('motor')),channelPieces(part.defaults,20).filter(p=>p.component.id.startsWith('motor')));
});
test('new discs and mounting slots follow the wider channels with stock columns',()=>{
  near(Math.hypot(layout.outputRadial,layout.lever),20.5);
  for(const p of columnLines())near(Math.hypot(...p),30.5);
  for(const pattern of ['lightened','solid'] as const) {
    const profiles=frameProfiles(true,pattern),discs=profiles.filter(p=>p.id.endsWith('-disc'));
    assert.equal(discs.length,3);
    for(const d of discs) {
      near(d.circles[0].radius,35);assert.ok(d.circles.some(c=>c.radius===2.5&&c.center.every(v=>v===0)));
      for(const [i,c] of d.circles.slice(1).entries())for(const q of d.circles.slice(1,i+1))
        assert.ok(Math.hypot(c.center[0]-q.center[0],c.center[1]-q.center[1])-c.radius-q.radius>2.1);
    }
    assert.equal(discs[0].circles.filter(c=>c.radius===1.7).length,12);
    assert.deepEqual(discs[1].loops.slice(4).map(l=>l.map(e=>e.from)),[0,1,2,3].map(guideSocketPoints));
    assert.deepEqual(profiles.filter(p=>!p.id.endsWith('-disc')),oldProfiles(pattern).filter(p=>!p.id.endsWith('-disc')&&p.id!=='solid-crank'));
  }
  const frame=framePieces();assert.equal(frame.length,27);
  assert.ok(frame.filter(p=>p.component.id.startsWith('frame-front-bolt-')).every(p=>p.component.parameters.head==='socket-cap'));
});
test('execution validates and retains four independent outputs and115 occurrences',()=>{
  for(const preset of part.presets)assert.deepEqual(part.validate(preset.parameters,'assembled'),[]);
  const a=pieces(part.defaults),b=pieces({...part.defaults,angleB:-18});
  assert.equal(a.length,115);assert.equal(a.filter(p=>p.component.libraryId==='surpass-2845').length,4);
  assert.deepEqual(a.filter(p=>!p.component.id.startsWith('b-')),b.filter(p=>!p.component.id.startsWith('b-')));
  assert.ok(!a.some(p=>['gmp16-gearmotor','faulhaber-bx4'].includes(p.component.libraryId)));
  part.dimensions(part.defaults,'assembled').forEach((v,i)=>assert.ok(Math.abs(v-[119,70,70][i])<.001));
});
test('fabrication uses the wider frame, custom coupling and exact motor specification',()=>{
  for(const preset of part.presets) {
    const files=part.fabricationFiles!(preset.parameters);
    assert.equal(new Set(files.map(f=>f.name)).size,files.length);
    assert.ok(files.every(f=>f.name.startsWith('TR8-SURPASS-2845-70-')));
    const manifest=JSON.parse(files.find(f=>f.id==='cut-manifest')!.content);
    assert.equal(manifest.physicalBlanks,15);assert.equal(manifest.discDiameter,70);
    const schedule=JSON.parse(files.find(f=>f.id==='machining')!.content);
    assert.equal(schedule.motor.axesRadius,20.5);assert.deepEqual(schedule.coupling.bores,[3.175,4]);assert.equal(schedule.columns.bodyLength,30);
    const bom=files.find(f=>f.id==='bom')!.content;assert.equal(bom.split('\n').filter(l=>l.includes('Catalog-from-Suprass-Hobby_compressed')).length,4);
    assert.equal(bom.split('\n').filter(l=>l.includes('Other hole Ø3.175×4')).length,4);assert.ok(!bom.includes('FAULHABER'));
  }
});
test('larger lightening windows keep at least3 mm ligaments and preserve every mounting datum',()=>{
  const distance=(a:number[],b:number[])=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const segmentDistance=(p:number[],a:number[],b:number[])=>{
    const x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y)));
    return distance(p,[a[0]+t*x,a[1]+t*y]);
  };
  for(const pilot of [false,true]) {
    const solid=frameProfiles(pilot,'solid').filter(p=>p.id.endsWith('-disc'));
    const light=frameProfiles(pilot,'lightened').filter(p=>p.id.endsWith('-disc'));
    for(const profile of light) {
      const reference=solid.find(p=>p.id===profile.id)!;
      assert.deepEqual(profile.circles.slice(0,-4),reference.circles);assert.deepEqual(profile.loops,reference.loops);
      const windows=profile.circles.slice(-4);
      for(const [i,hole] of windows.entries()) {
        near(hole.radius,profile.id==='motor-disc'?6.75:5);
        near(Math.hypot(...hole.center),profile.id==='motor-disc'?12.5:21.8);
        assert.ok(35-Math.hypot(...hole.center)-hole.radius>=3);
        for(const other of [...reference.circles.slice(1),...windows.slice(0,i)])
          assert.ok(distance(hole.center,other.center)-hole.radius-other.radius>=3);
        for(const loop of reference.loops)for(const edge of loop) {
          assert.equal(edge.kind,'line');assert.ok(segmentDistance(hole.center,edge.from,edge.to)-hole.radius>=3);
        }
      }
      if(!pilot)assert.equal(createHash('sha256').update(JSON.stringify({thickness:reference.thickness,quantity:reference.quantity,
        circles:reference.circles,loops:reference.loops,shape:reference.shape})).digest('hex'),solidDiscHashes[profile.id as keyof typeof solidDiscHashes]);
    }
  }
  const schedule=JSON.parse(part.fabricationFiles!(part.defaults).find(f=>f.id==='machining')!.content);
  assert.ok(schedule.lightening.extraMassSavingFromPreviousLightenedG>16&&schedule.lightening.extraMassSavingFromPreviousLightenedG<16.5);
});

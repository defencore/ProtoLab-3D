import assert from 'node:assert/strict';
import test from 'node:test';
import {promActuatorBearings} from '../src/parts/flanged-ball-bearing/part';
import small,{pieces as smallPieces,channelPieces as smallChannel,frameProfiles as smallProfiles} from '../src/parts/tr8-quad-twin-pin-mini-actuator/part';
import large,{pieces as largePieces,channelPieces as largeChannel,frameProfiles as largeProfiles} from '../src/parts/tr8-quad-twin-pin-actuator/part';

test('both twin-pin sizes use the same three stock SKUs, without bore adapters or added occurrences',()=>{
  for(const [part,pieces,channel] of [[small,smallPieces,smallChannel],[large,largePieces,largeChannel]] as const) {
    const p={...part.defaults,bearingKit:'prom-smb'},rows=pieces(p);
    const bearings=rows.filter(r=>r.component.libraryId==='flanged-ball-bearing');
    const quantities=Object.fromEntries(promActuatorBearings.map(p=>[p.id,bearings.filter(r=>r.component.presetId===p.id).length]));
    assert.deepEqual(quantities,{'smb-mf105-2z':8,'smb-mf106-2z':4,'smb-mf63-2z':4});
    assert.equal(rows.length,pieces({...p,bearingKit:'reference'}).length-8);
    for(const row of bearings)assert.ok(row.component.procurement?.source?.startsWith('https://prom.ua/'));
    for(const angle of [-20,0,20]) {
      const old=channel({...p,bearingKit:'reference'},angle),now=channel(p,angle);
      for(const row of now)if(row.component.libraryId!=='flanged-ball-bearing'&&row.component.id!=='lead-screw'&&!/^(fixed|floating)-(inner|outer)-spacer$/.test(row.component.id))
        assert.deepEqual(row,old.find(o=>o.component.id===row.component.id));
      const screw=now.filter(r=>r.component.id.startsWith('screw-bearing-'));
      assert.deepEqual(screw.map(r=>r.component.placement.translation[0]),[-16.8,16.8]);
    }
  }
});

test('laser files, machining schedules and supplier BOM agree with the selected bearing kit',()=>{
  for(const part of [small,large])for(const kit of ['prom-smb','reference']) {
    const files=part.fabricationFiles!({...part.defaults,bearingKit:kit});
    const schedule=JSON.parse(files.find(f=>f.id==='machining')!.content);
    assert.equal(schedule.bearingKit,kit);
    assert.match(schedule.finishing.screwBearingPilots,kit==='prom-smb'?/9\.8.*10\.02/:/12\.8.*13\.02/);
    const csv=files.find(f=>f.id==='bom')!.content;
    if(kit==='prom-smb') {
      assert.equal((csv.match(/SMB MF105 2Z/g)??[]).length,16);
      assert.match(csv,/https:\/\/prom\.ua\//);
    }
  }
  for(const kit of ['prom-smb','reference'] as const) {
    for(const profiles of [largeProfiles(false,kit),smallProfiles(false,'lightened',kit)])
      for(const profile of profiles.filter(p=>/^(fixed|end)-disc$/.test(p.id)))
        assert.equal(profile.circles.filter(c=>Math.abs(c.radius-(kit==='prom-smb'?5.01:6.51))<1e-8).length,4);
  }
});

// Axial retention must remain explicit when the two internal rings are omitted.
test('two end rings and shoulder-supported sleeves replace the four-ring screw stack',()=>{
  for(const [part,pieces,channel] of [[small,smallPieces,smallChannel],[large,largePieces,largeChannel]] as const) {
    const now=channel(part.defaults,0),old=channel({...part.defaults,bearingKit:'reference'},0);
    assert.deepEqual(now.filter(p=>p.component.id.startsWith('screw-circlip-')).map(p=>p.component.placement.translation[0]),[-19.8,19.8]);
    assert.equal(old.filter(p=>p.component.id.startsWith('screw-circlip-')).length,4);
    assert.equal(pieces(part.defaults).filter(p=>p.component.id.includes('screw-circlip-')).length,8);
    const schedule=JSON.parse(part.fabricationFiles!(part.defaults).find(f=>f.id==='machining')!.content);
    assert.equal(schedule.screw.retainingRingsPerScrew,2);
    assert.deepEqual(schedule.screw.grooves.map((g:{center:number})=>g.center),[-19.8,19.8]);
    assert.deepEqual(schedule.screw.thrustShoulders,[-13,13]);
    const inner=schedule.screw.sleeves.filter((p:{id:string})=>p.id.includes('inner'));
    assert.deepEqual(inner.map((p:{from:number,to:number})=>[p.from,p.to]),[[-14.8,-13],[13,14.8]]);
    assert.ok(part.fabricationFiles!(part.defaults).some(f=>f.id==='screw-native'));
  }
});

test('every purchased bearing names its actual bore, body diameter and width in the model and BOM',()=>{
  for(const [part,pieces] of [[small,smallPieces],[large,largePieces]] as const) {
    for(const kit of ['prom-smb','reference'])for(const {component:c,label} of pieces({...part.defaults,bearingKit:kit}).filter(p=>p.component.libraryId==='flanged-ball-bearing')) {
      const expected=`${c.parameters.bore}×${c.parameters.outer}×${c.parameters.width} mm`;
      assert.ok(c.name.includes(expected),c.name);
      assert.equal(c.name,label);
      assert.ok(c.procurement!.designation.includes(expected));
    }
    const csv=part.fabricationFiles!(part.defaults).find(f=>f.id==='bom')!.content;
    for(const size of ['5×10×4 mm','6×10×3 mm','3×6×2.5 mm'])assert.ok(csv.includes(size));
  }
});

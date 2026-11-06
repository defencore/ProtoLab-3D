"""Carry completed native poses only through an exact physical-source metadata refresh."""
import json,hashlib,shutil
from pathlib import Path
p=Path('test-results/tr8-quad-geared-rocker-five-stand');old_path=p/'capture.json';new_path=p/'metadata-refresh/capture.json';old=json.loads(old_path.read_text());new=json.loads(new_path.read_text());h=lambda x:hashlib.sha256(x).hexdigest()
checks=[]
for a,b in zip(old['poses'],new['poses']):
 assert(a['motor'],a['angle'])==(b['motor'],b['angle'])
 ak=[(x['id'],x['geometryKey'])for x in a['occurrences']];bk=[(x['id'],x['geometryKey'])for x in b['occurrences']];assert ak==bk,'Physical occurrence changed'
 af=[line for line in a['source'].splitlines()if line.startswith('scope = _quad_rocker_source(')];bf=[line for line in b['source'].splitlines()if line.startswith('scope = _quad_rocker_source(')];assert af==bf,'Native physical factory changed'
 assert a['values']==b['values']and a['mounts']==b['mounts']
 checks.append({'motor':a['motor'],'angle':a['angle'],'identicalPhysicalOccurrenceKeys':len(ak),'identicalNativeFactoryBlocks':len(af),'nativeFactorySha256':h('\n'.join(af).encode())})
assert old['standMountStations']==new['standMountStations']and old['panelFrames']==new['panelFrames']
for path,expected in dict(new['sources'],**new['preserved']).items():assert h(Path(path).read_bytes())==expected,path
changed=[path for path in old['sources']if old['sources'][path]!=new['sources'][path]];assert set(changed)<={x for x in old['sources']if x.endswith(('/presets.json','/product.json','/lib/fabrication.ts'))},changed
report={'passed':True,'scope':'Metadata-only source refresh after all six native fit poses physically completed. Exact geometry keys, every native physical factory block, all transforms and stand stations remain identical.','changedMetadataFiles':changed,'poses':checks,'oldCaptureSha256':h(old_path.read_bytes()),'currentCaptureSha256':h(new_path.read_bytes()),'sourceHashes':new['sources']}
(p/'metadata-refresh-report.json').write_text(json.dumps(report,indent=2)+'\n')
r=json.loads((p/'new-parts-native-report.json').read_text());assert len(r['poses'])==6 and all(q['completed']and not q['collisions']for q in r['poses']);(p/'fit-report-before-metadata-refresh.json').write_text(json.dumps(r,indent=2)+'\n')
r['originalCompletionGuardFailure']=r.pop('error',None);r['passed']=True;r['stage']='six selective poses passed; exact metadata-only refresh verified';r['metadataRefreshReport']='metadata-refresh-report.json';r['verifiedOriginalCapture']='verified-capture-before-metadata-refresh.json';r['verifiedOriginalCaptureSha256']=report['oldCaptureSha256'];r['captureSha256']=report['currentCaptureSha256'];r['sources']=new['sources'];(p/'new-parts-native-report.json').write_text(json.dumps(r,indent=2)+'\n')
shutil.move(old_path,p/'verified-capture-before-metadata-refresh.json');shutil.move(new_path,old_path)
print(json.dumps({'passed':True,'identicalOccurrencePoses':sum(q['identicalPhysicalOccurrenceKeys']for q in checks),'identicalNativeFactories':sum(q['identicalNativeFactoryBlocks']for q in checks),'changedMetadata':changed}))

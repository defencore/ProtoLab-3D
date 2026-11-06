import sys,json,hashlib,csv,zipfile
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App, Part, MeshPart
from rocket_guided_source_bindings import verify_source_bindings
folder=Path(sys.argv[1]).resolve()
report=json.loads((folder/'guided-review-report.json').read_text());assert report['passed']
manifest=json.loads((folder/'review-manifest.json').read_text())
source_amendment=verify_source_bindings(manifest,folder.parent/'source-amendment.json')
out=folder/'prototype-kit';out.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
record=next(r for r in manifest['records'] if r['state']=='assembled')
macro=(folder/record['macroFile']).read_bytes();assert sha(macro)==record['macroSHA256']
doc=App.newDocument('RocketCameraNoseFinal')
exec(compile(macro.decode(),'assembled.FCMacro','exec'),{})
features=lambda d:sorted([o for o in d.Objects if o.isDerivedFrom('Part::Feature') and hasattr(o,'ComponentIndex')],key=lambda o:o.ComponentIndex)
units=features(doc);assert len(units)==len(record['components'])
identity=lambda f:{k:str(getattr(f,k))for k in f.PropertiesList if f.getTypeIdOfProperty(k) in ('App::PropertyString','App::PropertyStringList')}
before=[{'identity':identity(f),'volume':f.Shape.Volume,'faces':len(f.Shape.Faces)}for f in units]
fcstd=out/('rocket-camera-nose-'+manifest['presetId']+'.FCStd');doc.recompute();doc.saveAs(str(fcstd));App.closeDocument(doc.Name)
restored=App.openDocument(str(fcstd));after=features(restored);assert len(after)==len(record['components'])
for a,b in zip(before,after):
 assert identity(b)==a['identity'];assert b.Shape.isValid() and b.Shape.isClosed();assert len(b.Shape.Faces)==a['faces'];assert abs(b.Shape.Volume-a['volume'])<max(1e-6,a['volume']*1e-9)
App.closeDocument(restored.Name)
printing=next(r for r in manifest['records'] if r['state']=='print-layout')
snap=folder/'native-cache'/printing['macroSHA256']/'snapshot.json';snapshot=json.loads(snap.read_text());lookup={r['id']:r for r in snapshot['records']}
rows=[]
for comp in printing['components']:
 id=comp['id'];r=lookup[id];data=(snap.parent/r['file']).read_bytes();assert sha(data)==r['brepSHA256']
 s=Part.Shape();s.importBrepFromString(data.decode());bb=s.optimalBoundingBox(False,False);assert max(bb.XLength,bb.YLength,bb.ZLength)<=256+1e-6;s.translate(App.Vector(-(bb.XMin+bb.XMax)/2,-(bb.YMin+bb.YMax)/2,-bb.ZMin))
 mesh=MeshPart.meshFromShape(Shape=s,LinearDeflection=.025,AngularDeflection=.08,Relative=False);assert mesh.isSolid() and mesh.Volume>0
 material=comp['manufacturing']['material'];name=material+'-'+id+'.stl';mesh.write(str(out/name));rows.append({'id':id,'material':material,'file':name,'quantity':1,'sizeX':round(bb.XLength,3),'sizeY':round(bb.YLength,3),'sizeZ':round(bb.ZLength,3)})
assert len(rows)==len(printing['components'])
with (out/'printed-parts.csv').open('w',newline='')as f:
 writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
with (out/'assembly-bom.csv').open('w',newline='')as f:
 writer=csv.writer(f);writer.writerow(['Occurrence ID','Name','Quantity','Library ID','Preset ID','Supply','Material'])
 for c in record['components']:writer.writerow([c['id'],c['name'],c['quantity'],c['libraryId'],c.get('presetId',''),c['supply'],c.get('manufacturing',{}).get('material','')])
original=manifest['parameters']['cameraSetup']=='camera-19'
screw_count=sum(c['quantity'] for c in record['components'] if c['libraryId']=='bolt-screw')
case_height=next(row['sizeZ'] for row in rows if row['id']=='outer-shell')
readme=f'''Prototype fit kit — rocket-camera-nose:{manifest['presetId']}

Units: millimetres. Aluminum tube90/86mm; installed length240mm.
{len(rows)} individually centered and grounded STL parts. Use the reviewed orientations; filenames and printed-parts.csv identify materials. The19mm camera execution also uses two separate machined compression sleeves listed in assembly-bom.csv.

One continuous {case_height:g} mm outer case prints tip-down. Cage base prints on its broad back; cage cover and auxiliary keeper print rear-up. Check each part separately in the slicer; the overview layout is not one combined256mm plate. Use the actual process/material profile and review the rounded start, brim and remaining local bridges. CAD layer screening is not slicer toolpaths or a support/strength qualification.

Build adapter+SSD, load TPU and electronics on the open base, assemble the selected camera in its open rear cradle and front objective liner, prepare the common closing cage with tracker/finder forms, connect the CSI/PCIe leads, close the cage, then connect GPIO/UPS power through the dedicated bench-access openings. {screw_count} screws total:4shared tube/case/cageM4,2common cageM4,{'2cameraM2.5,' if original else ''}1accessory keeperM3 and1SSD M2. Insert the fully wired camera-first cassette into the open rear of the case, then seat the complete unit in the aluminum tube and install the four shared pins. The rigid case/cage are common to both single-camera executions; the two TPU optical cartridge parts are source-specific. OV rear support bears at the four mounting-hole zones, with a relief chamber for rear components; verify the delivered module before use.

Tube holes are opposed0/180-degree columns atZ=-20/-32mm relative to the nose/tube shoulder. Existing99/261-degree holes are unused; check the actual tube pattern before manufacture. Remove all four tube pins before withdrawing the complete cassette for Ethernet service.

{len(record['components'])} source-bound physical units and{len(rows)} prints passed the accompanying native geometry, assembly/access, retention and export checks. Existing library references retain their documented fidelity limits. Physical fits, actual connectors and wiring, ribbon bend/twist limits, thermal performance and fastener preload/locking need hardware qualification. Peak deployment acceleration and printed allowables remain unknown; this kit is not a demonstrated15kg lifting, vibration, impact or flight rating.

See GUIDE.md and verification-summary.json for the exact revision, evidence and remaining work.
'''
(out/'README.txt').write_text(readme)
(out/'GUIDE.md').write_text(Path('src/parts/rocket-camera-nose/GUIDE.md').read_text())
retention=json.loads((folder/'retention-probe-report.json').read_text());assert retention['passed']
verification={'presetId':manifest['presetId'],'sourceMacroSHA256':record['macroSHA256'],'manifestSHA256':sha((folder/'review-manifest.json').read_bytes()),'geometryPassed':report['passed'],'nativePaths':len(report['motions']),'retentionProbeGroups':len(retention['groups']),'retentionPassed':retention['passed'],'printedParts':len(rows),'fcstdRoundTrip':{'passed':True,'occurrences':len(record['components']),'bytes':fcstd.stat().st_size},'files':[{ 'name':p.name,'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())}for p in out.iterdir()if p.is_file()]}
verification['exporterSHA256']=sha(Path(__file__).read_bytes())
if source_amendment: verification['catalogProseAmendment']=source_amendment
(out/'verification-summary.json').write_text(json.dumps(verification,indent=2)+'\n')
archive=folder/('rocket-camera-nose-'+manifest['presetId']+'-prototype-kit.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED)as z:
 for p in sorted(out.iterdir()):z.write(p,p.name)
(folder/'export-roundtrip-report.json').write_text(json.dumps(verification,indent=2)+'\n')
print(json.dumps({'archive':str(archive),'archiveBytes':archive.stat().st_size,'prints':len(rows),'fcstdRoundTrip':True,'occurrences':len(record['components'])}))

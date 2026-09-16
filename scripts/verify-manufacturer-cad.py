"""Compare baked native solids and a generated macro with original STEP geometry.
Usage: FreeCAD-Python verify-manufacturer-cad.py family folder original.step case.json report.json
The case JSON has script, parameters and state from the production generator.
"""
import base64,hashlib,json,os,sys,tempfile,time,zlib
from pathlib import Path
sys.path.insert(0,os.environ.get('FREECAD_LIB','/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App,Part
family,folder,original_path,case_path,report_path=sys.argv[1:6]
root=Path(__file__).resolve().parents[1]
native=json.loads((root/'src/parts'/family/'lib'/folder/'native.json').read_text())
source=Part.Shape(); source.read(original_path)
assert hashlib.sha256(Path(original_path).read_bytes()).hexdigest()==native['sourceSha256']
assert len(source.Solids)==native['sourceSolids']==len(native['components'])
case=json.loads(Path(case_path).read_text())
doc=App.newDocument('SourceComparison')
started=time.perf_counter()
print('executing production macro',flush=True)
exec(case['script'],{})
print('macro complete',flush=True)
objects=list(doc.RootObjects[0].Group)
assert len(objects)==len(source.Solids)
max_bounds=max_volume=max_difference=0
boolean_comparisons=exact_brep_comparisons=surface_comparisons=0

def boundary_signature(shape):
 def row(item,measure):
  c=item.CenterOfMass
  return tuple(round(v,5) for v in [getattr(item,measure),c.x,c.y,c.z])
 return {
  'vertices': sorted(tuple(round(c,5) for c in v.Point) for v in shape.Vertexes),
  'edges': sorted(row(e,'Length') for e in shape.Edges),
  'faces': sorted((type(f.Surface).__name__,)+row(f,'Area') for f in shape.Faces),
 }

def matching_surfaces(a,b,tolerance=1e-7):
 # Avoid rounding-boundary false negatives while also comparing surface points.
 if (len(a.Vertexes),len(a.Edges),len(a.Faces))!=(len(b.Vertexes),len(b.Edges),len(b.Faces)): return False
 if any((v.Point-w.Point).Length>tolerance for v,w in zip(a.Vertexes,b.Vertexes)): return False
 if any(abs(v.Length-w.Length)>tolerance or (v.CenterOfMass-w.CenterOfMass).Length>tolerance for v,w in zip(a.Edges,b.Edges)): return False
 for x,y in zip(a.Faces,b.Faces):
  if type(x.Surface)!=type(y.Surface) or abs(x.Area-y.Area)>tolerance or (x.CenterOfMass-y.CenterOfMass).Length>tolerance: return False
  u0,u1,v0,v1=x.ParameterRange; r0,r1,s0,s1=y.ParameterRange
  for u,v in [(0,0),(1,0),(0,1),(1,1),(.25,.25),(.5,.5),(.75,.75)]:
   if (x.valueAt(u0+u*(u1-u0),v0+v*(v1-v0))-y.valueAt(r0+u*(r1-r0),s0+v*(s1-s0))).Length>tolerance:return False
 return True

for i,(original,c,obj) in enumerate(zip(source.Solids,native['components'],objects)):
 expected=original.copy()
 expected.rotate(App.Vector(),App.Vector(0,0,1),native['transform']['rotate'])
 expected.translate(App.Vector(*native['transform']['shift']))
 if case['state']=='exploded': expected.translate(App.Vector(0,0,c['layer']*10))
 actual=obj.Shape
 assert actual.isValid() and actual.isClosed() and len(actual.Solids)==1 and actual.Volume>0,(i,'invalid')
 a=actual.optimalBoundingBox(False,False);b=expected.optimalBoundingBox(False,False)
 err=max(abs(getattr(a,k)-getattr(b,k)) for k in ['XMin','YMin','ZMin','XMax','YMax','ZMax'])
 max_bounds=max(max_bounds,err);assert err<1e-5,(i,'bounds',err)
 max_volume=max(max_volume,abs(actual.Volume-expected.Volume))
 if boundary_signature(actual)!=boundary_signature(expected):
  if matching_surfaces(actual,expected):
   surface_comparisons+=1
   print('source boundary/surface comparison',i,flush=True)
   continue
  # Prove unchanged source geometry directly when possible. OCC booleans on
  # coincident, heavily trimmed connector faces can return the entire solid.
  # Byte-identical canonical BREP + the source-derived instance transform is
  # stronger evidence than a boolean or rounded boundary fingerprint.
  canonical=original.copy()
  canonical.rotate(App.Vector(),App.Vector(0,0,1),native['transform']['rotate'])
  canonical.translate(App.Vector(*native['transform']['shift']))
  placement=canonical.Placement
  canonical.Placement=App.Placement()
  center=canonical.CenterOfMass;canonical.translate(-center)
  raw=zlib.decompress(base64.b64decode(native['templates'][c['template']]['brep'])).decode()
  if canonical.exportBrepToString()==raw:
   matrix=list(placement.multiply(App.Placement(center,App.Rotation())).Matrix.A)
   assert max(abs(a-b) for a,b in zip(matrix,c['matrix']))<1e-12,(i,'source transform')
   restored=Part.Shape();restored.importBrepFromString(raw)
   restored.Placement=App.Placement(App.Matrix(*matrix)).multiply(restored.Placement)
   restored.translate(App.Vector(0,0,c['layer']*10 if case['state']=='exploded' else 0))
   assert actual.exportBrepToString()==restored.exportBrepToString(),(i,'macro BREP')
   exact_brep_comparisons+=1
   print('source exact BREP comparison',i,flush=True)
   continue
  # Equivalent solids can have different seam vertices / face parametrization.
  # Compare occupied volume directly when their boundary signatures differ.
  left,right=actual.cut(expected),expected.cut(actual)
  assert left.isValid() and right.isValid(),(i,'invalid difference check')
  difference=abs(left.Volume)+abs(right.Volume)
  max_difference=max(max_difference,difference)
  assert difference<1e-7,(i,'source symmetric difference',difference)
  boolean_comparisons+=1
  print('source boolean comparison',i,difference,flush=True)
 if i%200==0:print('source compared',i,flush=True)
with tempfile.TemporaryDirectory(prefix='protolab-native-') as tmp:
 file=str(Path(tmp)/'roundtrip.step');Part.export(objects,file)
 restored=Part.Shape();restored.read(file)
 assert restored.isValid() and len(restored.Solids)==len(objects)
 # OCC integrates a compound with a different error budget from its solids.
 # Compare corresponding solids, not compound.Volume against sum(solid.Volume).
 roundtrip_bounds=roundtrip_relative_volume=roundtrip_absolute_volume=roundtrip_cad_tolerance=roundtrip_volume_budget=0
 restored_solids=restored.Solids
 for obj,solid in zip(objects,restored_solids):
  assert solid.isClosed() and solid.Volume>0
  a=obj.Shape.optimalBoundingBox(False,False);b=solid.optimalBoundingBox(False,False)
  error=max(abs(getattr(a,k)-getattr(b,k)) for k in ['XMin','YMin','ZMin','XMax','YMax','ZMax'])
  assert error<1e-5,('STEP bounds',obj.Label,error)
  roundtrip_bounds=max(roundtrip_bounds,error)
  difference=abs(obj.Shape.Volume-solid.Volume)
  # Small filleted solids can change numerical mass integration after STEP
  # reparameterization. Bound volume drift by a shell of source CAD tolerance,
  # while independently checking bounds and recording aggregate volume drift.
  cad_tolerance=max(1e-7,obj.Shape.getTolerance(1),solid.getTolerance(1))
  volume_tolerance=max(1e-7,max(obj.Shape.Area,solid.Area)*cad_tolerance)
  roundtrip_volume_budget+=volume_tolerance
  assert difference<volume_tolerance,('STEP volume',obj.Label,difference,volume_tolerance)
  roundtrip_cad_tolerance=max(roundtrip_cad_tolerance,cad_tolerance)
  roundtrip_absolute_volume=max(roundtrip_absolute_volume,difference)
  roundtrip_relative_volume=max(roundtrip_relative_volume,difference/obj.Shape.Volume)
 roundtrip_total_difference=abs(sum(s.Volume for s in restored_solids)-sum(o.Shape.Volume for o in objects))
 assert roundtrip_total_difference<roundtrip_volume_budget,('STEP aggregate volume',roundtrip_total_difference,roundtrip_volume_budget)
 fcstd=str(Path(tmp)/'roundtrip.FCStd');labels=[o.Label for o in objects]
 doc.saveAs(fcstd);App.closeDocument(doc.Name);doc=App.openDocument(fcstd)
 assert [o.Label for o in doc.RootObjects[0].Group]==labels
 evidence=json.loads(doc.RootObjects[0].GeometryEvidence)
 assert evidence['sourceSha256']==native['sourceSha256']
report=dict(model=family+'/'+folder,state=case['state'],passed=True,sourceSha256=native['sourceSha256'],
 sourceSolids=len(source.Solids),templates=len(native['templates']),sourceGeometryMatch=True,boundarySignatureMatches=len(objects)-boolean_comparisons-exact_brep_comparisons-surface_comparisons,sampledSurfaceComparisons=surface_comparisons,surfaceComparisonTolerance=1e-7,exactBrepComparisons=exact_brep_comparisons,booleanComparisons=boolean_comparisons,sourceSymmetricDifferenceMax=max_difference,signaturePrecision=0.00001,
 maxBoundsDifference=max_bounds,maxVolumeDifference=max_volume,
 codeSha256=hashlib.sha256(case['script'].encode()).hexdigest(),
 stepRoundtrip=True,fcstdRoundtrip=True,elapsedSeconds=time.perf_counter()-started,
 stepRoundtripMetrics=dict(maxBoundsDifference=roundtrip_bounds,maxAbsoluteVolumeDifference=roundtrip_absolute_volume,maxRelativeVolumeDifference=roundtrip_relative_volume,sumOfSolidVolumesDifference=roundtrip_total_difference,maxSourceOrRestoredCadTolerance=roundtrip_cad_tolerance,volumeDriftLimit='per-solid surface area multiplied by stored CAD tolerance',sumOfPerSolidVolumeBudgets=roundtrip_volume_budget),
 preview=dict(linearDeflection=native['linearDeflection'],angularDeflection=native['angularDeflection'],
 patchedTemplates=sum(bool(t['previewPatches']) for t in native['templates']),
 collapsedEdgeMax=max((v for t in native['templates'] for v in t['previewCollapsedEdges']),default=0),
 sampledPatchSurfaceErrorMax=max((p['maxSampledSurfaceError'] for t in native['templates'] for p in t['previewPatches']),default=0)))
Path(report_path).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
App.closeDocument(doc.Name)

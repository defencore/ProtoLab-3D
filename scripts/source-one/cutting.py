"""Combine the pinned original 2D drawings by rigid translation only."""
from pathlib import Path
import json,hashlib
import ezdxf
from ezdxf import bbox
from ezdxf.addons import Importer
from ezdxf.math import Matrix44
root=Path('/Users/x/Development/3D/ProtoLab-3D')
source=Path('/tmp/frame-redesign')
files=['v5-arm.dxf','SO_V5_BottomPlate_2mm.dxf','SO_V5_MiddlePlate_2mm.dxf','SO_V5_TopPlate_2mm.dxf','SO_V5_CameraPlate_2mm.dxf','SO_V5_CrossPlate_6mm.dxf']
out=ezdxf.new('R2010');out.units=4;x=0;manifest=[]
for name in files:
 path=source/name;doc=ezdxf.readfile(path)
 entities=list(doc.modelspace().query('LWPOLYLINE CIRCLE ARC LINE'))
 b=bbox.extents(entities);before=len(out.modelspace())
 importer=Importer(doc,out);importer.import_entities(entities);importer.finalize()
 layer='SOURCE_'+name.replace('.dxf','').replace('v5-arm','Arm_6mm');out.layers.new(layer)
 for entity in list(out.modelspace())[before:]:
  entity.transform(Matrix44.translate(x-b.extmin.x,-b.extmin.y,0));entity.dxf.layer=layer
 out.modelspace().add_text(name,dxfattribs={'height':3,'insert':(x,-8)})
 manifest.append({'file':name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'entities':len(entities)})
 x+=b.size.x+15
out.modelspace().add_text('SOURCE ONE project / pinned V5 / GPL-3.0-only / original labels retained',dxfattribs={'height':3,'insert':(0,-16)})
path=source/'original-cutting-pack.dxf';out.saveas(path);audit=out.audit();assert not audit.errors
(root/'src/parts/multicopter-frame/lib/cutting.json').write_text(json.dumps({'files':manifest,'dxf':path.read_text()},separators=(',',':')))
print('Original source cut entities',sum(m['entities'] for m in manifest),'DXF errors',len(audit.errors))

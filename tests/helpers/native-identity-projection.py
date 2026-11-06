"""Project only added ESKD identity data out of reviewed native source baselines."""
import ast
import json
import sys
HELPERS={'_cnc_source','_actuator_source','_pl_component'}
def project(code):
 tree=ast.parse(code)
 raw=code.encode()
 lines=code.splitlines(keepends=True)
 offsets=[0]
 for line in lines: offsets.append(offsets[-1]+len(line.encode()))
 edits=[]
 def edit(node,replacement):
  edits.append((offsets[node.lineno-1]+node.col_offset,offsets[node.end_lineno-1]+node.end_col_offset,replacement.encode()))
 def visit(node):
  if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute) and isinstance(node.func.value,ast.Name) and node.func.value.id=='component_metadata' and node.func.attr=='append' and len(node.args)==1:
   item=node.args[0]
   if isinstance(item,ast.Call) and isinstance(item.func,ast.Name) and item.func.id=='dict' and len(item.args)==1 and isinstance(item.args[0],ast.Name) and item.args[0].id=='placed':
    for kw in item.keywords:
     if kw.arg is None and isinstance(kw.value,ast.Dict):
      value=ast.literal_eval(kw.value)
      if 'ESKDIdentityJSON' in value:
       identity=json.loads(value['ESKDIdentityJSON'])
       assert isinstance(identity,dict) and all(isinstance(identity.get(key),str) for key in ['designation','name','revision','configurationKey','supply'])
       del value['ESKDIdentityJSON']
       edit(kw.value,json.dumps(value,ensure_ascii=False,separators=(',',':')))
       return
  if isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id in HELPERS and node.args and isinstance(node.args[0],ast.Constant) and isinstance(node.args[0].value,str) and '\n' in node.args[0].value:
   value=project(node.args[0].value)
   if value!=node.args[0].value:edit(node.args[0],json.dumps(value,ensure_ascii=False,separators=(',',':')))
  for child in ast.iter_child_nodes(node):visit(child)
 visit(tree)
 for start,end,replacement in sorted(edits,reverse=True):raw=raw[:start]+replacement+raw[end:]
 return raw.decode()
sources=json.load(sys.stdin)
assert isinstance(sources,list) and all(isinstance(source,str) for source in sources)
json.dump([project(source) for source in sources],sys.stdout,ensure_ascii=False)

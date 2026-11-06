"""Hash reviewed TR8 occurrences and native programs across Node architectures."""
import ast
import hashlib
import json
import sys
HELPERS={'_cnc_source','_actuator_source','_pl_component'}


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def project_rings(shape):
    if shape['kind'] == 'helical-worm':
        # Only transverse preview samples vary with the platform's trig library.
        # Preserve axial stations, topology and every analytic thread parameter.
        shape['rings'] = [
            [[round(x, 10) or 0, round(y, 10) or 0, z] for x, y, z in ring]
            for ring in shape['rings']
        ]
        return True
    if 'child' in shape:
        return project_rings(shape['child'])
    changed = False
    for child in shape.get('children', []):
        if project_rings(child):
            changed = True
    return changed


def project_recipe(parameters):
    if 'recipe' not in parameters:
        return False
    recipe = json.loads(parameters['recipe'])
    if not project_rings(recipe):
        return False
    parameters['recipe'] = encode(recipe)
    return True


def project_pieces(pieces, portable_preview):
    if not portable_preview:
        return pieces
    records = json.loads(pieces)
    for piece in records:
        project_recipe(piece['component']['parameters'])
    return encode(records)


def project(code, portable_preview):
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
       if portable_preview:
        parameters=json.loads(value['ConfigurationJSON'])
        if project_recipe(parameters):value['ConfigurationJSON']=encode(parameters)
       edit(kw.value,encode(value))
       return
  if isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id in HELPERS and node.args and isinstance(node.args[0],ast.Constant) and isinstance(node.args[0].value,str) and '\n' in node.args[0].value:
   value=project(node.args[0].value,portable_preview)
   if value!=node.args[0].value:edit(node.args[0],encode(value))
  for child in ast.iter_child_nodes(node):visit(child)
 visit(tree)
 for start,end,replacement in sorted(edits,reverse=True):raw=raw[:start]+replacement+raw[end:]
 return raw.decode()

def sha256(value):
    return hashlib.sha256(value.encode()).hexdigest()


if __name__ == '__main__':
    captures = json.load(sys.stdin)
    json.dump([
        {
            'sourceSha256': sha256(project(item['source'], item['portablePreview'])),
            'piecesSha256': sha256(project_pieces(item['pieces'], item['portablePreview'])),
        }
        for item in captures
    ], sys.stdout)
